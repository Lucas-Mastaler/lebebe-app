'use client'
import { createContext, useContext } from 'react'
import type { FichaCriancaRascunho } from '@/lib/atendimento-presencial/ficha-schema'
import type { Simulador } from './simulador'
import type { Evento, Produto, Resposta, Respostas } from './modelo'

export type Laboratorio = {
  simulador: Simulador
  respostas: Respostas
  eventos: Evento[]
  atendimento: string
  legado: boolean
  fases: Record<string, number>
  selecionarFase: (id: string, meses: number) => void
  responder: (id: string, produto: Produto, resposta: Resposta) => void
  selecionada: string
  selecionar: (id: string) => void
  erros: boolean
  validar: (criancas: FichaCriancaRascunho[]) => boolean
  navegador: { push: (url: string) => void; replace: (url: string, opcoes?: { scroll?: boolean }) => void; refresh: () => void }
}
export const LaboratorioContext = createContext<Laboratorio | null>(null)
export function useLaboratorio() {
  const contexto = useContext(LaboratorioContext)
  if (!contexto) throw new Error('Componente experimental fora do laboratório isolado')
  return contexto
}
