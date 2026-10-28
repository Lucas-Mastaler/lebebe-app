'use client'
import type { AnchorHTMLAttributes } from 'react'
import { useLaboratorio } from './LaboratorioContext'
export default function LinkSimulado(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { navegador } = useLaboratorio()
  return <a {...props} onClick={e => { e.preventDefault(); navegador.push(props.href ?? '') }} />
}
