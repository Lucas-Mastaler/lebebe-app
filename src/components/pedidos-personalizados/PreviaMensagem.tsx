'use client'

import { Check, Copy, MessageSquareText } from 'lucide-react'
import { Alert, Button, Card, CardContent, CardHeader } from '@/components/design-system'

type Props = {
  mensagem: string | null
  copiada: boolean
  onCopiar: () => void
  titulo?: string
  subtitulo?: string
  rotuloBotao?: string
  orientacaoObservacoes?: boolean
}

export function PreviaMensagem({
  mensagem,
  copiada,
  onCopiar,
  titulo = 'Prévia da mensagem comercial',
  subtitulo = 'Gerada automaticamente a partir do formulário.',
  rotuloBotao = 'Copiar mensagem',
  orientacaoObservacoes = false,
}: Props) {
  return (
    <Card>
      <CardHeader
        icon={<MessageSquareText />}
        title={titulo}
        description={subtitulo}
        action={
          <Button type="button" variant="secondary" className="min-h-11" disabled={!mensagem} onClick={onCopiar}>
            {copiada ? <Check /> : <Copy />}
            {copiada ? 'Copiado' : rotuloBotao}
          </Button>
        }
      />
      <CardContent>
        {orientacaoObservacoes && (
          <Alert tone="info" className="mb-3">Esta informação deve ser colocada nas observações do pedido de venda.</Alert>
        )}
        <pre className="max-h-[32rem] min-h-40 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-4 text-sm leading-relaxed text-slate-50" aria-live="polite">
          {mensagem ?? 'Preencha os campos obrigatórios e as medidas para gerar a prévia.'}
        </pre>
      </CardContent>
    </Card>
  )
}
