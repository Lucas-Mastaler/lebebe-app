import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * Logo oficial (`public/logo.png`, 500x500 com ~60% de margem transparente
 * em volta do desenho). O recorte é feito via `object-cover` +
 * `object-position`: o container tem proporção 5:2 e mostra só a faixa
 * vertical onde o logo realmente está, então a largura passada em
 * `className` (ex.: `w-[140px]`) é a largura real do desenho — sem
 * duplicar nem editar o arquivo.
 */
export function BrandLogo({
  className,
  priority = false,
  sizes,
}: {
  className?: string
  priority?: boolean
  sizes?: string
}) {
  return (
    <span className={cn('relative block aspect-[5/2]', className)}>
      <Image
        src="/logo.png"
        alt="Le Bébé"
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover object-[50%_53%]"
      />
    </span>
  )
}
