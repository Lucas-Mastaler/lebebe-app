'use client'
import { useRef } from 'react'
import { Button, Section } from '@/components/design-system'
import type { ArtigoFormularioDecorisi } from '@/lib/pedidos-personalizados/decorisi/formulario'

export function AnexosDecorisi({
  artigo,
  bloqueado,
  salvo,
  onArquivo,
  onExcluir,
  onAbrir,
  operacoes = { adicionar: true, substituir: true, remover: true },
}: {
  artigo: Pick<ArtigoFormularioDecorisi, 'anexos'>
  bloqueado: boolean
  salvo: boolean
  onArquivo: (arquivo: File, slot: number, anexoId?: string) => Promise<void>
  onExcluir: (id: string) => void
  onAbrir: (id: string) => void
  operacoes?: { adicionar: boolean; substituir: boolean; remover: boolean }
}) {
  const selecao = useRef<HTMLInputElement>(null)
  const alvo = useRef<{ slot: number; id?: string }>({ slot: 1 })
  function selecionar(slot: number, id?: string) {
    alvo.current = { slot, id }
    selecao.current?.click()
  }
  return (
    <Section
      title="Anexos"
      description={`${artigo.anexos.length}/5 arquivos · JPEG, PNG, WEBP ou PDF · até 10 MiB cada`}
    >
      {!salvo && (
        <p className="mb-3 text-sm text-muted-foreground">
          Salve o rascunho e suas alterações antes de gerenciar os arquivos
          deste produto.
        </p>
      )}
      <input
        ref={selecao}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-label="Selecionar arquivo do produto"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        disabled={bloqueado || !salvo}
        onChange={(e) => {
          const arquivo = e.target.files?.[0]
          e.target.value = ''
          if (arquivo)
            void onArquivo(arquivo, alvo.current.slot, alvo.current.id)
        }}
      />
      <ul className="space-y-2">
        {artigo.anexos.map((a) => (
          <li
            key={a.id}
            className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2"
          >
            <span className="min-w-0 flex-1 break-all text-sm">
              {a.nome_original}
            </span>
            <Button
              type="button"
              variant="secondary"
              disabled={bloqueado}
              onClick={() => onAbrir(a.id)}
            >
              Abrir
            </Button>
            {operacoes.substituir && <Button
              type="button"
              variant="secondary"
              disabled={bloqueado || !salvo}
              onClick={() => selecionar(a.slot, a.id)}
            >
              Substituir
            </Button>}
            {operacoes.remover && <Button
              type="button"
              variant="destructive"
              disabled={bloqueado || !salvo}
              onClick={() => onExcluir(a.id)}
            >
              Remover
            </Button>}
          </li>
        ))}
      </ul>
      {operacoes.adicionar && <Button
        type="button"
        variant="secondary"
        className="mt-3"
        disabled={bloqueado || !salvo || artigo.anexos.length >= 5}
        onClick={() =>
          selecionar(
            [1, 2, 3, 4, 5].find(
              (s) => !artigo.anexos.some((a) => a.slot === s),
            )!,
          )
        }
      >
        Adicionar anexo
      </Button>}
    </Section>
  )
}
