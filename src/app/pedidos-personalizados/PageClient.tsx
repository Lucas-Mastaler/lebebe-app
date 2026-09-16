'use client'

import Link from 'next/link'
import { PackageSearch, Plus } from 'lucide-react'
import { Button, PageContainer, PageHeader } from '@/components/design-system'
import { GestaoPedidosPersonalizados } from '@/components/pedidos-personalizados/GestaoPedidosPersonalizados'

export default function PedidosPersonalizadosPageClient() {
  return (
    <PageContainer className="space-y-6">
      <PageHeader
        icon={<PackageSearch className="size-6" />}
        eyebrow="Pedidos personalizados"
        title="Gestão de pedidos"
        description="Consulte, revise e atualize pedidos Moriah no seu escopo de unidades."
        action={
          <Button asChild className="min-h-11">
            <Link href="/pedidos-personalizados/novo"><Plus />Novo pedido</Link>
          </Button>
        }
      />
      <GestaoPedidosPersonalizados />
    </PageContainer>
  )
}
