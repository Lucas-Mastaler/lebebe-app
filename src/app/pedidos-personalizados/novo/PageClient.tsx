'use client'

import { ClipboardPlus } from 'lucide-react'
import { FormPageContent, PageContainer, PageHeader } from '@/components/design-system'
import FormularioNovoPedido from '@/components/pedidos-personalizados/FormularioNovoPedido'

export default function NovoPedidoPersonalizadoPageClient() {
  return (
    <PageContainer className="space-y-6">
      <FormPageContent className="space-y-6">
        <PageHeader
          icon={<ClipboardPlus className="size-6" />}
          eyebrow="Pedidos personalizados"
          title="Novo pedido personalizado"
          description="Preencha os dados comerciais e escolha o fornecedor para continuar."
        />
        <FormularioNovoPedido />
      </FormPageContent>
    </PageContainer>
  )
}
