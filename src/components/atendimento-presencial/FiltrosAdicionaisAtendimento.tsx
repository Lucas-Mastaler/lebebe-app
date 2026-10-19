'use client'
import { FilterFieldGroup, FormField, Input } from '@/components/design-system'
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

export function FiltrosAdicionaisAtendimento({
  value,
  onChange,
  rascunhos = false,
}: {
  value: FiltrosAdicionais
  onChange: (campo: keyof FiltrosAdicionais, valor: string | string[]) => void
  rascunhos?: boolean
}) {
  const prefixo = rascunhos ? 'rascunho' : 'salvo'
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
    return (
      <FormField id={`${prefixo}-${campo}`} label={label}>
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
      </FormField>
    )
  }
  return (
    <>
      <FilterFieldGroup
        className="border-t border-slate-200 pt-4"
        label={
          rascunhos
            ? 'Última atividade e identificação'
            : 'Período do atendimento e identificação'
        }
      >
        <FormField
          id={`${prefixo}-data-de`}
          label={
            rascunhos ? 'Última atividade — de' : 'Início do atendimento — de'
          }
        >
          {(props) => (
            <Input
              {...props}
              type="date"
              value={value.atendimentoDe}
              onChange={(e) => onChange('atendimentoDe', e.target.value)}
            />
          )}
        </FormField>
        <FormField id={`${prefixo}-data-ate`} label="Até">
          {(props) => (
            <Input
              {...props}
              type="date"
              value={value.atendimentoAte}
              onChange={(e) => onChange('atendimentoAte', e.target.value)}
            />
          )}
        </FormField>
        {selecao('tipoAtendimento', 'Tipo de atendimento', [
          { chave: 'cliente', label: 'Cliente' },
          { chave: 'nao_cliente', label: 'Não cliente' },
          ...(rascunhos
            ? [{ chave: 'nao_informado', label: 'Tipo não informado' }]
            : []),
        ])}
        <FormField id={`${prefixo}-telefone`} label="Telefone da cliente">
          {(props) => (
            <Input
              {...props}
              inputMode="tel"
              value={value.telefoneCliente}
              onChange={(e) => onChange('telefoneCliente', e.target.value)}
              placeholder="Telefone ou trecho"
            />
          )}
        </FormField>
        {selecao('contato', 'Telefone disponível', [
          { chave: 'com', label: 'Com telefone' },
          { chave: 'sem', label: 'Sem telefone' },
        ])}
        {!rascunhos && (
          <FormField id="salvo-lancamento" label="Número do lançamento">
            {(props) => (
              <Input
                {...props}
                inputMode="numeric"
                value={value.numeroLancamento}
                onChange={(e) => onChange('numeroLancamento', e.target.value)}
              />
            )}
          </FormField>
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
        <FilterFieldGroup label="Interesses e motivos" className="border-t border-slate-200 pt-4">
          <FormField
            id="salvo-departamentos"
            label="Departamentos de interesse"
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
          </FormField>
          <FormField id="salvo-motivos" label="Motivos da negociação/perda">
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
          </FormField>
          {selecao('motivoVisita', 'Motivo da visita', OPCOES_VISITA_FILTRO)}
        </FilterFieldGroup>
      )}
    </>
  )
}
