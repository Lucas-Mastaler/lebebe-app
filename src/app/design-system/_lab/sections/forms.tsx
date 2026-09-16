import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DecisionBlock } from '../DecisionBlock'

function FieldSet({
  inputClass,
  selectClass,
  textareaClass,
  labelClass,
}: {
  inputClass: string
  selectClass: string
  textareaClass: string
  labelClass: string
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>Nome do cliente</label>
        <input defaultValue="Ana Souza" className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Unidade</label>
        <Select defaultValue="centro">
          <SelectTrigger className={selectClass}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="centro">Unidade Centro</SelectItem>
            <SelectItem value="norte">Unidade Norte</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className={labelClass}>Observações</label>
        <textarea rows={2} placeholder="Opcional" className={textareaClass} />
      </div>
      <div>
        <label className={labelClass}>Telefone *</label>
        <input aria-invalid placeholder="(00) 00000-0000" className={`${inputClass} border-red-400 focus:border-red-500`} />
        <p className="mt-1 text-[11px] text-red-600" role="alert">Campo obrigatório.</p>
      </div>
      <div>
        <label className={`${labelClass} opacity-60`}>Código interno</label>
        <input defaultValue="AUTO-GERADO" disabled className={`${inputClass} cursor-not-allowed opacity-50`} />
      </div>
    </div>
  )
}

export function FormsSection() {
  return (
    <DecisionBlock
      code="INP"
      title="Sistema de campos"
      description="Input, select, textarea, estado de erro e estado desabilitado — mostrados juntos para comparar o mesmo formulário."
      options={[
        {
          letter: 'A',
          label: 'Atual (com borda)',
          note: 'Border-box com foco em anel — o que Input/Select já implementam hoje.',
          content: (
            <FieldSet
              labelClass="mb-1 block text-xs font-medium text-slate-700"
              inputClass="h-8 w-full rounded-md border border-slate-300 bg-transparent px-2.5 text-xs outline-none focus:border-[#00A5E6] focus:ring-2 focus:ring-[#00A5E6]/30"
              selectClass="h-8 w-full rounded-md border border-slate-300 bg-transparent px-2.5 text-xs"
              textareaClass="w-full rounded-md border border-slate-300 bg-transparent px-2.5 py-1.5 text-xs outline-none focus:border-[#00A5E6] focus:ring-2 focus:ring-[#00A5E6]/30"
            />
          ),
        },
        {
          letter: 'B',
          label: 'Preenchido (filled)',
          note: 'Fundo sólido, sem borda visível até o foco — comum em produtos mais "modernos".',
          content: (
            <FieldSet
              labelClass="mb-1 block text-xs font-medium text-slate-700"
              inputClass="h-8 w-full rounded-md border border-transparent bg-slate-100 px-2.5 text-xs outline-none focus:border-[#00A5E6] focus:bg-white"
              selectClass="h-8 w-full rounded-md border border-transparent bg-slate-100 px-2.5 text-xs"
              textareaClass="w-full rounded-md border border-transparent bg-slate-100 px-2.5 py-1.5 text-xs outline-none focus:border-[#00A5E6] focus:bg-white"
            />
          ),
        },
        {
          letter: 'C',
          label: 'Underline minimalista',
          note: 'Sem caixa — só uma linha inferior. Visual mais denso/tabular.',
          content: (
            <FieldSet
              labelClass="mb-1 block text-xs font-medium text-slate-600"
              inputClass="h-7 w-full border-b border-slate-300 bg-transparent px-0.5 text-xs outline-none focus:border-b-2 focus:border-[#00A5E6]"
              selectClass="h-7 w-full rounded-none border-0 border-b border-slate-300 bg-transparent px-0.5 text-xs shadow-none"
              textareaClass="w-full border-b border-slate-300 bg-transparent px-0.5 py-1 text-xs outline-none focus:border-b-2 focus:border-[#00A5E6]"
            />
          ),
        },
      ]}
    />
  )
}
