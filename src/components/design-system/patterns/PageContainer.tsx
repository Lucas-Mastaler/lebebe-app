import { cn } from '@/lib/utils'

/**
 * Page Container oficial — a página usa 100% da área útil disponível
 * (depois da Sidebar), com gutters laterais oficiais: 16px mobile, 24px
 * tablet (`sm:`, 640px+), 32px desktop (`lg:`, 1024px+). Sem `max-width`
 * — a limitação, quando fizer sentido (ex. formulário simples), é
 * responsabilidade do conteúdo interno, não do container da página (ver
 * `docs/design-system/foundations.md`, "Layout / Page Shell").
 *
 * `LayoutWrapper` (`src/components/LayoutWrapper.tsx`, não alterado)
 * já envolve toda página autenticada num wrapper com `p-4 sm:p-6` — as
 * margens negativas abaixo cancelam exatamente esse padding ambiente
 * (16px mobile / 24px sm+) antes de reaplicar os gutters oficiais, para
 * este componente funcionar corretamente dentro do shell atual sem
 * precisar alterá-lo e sem duplicar a compensação da Sidebar (que já é
 * feita pelo `<main>` do próprio `LayoutWrapper`).
 */
export function PageContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('-mx-4 px-4 py-4 sm:-mx-6 sm:px-6 sm:py-6 lg:px-8', className)}>{children}</div>
}
