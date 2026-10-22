import { Alert, Badge, Section } from '@/components/design-system'
import type { HistoricoVendaSgiDTO } from '@/lib/atendimento-presencial/historico-cliente'
import { MENSAGENS_DIAGNOSTICO_SGI, type ResolucaoVendasSgi } from '@/lib/atendimento-presencial/vendas-sgi-diagnostico'

const dinheiro = (valor: number | null) => valor === null ? 'Não informado' : valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function DiagnosticosVendaSgi({ diagnosticos }: { diagnosticos?: ResolucaoVendasSgi['diagnosticos'] }) {
  return <>{Object.entries(diagnosticos ?? {}).filter(([motivo, quantidade]) => quantidade && motivo !== 'associado' && motivo !== 'ja_identificada').map(([motivo, quantidade]) => (
    <Alert key={motivo} tone="info">{MENSAGENS_DIAGNOSTICO_SGI[motivo as keyof typeof MENSAGENS_DIAGNOSTICO_SGI]}{quantidade > 1 ? ` (${quantidade} atendimentos)` : ''}</Alert>
  ))}</>
}

export function VendaSgiAtendimento({ venda, diagnosticos }: { venda?: HistoricoVendaSgiDTO | null; diagnosticos?: ResolucaoVendasSgi['diagnosticos'] }) {
  return <Section className="mb-4 inline-block w-full break-inside-avoid" title="Venda oficial do SGI" description="Dados comerciais importados do SGI" tone="section-2">
    <DiagnosticosVendaSgi diagnosticos={diagnosticos} />
    {venda && <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><strong>Lançamento {venda.numeroLancamento}</strong><Badge tone="success">{venda.origemAssociacao === 'prancheta' ? 'Identificada pela Prancheta' : 'Identificada no SGI'}</Badge></div>
      <dl className="grid gap-2 sm:grid-cols-2">
        <div><dt className="font-semibold">Documento</dt><dd>{venda.numeroDocumento ?? 'Não informado'}</dd></div>
        <div><dt className="font-semibold">Filial</dt><dd>{venda.filial ?? 'Não informada'}</dd></div>
        <div><dt className="font-semibold">Data da venda</dt><dd>{venda.data ? new Date(venda.data).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Não informada'}</dd></div>
        <div><dt className="font-semibold">Valor total</dt><dd>{dinheiro(venda.valorTotal)}</dd></div>
        <div><dt className="font-semibold">Vendedor</dt><dd>{venda.vendedor ?? 'Não informado'}</dd></div>
        <div><dt className="font-semibold">Status</dt><dd>{venda.status ?? 'Não informado'}</dd></div>
      </dl>
      <div><p className="font-semibold">Produtos</p>{venda.produtos.length ? <ul className="list-inside list-disc space-y-1">{venda.produtos.map((produto, index) => <li key={index}>{produto.quantidade ?? '—'} × {produto.nome} · {dinheiro(produto.valorTotal)}</li>)}</ul> : <p>Sem produtos informados no SGI.</p>}</div>
      <div><p className="font-semibold">Pagamentos</p>{venda.pagamentos?.length ? <ul className="list-inside list-disc space-y-1">{venda.pagamentos.map((pagamento, index) => <li key={index}>{pagamento.forma ?? 'Não informada'} · {dinheiro(pagamento.valor)}{pagamento.parcelas ? ` · ${pagamento.parcelas} parcela(s)` : ''}</li>)}</ul> : <p>Sem pagamentos informados no SGI.</p>}</div>
    </div>}
  </Section>
}
