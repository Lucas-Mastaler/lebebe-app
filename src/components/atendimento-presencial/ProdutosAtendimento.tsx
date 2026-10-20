'use client'

import { useId, useRef, useState } from 'react'
import styles from './ProdutosAtendimento.module.css'
import { CheckCircle2, Minus, Plus, Target, X } from 'lucide-react'
import { Button, Input } from '@/components/design-system'
import { ListaEnxovalDialog } from './ListaEnxovalDialog'
import { FICHA_PRODUTO_MAX_CHARS, FICHA_PRODUTOS_MAX_ITENS, type FichaDadosRascunho } from '@/lib/atendimento-presencial/ficha-schema'
import { maiusculasNomeComCursor } from '@/lib/atendimento-presencial/maiusculas-nomes'
import { calcularPv, chaveProduto, descricaoProduto, estruturarProduto, incrementarProduto, META_PV, PRODUTO_NAO_TRABALHAMOS, produtoNaoTrabalhado, QUANTIDADE_PRODUTO_MAX, type ProdutoCompativel } from '@/lib/atendimento-presencial/produtos'

export function IndicadorPv({ produtos, versaoProdutos }: { produtos: ProdutoCompativel[]; versaoProdutos?: number | null }) {
  const pv = calcularPv(produtos, versaoProdutos)
  const percentual = Math.round(pv.valor / META_PV * 100)
  const atingiu = pv.valor >= META_PV
  return <div className={styles.resumoPv} aria-live="polite">
    <div className={[styles.pv, !pv.informado ? styles.pvDesconhecido : atingiu ? styles.pvSucesso : styles.pvPendente].join(' ')}>
      <Target className={styles.pvIcone} aria-hidden="true" />
      <div className={styles.pvConteudo}>
        <div className={styles.pvCabecalho}>
          <strong className={styles.pvValor}>{!pv.informado ? 'PV não informado' : `${pv.incompleto ? 'PV registrado' : 'PV'}: ${pv.valor}`}</strong>
          <span className={styles.pvMeta}>Meta PV: {META_PV}</span>
          {pv.informado && <span className={styles.pvPercentual}>{percentual}%</span>}
        </div>
        {pv.informado && <div role="progressbar" aria-label="Peças vendidas em relação à referência de 5" aria-valuemin={0} aria-valuemax={META_PV} aria-valuenow={Math.min(pv.valor, META_PV)} aria-valuetext={`${pv.valor} peças vendidas; referência ${META_PV}`} className={styles.pvBarra}>
          <div className={`h-full rounded-full ${atingiu ? 'bg-emerald-600' : 'bg-red-600'}`} style={{ width: `${Math.min(percentual, 100)}%` }} />
        </div>}
      </div>
    </div>
    <p className={styles.pvLegenda}>Peças vendidas neste atendimento{pv.incompleto ? '. Informação histórica incompleta.' : '.'}</p>
  </div>
}

export function ResumoProdutos({ produtos, versaoProdutos }: { produtos: ProdutoCompativel[]; versaoProdutos?: number | null }) {
  return <div><ul className="space-y-2">{produtos.map((p, i) => { const item = estruturarProduto(p); return <li key={i} className="break-words rounded-lg bg-white/80 p-2"><strong>{item.descricao}</strong><p className="text-xs text-slate-600">{produtoNaoTrabalhado(p) ? 'Produto que não trabalhamos' : `Qtd: ${item.quantidade ?? 'Não informado'} · Vendido: ${item.vendido === null ? 'Não informado' : item.vendido ? 'Sim' : 'Não'}`}</p></li> })}</ul><IndicadorPv produtos={produtos} versaoProdutos={versaoProdutos} /></div>
}

export function AvisoProdutosVendidos({ ficha }: { ficha: FichaDadosRascunho }) {
  return (ficha.resultadoAtendimento === 'nao' || ficha.resultadoAtendimento === 'negociacao') && calcularPv(ficha.produtosInteresse, ficha.versaoProdutos).valor > 0
    ? <p role="status" className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">Há produtos marcados como vendidos neste atendimento. Confira os itens e a situação da venda antes de finalizar.</p> : null
}

type Props = {
  ficha: FichaDadosRascunho
  atualizar: (update: (ficha: FichaDadosRascunho) => FichaDadosRascunho) => void
  digitado: string
  setDigitado: (value: string) => void
}

export function ProdutosAtendimento({ ficha, atualizar, digitado, setDigitado }: Props) {
  const id = useId()
  const entrada = useRef<HTMLInputElement>(null)
  const consumido = useRef(false)
  const [erro, setErro] = useState('')
  const [edicao, setEdicao] = useState<{ indice: number; valor: string } | null>(null)
  const edicaoAbertaRef = useRef(false)
  function mudarLinha(indice: number, alterar: (p: ProdutoCompativel) => ProdutoCompativel) {
    atualizar(atual => ({ ...atual, versaoProdutos: 2, produtosInteresse: atual.produtosInteresse.map((p, i) => i === indice ? alterar(p) : estruturarProduto(p)) }))
  }
  function adicionar(descricao = digitado) {
    if (consumido.current) return
    const nome = descricao.trim().replace(/\s+/gu, ' ').toLocaleUpperCase('pt-BR')
    if (!nome) return
    if (Array.from(nome).length > FICHA_PRODUTO_MAX_CHARS) { setErro('Use até 80 caracteres no nome do produto.'); return }
    const iguais = ficha.produtosInteresse.flatMap((p, i) => chaveProduto(descricaoProduto(p)) === chaveProduto(nome) ? [i] : [])
    if (!iguais.length && ficha.produtosInteresse.length >= FICHA_PRODUTOS_MAX_ITENS) { setErro('Limite de 20 produtos. Você ainda pode aumentar as quantidades.'); return }
    consumido.current = true
    atualizar(atual => {
      const itens = atual.produtosInteresse.map(estruturarProduto)
      const alvo = itens.findIndex(p => chaveProduto(p.descricao) === chaveProduto(nome))
      if (alvo >= 0) itens[alvo] = incrementarProduto(itens[alvo])
      else if (itens.length < FICHA_PRODUTOS_MAX_ITENS) itens.push({ descricao: nome, quantidade: produtoNaoTrabalhado(nome) ? null : 1, vendido: produtoNaoTrabalhado(nome) ? null : false })
      return { ...atual, versaoProdutos: 2, produtosInteresse: itens }
    })
    setDigitado(''); setErro('')
    // A mesma entrada não pode ser consumida pelo Enter e por um clique subsequente.
    if (entrada.current) entrada.current.value = ''
  }
  function confirmarNome() {
    if (!edicao || !edicaoAbertaRef.current) return
    const nome = edicao.valor.trim().replace(/\s+/gu, ' ').toLocaleUpperCase('pt-BR')
    if (!nome || Array.from(nome).length > FICHA_PRODUTO_MAX_CHARS) {
      setErro('Informe um nome de produto com até 80 caracteres.')
      return
    }
    if (produtoNaoTrabalhado(nome)) {
      setErro('Use o botão Produto que não trabalhamos para adicionar esse marcador.')
      return
    }
    edicaoAbertaRef.current = false
    mudarLinha(edicao.indice, produto => ({ ...estruturarProduto(produto), descricao: nome }))
    setEdicao(null)
    setErro('')
  }
  function adicionarMarcador() {
    atualizar(atual => {
      if (atual.produtosInteresse.some(produtoNaoTrabalhado) || atual.produtosInteresse.length >= FICHA_PRODUTOS_MAX_ITENS) return atual
      return { ...atual, versaoProdutos: 2, produtosInteresse: [...atual.produtosInteresse.map(estruturarProduto), { descricao: PRODUTO_NAO_TRABALHAMOS, quantidade: null, vendido: null }] }
    })
  }
  return <div className={styles.container}>
    <label htmlFor={id} className="sr-only">Produtos de interesse</label>
    <div className={styles.entrada}>
      <Input
        ref={entrada}
        id={id}
        value={digitado}
        placeholder="Adicionar produto..."
        maxLength={FICHA_PRODUTO_MAX_CHARS}
        className={styles.campo}
        enterKeyHint="done"
        onChange={event => {
          consumido.current = false
          const campo = event.target
          const maiusculas = maiusculasNomeComCursor(campo.value, campo.selectionStart ?? 0, campo.selectionEnd ?? 0)
          setDigitado(maiusculas.valor)
          requestAnimationFrame(() => campo.setSelectionRange(maiusculas.inicio, maiusculas.fim))
          setErro('')
        }}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.preventDefault()
            adicionar()
          }
        }}
      />
      <Button type="button" aria-label="Adicionar produto" className={styles.adicionar} onClick={() => adicionar()}>
        <Plus className="size-5" aria-hidden="true" />
      </Button>
    </div>
    <div className={styles.acoesAuxiliares}>
      <ListaEnxovalDialog />
      <Button type="button" variant="secondary" className={styles.marcador} disabled={ficha.produtosInteresse.some(produtoNaoTrabalhado) || ficha.produtosInteresse.length >= FICHA_PRODUTOS_MAX_ITENS} onClick={adicionarMarcador}>Produto que não trabalhamos</Button>
    </div>
    {erro && <p role="alert" className="mt-2 text-sm text-red-700">{erro}</p>}
    <div className={`${styles.grade} ${styles.cabecalho}`} aria-hidden="true">
      <span>Produto</span><span className="text-center">Qtd</span><span className="text-center">Vendido</span><span />
    </div>
    <ul className={styles.lista}>
      {ficha.produtosInteresse.map((p, i) => {
        const item = estruturarProduto(p)
        const marcador = produtoNaoTrabalhado(p)
        return <li key={i} className={`${styles.grade} ${styles.linha}`}>
          {edicao?.indice === i ? <Input
            autoFocus
            aria-label={`Nome do produto na linha ${i + 1}`}
            className={styles.editarNome}
            value={edicao.valor}
            maxLength={FICHA_PRODUTO_MAX_CHARS}
            onFocus={event => event.target.select()}
            onChange={event => {
              const campo = event.target
              const nome = maiusculasNomeComCursor(campo.value, campo.selectionStart ?? 0, campo.selectionEnd ?? 0)
              setEdicao({ indice: i, valor: nome.valor })
              requestAnimationFrame(() => campo.setSelectionRange(nome.inicio, nome.fim))
              setErro('')
            }}
            onBlur={event => {
              if (!(event.relatedTarget instanceof Element && event.relatedTarget.closest('[data-remover-produto]'))) confirmarNome()
            }}
            onKeyDown={event => {
              if (event.nativeEvent.isComposing) return
              if (event.key === 'Enter') { event.preventDefault(); confirmarNome() }
              if (event.key === 'Escape') { event.preventDefault(); edicaoAbertaRef.current = false; setEdicao(null); setErro('') }
            }}
          /> : marcador ? <span className={styles.nome}>{item.descricao}</span> : <button type="button" className={`${styles.nome} ${styles.nomeEditavel}`} aria-label={`Editar nome de ${item.descricao}, linha ${i + 1}`} onClick={() => { edicaoAbertaRef.current = true; setEdicao({ indice: i, valor: item.descricao }); setErro('') }}>{item.descricao}</button>}
          {marcador ? <span className={`${styles.quantidadePosicao} text-center text-slate-400`}>—</span> : <div className={`${styles.quantidadePosicao} ${styles.quantidade}`}>
            <button type="button" className={styles.controle} aria-label={`Diminuir quantidade de ${item.descricao}`} disabled={item.quantidade === null || item.quantidade <= 1} onClick={() => mudarLinha(i, p => ({ ...estruturarProduto(p), quantidade: Math.max(1, (estruturarProduto(p).quantidade ?? 1) - 1) }))}>
              <Minus className="size-4" aria-hidden="true" />
            </button>
            <span className={styles.numero} title={item.quantidade === null ? 'Quantidade não informada' : undefined}>{item.quantidade ?? 'N/I'}</span>
            <button type="button" className={styles.controle} aria-label={`Aumentar quantidade de ${item.descricao}`} disabled={item.quantidade === QUANTIDADE_PRODUTO_MAX} onClick={() => mudarLinha(i, incrementarProduto)}>
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </div>}
          {marcador ? <span className="text-center text-slate-400">—</span> : <button
            type="button"
            className={styles.toggle}
            data-vendido={item.vendido === null ? 'desconhecido' : item.vendido ? 'sim' : 'nao'}
            aria-label={`Vendido: ${item.descricao}`}
            aria-pressed={item.vendido === null ? 'mixed' : item.vendido}
            title={item.vendido === null ? 'Venda não informada' : item.vendido ? 'Vendido: Sim' : 'Vendido: Não'}
            onClick={() => {
              if (item.quantidade === null) { setErro('Informe a quantidade pelo botão + antes de marcar a venda.'); return }
              setErro('')
              mudarLinha(i, p => ({ ...estruturarProduto(p), vendido: estruturarProduto(p).vendido !== true }))
            }}
          >
            {item.vendido === null ? 'N/I' : item.vendido ? <><CheckCircle2 className="size-3 shrink-0" aria-hidden="true" /><span>Vendido</span></> : 'Marcar'}
          </button>}
          <button type="button" className={styles.remover} data-remover-produto aria-label={`Remover ${item.descricao}`} onClick={() => { edicaoAbertaRef.current = false; setEdicao(null); setErro(''); atualizar(atual => ({ ...atual, versaoProdutos: 2, produtosInteresse: atual.produtosInteresse.filter((_, index) => index !== i).map(estruturarProduto) })) }}>
            <X className="size-4" aria-hidden="true" />
          </button>
        </li>
      })}
    </ul>
    {ficha.produtosInteresse.some(p => !produtoNaoTrabalhado(p) && (estruturarProduto(p).quantidade === null || estruturarProduto(p).vendido === null)) && <p className="mt-2 text-xs text-slate-600">N/I: não informado no histórico. Os dados só mudam quando você os preencher.</p>}
    <IndicadorPv produtos={ficha.produtosInteresse} versaoProdutos={ficha.versaoProdutos} />
    <AvisoProdutosVendidos ficha={ficha} />
  </div>
}
