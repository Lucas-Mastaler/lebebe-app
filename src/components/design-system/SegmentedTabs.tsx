import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

/**
 * Tabs oficial (TAB=C — segmentado tonal). Reaproveita o `Tabs` do Radix
 * já existente em `src/components/ui/tabs.tsx` (não alterado — aquele
 * componente continua com o visual "pills" que outras telas já usam),
 * só troca o `className` para o visual segmentado aprovado.
 */
export { Tabs, TabsContent }

export function SegmentedTabsList({ className, ...props }: React.ComponentProps<typeof TabsList>) {
  return <TabsList className={cn('h-auto w-full gap-0 rounded-full bg-primary/10 p-1', className)} {...props} />
}

export function SegmentedTabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsTrigger>) {
  return (
    <TabsTrigger
      className={cn('flex-1 rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none', className)}
      {...props}
    />
  )
}
