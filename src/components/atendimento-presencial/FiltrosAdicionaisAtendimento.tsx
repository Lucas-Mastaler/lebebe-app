'use client'
import { CalendarDays, Heart } from 'lucide-react'
import {
  FilterChips,
  FilterField,
  FilterFieldGroup,
  Input,
  useFilterPanelVariant,
} from '@/components/design-system'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MultiSelect } from '@/components/ui/multi-select'
import {
  DEPARTAMENTOS_INTERESSE,
  MOTIVOS_NEGOCIACAO,
  MOTIVOS_RESULTADO_GRUPOS,
  MOTIVOS_VENDA_PERDIDA,
  MOTIVOS_VISITA,
  MOTIVOS_VISITA_HISTORICOS,
} from '@/lib/atendimento-presencial/ficha-schema'
import type { FiltrosAdicionais } from '@/lib/atendimento-presencial/filtros-listagem'
import { PARENTESCOS_CLIENTE } from '@/lib/atendimento-presencial/clientes'

export const OPCOES_MOTIVOS_FILTRO = Array.from(
  new Map(
    [
      ...MOTIVOS_VENDA_PERDIDA,
      ...MOTIVOS_NEGOCIACAO,
      ...MOTIVOS_RESULTADO_GRUPOS.flatMap((grupo) => [...grupo.motivos]),
    ].map((item) => [item.chave, item]),
  ).values(),
)
export const OPCOES_VISITA_FILTRO = Array.from(
  new Map(
    [...MOTIVOS_VISITA, ...MOTIVOS_VISITA_HISTORICOS].map((item) => [
      item.chave,
      item,
    ]),
  ).values(),
)

const MAX_OPCOES_CHIPS = 2

export function FiltrosAdicionaisAtendimento({
  value,
  onChange,
  rascunhos = false,
  ocultarTelefone = false,
}: {
  value: FiltrosAdicionais
  onChange: (campo: keyof FiltrosAdicionais, valor: string | string[]) => void
  rascunhos?: boolean
  ocultarTelefone?: boolean
}) {
  const v2 = useFilterPanelVariant() === 'v2'
  const prefixo = rascunhos ? 'rascunho' : 'salvo'
  const separadorV1 = v2 ? undefined : 'border-t border-slate-200 pt-4'
  function selecao(
    campo:
      | 'tipoAtendimento'
      | 'contato'
      | 'motivoVisita'
      | 'vinculoCliente'
      | 'expiracao',
    label: string,
    opcoes: Array<{ chave: string; label: string }>,
  ) {
    const id = `${prefixo}-${campo}`
    if (v2 && opcoes.length <= MAX_OPCOES_CHIPS) {
      return (
        <FilterField id={id} label={label} active={Boolean(value[campo])}>
          {(props) => (
            <FilterChips
              id={props.id}
              aria-label={label}
              value={value[campo]}
              onChange={(v) => onChange(campo, v)}
              options={[
                { value: '', label: 'Todos' },
                ...opcoes.map((o) => ({ value: o.chave, label: o.label })),
              ]}
            />
          )}
        </FilterField>
      )
    }
    return (
      <FilterField id={id} label={label} active={Boolean(value[campo])}>
        {(props) => (
          <Select
            value={value[campo] || 'all'}
            onValueChange={(v) => onChange(campo, v === 'all' ? '' : v)}
          >
            <SelectTrigger {...props} className="w-full min-w-0">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {opcoes.map((o) => (
                <SelectItem key={o.chave} value={o.chave}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FilterField>
    )
  }
  return (
    <>
      <FilterFieldGroup
        prominent={!rascunhos}
        className={separadorV1}
        icon={v2 ? <CalendarDays /> : undefined}
        description="Quando o atendimento começou e como identificar o registro."
        label={
          rascunhos
            ? 'Última atividade e identificação'
            : 'Período do atendimento e identificação'
        }
      >
        <FilterField
          id={`${prefixo}-data-de`}
          label={
            rascunhos ? 'Última atividade — de' : 'Início do atendimento — de'
          }
          active={Boolean(value.atendimentoDe)}
        >
          {(props) => (
            <Input
              {...props}
              type="date"
              value={value.atendimentoDe}
              onChange={(e) => onChange('atendimentoDe', e.target.value)}
            />
          )}
        </FilterField>
        <FilterField id={`${prefixo}-data-ate`} label="Até" active={Boolean(value.atendimentoAte)}>
          {(props) => (
            <Input
              {...props}
              type="date"
              value={value.atendimentoAte}
              onChange={(e) => onChange('atendimentoAte', e.target.value)}
            />
          )}
        </FilterField>
        {selecao('tipoAtendimento', 'Tipo de atendimento', [
          { chave: 'cliente', label: 'Cliente' },
          { chave: 'nao_cliente', label: 'Não cliente' },
          ...(rascunhos
            ? [{ chave: 'nao_informado', label: 'Tipo não informado' }]
            : []),
        ])}
        {!ocultarTelefone && <FilterField id={`${prefixo}-telefone`} label="Telefone da cliente" active={Boolean(value.telefoneCliente)}>
          {(props) => (
            <Input
              {...props}
              inputMode="tel"
              value={value.telefoneCliente}
              onChange={(e) => onChange('telefoneCliente', e.target.value)}
              placeholder="Telefone ou trecho"
            />
          )}
        </FilterField>}
        {selecao('contato', 'Telefone disponível', [
          { chave: 'com', label: 'Com telefone' },
          { chave: 'sem', label: 'Sem telefone' },
        ])}
        {!rascunhos && (
          <FilterField id="salvo-lancamento" label="Número do lançamento" active={Boolean(value.numeroLancamento)}>
            {(props) => (
              <Input
                {...props}
                inputMode="numeric"
                value={value.numeroLancamento}
                onChange={(e) => onChange('numeroLancamento', e.target.value)}
              />
            )}
          </FilterField>
        )}
        {rascunhos &&
          selecao('vinculoCliente', 'Cadastro vinculado', [
            { chave: 'com', label: 'Com cliente vinculado' },
            { chave: 'sem', label: 'Sem cliente vinculado' },
          ])}
        {rascunhos &&
          selecao('expiracao', 'Expiração', [
            { chave: '24h', label: 'Expira nas próximas 24 horas' },
          ])}
      </FilterFieldGroup>
      {!rascunhos && (
        <FilterFieldGroup
          label="Interesses e motivos"
          className={separadorV1}
          prominent
          icon={v2 ? <Heart /> : undefined}
          description="O que a cliente buscou, o resultado da negociação e o motivo da visita."
        >
          <FilterField
            id="salvo-departamentos"
            label="Departamentos de interesse"
            active={value.departamentos.length > 0}
          >
            {() => (
              <MultiSelect
                placeholder="Todos os departamentos"
                options={DEPARTAMENTOS_INTERESSE.map((o) => o.label)}
                selected={DEPARTAMENTOS_INTERESSE.filter((o) =>
                  value.departamentos.includes(o.chave),
                ).map((o) => o.label)}
                onChange={(labels) =>
                  onChange(
                    'departamentos',
                    DEPARTAMENTOS_INTERESSE.filter((o) =>
                      labels.includes(o.label),
                    ).map((o) => o.chave),
                  )
                }
              />
            )}
          </FilterField>
          <FilterField id="salvo-motivos" label="Motivos da negociação/perda" active={value.motivos.length > 0}>
            {() => (
              <MultiSelect
                enableSearch
                placeholder="Todos os motivos"
                options={OPCOES_MOTIVOS_FILTRO.map((o) => o.label)}
                selected={OPCOES_MOTIVOS_FILTRO.filter((o) =>
                  value.motivos.includes(o.chave),
                ).map((o) => o.label)}
                onChange={(labels) =>
                  onChange(
                    'motivos',
                    OPCOES_MOTIVOS_FILTRO.filter((o) =>
                      labels.includes(o.label),
                    ).map((o) => o.chave),
                  )
                }
              />
            )}
          </FilterField>
          <FilterField id="salvo-parentescos" label="Parentesco da criança" active={value.parentescos.length > 0}>
            {() => (
              <MultiSelect
                placeholder="Todos os parentescos"
                options={PARENTESCOS_CLIENTE.map((o) => o.label)}
                selected={PARENTESCOS_CLIENTE.filter((o) =>
                  value.parentescos.includes(o.label),
                ).map((o) => o.label)}
                onChange={(labels) =>
                  onChange(
                    'parentescos',
                    PARENTESCOS_CLIENTE.filter((o) => labels.includes(o.label)).map(
                      (o) => o.label,
                    ),
                  )
                }
              />
            )}
          </FilterField>
          {selecao('motivoVisita', 'Motivo da visita', OPCOES_VISITA_FILTRO)}
        </FilterFieldGroup>
      )}
    </>
  )
}
