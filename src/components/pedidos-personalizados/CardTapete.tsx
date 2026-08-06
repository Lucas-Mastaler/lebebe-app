'use client'

import { ArrowDown, ArrowUp, Circle, RectangleHorizontal, Shapes, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { mascararMedidaMetros } from '@/lib/pedidos-personalizados'
import type { FormatoTapeteMoriah, ProblemaPedidoPersonalizado } from '@/lib/pedidos-personalizados'
import { alterarFormatoTapete, resumirTapete } from './novo-pedido-modelo'
import type { CorOpcao, ProdutoOpcao, TapeteFormulario } from './novo-pedido-modelo'
import { SeletorCores } from './SeletorCores'

type Props = {
  tapete: TapeteFormulario
  indice: number
  total: number
  produtos: readonly ProdutoOpcao[]
  cores: readonly CorOpcao[]
  erros: readonly ProblemaPedidoPersonalizado[]
  camposTocados: ReadonlySet<string>
  tentouSalvar: boolean
  disabled?: boolean
  onChange: (tapete: TapeteFormulario) => void
  onMover: (direcao: -1 | 1) => void
  onRemover: () => void
  onLimiteCores: () => void
  onTocar: (campo: string) => void
}

const formatos: Array<{
  valor: FormatoTapeteMoriah
  label: string
  Icone: typeof Circle
}> = [
  { valor: 'REDONDO', label: 'Redondo', Icone: Circle },
  { valor: 'RETANGULAR', label: 'Retangular', Icone: RectangleHorizontal },
  { valor: 'ORGANICO', label: 'Orgânico', Icone: Shapes },
]

function ErroCampo({ mensagens, id }: { mensagens: string[]; id: string }) {
  if (mensagens.length === 0) return null
  return <p id={id} role="alert" className="mt-1 text-sm text-red-600">{mensagens[0]}</p>
}

export function CardTapete({
  tapete,
  indice,
  total,
  produtos,
  cores,
  erros,
  camposTocados,
  tentouSalvar,
  disabled,
  onChange,
  onMover,
  onRemover,
  onLimiteCores,
  onTocar,
}: Props) {
  const numero = indice + 1
  const base = `tapetes.${indice}`
  const resumo = resumirTapete(tapete, produtos)
  const mensagens = (campo: string) => {
    const caminho = `${base}.${campo}`
    if (!tentouSalvar && !camposTocados.has(caminho)) return []
    return erros.filter((item) => item.campo === caminho).map((item) => item.mensagem)
  }
  const campo = (chave: keyof TapeteFormulario, valor: string) => onChange({ ...tapete, [chave]: valor })
  const segundaMedida = tapete.formato === 'ORGANICO' ? 'Maior comprimento' : 'Comprimento'
  const primeiraMedida = tapete.formato === 'REDONDO'
    ? 'Diâmetro'
    : tapete.formato === 'ORGANICO' ? 'Maior largura' : 'Largura'

  return (
    <article id={`tapete-${numero}`} className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#00A5E6]">Tapete</p>
          <h3 className="text-xl font-bold text-slate-900">TAPETE {numero}</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" className="size-11" disabled={disabled || indice === 0} onClick={() => onMover(-1)} aria-label={`Mover tapete ${numero} para cima`}>
            <ArrowUp />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="size-11" disabled={disabled || indice === total - 1} onClick={() => onMover(1)} aria-label={`Mover tapete ${numero} para baixo`}>
            <ArrowDown />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="size-11 text-red-600 hover:text-red-700" disabled={disabled || total === 1} onClick={onRemover} aria-label={`Remover tapete ${numero}`}>
            <Trash2 />
          </Button>
        </div>
      </header>

      <div className="space-y-6">
        <fieldset disabled={disabled}>
          <legend className="mb-3 font-semibold text-slate-800">Formato</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {formatos.map(({ valor, label, Icone }) => {
              const ativo = tapete.formato === valor
              return (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => onChange(alterarFormatoTapete(tapete, valor))}
                  className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[#00A5E6] ${
                    ativo ? 'border-[#00A5E6] bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icone className="size-5" />
                  {label}
                </button>
              )
            })}
          </div>
        </fieldset>

        <div className={`grid gap-4 ${tapete.formato === 'REDONDO' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
          <div>
            <label htmlFor={`${tapete.chaveLocal}-dimensao-1`} className="mb-1.5 block text-sm font-medium text-slate-700">{primeiraMedida} (m) *</label>
            <Input
              id={`${tapete.chaveLocal}-dimensao-1`}
              value={tapete.dimensao1Metros}
              onChange={(event) => campo('dimensao1Metros', mascararMedidaMetros(event.target.value))}
              onBlur={() => onTocar(`${base}.dimensao1Metros`)}
              inputMode="decimal"
              placeholder="Ex.: 1,95"
              maxLength={5}
              disabled={disabled}
              aria-invalid={mensagens('dimensao1Metros').length > 0}
              aria-describedby={`${tapete.chaveLocal}-dimensao-1-erro`}
              className="h-11"
            />
            <ErroCampo mensagens={mensagens('dimensao1Metros')} id={`${tapete.chaveLocal}-dimensao-1-erro`} />
          </div>
          {tapete.formato !== 'REDONDO' && (
            <div>
              <label htmlFor={`${tapete.chaveLocal}-dimensao-2`} className="mb-1.5 block text-sm font-medium text-slate-700">{segundaMedida} (m) *</label>
              <Input
                id={`${tapete.chaveLocal}-dimensao-2`}
                value={tapete.dimensao2Metros}
                onChange={(event) => campo('dimensao2Metros', mascararMedidaMetros(event.target.value))}
                onBlur={() => onTocar(`${base}.dimensao2Metros`)}
                inputMode="decimal"
                placeholder="Ex.: 2,00"
                maxLength={5}
                disabled={disabled}
                aria-invalid={mensagens('dimensao2Metros').length > 0}
                aria-describedby={`${tapete.chaveLocal}-dimensao-2-erro`}
                className="h-11"
              />
              <ErroCampo mensagens={mensagens('dimensao2Metros')} id={`${tapete.chaveLocal}-dimensao-2-erro`} />
            </div>
          )}
        </div>

        <div aria-live="polite" className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Área calculada</p>
            <p className="mt-1 font-semibold text-slate-900">{resumo.area ?? 'Preencha medidas válidas'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Produto calculado</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {resumo.produto ? `${resumo.produto.codigo} — ${resumo.produto.descricao}` : 'Aguardando medidas válidas'}
            </p>
          </div>
          {resumo.avisoMedida && (
            <p className="sm:col-span-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              A Moriah produz preferencialmente em medidas de 5 cm em 5 cm.
            </p>
          )}
        </div>

        <SeletorCores
          tapeteNumero={numero}
          cores={cores}
          selecionadas={tapete.corIds}
          disabled={disabled}
          onChange={(corIds) => onChange({ ...tapete, corIds })}
          onLimite={onLimiteCores}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2"><label htmlFor={`${tapete.chaveLocal}-colecao`} className="text-sm font-medium text-slate-700">Coleção</label><span className="text-xs text-slate-500">{tapete.nomeColecaoCatalogo.length}/30</span></div>
            <Input id={`${tapete.chaveLocal}-colecao`} value={tapete.nomeColecaoCatalogo} onChange={(event) => campo('nomeColecaoCatalogo', event.target.value)} onBlur={() => onTocar(`${base}.nomeColecaoCatalogo`)} maxLength={30} disabled={disabled} aria-invalid={mensagens('nomeColecaoCatalogo').length > 0} aria-describedby={mensagens('nomeColecaoCatalogo').length > 0 ? `${tapete.chaveLocal}-colecao-erro` : undefined} className="h-11" />
            <ErroCampo mensagens={mensagens('nomeColecaoCatalogo')} id={`${tapete.chaveLocal}-colecao-erro`} />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2"><label htmlFor={`${tapete.chaveLocal}-referencia`} className="text-sm font-medium text-slate-700">Referência</label><span className="text-xs text-slate-500">{tapete.referenciaCatalogo.length}/20</span></div>
            <Input id={`${tapete.chaveLocal}-referencia`} value={tapete.referenciaCatalogo} onChange={(event) => campo('referenciaCatalogo', event.target.value)} onBlur={() => onTocar(`${base}.referenciaCatalogo`)} maxLength={20} placeholder="Letras, números e hífen" disabled={disabled} aria-invalid={mensagens('referenciaCatalogo').length > 0} aria-describedby={mensagens('referenciaCatalogo').length > 0 ? `${tapete.chaveLocal}-referencia-erro` : undefined} className="h-11" />
            <ErroCampo mensagens={mensagens('referenciaCatalogo')} id={`${tapete.chaveLocal}-referencia-erro`} />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label htmlFor={`${tapete.chaveLocal}-observacoes`} className="text-sm font-medium text-slate-700">Observações</label>
            <span className="text-xs text-slate-500">{tapete.observacoes.length}/500</span>
          </div>
          <textarea
            id={`${tapete.chaveLocal}-observacoes`}
            value={tapete.observacoes}
            onChange={(event) => campo('observacoes', event.target.value)}
            onBlur={() => onTocar(`${base}.observacoes`)}
            maxLength={500}
            rows={4}
            disabled={disabled}
            aria-invalid={mensagens('observacoes').length > 0}
            aria-describedby={mensagens('observacoes').length > 0 ? `${tapete.chaveLocal}-observacoes-erro` : undefined}
            className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-base outline-none transition focus-visible:border-[#00A5E6] focus-visible:ring-2 focus-visible:ring-[#00A5E6]/30 disabled:opacity-50 sm:text-sm"
          />
          <ErroCampo mensagens={mensagens('observacoes')} id={`${tapete.chaveLocal}-observacoes-erro`} />
        </div>
      </div>
    </article>
  )
}
