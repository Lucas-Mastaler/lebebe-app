'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, BookOpen, Circle, ExternalLink, Ruler, RectangleHorizontal, Shapes, Trash2, Wand2 } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, Dialog, DialogBody, DialogContent, DialogHeader, FormField, Input } from '@/components/design-system'
import { TIPO_TAPETE_PARA_EXIBICAO, mascararMedidaMetros } from '@/lib/pedidos-personalizados'
import type { FormatoTapeteMoriah, ProblemaPedidoPersonalizado } from '@/lib/pedidos-personalizados'
import {
  alterarFormatoTapete,
  classificacaoTapeteCompleta,
  exibirSecaoCatalogo,
  resumirTapete,
  responderExisteNoCatalogo,
  responderIdenticoReferencia,
} from './novo-pedido-modelo'
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

function botaoRespostaClasse(ativo: boolean) {
  return `flex min-h-14 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-center text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-primary ${
    ativo ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
  }`
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
  const restanteBloqueado = !classificacaoTapeteCompleta(tapete)
  const [catalogoAberto, setCatalogoAberto] = useState(false)
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
    <Card id={`tapete-${numero}`} className="scroll-mt-6">
      <CardHeader
        icon={<Ruler className="size-5" aria-hidden="true" />}
        title={`Tapete ${numero}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => setCatalogoAberto(true)}
              disabled={disabled}
              aria-label={`Ver catálogo de tapetes para o tapete ${numero}`}
              variant="secondary"
              className="min-h-11 gap-2 rounded-xl border-2 border-primary/40 px-4 text-sm font-bold shadow-sm"
            >
              <BookOpen className="size-5" />
              Ver Catálogo
            </Button>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon" className="size-11" disabled={disabled || indice === 0} onClick={() => onMover(-1)} aria-label={`Mover tapete ${numero} para cima`}>
                <ArrowUp />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-11" disabled={disabled || indice === total - 1} onClick={() => onMover(1)} aria-label={`Mover tapete ${numero} para baixo`}>
                <ArrowDown />
              </Button>
              <Button type="button" variant="destructive" size="icon" className="size-11" disabled={disabled || total === 1} onClick={onRemover} aria-label={`Remover tapete ${numero}`}>
                <Trash2 />
              </Button>
            </div>
          </div>
        }
      />
      <CardContent className="space-y-6">
        <fieldset disabled={disabled}>
          <legend className="mb-3 font-semibold text-slate-800">Este produto existe no catálogo?</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              aria-pressed={tapete.existeNoCatalogo === true}
              onClick={() => { onChange(responderExisteNoCatalogo(tapete, true)); onTocar(`${base}.existeNoCatalogo`) }}
              className={botaoRespostaClasse(tapete.existeNoCatalogo === true)}
            >
              Sim, está no catálogo
            </button>
            <button
              type="button"
              aria-pressed={tapete.existeNoCatalogo === false}
              onClick={() => { onChange(responderExisteNoCatalogo(tapete, false)); onTocar(`${base}.existeNoCatalogo`) }}
              className={botaoRespostaClasse(tapete.existeNoCatalogo === false)}
            >
              Não, é um produto fora do catálogo
            </button>
          </div>
          {mensagens('existeNoCatalogo')[0] && <p id={`${tapete.chaveLocal}-existe-catalogo-erro`} role="alert" className="mt-1 text-sm text-destructive">{mensagens('existeNoCatalogo')[0]}</p>}
        </fieldset>

        {tapete.existeNoCatalogo === true && (
          <fieldset disabled={disabled}>
            <legend className="mb-3 font-semibold text-slate-800">O produto será exatamente igual à referência do catálogo?</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                aria-pressed={tapete.identicoReferencia === true}
                onClick={() => { onChange(responderIdenticoReferencia(tapete, true)); onTocar(`${base}.identicoReferencia`) }}
                className={botaoRespostaClasse(tapete.identicoReferencia === true)}
              >
                Sim, exatamente igual
              </button>
              <button
                type="button"
                aria-pressed={tapete.identicoReferencia === false}
                onClick={() => { onChange(responderIdenticoReferencia(tapete, false)); onTocar(`${base}.identicoReferencia`) }}
                className={botaoRespostaClasse(tapete.identicoReferencia === false)}
              >
                Não, terá alterações
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-900">Qualquer alteração, inclusive de cores, torna o produto Personalizado.</p>
            {mensagens('identicoReferencia')[0] && <p id={`${tapete.chaveLocal}-identico-referencia-erro`} role="alert" className="mt-1 text-sm text-destructive">{mensagens('identicoReferencia')[0]}</p>}
          </fieldset>
        )}

        {classificacaoTapeteCompleta(tapete) ? (
          <div
            className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-base font-semibold ${
              tapete.tipo === 'CATALOGO'
                ? 'border-sky-200 bg-sky-50 text-sky-800'
                : 'border-violet-200 bg-violet-50 text-violet-800'
            }`}
          >
            {tapete.tipo === 'CATALOGO'
              ? <BookOpen className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              : <Wand2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />}
            <p>
              <span className="mr-1 uppercase tracking-wide">Tipo: {TIPO_TAPETE_PARA_EXIBICAO[tapete.tipo]}.</span>
              {tapete.tipo === 'CATALOGO'
                ? 'O produto será produzido exatamente conforme a referência do catálogo, sem seleção manual de cores.'
                : 'Produto fora do catálogo, ou com alguma personalização em relação à referência do catálogo, como alteração de cores.'}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Responda a pergunta acima para definir o Tipo deste tapete.
          </div>
        )}

        <div className="relative">
          {restanteBloqueado && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/80 p-4 text-center backdrop-blur-[1px]">
              <p className="max-w-xs rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm">
                Responda primeiro às perguntas acima para continuar.
              </p>
            </div>
          )}
          <div
            className={`space-y-6 ${restanteBloqueado ? 'opacity-50 select-none' : ''}`}
            inert={restanteBloqueado}
          >
        {exibirSecaoCatalogo(tapete) && (
          <>
            <hr className="border-t border-slate-200" />

            <div>
              <h4 className="mb-3 font-semibold text-slate-800">Catálogo</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id={`${tapete.chaveLocal}-colecao`} label={`Nome do Catálogo${tapete.tipo === 'CATALOGO' ? '' : ''}`} required={tapete.tipo === 'CATALOGO'} helper={`${tapete.nomeColecaoCatalogo.length}/30`} error={mensagens('nomeColecaoCatalogo')[0]}>
                  {(f) => <Input {...f} value={tapete.nomeColecaoCatalogo} onChange={(event) => campo('nomeColecaoCatalogo', event.target.value)} onBlur={() => onTocar(`${base}.nomeColecaoCatalogo`)} maxLength={30} disabled={disabled} className="h-11" />}
                </FormField>
                <FormField id={`${tapete.chaveLocal}-referencia`} label="Cor/Referência do Catálogo" required={tapete.tipo === 'CATALOGO'} helper={`${tapete.referenciaCatalogo.length}/20`} error={mensagens('referenciaCatalogo')[0]}>
                  {(f) => <Input {...f} value={tapete.referenciaCatalogo} onChange={(event) => campo('referenciaCatalogo', event.target.value)} onBlur={() => onTocar(`${base}.referenciaCatalogo`)} maxLength={20} placeholder="Letras, números e hífen" disabled={disabled} className="h-11" />}
                </FormField>
              </div>
            </div>
          </>
        )}

        <hr className="border-t border-slate-200" />

        <fieldset disabled={disabled}>
          <legend className="mb-3 font-semibold text-slate-800">Formato</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {formatos.map(({ valor, label, Icone }) => {
              const ativo = tapete.formato === valor
              return (
                <div key={valor}>
                  <button
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => onChange(alterarFormatoTapete(tapete, valor))}
                    className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-primary ${
                      ativo ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icone className="size-5" />
                    {label}
                  </button>
                  {valor === 'ORGANICO' && (
                    <p className="mt-2 text-xs text-slate-500">Orgânico: use apenas quando o formato não for redondo, quadrado ou retangular.</p>
                  )}
                </div>
              )
            })}
          </div>
        </fieldset>

        <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
          Sugestão: utilizando em uma das medidas o valor de 0,95 m ou 1,95 m, o tapete pode ficar em uma faixa de preço menor.
        </p>

        <div className={`grid gap-4 ${tapete.formato === 'REDONDO' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
          <FormField id={`${tapete.chaveLocal}-dimensao-1`} label={`${primeiraMedida} (m)`} required error={mensagens('dimensao1Metros')[0]}>
            {(f) => (
              <Input
                {...f}
                value={tapete.dimensao1Metros}
                onChange={(event) => campo('dimensao1Metros', mascararMedidaMetros(event.target.value))}
                onBlur={() => onTocar(`${base}.dimensao1Metros`)}
                inputMode="decimal"
                placeholder="Ex.: 1,95"
                maxLength={5}
                disabled={disabled}
                className="h-11"
              />
            )}
          </FormField>
          {tapete.formato !== 'REDONDO' && (
            <FormField id={`${tapete.chaveLocal}-dimensao-2`} label={`${segundaMedida} (m)`} required error={mensagens('dimensao2Metros')[0]}>
              {(f) => (
                <Input
                  {...f}
                  value={tapete.dimensao2Metros}
                  onChange={(event) => campo('dimensao2Metros', mascararMedidaMetros(event.target.value))}
                  onBlur={() => onTocar(`${base}.dimensao2Metros`)}
                  inputMode="decimal"
                  placeholder="Ex.: 2,00"
                  maxLength={5}
                  disabled={disabled}
                  className="h-11"
                />
              )}
            </FormField>
          )}
        </div>

        <div aria-live="polite" className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Área cobrada</p>
            <p className="mt-1 font-semibold text-slate-900">{resumo.area ?? 'Preencha medidas válidas'}</p>
            <p className="mt-0.5 text-xs text-slate-500">Arredondada para cima de 0,05 em 0,05 m².</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Valor cobrado</p>
            <p className={`mt-1 font-semibold ${resumo.precoIndisponivel ? 'text-amber-700' : 'text-slate-900'}`}>
              {resumo.valorCobrado
                ?? (resumo.precoIndisponivel ? 'Preço indisponível' : 'Aguardando medidas válidas')}
            </p>
            {resumo.precoM2 && <p className="mt-0.5 text-xs text-slate-500">{resumo.precoM2}</p>}
          </div>
          <div className="sm:col-span-2">
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

        {tapete.tipo === 'PERSONALIZADO' && (
          <>
            <hr className="border-t border-slate-200" />

            <SeletorCores
              tapeteNumero={numero}
              cores={cores}
              selecionadas={tapete.corIds}
              disabled={disabled}
              onChange={(corIds) => onChange({ ...tapete, corIds })}
              onLimite={onLimiteCores}
            />
          </>
        )}

        <FormField id={`${tapete.chaveLocal}-observacoes`} label="Observações" helper={`${tapete.observacoes.length}/500`} error={mensagens('observacoes')[0]}>
          {(f) => (
            <textarea
              {...f}
              value={tapete.observacoes}
              onChange={(event) => campo('observacoes', event.target.value)}
              onBlur={() => onTocar(`${base}.observacoes`)}
              maxLength={500}
              rows={4}
              disabled={disabled}
              className="w-full resize-y rounded-xl border border-slate-200 bg-input-background px-3 py-2 text-base outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50 sm:text-sm"
            />
          )}
        </FormField>
          </div>
        </div>
      </CardContent>

      <Dialog open={catalogoAberto} onOpenChange={setCatalogoAberto}>
        <DialogContent className="h-[90vh] max-h-[90vh] !w-[95vw] max-w-5xl">
          <DialogHeader title="Catálogo">
            <a
              href="https://book107992.publuu.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <ExternalLink className="size-4" />
              Abrir em nova guia
            </a>
          </DialogHeader>
          <DialogBody className="p-0">
            <iframe
              src="https://book107992.publuu.com/"
              title="Catálogo de tapetes"
              className="h-full w-full min-h-[60vh] border-0"
              loading="lazy"
            />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
