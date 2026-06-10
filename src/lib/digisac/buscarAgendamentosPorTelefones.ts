import { fetchDigisac } from './clienteDigisac';
import { gerarVariacoesTelefone } from './sgi-sync';
import { formatarDataPtBr, formatarHoraPtBr } from './formatadores';
import type { Agendamento } from '@/types';

/**
 * Busca agendamentos futuros no Digisac para um conjunto de telefones,
 * filtrando apenas agendamentos com scheduledAt > dataFechamento da venda.
 *
 * Fluxo:
 * 1. Gerar variações de telefone (com/sem DDI, com/sem nono dígito)
 * 2. Buscar contactIds no Digisac via GET /contacts?where[$or][data.number][$iLike]=...
 * 3. Para cada contactId, buscar /schedule?where[contactId]=...
 * 4. Filtrar scheduledAt > dataFechamento
 * 5. Enriquecer com tags do contato e retornar no formato Agendamento
 */
export async function buscarAgendamentosFuturos(
  telefones: string[],
  dataFechamento: string
): Promise<Agendamento[]> {
  if (telefones.length === 0) return [];

  // 1. Gerar todas as variações de telefone
  const variacoes = Array.from(
    new Set(
      telefones.flatMap((t) => gerarVariacoesTelefone(t))
    )
  ).filter((v) => v.length >= 8);

  if (variacoes.length === 0) return [];

  console.log(`[AGENDAMENTOS-FUTUROS] Variações de telefone:`, variacoes);

  // 2. Buscar contactIds no Digisac por data.number
  // Monta query com $or para todas as variações
  const contactIds = await buscarContactIdsPorTelefones(variacoes);

  if (contactIds.length === 0) {
    console.log(`[AGENDAMENTOS-FUTUROS] Nenhum contactId encontrado para as variações.`);
    return [];
  }

  console.log(`[AGENDAMENTOS-FUTUROS] ContactIds encontrados:`, contactIds);

  // 3. Buscar agendamentos por contactId (um por vez, mais confiável)
  const agendamentosRaw: unknown[] = [];
  for (const contactId of contactIds) {
    try {
      const schedules = await buscarSchedulesPorContactId(contactId);
      agendamentosRaw.push(...schedules);
    } catch (err) {
      console.warn(`[AGENDAMENTOS-FUTUROS] Erro ao buscar schedules para contactId=${contactId}:`, err);
    }
  }

  console.log(`[AGENDAMENTOS-FUTUROS] Total schedules antes do filtro de data:`, agendamentosRaw.length);

  // 4. Filtrar scheduledAt > dataFechamento (comparação exata, não início do dia)
  const dataFechamentoMs = new Date(dataFechamento).getTime();
  const futuros = agendamentosRaw.filter((item) => {
    const schedule = item as { scheduledAt?: string };
    if (!schedule.scheduledAt) return false;
    return new Date(schedule.scheduledAt).getTime() > dataFechamentoMs;
  });

  console.log(`[AGENDAMENTOS-FUTUROS] Após filtro scheduledAt > ${dataFechamento}: ${futuros.length}`);

  // 5. Transformar para o tipo Agendamento
  return futuros.map((raw) => transformarParaAgendamento(raw));
}

/**
 * Busca contactIds no Digisac usando o campo data.number com $iLike.
 * Monta um $or com todas as variações de telefone.
 */
async function buscarContactIdsPorTelefones(variacoes: string[]): Promise<string[]> {
  // Monta query JSON como a API Digisac usa
  // Exemplo real: ?where[visible]=true&where[$or][data.number][$iLike]=%NUMERO%
  // Para múltiplas variações, usamos índices no array $or
  const params = new URLSearchParams();
  params.append('where[visible]', 'true');
  params.append('perPage', '50');

  // Monta $or para cada variação
  variacoes.forEach((variacao, index) => {
    params.append(`where[$or][${index}][data.number][$iLike]`, `%${variacao}%`);
  });

  const url = `/contacts?${params.toString()}`;
  console.log(`[AGENDAMENTOS-FUTUROS] Buscando contatos: GET /contacts (${variacoes.length} variações)`);

  try {
    const res = await fetchDigisac(url);
    const itens: unknown[] = Array.isArray(res) ? res : ((res as { rows?: unknown[] })?.rows || (res as { data?: unknown[] })?.data || []);
    const ids = itens.map((c) => (c as { id?: string }).id).filter((id): id is string => Boolean(id));
    return Array.from(new Set(ids));
  } catch (err) {
    console.error(`[AGENDAMENTOS-FUTUROS] Erro ao buscar contatos por telefone:`, err);
    return [];
  }
}

/**
 * Busca schedules de um contactId específico no Digisac.
 * Usa GET /schedule?where[contactId]=ID com includes de contact, department e user.
 */
async function buscarSchedulesPorContactId(contactId: string): Promise<unknown[]> {
  const params = new URLSearchParams();
  params.append('where[contactId]', contactId);
  params.append('include[0][model]', 'contact');
  params.append('include[1][model]', 'department');
  params.append('include[2][model]', 'user');
  params.append('perPage', '100');
  params.append('order[0][0]', 'scheduledAt');
  params.append('order[0][1]', 'ASC');

  const url = `/schedule?${params.toString()}`;

  const res = await fetchDigisac(url);
  const itens: unknown[] = Array.isArray(res) ? res : ((res as { rows?: unknown[] })?.rows || (res as { data?: unknown[] })?.data || []);
  return itens;
}

/**
 * Transforma o raw schedule da API Digisac no tipo Agendamento do projeto.
 */
function transformarParaAgendamento(raw: unknown): Agendamento {
  const schedule = raw as {
    contact?: unknown;
    scheduledAt?: string;
    status?: string;
    id?: string;
    message?: string;
    data?: { message?: string };
    notes?: string;
    department?: { name?: string };
    user?: { name?: string };
    createdAt?: string;
    updatedAt?: string;
    accountId?: string;
    departmentId?: string;
    userId?: string;
    contactId?: string;
    openTicket?: boolean;
    notificateUser?: boolean;
  };
  const contactBasic = (schedule.contact || {}) as { tags?: unknown[]; name?: string; internalName?: string };

  const tags: string = contactBasic.tags
    ? (contactBasic.tags as { name?: string; label?: string; title?: string; tag?: { name?: string } }[])
        .map((t) => t.name || t.label || t.title || t.tag?.name || '')
        .filter((s) => s.trim().length > 0)
        .join(', ')
    : '';

  const status = schedule.status || 'scheduled';
  let statusLabel = 'Agendado';
  let statusBadgeVariant: 'info' | 'success' | 'destructive' = 'success';

  if (status === 'done') {
    statusLabel = 'Finalizado';
    statusBadgeVariant = 'info';
  } else if (status === 'error' || status === 'canceled') {
    statusLabel = 'Erro/Cancelado';
    statusBadgeVariant = 'destructive';
  }

  return {
    id: schedule.id || '',
    accountId: schedule.accountId || '',
    departmentId: schedule.departmentId || '',
    userId: schedule.userId || '',
    contactId: schedule.contactId || '',

    loja: schedule.department?.name || '',
    consultora: schedule.user?.name || '',
    nomeWhatsapp: contactBasic.name || '',
    nomeDigisac: contactBasic.internalName || '',
    mensagemAgendada: schedule.message || schedule.data?.message || '',
    comentario: schedule.notes || '',
    tags,

    statusChamado: '',
    ultimoChamadoFechado: '',

    statusCode: status,
    statusLabel,
    statusBadgeVariant,

    abrirTicketLabel: schedule.openTicket ? 'Sim' : 'Não',
    notificarLabel: schedule.notificateUser ? 'Sim' : 'Não',

    agendadoDia: formatarDataPtBr(schedule.scheduledAt || ''),
    agendadoHora: formatarHoraPtBr(schedule.scheduledAt || ''),
    criadoEm: formatarDataPtBr(schedule.createdAt || ''),
    atualizadoEm: formatarDataPtBr(schedule.updatedAt || ''),
  } as unknown as Agendamento;
}
