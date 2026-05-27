import { fetchDigisacRaw } from './clienteDigisac';

export async function transferirContatoParaDepartamento(params: {
  contactId: string;
  departmentId: string;
}): Promise<void> {
  const botUserId = process.env.DIGISAC_BOT_USER_ID;

  if (!botUserId) {
    throw new Error('DIGISAC_BOT_USER_ID não configurado');
  }

  const response = await fetchDigisacRaw(`/contacts/${params.contactId}/ticket/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      departmentId: params.departmentId,
      userId: null,
      comments: '',
      byUserId: botUserId,
    }),
  });

  const textoResposta = await response.text().catch(() => '');

  if (!response.ok) {
    throw new Error(
      `Erro ao transferir contato no Digisac. Status=${response.status}. Body=${textoResposta}`
    );
  }

  console.log(
    `[DIGISAC-TRIAGEM] transferência aceita pelo Digisac status=${response.status} body=${textoResposta}`
  );
}
