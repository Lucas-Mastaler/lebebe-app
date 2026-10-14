'use client'

import { useState } from 'react'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Combobox,
  FormField,
  Input,
  Section,
} from '@/components/design-system'
import {
  novaMedidaDecorisi,
  mascararMedidaDecorisi,
  normalizarMedidaDecorisi,
  editarMedidaDecorisi,
  errosArtigoDecorisi,
  preverArtigoDecorisi,
  formatarCentavosDecorisi,
  type ArtigoFormularioDecorisi,
  type OpcoesFormularioDecorisi,
} from '@/lib/pedidos-personalizados/decorisi/formulario'
import { subtotalDecorisiCentavos } from '@/lib/pedidos-personalizados/decorisi/calculos'
import { pesquisarReferenciasPapel } from '@/lib/pedidos-personalizados/decorisi/catalogo'
import { AnexosDecorisi } from './AnexosDecorisi'

type Props = {
  artigo: ArtigoFormularioDecorisi
  ordem: number
  opcoes: OpcoesFormularioDecorisi
  bloqueado: boolean
  salvo: boolean
  erros: Record<string, string>
  tentouSalvar: boolean
  onChange: (artigo: ArtigoFormularioDecorisi) => boolean
  onConfirmar: (mensagem: string, executar: () => void) => void
  onRemover: () => void
  onArquivo: (arquivo: File, slot: number, anexoId?: string) => Promise<void>
  onExcluirAnexo: (id: string) => void
  onAbrirAnexo: (id: string) => void
}
export function CardProdutoDecorisi({
  artigo,
  ordem,
  opcoes,
  bloqueado,
  salvo,
  erros,
  tentouSalvar,
  onChange,
  onRemover,
  onConfirmar,
  onArquivo,
  onExcluirAnexo,
  onAbrirAnexo,
}: Props) {
  const [buscaVersao, setBuscaVersao] = useState(0)
  const [tocados, setTocados] = useState<Record<string, boolean>>({})
  const previa = preverArtigoDecorisi(artigo, opcoes)
  const catalogo =
    artigo.catalogoPapel ?? (artigo.referencia?.startsWith('XP') ? 'XP' : 'DB')
  const referencias =
    artigo.tipo === 'PAPEL'
      ? pesquisarReferenciasPapel(
          opcoes.db.map((r) => r.referencia),
          catalogo,
          '',
        )
      : opcoes.pf
  function atualizarMedida(
    chave: string,
    dim: 'largura' | 'altura',
    valor: string,
  ) {
    onChange({
      ...artigo,
      medidas: artigo.medidas.map((m) =>
        m.chave === chave ? { ...m, [dim]: valor } : m,
      ),
    })
  }
  function editar(
    input: HTMLInputElement,
    chave: string,
    dim: 'largura' | 'altura',
    entrada: string,
    acao: 'inserir' | 'Backspace' | 'Delete' = 'inserir',
  ) {
    const resultado = editarMedidaDecorisi(
      input.value,
      input.selectionStart ?? input.value.length,
      input.selectionEnd ?? input.value.length,
      entrada,
      acao,
    )
    atualizarMedida(chave, dim, resultado.valor)
    requestAnimationFrame(() => {
      if (input.isConnected)
        input.setSelectionRange(resultado.cursor, resultado.cursor)
    })
  }
  const personalizada = artigo.classificacao === 'PERSONALIZADO'
  const completos = errosArtigoDecorisi(artigo, opcoes, true)
  const campo = (nome: string) =>
    tentouSalvar || tocados[nome] ? (erros[nome] ?? completos[nome]) : undefined
  return (
    <Card
      id={`decorisi-${artigo.id}`}
      tabIndex={-1}
      className="scroll-mt-6 focus-visible:ring-2 focus-visible:ring-primary"
    >
      <CardHeader
        title={`Produto ${ordem} · ${artigo.referencia ?? 'Nova arte'}`}
        action={
          <Button
            type="button"
            variant="destructive"
            disabled={bloqueado}
            onClick={onRemover}
          >
            Remover produto
          </Button>
        }
      />
      <CardContent className="space-y-6">
        <fieldset
          id={`${artigo.id}-produto`}
          tabIndex={-1}
          disabled={bloqueado}
        >
          <legend className="mb-3 font-semibold">
            Qual produto o cliente deseja? *
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['PAPEL', 'PAINEL'] as const).map((tipo) => (
              <button
                type="button"
                key={tipo}
                aria-pressed={
                  artigo.produtoRespondido !== false && artigo.tipo === tipo
                }
                className={`min-h-14 rounded-xl border px-4 py-3 text-left text-sm focus-visible:ring-2 focus-visible:ring-primary ${artigo.produtoRespondido !== false && artigo.tipo === tipo ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white'}`}
                onClick={() => {
                  const aplicar = () =>
                    onChange({
                      ...artigo,
                      tipo,
                      produtoRespondido: true,
                      arteRespondida:
                        tipo === artigo.tipo ? artigo.arteRespondida : false,
                      referencia:
                        tipo === artigo.tipo ? artigo.referencia : null,
                    })
                  if (tipo !== artigo.tipo && artigo.referencia)
                    onConfirmar(
                      'A referência de outro catálogo será removida. Medidas, descrição e anexos serão preservados. Continuar?',
                      aplicar,
                    )
                  else aplicar()
                }}
              >
                <span className="block font-semibold">
                  {tipo === 'PAPEL' ? 'Papel de parede' : 'Painel de parede'}
                </span>
                <span>
                  {tipo === 'PAPEL'
                    ? 'Rolos de 0,62 × 10 m, considerando a repetição da arte.'
                    : 'Feito nas medidas da parede, cobrado por m² exato.'}
                </span>
              </button>
            ))}
          </div>
        </fieldset>
        {artigo.produtoRespondido !== false && (
          <fieldset id={`${artigo.id}-arte`} tabIndex={-1} disabled={bloqueado}>
            <legend className="mb-3 font-semibold">Como será a arte? *</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(['CATALOGO', 'PERSONALIZADO'] as const).map((classificacao) => (
                <button
                  type="button"
                  key={classificacao}
                  aria-pressed={
                    artigo.arteRespondida !== false &&
                    artigo.classificacao === classificacao
                  }
                  className={`min-h-14 rounded-xl border px-4 py-3 text-left text-sm focus-visible:ring-2 focus-visible:ring-primary ${artigo.arteRespondida !== false && artigo.classificacao === classificacao ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white'}`}
                  onClick={() =>
                    onChange({ ...artigo, classificacao, arteRespondida: true })
                  }
                >
                  <span className="block font-semibold">
                    {classificacao === 'CATALOGO'
                      ? artigo.tipo === 'PAPEL'
                        ? 'Modelo original do catálogo'
                        : 'Modelo original do catálogo Fofura'
                      : artigo.tipo === 'PAPEL'
                        ? 'Personalizar modelo do catálogo'
                        : 'Painel personalizado'}
                  </span>
                  <span>
                    {classificacao === 'CATALOGO'
                      ? artigo.tipo === 'PAPEL'
                        ? 'Escolha a referência original de Doce Bebê ou Xadrezia.'
                        : 'Referências PF200 a PF280.'
                      : artigo.tipo === 'PAPEL'
                        ? 'Altere uma arte DB ou XP existente, como trocar uma linha azul por preta.'
                        : 'Referência PF opcional, imagem própria, foto ou outra composição.'}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {artigo.produtoRespondido !== false &&
          artigo.arteRespondida !== false && (
            <>
              <hr className="border-t border-slate-200" />
              <div>
                <h4 className="mb-3 font-semibold text-slate-800">
                  {artigo.tipo === 'PAPEL'
                    ? personalizada
                      ? 'Modelo original'
                      : 'Catálogo'
                    : personalizada
                      ? 'Arte personalizada'
                      : 'Catálogo Fofura'}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {artigo.tipo === 'PAPEL'
                    ? personalizada
                      ? 'Selecione a referência DB ou XP que será a base da personalização.'
                      : 'Selecione o catálogo e a referência original Decorisi.'
                    : personalizada
                      ? 'Informe a arte desejada. Uma referência PF pode servir de inspiração.'
                      : 'Selecione o modelo PF do catálogo Fofura.'}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {artigo.tipo === 'PAPEL' && (
                  <FormField
                    id={`${artigo.id}-catalogo`}
                    label="Catálogo"
                    required
                  >
                    {(f) => (
                      <Combobox
                        key={`catalogo-${catalogo}-${buscaVersao}`}
                        {...f}
                        disabled={bloqueado}
                        minChars={0}
                        value={{
                          value: catalogo,
                          label: catalogo === 'DB' ? 'Doce Bebê' : 'Xadrezia',
                        }}
                        onSearch={async () =>
                          [
                            { value: 'DB', label: 'Doce Bebê' },
                            { value: 'XP', label: 'Xadrezia' },
                          ]
                        }
                        onChange={(c) => {
                          setBuscaVersao((v) => v + 1)
                          if (!c || c.value === catalogo) return
                          const aplicar = () => {
                            onChange({
                              ...artigo,
                              catalogoPapel: c.value as 'DB' | 'XP',
                              referencia: null,
                            })
                            setBuscaVersao((v) => v + 1)
                          }
                          if (artigo.referencia)
                            onConfirmar(
                              'Trocar o catálogo removerá a referência selecionada. Medidas, descrição e anexos serão preservados. Continuar?',
                              aplicar,
                            )
                          else aplicar()
                        }}
                      />
                    )}
                  </FormField>
                )}
                <FormField
                  id={`${artigo.id}-referencia`}
                  label={
                    personalizada
                      ? 'Referência original'
                      : 'Referência do modelo'
                  }
                  error={campo(`${artigo.id}-referencia`)}
                  required={artigo.tipo === 'PAPEL' || !personalizada}
                  helper={
                    artigo.tipo === 'PAINEL'
                      ? 'Catálogo Fofura · PF200 a PF280.'
                      : 'A repetição da referência DB ou XP é carregada automaticamente.'
                  }
                >
                  {(f) => (
                    <fieldset
                      disabled={bloqueado}
                      onBlur={() =>
                        setTocados((t) => ({
                          ...t,
                          [`${artigo.id}-referencia`]: true,
                        }))
                      }
                      className="min-w-0 [&_[role=listbox]]:max-h-60 [&_[role=listbox]]:overflow-y-auto"
                      onKeyDown={(e) => {
                        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
                        const botoes = Array.from(
                          e.currentTarget.querySelectorAll<HTMLButtonElement>(
                            '[role=option]',
                          ),
                        )
                        if (!botoes.length) return
                        e.preventDefault()
                        const atual = botoes.indexOf(
                          document.activeElement as HTMLButtonElement,
                        )
                        botoes[
                          (atual +
                            (e.key === 'ArrowDown' ? 1 : -1) +
                            botoes.length) %
                            botoes.length
                        ].focus()
                      }}
                    >
                      <Combobox
                        key={`${artigo.tipo}-${catalogo}-${buscaVersao}`}
                        {...f}
                        disabled={bloqueado}
                        value={
                          artigo.referencia
                            ? {
                                value: artigo.referencia,
                                label: artigo.referencia,
                              }
                            : null
                        }
                        onChange={(r) => {
                          if (
                            !onChange({
                              ...artigo,
                              referencia: r?.value ?? null,
                            })
                          )
                            setBuscaVersao((v) => v + 1)
                        }}
                        onSearch={async (q) =>
                          referencias
                            .filter((r) => r.includes(q.trim().toUpperCase()))
                            .map((r) => ({ value: r, label: r }))
                        }
                        minChars={0}
                        placeholder={
                          artigo.tipo === 'PAPEL'
                            ? catalogo === 'DB'
                              ? 'Buscar DB813 ou 813'
                              : 'Buscar XP001 ou 001'
                            : 'Buscar PF200 ou 200'
                        }
                      />
                    </fieldset>
                  )}
                </FormField>
                {artigo.tipo === 'PAPEL' && artigo.referencia && (
                  <p className="self-center text-sm text-muted-foreground">
                    Repetição:{' '}
                    {String(
                      opcoes.db.find((r) => r.referencia === artigo.referencia)
                        ?.repeticao_m ?? '—',
                    ).replace('.', ',')}{' '}
                    m
                  </p>
                )}
              </div>
              {personalizada && (
                <FormField
                  id={`${artigo.id}-descricao`}
                  label="Descrição da personalização"
                  error={campo(`${artigo.id}-descricao`)}
                  required
                  helper="Obrigatória antes de fechar a venda; pode ser completada depois de salvar o rascunho."
                >
                  {(f) => (
                    <textarea
                      {...f}
                      disabled={bloqueado}
                      maxLength={500}
                      rows={3}
                      className="w-full rounded-md border border-input bg-background p-3"
                      value={artigo.descricao ?? ''}
                      onBlur={() =>
                        setTocados((t) => ({
                          ...t,
                          [`${artigo.id}-descricao`]: true,
                        }))
                      }
                      onChange={(e) =>
                        onChange({ ...artigo, descricao: e.target.value })
                      }
                    />
                  )}
                </FormField>
              )}
              <hr className="border-t border-slate-200" />
              <Section
                title="Medidas das paredes"
                description={`${artigo.medidas.length}/20 medidas · largura e altura em metros`}
              >
                <div className="space-y-4">
                  {artigo.medidas.map((m, indice) => (
                    <div
                      key={m.chave}
                      className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2 lg:grid-cols-4"
                    >
                      <FormField
                        id={`${m.chave}-ambiente`}
                        label={`Parede ${indice + 1}`}
                        helper={`${m.ambiente.length}/30 caracteres`}
                        error={campo(`${m.chave}-ambiente`)}
                      >
                        {(f) => (
                          <Input
                            {...f}
                            disabled={bloqueado}
                            maxLength={30}
                            placeholder="Identificação opcional"
                            value={m.ambiente}
                            onChange={(e) =>
                              onChange({
                                ...artigo,
                                medidas: artigo.medidas.map((x) =>
                                  x.chave === m.chave
                                    ? { ...x, ambiente: e.target.value }
                                    : x,
                                ),
                              })
                            }
                          />
                        )}
                      </FormField>
                      {(['largura', 'altura'] as const).map((dim) => (
                        <FormField
                          key={dim}
                          id={`${m.chave}-${dim}`}
                          label={
                            dim === 'largura' ? 'Largura (m)' : 'Altura (m)'
                          }
                          required
                          error={campo(`${m.chave}-${dim}`)}
                        >
                          {(f) => (
                            <Input
                              {...f}
                              disabled={bloqueado}
                              inputMode="numeric"
                              placeholder="0,00"
                              value={m[dim]}
                              onKeyDown={(e) => {
                                if (
                                  e.ctrlKey ||
                                  e.metaKey ||
                                  e.altKey ||
                                  e.nativeEvent.isComposing
                                )
                                  return
                                if (
                                  /^\d$/.test(e.key) ||
                                  e.key === 'Backspace' ||
                                  e.key === 'Delete'
                                ) {
                                  e.preventDefault()
                                  editar(
                                    e.currentTarget,
                                    m.chave,
                                    dim,
                                    /^\d$/.test(e.key) ? e.key : '',
                                    e.key === 'Backspace' || e.key === 'Delete'
                                      ? e.key
                                      : 'inserir',
                                  )
                                } else if (e.key.length === 1)
                                  e.preventDefault()
                              }}
                              onPaste={(e) => {
                                e.preventDefault()
                                editar(
                                  e.currentTarget,
                                  m.chave,
                                  dim,
                                  e.clipboardData.getData('text'),
                                )
                              }}
                              onBlur={() => {
                                setTocados((t) => ({
                                  ...t,
                                  [`${m.chave}-${dim}`]: true,
                                }))
                                onChange({
                                  ...artigo,
                                  medidas: artigo.medidas.map((x) =>
                                    x.chave === m.chave
                                      ? {
                                          ...x,
                                          [dim]: normalizarMedidaDecorisi(
                                            x[dim],
                                          ),
                                        }
                                      : x,
                                  ),
                                })
                              }}
                              onChange={(e) =>
                                onChange({
                                  ...artigo,
                                  medidas: artigo.medidas.map((x) =>
                                    x.chave === m.chave
                                      ? {
                                          ...x,
                                          [dim]: mascararMedidaDecorisi(
                                            e.target.value,
                                          ),
                                        }
                                      : x,
                                  ),
                                })
                              }
                            />
                          )}
                        </FormField>
                      ))}
                      <Button
                        type="button"
                        variant="secondary"
                        className="self-end min-h-11"
                        disabled={bloqueado}
                        onClick={() => {
                          const remover = () =>
                            onChange({
                              ...artigo,
                              medidas: artigo.medidas.filter(
                                (x) => x.chave !== m.chave,
                              ),
                            })
                          if (m.ambiente || m.largura || m.altura)
                            onConfirmar(
                              `Remover parede ${indice + 1} e suas medidas?`,
                              remover,
                            )
                          else remover()
                        }}
                      >
                        Remover parede {indice + 1}
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={bloqueado || artigo.medidas.length >= 20}
                    onClick={() =>
                      onChange({
                        ...artigo,
                        medidas: [...artigo.medidas, novaMedidaDecorisi()],
                      })
                    }
                  >
                    Adicionar medida
                  </Button>
                </div>
              </Section>
              <hr className="border-t border-slate-200" />
              <div
                className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2"
                aria-live="polite"
              >
                <h4 className="font-semibold sm:col-span-2">
                  Resumo financeiro
                </h4>
                <p className="sm:col-span-2">
                  {artigo.medidas.length} paredes · Produto SGI{' '}
                  {previa.produto.codigo} ·{' '}
                  {artigo.tipo === 'PAPEL'
                    ? 'Rolo de 0,62 × 10 m'
                    : 'Metro quadrado'}
                </p>
                {previa.quantidade && (
                  <p className="mt-1 font-semibold">
                    {artigo.tipo === 'PAPEL' ? 'Quantidade:' : 'Área total:'}{' '}
                    {previa.quantidade.replace('.', ',')}{' '}
                    {artigo.tipo === 'PAPEL' ? 'rolos' : 'm²'}
                  </p>
                )}
                {previa.preco && (
                  <p>
                    Preço por {artigo.tipo === 'PAPEL' ? 'rolo' : 'm²'}:{' '}
                    {formatarCentavosDecorisi(
                      subtotalDecorisiCentavos('1', previa.preco),
                    )}
                  </p>
                )}
                {previa.subtotal && (
                  <p className="font-bold">
                    Subtotal: {formatarCentavosDecorisi(previa.subtotal)}
                  </p>
                )}
                {previa.pendencia && (
                  <p className="mt-1 text-amber-800">{previa.pendencia}</p>
                )}
                {personalizada &&
                  (!artigo.descricao?.trim() || !artigo.anexos.length) && (
                    <p className="mt-1 text-amber-800">
                      Antes do fechamento, complete a descrição e inclua ao
                      menos um anexo.
                    </p>
                  )}
              </div>
              <hr className="border-t border-slate-200" />
              <FormField
                id={`${artigo.id}-observacoes`}
                label="Observações"
                helper="Registre aqui portas, janelas, inclinações e outras orientações."
              >
                {(f) => (
                  <textarea
                    {...f}
                    disabled={bloqueado}
                    maxLength={500}
                    rows={2}
                    className="w-full rounded-md border border-input bg-background p-3"
                    value={artigo.observacoes ?? ''}
                    onChange={(e) =>
                      onChange({ ...artigo, observacoes: e.target.value })
                    }
                  />
                )}
              </FormField>
              <AnexosDecorisi
                artigo={artigo}
                bloqueado={bloqueado}
                salvo={salvo}
                onArquivo={onArquivo}
                onExcluir={onExcluirAnexo}
                onAbrir={onAbrirAnexo}
              />
            </>
          )}
      </CardContent>
    </Card>
  )
}
