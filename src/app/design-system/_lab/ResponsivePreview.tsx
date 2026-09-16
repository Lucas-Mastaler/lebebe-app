interface ResponsivePreviewProps {
  desktop: React.ReactNode
  mobile: React.ReactNode
}

/**
 * Mostra a mesma decisão em dois contextos reais — desktop e mobile —
 * sempre empilhados (nunca lado a lado): cada opção fica dentro de um card
 * estreito (1/3 da largura da página no grid de 3 colunas), e um layout
 * lado a lado baseado em breakpoint de viewport (em vez da largura real do
 * card) fazia o preview mobile vazar para fora da borda do card, sobre as
 * outras opções. Empilhado garante que sempre caiba dentro do card, em
 * qualquer largura de tela. O conteúdo mobile continua reorganizado de
 * verdade, não apenas encolhido.
 */
export function ResponsivePreview({ desktop, mobile }: ResponsivePreviewProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Desktop</p>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-2">{desktop}</div>
      </div>
      <div>
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Mobile</p>
        <div className="mx-auto w-[220px] max-w-full overflow-hidden rounded-[1.25rem] border-4 border-slate-800 bg-white shadow-md">
          <div className="max-h-[320px] overflow-y-auto p-1.5 text-[11px]">{mobile}</div>
        </div>
      </div>
    </div>
  )
}
