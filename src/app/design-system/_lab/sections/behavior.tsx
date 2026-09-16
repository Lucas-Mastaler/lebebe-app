'use client'

import * as React from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  Eye,
  Loader2,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
} from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  Dialog as DsDialog,
  DialogBody as DsDialogBody,
  DialogContent as DsDialogContent,
  DialogHeader as DsDialogHeader,
} from '@/components/design-system'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { DecisionBlock } from '../DecisionBlock'
import { FixedRuleBlock } from '../FixedRuleBlock'
import { CATEGORY_J_SUBGROUPS, decisionsBySubgroup } from '../registry'

function subgroupAnchor(id: string) {
  return `subgrupo-${id.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

function SubgroupNav() {
  return (
    <nav aria-label="Subgrupos de comportamento" className="mb-6 flex flex-wrap gap-1.5">
      {CATEGORY_J_SUBGROUPS.map((s) => (
        <a
          key={s.id}
          href={`#${subgroupAnchor(s.id)}`}
          className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-emerald-400 hover:text-emerald-700"
        >
          {s.title} ({decisionsBySubgroup(s.id).length})
        </a>
      ))}
    </nav>
  )
}

function Subgroup({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <details id={subgroupAnchor(id)} open className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white/60 p-4 sm:p-5">
      <summary className="cursor-pointer list-none">
        <span className="flex items-center gap-2 text-base font-bold text-slate-800">
          <ChevronDown className="size-4 shrink-0 text-slate-400 transition group-open:rotate-180" />
          {id}
        </span>
      </summary>
      <div className="mt-5 space-y-10 border-t border-slate-100 pt-5">{children}</div>
    </details>
  )
}

// =========================================================================
// J.1 — Filtros e consultas
// =========================================================================

function FiltrosExecDemo() {
  const [statusDraft, setStatusDraft] = React.useState('todos')
  const [statusApplied, setStatusApplied] = React.useState('todos')
  const [resultCount, setResultCount] = React.useState(24)
  const dirty = statusDraft !== statusApplied

  function aplicar() {
    setStatusApplied(statusDraft)
    setResultCount(statusDraft === 'todos' ? 24 : statusDraft === 'producao' ? 9 : 3)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={statusDraft}
          onChange={(e) => setStatusDraft(e.target.value)}
          className="h-8 rounded border border-slate-300 bg-white px-2 text-xs"
        >
          <option value="todos">Todos os status</option>
          <option value="producao">Em produção</option>
          <option value="atraso">Em atraso</option>
        </select>
        <button
          onClick={aplicar}
          className="flex items-center gap-1 rounded-md bg-[#00A5E6] px-3 py-1.5 text-xs font-semibold text-white"
        >
          <Search className="size-3.5" />
          Filtrar
        </button>
      </div>
      <p className="text-[11px] text-slate-500">
        Mostrando <strong>{resultCount}</strong> pedidos
        {dirty && <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">filtro alterado, clique em Filtrar</span>}
      </p>
      <p className="text-[10px] text-slate-400">Troque o select acima — repare que a contagem só muda quando você clica em &quot;Filtrar&quot;.</p>
    </div>
  )
}

function FltClrDemoA() {
  const [field, setField] = React.useState('Ana')
  const [applied, setApplied] = React.useState('Ana')
  return (
    <div className="space-y-2">
      <input value={field} onChange={(e) => setField(e.target.value)} className="h-7 w-full rounded border border-slate-300 px-2 text-[11px]" />
      <div className="flex gap-1.5">
        <button onClick={() => setApplied(field)} className="rounded bg-[#00A5E6] px-2 py-1 text-[10px] font-semibold text-white">Filtrar</button>
        <button onClick={() => setField('')} className="rounded border border-slate-300 px-2 py-1 text-[10px] text-slate-600">Limpar</button>
      </div>
      <p className="text-[10px] text-slate-500">Listagem ainda mostra: <strong>&quot;{applied}&quot;</strong> (só muda ao clicar Filtrar de novo)</p>
    </div>
  )
}

function FltClrDemoB() {
  const [field, setField] = React.useState('Ana')
  const [applied, setApplied] = React.useState('Ana')
  return (
    <div className="space-y-2">
      <input value={field} onChange={(e) => setField(e.target.value)} className="h-7 w-full rounded border border-slate-300 px-2 text-[11px]" />
      <div className="flex gap-1.5">
        <button onClick={() => setApplied(field)} className="rounded bg-[#00A5E6] px-2 py-1 text-[10px] font-semibold text-white">Filtrar</button>
        <button
          onClick={() => {
            setField('')
            setApplied('')
          }}
          className="rounded border border-slate-300 px-2 py-1 text-[10px] text-slate-600"
        >
          Limpar
        </button>
      </div>
      <p className="text-[10px] text-slate-500">Listagem: {applied ? <strong>&quot;{applied}&quot;</strong> : <strong>todos os pedidos (resetou na hora)</strong>}</p>
    </div>
  )
}

function FltClrDemoC() {
  const [field, setField] = React.useState('Ana')
  const [applied, setApplied] = React.useState('Ana')
  const [open, setOpen] = React.useState(true)
  return (
    <div className="space-y-2">
      {open && <input value={field} onChange={(e) => setField(e.target.value)} className="h-7 w-full rounded border border-slate-300 px-2 text-[11px]" />}
      <div className="flex gap-1.5">
        <button onClick={() => setApplied(field)} className="rounded bg-[#00A5E6] px-2 py-1 text-[10px] font-semibold text-white">Filtrar</button>
        <button
          onClick={() => {
            setField('')
            setApplied('')
            setOpen(true)
          }}
          className="rounded border border-slate-300 px-2 py-1 text-[10px] text-slate-600"
        >
          Limpar
        </button>
      </div>
      <p className="text-[10px] text-slate-500">
        Listagem: {applied ? <strong>&quot;{applied}&quot;</strong> : <strong>todos os pedidos</strong>} — Limpar reseta a listagem{' '}
        <strong>e</strong> mantém o painel de filtros aberto pronto para nova busca.
      </p>
    </div>
  )
}

// =========================================================================
// J.2 — Formulários e validação
// =========================================================================

function validaEmail(v: string) {
  return /.+@.+\..+/.test(v) ? '' : 'Informe um e-mail válido.'
}

function ValDemoA() {
  const [value, setValue] = React.useState('')
  const [error, setError] = React.useState('')
  const [tried, setTried] = React.useState(false)
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-medium text-slate-700">E-mail</label>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-invalid={!!error}
        className={`h-7 w-full rounded border px-2 text-[11px] ${error ? 'border-red-400' : 'border-slate-300'}`}
      />
      {error && <p className="text-[10px] text-red-600">{error}</p>}
      <button
        onClick={() => {
          setTried(true)
          setError(validaEmail(value))
        }}
        className="rounded bg-[#00A5E6] px-2 py-1 text-[10px] font-semibold text-white"
      >
        Salvar
      </button>
      {!tried && <p className="text-[10px] text-slate-400">Nada é validado até você clicar em Salvar.</p>}
    </div>
  )
}

function ValDemoB() {
  const [value, setValue] = React.useState('')
  const [touched, setTouched] = React.useState(false)
  const error = touched ? validaEmail(value) : ''
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-medium text-slate-700">E-mail</label>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => setTouched(true)}
        aria-invalid={!!error}
        className={`h-7 w-full rounded border px-2 text-[11px] ${error ? 'border-red-400' : 'border-slate-300'}`}
      />
      {error && <p className="text-[10px] text-red-600">{error}</p>}
      <button onClick={() => setTouched(true)} className="rounded bg-[#00A5E6] px-2 py-1 text-[10px] font-semibold text-white">
        Salvar
      </button>
      {!touched && <p className="text-[10px] text-slate-400">Valida ao sair do campo (blur) — clique dentro e depois fora.</p>}
    </div>
  )
}

function ValDemoC() {
  const [value, setValue] = React.useState('')
  const [touched, setTouched] = React.useState(false)
  const error = touched ? validaEmail(value) : ''
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-medium text-slate-700">E-mail</label>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => setTouched(true)}
        aria-invalid={!!error}
        className={`h-7 w-full rounded border px-2 text-[11px] ${error ? 'border-red-400' : 'border-slate-300'}`}
      />
      {error && <p className="text-[10px] text-red-600">{error}</p>}
      <p className="text-[10px] text-slate-400">
        {touched ? 'Erro some em tempo real assim que o e-mail ficar válido — digite algo com @ e domínio.' : 'Saia do campo para ver a validação.'}
      </p>
    </div>
  )
}

function ErrDemo({ variant }: { variant: 'A' | 'B' | 'C' }) {
  const [serverError, setServerError] = React.useState(false)
  return (
    <div className="space-y-2">
      {variant === 'A' && (
        <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-[10px] text-red-700">
          2 campos precisam de atenção: <a href="#" className="underline">Nome</a>, <a href="#" className="underline">Telefone</a>
        </div>
      )}
      <div>
        <label className="block text-[11px] font-medium text-slate-700">Nome *</label>
        <input aria-invalid className="h-7 w-full rounded border border-red-400 px-2 text-[11px]" />
        <p className="text-[10px] text-red-600">Campo obrigatório.</p>
      </div>
      <div>
        <label className="block text-[11px] font-medium text-slate-700">Telefone *</label>
        <input aria-invalid className="h-7 w-full rounded border border-red-400 px-2 text-[11px]" />
        <p className="text-[10px] text-red-600">Formato inválido.</p>
      </div>
      {variant === 'C' && (
        <>
          <button onClick={() => setServerError((v) => !v)} className="rounded border border-slate-300 px-2 py-1 text-[10px] text-slate-600">
            Simular erro de servidor
          </button>
          {serverError && (
            <div className="flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-[10px] text-amber-800">
              <AlertTriangle className="size-3 shrink-0" />
              Não foi possível salvar — tente novamente (erro de servidor, diferente dos erros de campo acima).
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ReqDemo({ variant }: { variant: 'A' | 'B' | 'C' }) {
  return (
    <div className="space-y-2 text-[11px]">
      <div>
        <label className="block font-medium text-slate-700">
          Nome{variant !== 'B' && <span className="text-red-500"> *</span>}
        </label>
        <input className="h-7 w-full rounded border border-slate-300 px-2" />
      </div>
      <div>
        <label className="block font-medium text-slate-700">
          Observações{(variant === 'B' || variant === 'C') && <span className="text-slate-400"> (opcional)</span>}
        </label>
        <input className="h-7 w-full rounded border border-slate-300 px-2" />
      </div>
    </div>
  )
}

function normalizeCpf(v: string) {
  return v.replace(/\D/g, '').slice(0, 11)
}
function maskCpfFixed(digits: string) {
  const p = digits.padEnd(11, '_').split('')
  return `${p[0]}${p[1]}${p[2]}.${p[3]}${p[4]}${p[5]}.${p[6]}${p[7]}${p[8]}-${p[9]}${p[10]}`.replace(/_/g, '')
}
function maskCpfProgressive(digits: string) {
  let out = digits
  if (digits.length > 9) out = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
  else if (digits.length > 6) out = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  else if (digits.length > 3) out = `${digits.slice(0, 3)}.${digits.slice(3)}`
  return out
}

function MskDemo({ variant }: { variant: 'A' | 'B' | 'C' }) {
  const [digits, setDigits] = React.useState('')
  const [blurred, setBlurred] = React.useState(false)

  let display = digits
  if (variant === 'A') display = maskCpfFixed(digits)
  if (variant === 'B') display = blurred ? maskCpfProgressive(digits) : digits
  if (variant === 'C') display = maskCpfProgressive(digits)

  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-medium text-slate-700">CPF</label>
      <input
        value={display}
        onChange={(e) => setDigits(normalizeCpf(e.target.value))}
        onBlur={() => setBlurred(true)}
        placeholder="000.000.000-00"
        className="h-7 w-full rounded border border-slate-300 px-2 font-mono text-[11px]"
      />
      <p className="text-[10px] text-slate-400">
        {variant === 'A' && 'Máscara fixa: os separadores já aparecem enquanto você digita os números.'}
        {variant === 'B' && 'Digite só números — a formatação aparece ao sair do campo (blur).'}
        {variant === 'C' && 'Formatação progressiva: pontuação aparece conforme os dígitos avançam, sem nada fixo antes da hora.'}
      </p>
    </div>
  )
}

const MASK_REFERENCE = [
  { tipo: 'CPF', exibicao: '000.000.000-00', digitado: 'só números', normalizado: 'string de 11 dígitos' },
  { tipo: 'CNPJ', exibicao: '00.000.000/0000-00', digitado: 'só números', normalizado: 'string de 14 dígitos' },
  { tipo: 'Telefone', exibicao: '(00) 00000-0000', digitado: 'só números', normalizado: 'string de 10-11 dígitos com DDD' },
  { tipo: 'CEP', exibicao: '00000-000', digitado: 'só números', normalizado: 'string de 8 dígitos' },
  { tipo: 'Moeda', exibicao: 'R$ 1.234,56', digitado: 'dígitos da direita para a esquerda', normalizado: 'number em centavos ou decimal' },
  { tipo: 'Percentual', exibicao: '12,5%', digitado: 'números + vírgula', normalizado: 'number (0–100 ou 0–1, a decidir)' },
  { tipo: 'Data', exibicao: 'dd/mm/aaaa', digitado: 'só números ou calendário', normalizado: 'ISO 8601 (aaaa-mm-dd)' },
  { tipo: 'Hora', exibicao: 'hh:mm', digitado: 'só números', normalizado: 'string HH:mm (24h)' },
  { tipo: 'Quantidade', exibicao: '12', digitado: 'só números inteiros', normalizado: 'number inteiro' },
  { tipo: 'Decimal', exibicao: '12,5', digitado: 'números + vírgula', normalizado: 'number (ponto internamente)' },
]

function MaskReferenceTable() {
  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
          Recomendação técnica — não aprovada automaticamente
        </span>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[11px]">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-1 pr-3">Tipo</th>
              <th className="py-1 pr-3">Exibição</th>
              <th className="py-1 pr-3">Digitação</th>
              <th className="py-1">Valor normalizado</th>
            </tr>
          </thead>
          <tbody>
            {MASK_REFERENCE.map((r) => (
              <tr key={r.tipo} className="border-b border-slate-100 last:border-0">
                <td className="py-1 pr-3 font-medium text-slate-700">{r.tipo}</td>
                <td className="py-1 pr-3 font-mono text-slate-600">{r.exibicao}</td>
                <td className="py-1 pr-3 text-slate-500">{r.digitado}</td>
                <td className="py-1 text-slate-500">{r.normalizado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-slate-400">
        Ao colar um valor já formatado (ex. CPF com pontos), a proposta é sempre normalizar removendo a formatação antes de
        aplicar a máscara — comportamento igual em qualquer uma das 3 opções acima.
      </p>
    </div>
  )
}

// =========================================================================
// J.3 — Ações e confirmações
// =========================================================================

function SavDemo({ variant }: { variant: 'A' | 'B' | 'C' }) {
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [simulateError, setSimulateError] = React.useState(false)

  function handleClick() {
    if (status === 'loading') return
    setStatus('loading')
    setTimeout(() => {
      if (simulateError) {
        setStatus('error')
        setTimeout(() => setStatus('idle'), 1800)
      } else {
        setStatus('success')
        setTimeout(() => setStatus('idle'), 1500)
      }
    }, 1000)
  }

  const label = status === 'loading' ? 'Salvando...' : status === 'success' ? 'Salvo!' : status === 'error' ? 'Falhou' : 'Salvar pedido'

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-[10px] text-slate-500">
        <input type="checkbox" checked={simulateError} onChange={(e) => setSimulateError(e.target.checked)} />
        simular erro
      </label>
      {variant === 'A' && (
        <button
          onClick={handleClick}
          disabled={status === 'loading'}
          className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-white transition disabled:opacity-80 ${
            status === 'success' ? 'bg-emerald-600' : status === 'error' ? 'bg-red-500' : 'bg-[#00A5E6]'
          }`}
        >
          {status === 'loading' && <Loader2 className="size-3.5 animate-spin" />}
          {status === 'success' && <Check className="size-3.5" />}
          {label}
        </button>
      )}
      {variant === 'B' && (
        <button
          onClick={handleClick}
          disabled={status === 'loading'}
          className="flex size-8 items-center justify-center rounded-md bg-[#00A5E6] text-white disabled:opacity-80"
          aria-label="Salvar"
        >
          {status === 'loading' ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        </button>
      )}
      {variant === 'C' && (
        <div className="relative inline-block">
          <button
            onClick={handleClick}
            disabled={status === 'loading'}
            className="flex h-8 items-center gap-1.5 rounded-md bg-[#00A5E6] px-3 text-xs font-semibold text-white disabled:opacity-60"
          >
            {status === 'loading' && <Loader2 className="size-3.5 animate-spin" />}
            Salvar pedido
          </button>
          {status === 'loading' && <span className="absolute -right-1 -top-1 size-2 rounded-full bg-amber-400" title="reenvio bloqueado" />}
        </div>
      )}
      {status === 'success' && variant === 'B' && <p className="text-[10px] text-emerald-600">Pedido salvo.</p>}
      {status === 'error' && variant === 'B' && <p className="text-[10px] text-red-600">Erro ao salvar.</p>}
      <p className="text-[10px] text-slate-400">Clique rápido duas vezes — o botão trava durante o carregamento nas 3 opções.</p>
    </div>
  )
}

function UnsDemo({ variant }: { variant: 'A' | 'B' | 'C' }) {
  const [value, setValue] = React.useState('')
  const dirty = value.length > 0
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [closedMsg, setClosedMsg] = React.useState('')

  function tryClose() {
    if (!dirty) {
      setClosedMsg('Fechado (nada para confirmar).')
      return
    }
    if (variant === 'A') {
      setConfirmOpen(true)
    } else if (variant === 'B') {
      // indicador inline cuida disso — não faz nada aqui
    } else {
      setClosedMsg('Rascunho salvo localmente. Fechado.')
      setValue('')
    }
  }

  return (
    <div className="space-y-2">
      <input
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setClosedMsg('')
        }}
        placeholder="Digite algo para marcar como alterado"
        className="h-7 w-full rounded border border-slate-300 px-2 text-[11px]"
      />
      <div className="flex items-center gap-2">
        <button onClick={tryClose} className="rounded border border-slate-300 px-2 py-1 text-[10px] text-slate-600">
          Fechar
        </button>
        {variant === 'B' && dirty && (
          <>
            <span className="text-[10px] font-semibold text-amber-600">Alterações não salvas</span>
            <button
              onClick={() => {
                setValue('')
                setClosedMsg('Descartado.')
              }}
              className="rounded border border-red-300 px-2 py-1 text-[10px] text-red-600"
            >
              Descartar
            </button>
          </>
        )}
      </div>
      {closedMsg && <p className="text-[10px] text-slate-500">{closedMsg}</p>}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-xs p-4">
          <DialogHeader>
            <DialogTitle className="text-sm">Alterações não salvas</DialogTitle>
            <DialogDescription className="text-xs">Você tem alterações não salvas. Sair mesmo assim?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button onClick={() => setConfirmOpen(false)} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600">
              Cancelar
            </button>
            <button
              onClick={() => {
                setConfirmOpen(false)
                setValue('')
                setClosedMsg('Fechado sem salvar.')
              }}
              className="rounded bg-red-500 px-2 py-1 text-xs font-semibold text-white"
            >
              Sair sem salvar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DstDemo({ variant }: { variant: 'A' | 'B' | 'C' }) {
  const [deleted, setDeleted] = React.useState(false)
  const [confirmText, setConfirmText] = React.useState('')
  const [open, setOpen] = React.useState(false)

  if (variant === 'B') {
    return (
      <div className="space-y-2">
        <button
          onClick={() => {
            setDeleted(true)
            toast('Pedido movido para a lixeira', {
              action: { label: 'Desfazer', onClick: () => setDeleted(false) },
            })
          }}
          disabled={deleted}
          className="flex items-center gap-1.5 rounded-md border border-red-300 px-2.5 py-1.5 text-[11px] font-medium text-red-600 disabled:opacity-50"
        >
          <Trash2 className="size-3.5" />
          {deleted ? 'Movido para a lixeira' : 'Excluir (reversível)'}
        </button>
        <p className="text-[10px] text-slate-400">Sem modal — executa direto, com toast de &quot;Desfazer&quot; por alguns segundos.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button className="flex items-center gap-1.5 rounded-md border border-red-300 px-2.5 py-1.5 text-[11px] font-medium text-red-600">
            <Trash2 className="size-3.5" />
            Excluir pedido #4821
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-xs p-4">
          <DialogHeader>
            <DialogTitle className="text-sm">Excluir pedido #4821?</DialogTitle>
            <DialogDescription className="text-xs">Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          {variant === 'C' && (
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder='Digite "excluir" para confirmar'
              className="h-8 w-full rounded border border-slate-300 px-2 text-xs"
            />
          )}
          <DialogFooter>
            <button onClick={() => setOpen(false)} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600">
              Cancelar
            </button>
            <button
              disabled={variant === 'C' && confirmText.toLowerCase() !== 'excluir'}
              onClick={() => {
                setOpen(false)
                toast.success('Pedido excluído.')
              }}
              className="rounded bg-red-500 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40"
            >
              Excluir definitivamente
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <p className="text-[10px] text-slate-400">
        {variant === 'A' ? 'Modal padrão de confirmação, para qualquer ação destrutiva.' : 'Ação crítica: precisa digitar "excluir" para habilitar o botão.'}
      </p>
    </div>
  )
}

// =========================================================================
// J.4 — Feedback e carregamento
// =========================================================================

function FdbDemo({ variant }: { variant: 'A' | 'B' | 'C' }) {
  const [inlineMsg, setInlineMsg] = React.useState<{ kind: string; text: string } | null>(null)
  const [cardFlash, setCardFlash] = React.useState(false)

  function fire(kind: 'success' | 'warning' | 'error' | 'info') {
    const texts = { success: 'Pedido salvo.', warning: 'Prazo próximo do vencimento.', error: 'Falha ao salvar.', info: 'Fluxo Lebebe Exclusive.' }
    if (variant === 'A') {
      const fn = kind === 'success' ? toast.success : kind === 'error' ? toast.error : kind === 'warning' ? toast.warning : toast.info
      fn(texts[kind])
    } else if (variant === 'B') {
      if (kind === 'success') {
        setCardFlash(true)
        setTimeout(() => setCardFlash(false), 1200)
      } else {
        toast.error(texts[kind])
      }
    } else {
      setInlineMsg({ kind, text: texts[kind] })
      setTimeout(() => setInlineMsg(null), 2500)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {(['success', 'warning', 'error', 'info'] as const).map((k) => (
          <button key={k} onClick={() => fire(k)} className="rounded border border-slate-300 px-2 py-1 text-[10px] capitalize text-slate-600">
            {k}
          </button>
        ))}
      </div>
      {variant === 'B' && (
        <div className={`rounded-lg border p-2 text-[10px] transition ${cardFlash ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
          Card do pedido {cardFlash && '— salvo!'}
        </div>
      )}
      {variant === 'C' && inlineMsg && (
        <p className={`text-[10px] font-medium ${inlineMsg.kind === 'error' ? 'text-red-600' : inlineMsg.kind === 'success' ? 'text-emerald-600' : 'text-slate-600'}`}>
          {inlineMsg.text}
        </p>
      )}
      <p className="text-[10px] text-slate-400">
        {variant === 'A' && 'Toast no canto para tudo (sonner, já usado no projeto).'}
        {variant === 'B' && 'Sucesso pisca no próprio card; erro ainda usa toast (crítico demais para passar despercebido).'}
        {variant === 'C' && 'Mensagem inline perto da ação, sem popup.'}
      </p>
    </div>
  )
}

function LdgDemo({ variant }: { variant: 'A' | 'B' | 'C' }) {
  const [loading, setLoading] = React.useState(false)
  const [loaded, setLoaded] = React.useState(false)

  function load() {
    setLoading(true)
    setLoaded(false)
    setTimeout(() => {
      setLoading(false)
      setLoaded(true)
    }, variant === 'C' ? 1400 : 1000)
  }

  return (
    <div className="space-y-2">
      <button onClick={load} className="rounded bg-[#00A5E6] px-2.5 py-1 text-[10px] font-semibold text-white">
        Carregar dados
      </button>
      {variant === 'A' &&
        (loading ? (
          <div className="space-y-1">
            <Skeleton className="h-2.5 w-full" />
            <Skeleton className="h-2.5 w-3/4" />
          </div>
        ) : loaded ? (
          <p className="text-[10px] text-slate-600">3 pedidos carregados.</p>
        ) : null)}
      {variant === 'B' &&
        (loading ? (
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <Loader2 className="size-3.5 animate-spin" />
            Carregando...
          </div>
        ) : loaded ? (
          <p className="text-[10px] text-slate-600">3 pedidos carregados.</p>
        ) : null)}
      {variant === 'C' && (
        <>
          {loading && <p className="text-[10px] text-slate-400">(nada aparece nos primeiros ~400ms, evita &quot;flash&quot;)</p>}
          {loaded && <p className="text-[10px] text-slate-600">3 pedidos carregados — como a operação era rápida, não mostrou skeleton.</p>}
        </>
      )}
    </div>
  )
}

// =========================================================================
// J.5 — Teclado e foco
// =========================================================================

function KbdDemo({ variant }: { variant: 'A' | 'B' | 'C' }) {
  const [msg, setMsg] = React.useState('')
  const field2Ref = React.useRef<HTMLInputElement>(null)

  function onEnterField1(e: React.KeyboardEvent) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (variant === 'A') setMsg('Formulário enviado (Enter no 1º campo já envia).')
    else field2Ref.current?.focus()
  }
  function onEnterField2(e: React.KeyboardEvent) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    setMsg('Formulário enviado.')
  }

  return (
    <div className="space-y-1.5">
      <input placeholder="Nome" onKeyDown={onEnterField1} className="h-7 w-full rounded border border-slate-300 px-2 text-[11px]" />
      <input ref={field2Ref} placeholder="Telefone" onKeyDown={onEnterField2} className="h-7 w-full rounded border border-slate-300 px-2 text-[11px]" />
      {msg && <p className="text-[10px] text-emerald-600">{msg}</p>}
      <p className="text-[10px] text-slate-400">
        {variant === 'A' && 'Enter em qualquer campo envia direto.'}
        {variant === 'B' && 'Enter no 1º campo move para o próximo; só envia no último.'}
        {variant === 'C' && 'Igual à opção B aqui (2 campos) — em campo único, Enter enviaria direto.'}
      </p>
    </div>
  )
}

function KeyboardTechnicalNote() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-[11px] text-slate-600">
      <p className="mb-1.5 font-semibold text-slate-700">Padrão técnico (não é uma escolha — já garantido pelos componentes Radix usados no projeto):</p>
      <ul className="list-disc space-y-0.5 pl-4">
        <li><strong>Escape</strong> fecha modal, popover e dropdown aberto.</li>
        <li><strong>Tab / Shift+Tab</strong> seguem a ordem lógica do DOM, sem armadilhas de foco fora de modais.</li>
        <li><strong>Foco inicial</strong> em um modal vai para o primeiro elemento focável (ou o definido explicitamente).</li>
        <li><strong>Retorno de foco</strong>: ao fechar um modal/popover, o foco volta para o elemento que o abriu.</li>
      </ul>
    </div>
  )
}

// =========================================================================
// J.6 — Campos de busca
// =========================================================================

const CMB_OPTIONS = ['Ana Souza', 'Ana Paula Lima', 'Beatriz Alves', 'Carlos Lima', 'Diego Nunes']

function useComboboxDemo(delay: number) {
  const [query, setQuery] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [results, setResults] = React.useState<string[]>([])

  React.useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    const t = setTimeout(() => {
      setResults(CMB_OPTIONS.filter((o) => o.toLowerCase().includes(query.toLowerCase())))
      setLoading(false)
    }, delay)
    return () => clearTimeout(t)
  }, [query, delay])

  return { query, setQuery, loading, results }
}

function CmbDemo({ variant }: { variant: 'A' | 'B' | 'C' }) {
  const { query, setQuery, loading, results } = useComboboxDemo(400)
  return (
    <div className="space-y-1.5">
      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar cliente..."
          className="h-7 w-full rounded border border-slate-300 px-2 pr-6 text-[11px]"
        />
        {variant === 'A' && loading && <Loader2 className="absolute right-1.5 top-1.5 size-3.5 animate-spin text-slate-400" />}
      </div>
      {query.length > 0 && query.length < 2 && <p className="text-[10px] text-slate-400">Digite ao menos 2 caracteres.</p>}
      {query.length >= 2 && (
        <div className="rounded border border-slate-200 bg-white">
          {variant === 'B' && loading && (
            <div className="space-y-1 p-1.5">
              <Skeleton className="h-2 w-3/4" />
              <Skeleton className="h-2 w-1/2" />
            </div>
          )}
          {variant === 'C' && loading && <p className="p-1.5 text-[10px] text-slate-400">Buscando na base completa...</p>}
          {!loading &&
            results.length > 0 &&
            results.map((r) => (
              <div key={r} className="border-b border-slate-100 px-1.5 py-1 text-[10px] text-slate-700 last:border-0 hover:bg-slate-50">
                {r}
              </div>
            ))}
          {!loading && results.length === 0 && <p className="p-1.5 text-[10px] text-slate-400">Nenhum resultado para &quot;{query}&quot;.</p>}
        </div>
      )}
    </div>
  )
}

// =========================================================================
// J.7 — Datas
// =========================================================================

function DatDemoA() {
  return (
    <div className="flex items-center gap-1.5">
      <input placeholder="dd/mm/aaaa" className="h-7 w-24 rounded border border-slate-300 px-2 font-mono text-[11px]" />
      <span className="text-[10px] text-slate-400">até</span>
      <input placeholder="dd/mm/aaaa" className="h-7 w-24 rounded border border-slate-300 px-2 font-mono text-[11px]" />
    </div>
  )
}

function DatDemoB() {
  const [date, setDate] = React.useState<Date | undefined>()
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex h-7 items-center gap-1.5 rounded border border-slate-300 px-2 text-[11px] text-slate-600">
          <CalendarIcon className="size-3.5" />
          {date ? date.toLocaleDateString('pt-BR') : 'Selecionar data'}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar mode="single" selected={date} onSelect={setDate} />
      </PopoverContent>
    </Popover>
  )
}

function DatDemoC() {
  return (
    <div className="space-y-1.5">
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex h-7 items-center gap-1.5 rounded border border-slate-300 px-2 text-[11px] text-slate-600">
            <CalendarIcon className="size-3.5" />
            Período
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2">
          <div className="mb-2 flex flex-wrap gap-1">
            {['Hoje', 'Últimos 7 dias', 'Este mês'].map((s) => (
              <button key={s} className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600 hover:bg-slate-50">
                {s}
              </button>
            ))}
          </div>
          <Calendar mode="range" />
        </PopoverContent>
      </Popover>
    </div>
  )
}

// =========================================================================
// J.8 — Tabelas e listagens
// =========================================================================

const ROW_DATA = [
  { cliente: 'Ana Souza', status: 'Em produção' },
  { cliente: 'Carlos Lima', status: 'Concluído' },
]

function RowActionsDemo({ variant }: { variant: 'A' | 'B' | 'C' }) {
  return (
    <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-[11px]">
      {ROW_DATA.map((r) => (
        <div key={r.cliente} className="group flex items-center justify-between px-2 py-1.5">
          <span className="text-slate-700">{r.cliente}</span>
          <div
            className={
              variant === 'B'
                ? 'flex items-center gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100'
                : 'flex items-center gap-1'
            }
          >
            {variant === 'C' ? (
              <button className="rounded p-1 hover:bg-slate-100" aria-label="Mais ações">
                <MoreHorizontal className="size-3.5 text-slate-500" />
              </button>
            ) : (
              <>
                <button className="rounded p-1 hover:bg-slate-100" aria-label="Ver">
                  <Eye className="size-3.5 text-slate-500" />
                </button>
                <button className="rounded p-1 hover:bg-slate-100" aria-label="Editar">
                  <Pencil className="size-3.5 text-slate-500" />
                </button>
                <button className="rounded p-1 hover:bg-slate-100" aria-label="Excluir">
                  <Trash2 className="size-3.5 text-red-400" />
                </button>
              </>
            )}
          </div>
        </div>
      ))}
      {variant === 'B' && <p className="px-2 py-1 text-[9px] italic text-slate-400">Passe o mouse sobre uma linha — nota: exige mouse/foco, revise para touch.</p>}
    </div>
  )
}

function PaginationNote() {
  return (
    <div className="mt-4 flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50/60 p-3 text-[11px] text-sky-900">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <p>
        <strong>Recomendação técnica, aguardando sua confirmação</strong> (não é uma regra aprovada automaticamente): ao aplicar um
        novo filtro, a paginação deveria voltar para a página 1 — do contrário o usuário pode &quot;sumir&quot; numa página que não existe mais
        no resultado filtrado. Avise se quiser que isso vire regra aprovada ou decisão em aberto.
      </p>
    </div>
  )
}

// =========================================================================
// J.9 — Modais e painéis
// =========================================================================

function ModDemoA() {
  const [open, setOpen] = React.useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="rounded-md bg-[#00A5E6] px-2.5 py-1.5 text-[11px] font-semibold text-white">Abrir modal</button>
      </DialogTrigger>
      <DialogContent className="max-w-xs p-4">
        <DialogHeader>
          <DialogTitle className="text-sm">Editar pedido</DialogTitle>
          <DialogDescription className="text-xs">Modal centralizado, usado para tudo.</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}

function DrawerMock({ label }: { label: string }) {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="relative h-28 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
      <button onClick={() => setOpen((v) => !v)} className="absolute left-2 top-2 rounded-md bg-[#00A5E6] px-2 py-1 text-[10px] font-semibold text-white">
        {label}
      </button>
      <div
        className={`absolute inset-y-0 right-0 w-2/3 border-l border-slate-200 bg-white p-2 shadow-lg transition-transform ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <p className="text-[10px] font-semibold text-slate-700">Detalhe do pedido</p>
        <p className="text-[9px] text-slate-400">Painel lateral, conteúdo mais longo cabe melhor aqui.</p>
      </div>
    </div>
  )
}

const OBSERVACOES_POUCAS = [
  { id: 1, data: '15/09/2026 09:12', autor: 'ana@example.com', texto: 'Cliente pediu para confirmar a cor antes de produzir.' },
  { id: 2, data: '15/09/2026 09:40', autor: 'ana@example.com', texto: 'Confirmado por telefone — segue com a cor original.' },
]

const OBSERVACOES_MUITAS = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  data: `15/09/2026 ${String(9 + Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`,
  autor: i % 2 === 0 ? 'ana@example.com' : 'joao@example.com',
  texto: `Observação de exemplo número ${i + 1} — texto ilustrativo para preencher espaço.`,
}))

/** Demonstração viva do SCROLL-BOUNDED-LIST (ver components-e-patterns.md) com o Dialog OFICIAL do DS (DialogBody, não o ui/dialog usado nos outros demos desta página). Valores de altura menores que a produção (`min(18rem,40dvh)`) só porque o card de preview aqui é pequeno — a técnica (max-h com min() + overflow-y-auto + overscroll-contain, textarea/botão fora da área rolável) é a mesma. */
function ScrollBoundedListDemo() {
  const [muitas, setMuitas] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const observacoes = muitas ? OBSERVACOES_MUITAS : OBSERVACOES_POUCAS

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setMuitas(false)}
          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${!muitas ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`}
        >
          Poucas observações
        </button>
        <button
          onClick={() => setMuitas(true)}
          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${muitas ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`}
        >
          Muitas observações
        </button>
      </div>
      <DsDialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button className="rounded-md bg-[#00A5E6] px-2.5 py-1.5 text-[11px] font-semibold text-white">Abrir pedido de exemplo</button>
        </DialogTrigger>
        <DsDialogContent className="max-w-sm">
          <DsDialogHeader title="Pedido #4821" description="Exemplo de coleção com altura limitada dentro do Dialog" />
          <DsDialogBody className="space-y-3">
            <div>
              <h4 className="text-xs font-semibold text-slate-900">Observações</h4>
              <ol className="mt-2 max-h-[min(9rem,40dvh)] space-y-2 overflow-y-auto overscroll-contain border-l-2 border-slate-200 pl-3 pr-2">
                {observacoes.map((o) => (
                  <li key={o.id} className="text-[11px]">
                    <p className="text-slate-400">{o.data} · {o.autor}</p>
                    <p className="text-slate-700">{o.texto}</p>
                  </li>
                ))}
              </ol>
              <div className="mt-2 rounded border border-dashed border-slate-300 bg-slate-50 px-2 py-1 text-[10px] text-slate-400">
                Textarea + botão &quot;Adicionar&quot; (sempre visíveis, fora da área rolável)
              </div>
            </div>
          </DsDialogBody>
        </DsDialogContent>
      </DsDialog>
      <p className="text-[10px] text-slate-400">
        {muitas
          ? 'Lista longa: para de crescer, passa a rolar internamente — o Dialog e o campo de nova observação continuam estáveis.'
          : 'Lista curta: altura natural, sem scrollbar (o teto só age quando o conteúdo realmente ultrapassa).'}
      </p>
    </div>
  )
}

// =========================================================================
// J.10 — Permissões
// =========================================================================

function PerDemo({ variant }: { variant: 'A' | 'B' | 'C' }) {
  return (
    <div className="flex items-center gap-2">
      <button className="rounded border border-slate-300 px-2 py-1 text-[10px] text-slate-600">Ver</button>
      <button className="rounded border border-slate-300 px-2 py-1 text-[10px] text-slate-600">Editar</button>
      {variant === 'A' && <span className="text-[9px] italic text-slate-300">(Excluir nem aparece)</span>}
      {variant === 'B' && (
        <button disabled title="Você não tem permissão para excluir pedidos" className="cursor-not-allowed rounded border border-slate-200 px-2 py-1 text-[10px] text-slate-300">
          Excluir
        </button>
      )}
      {variant === 'C' && (
        <button
          disabled
          title="Ação bloqueada para o seu perfil — visível porque você já está vendo este pedido"
          className="cursor-not-allowed rounded border border-slate-200 px-2 py-1 text-[10px] text-slate-300"
        >
          Excluir
        </button>
      )}
    </div>
  )
}

// =========================================================================
// J.11 — Mobile
// =========================================================================

function MobPhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto h-40 w-[140px] overflow-hidden rounded-[1rem] border-4 border-slate-800 bg-white">
      <div className="space-y-1 p-1.5 text-[8px] text-slate-400">
        <div className="h-2 w-3/4 rounded bg-slate-100" />
        <div className="h-2 w-full rounded bg-slate-100" />
        <div className="h-2 w-2/3 rounded bg-slate-100" />
      </div>
      {children}
    </div>
  )
}

function MobDemo({ variant }: { variant: 'A' | 'B' | 'C' }) {
  return (
    <MobPhoneFrame>
      {variant === 'A' && (
        <div className="absolute inset-x-0 bottom-0 border-t border-slate-200 bg-white p-1.5">
          <div className="h-4 rounded bg-[#00A5E6] text-center text-[8px] font-semibold leading-4 text-white">Salvar pedido</div>
        </div>
      )}
      {variant === 'B' && (
        <div className="p-1.5">
          <div className="h-4 w-16 rounded bg-[#00A5E6] text-center text-[8px] font-semibold leading-4 text-white">Salvar</div>
        </div>
      )}
      {variant === 'C' && (
        <div className="absolute bottom-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-[#00A5E6] text-white shadow-md">
          <Check className="size-3" />
        </div>
      )}
    </MobPhoneFrame>
  )
}

// =========================================================================

export function BehaviorSection() {
  return (
    <div>
      <SubgroupNav />
      <div className="space-y-8">
        <Subgroup id="Filtros e consultas">
          <FixedRuleBlock
            code="FLT-EXEC"
            title="Execução de filtros"
            rule="Alterar um filtro nunca executa a consulta sozinho — só o clique em Filtrar."
            fixedValue="MANUAL"
            content={<FiltrosExecDemo />}
            note="ALTERAR FILTRO ≠ EXECUTAR CONSULTA. Não se aplica a autocomplete/combobox de busca (ver CMB, subgrupo Campos de busca)."
          />
          <DecisionBlock
            code="FLT-CLR"
            title="Limpar filtros"
            description="O que acontece com os campos e com a listagem ao clicar em Limpar."
            options={[
              { letter: 'A', label: 'Limpa sem reconsultar', note: 'Campos voltam ao vazio; listagem só muda ao clicar Filtrar de novo.', content: <FltClrDemoA /> },
              { letter: 'B', label: 'Limpa e reconsulta na hora', note: 'Campos e listagem resetam juntos, imediatamente.', content: <FltClrDemoB /> },
              { letter: 'C', label: 'Limpa, reconsulta e mantém painel aberto', note: 'Reset completo, mas já pronto para configurar um novo filtro.', content: <FltClrDemoC /> },
            ]}
          />
        </Subgroup>

        <Subgroup id="Formulários e validação">
          <DecisionBlock
            code="VAL"
            title="Quando validar campos"
            description="Em que momento o erro de um campo aparece pela primeira vez."
            options={[
              { letter: 'A', label: 'Só ao salvar', note: 'Nada é validado antes da tentativa de envio.', content: <ValDemoA /> },
              { letter: 'B', label: 'Ao sair do campo + ao salvar', note: 'Valida no blur após interação, revalida no envio.', content: <ValDemoB /> },
              { letter: 'C', label: 'Progressiva', note: 'Valida no blur, mas o erro some em tempo real assim que corrigido.', content: <ValDemoC /> },
            ]}
          />
          <DecisionBlock
            code="ERR"
            title="Apresentação de erros"
            description="Como comunicar erros de validação — nunca só cor, sempre texto associado ao campo."
            options={[
              { letter: 'A', label: 'Inline + resumo no topo', note: 'Bom para formulários longos.', content: <ErrDemo variant="A" /> },
              { letter: 'B', label: 'Só inline', note: 'Direto, sem resumo separado.', content: <ErrDemo variant="B" /> },
              { letter: 'C', label: 'Inline + banner de erro de servidor', note: 'Erro de validação ≠ erro de servidor, visualmente diferentes.', content: <ErrDemo variant="C" /> },
            ]}
          />
          <DecisionBlock
            code="REQ"
            title="Campos obrigatórios e opcionais"
            description="Label sempre visível — placeholder nunca substitui label."
            options={[
              { letter: 'A', label: 'Asterisco no obrigatório', note: '"Nome *" — opcional sem marca.', content: <ReqDemo variant="A" /> },
              { letter: 'B', label: '"(opcional)" no opcional', note: 'Bom quando a maioria dos campos é obrigatória.', content: <ReqDemo variant="B" /> },
              { letter: 'C', label: 'Os dois marcados', note: 'Sem ambiguidade em nenhum campo.', content: <ReqDemo variant="C" /> },
            ]}
          />
          <div>
            <DecisionBlock
              code="MSK"
              title="Máscaras e formatos de entrada"
              description="Filosofia geral de máscara — exemplo com CPF, aplicável ao mesmo padrão de CNPJ/telefone/CEP/etc."
              options={[
                { letter: 'A', label: 'Máscara fixa ao digitar', note: 'Separadores aparecem antes de você preencher.', content: <MskDemo variant="A" /> },
                { letter: 'B', label: 'Livre + formata no blur', note: 'Digita só números, formata ao sair do campo.', content: <MskDemo variant="B" /> },
                { letter: 'C', label: 'Progressiva em tempo real', note: 'Pontuação aparece conforme os dígitos avançam.', content: <MskDemo variant="C" /> },
              ]}
            />
            <MaskReferenceTable />
          </div>
        </Subgroup>

        <Subgroup id="Ações e confirmações">
          <DecisionBlock
            code="SAV"
            title="Salvar / enviar"
            description="O que acontece visualmente durante e depois da ação — sempre bloqueando duplo clique."
            options={[
              { letter: 'A', label: 'Botão muda de estado', note: 'Texto + ícone mudam: normal → salvando → salvo/falhou.', content: <SavDemo variant="A" /> },
              { letter: 'B', label: 'Botão vira só ícone', note: 'Spinner substitui o conteúdo; feedback de sucesso/erro à parte.', content: <SavDemo variant="B" /> },
              { letter: 'C', label: 'Ícone + bloqueio do formulário', note: 'Texto do botão não muda; overlay sutil evita reenvio.', content: <SavDemo variant="C" /> },
            ]}
          />
          <DecisionBlock
            code="UNS"
            title="Alterações não salvas"
            description="O que acontece ao tentar fechar/sair com um formulário alterado."
            options={[
              { letter: 'A', label: 'Modal de confirmação', note: 'Só pergunta se algo realmente mudou.', content: <UnsDemo variant="A" /> },
              { letter: 'B', label: 'Indicador inline + Descartar', note: 'Sem modal — aviso discreto e ação explícita.', content: <UnsDemo variant="B" /> },
              { letter: 'C', label: 'Rascunho automático', note: 'Salva localmente e oferece restaurar depois, sem perguntar.', content: <UnsDemo variant="C" /> },
            ]}
          />
          <DecisionBlock
            code="DST"
            title="Ações destrutivas"
            description="Diferencia ação reversível, irreversível e crítica — nem tudo precisa de confirmação."
            options={[
              { letter: 'A', label: 'Confirmação padrão', note: 'Modal simples para qualquer ação destrutiva.', content: <DstDemo variant="A" /> },
              { letter: 'B', label: 'Reversível sem modal', note: 'Executa direto + Desfazer via toast; só irreversível pede confirmação.', content: <DstDemo variant="B" /> },
              { letter: 'C', label: 'Confirmação reforçada', note: 'Ação crítica exige digitar uma palavra para confirmar.', content: <DstDemo variant="C" /> },
            ]}
          />
        </Subgroup>

        <Subgroup id="Feedback e carregamento">
          <DecisionBlock
            code="FDB"
            title="Feedback após ações"
            description="Toast, inline ou contextual na própria área alterada — sem duplicar feedback."
            options={[
              { letter: 'A', label: 'Toast para tudo', note: 'Um só padrão, sempre no mesmo lugar (sonner).', content: <FdbDemo variant="A" /> },
              { letter: 'B', label: 'Contextual + toast só p/ erro crítico', note: 'Sucesso pisca no próprio elemento alterado.', content: <FdbDemo variant="B" /> },
              { letter: 'C', label: 'Mensagem inline perto da ação', note: 'Sem popup — bom dentro de modais.', content: <FdbDemo variant="C" /> },
            ]}
          />
          <DecisionBlock
            code="LDG"
            title="Loading"
            description="Skeleton, spinner ou bloqueio — considerando operações rápidas e demoradas."
            options={[
              { letter: 'A', label: 'Skeleton p/ conteúdo, spinner p/ ação', note: 'Nunca bloqueia a tela inteira.', content: <LdgDemo variant="A" /> },
              { letter: 'B', label: 'Spinner central sempre', note: 'Um único padrão simples, para qualquer carregamento.', content: <LdgDemo variant="B" /> },
              { letter: 'C', label: 'Baseado em duração', note: 'Só mostra loading se passar de um pequeno limiar — evita flash.', content: <LdgDemo variant="C" /> },
            ]}
          />
        </Subgroup>

        <Subgroup id="Teclado e foco">
          <DecisionBlock
            code="KBD"
            title="Enter em formulários"
            description="O que a tecla Enter faz dentro de um campo de formulário com múltiplos campos."
            options={[
              { letter: 'A', label: 'Enter envia', note: 'Comportamento padrão do navegador.', content: <KbdDemo variant="A" /> },
              { letter: 'B', label: 'Enter avança o campo', note: 'Como entrada de dados tipo planilha/POS.', content: <KbdDemo variant="B" /> },
              { letter: 'C', label: 'Misto por contexto', note: 'Avança em formulário longo; envia em campo único.', content: <KbdDemo variant="C" /> },
            ]}
          />
          <KeyboardTechnicalNote />
        </Subgroup>

        <Subgroup id="Campos de busca">
          <DecisionBlock
            code="CMB"
            title="Combobox / autocomplete"
            description="Busca enquanto digita (diferente de FLT-EXEC — aqui a busca É ao vivo). Mínimo de 2 caracteres, com debounce."
            options={[
              { letter: 'A', label: 'Ícone de loading no campo', note: 'Spinner discreto dentro do próprio input.', content: <CmbDemo variant="A" /> },
              { letter: 'B', label: 'Skeleton no dropdown', note: 'Loading mais visível, dentro da lista de sugestões.', content: <CmbDemo variant="B" /> },
              { letter: 'C', label: 'Texto de progresso', note: 'Mensagem simples enquanto busca na base completa.', content: <CmbDemo variant="C" /> },
            ]}
          />
        </Subgroup>

        <Subgroup id="Datas">
          <DecisionBlock
            code="DAT"
            title="Datas e períodos"
            description="Campo de data única/intervalo — formato brasileiro sempre exibido."
            options={[
              { letter: 'A', label: 'Dois campos com máscara', note: 'Digitação rápida, familiar.', content: <DatDemoA /> },
              { letter: 'B', label: 'Popover de calendário', note: 'Usa o componente Calendar já existente.', content: <DatDemoB /> },
              { letter: 'C', label: 'Período com atalhos', note: 'Calendário + presets rápidos (Hoje, Últimos 7 dias...).', content: <DatDemoC /> },
            ]}
          />
        </Subgroup>

        <Subgroup id="Tabelas e listagens">
          <DecisionBlock
            code="ROW"
            title="Ações de linha"
            description="Como as ações de cada linha de uma tabela/listagem aparecem (visual já definido em TBL=B)."
            options={[
              { letter: 'A', label: 'Sempre visíveis', note: 'Ícones fixos numa coluna de ação.', content: <RowActionsDemo variant="A" /> },
              { letter: 'B', label: 'Reveladas no hover', note: 'Mais limpo — exige mouse/foco, atenção ao touch.', content: <RowActionsDemo variant="B" /> },
              { letter: 'C', label: 'Menu "⋯" consolidado', note: 'Todas as ações num dropdown só.', content: <RowActionsDemo variant="C" /> },
            ]}
          />
          <PaginationNote />
        </Subgroup>

        <Subgroup id="Modais e painéis">
          <DecisionBlock
            code="MOD"
            title="Modal vs. drawer"
            description="Quando usar cada um — não redesenha os componentes já escolhidos (CRD=C), só o comportamento."
            options={[
              { letter: 'A', label: 'Modal para tudo', note: 'Um só padrão, simples de manter.', content: <ModDemoA /> },
              { letter: 'B', label: 'Modal curto / drawer longo', note: 'Drawer lateral para formulários longos ou detalhe extenso.', content: <DrawerMock label="Abrir drawer" /> },
              { letter: 'C', label: 'Modal no desktop, tela cheia no mobile', note: 'No mobile todo modal vira uma folha em tela cheia.', content: <DrawerMock label="Abrir (mobile: full-screen)" /> },
            ]}
          />
          <FixedRuleBlock
            code="SBL"
            title="SCROLL-BOUNDED-LIST — coleção ilimitada dentro de um Dialog"
            rule="Uma região de conteúdo potencialmente ilimitado dentro de um Dialog (histórico de observações, comentários, logs) ganha altura máxima própria + scroll interno isolado quando ultrapassa o limite — sem fazer o Dialog crescer. Controles de criação (Textarea/botão) ficam sempre fora da área rolável."
            fixedValue="ATIVO"
            note="Aplicado em /pedidos-personalizados (histórico de status e histórico de observações do pedido). Produção usa max-h-[min(18rem,40dvh)] overflow-y-auto overscroll-contain — este preview usa uma altura menor (min(9rem,40dvh)) só por caber num card pequeno. Não conflita com TABLE-NO-INTERNAL-VSCROLL (foundations.md): aquela regra é sobre a listagem/tabela principal paginada da página; esta é sobre uma coleção subordinada dentro de um Dialog que já tem seu próprio scroll principal (DialogBody). Detalhe completo em components-e-patterns.md."
            content={<ScrollBoundedListDemo />}
          />
        </Subgroup>

        <Subgroup id="Permissões">
          <DecisionBlock
            code="PER"
            title="Ações sem permissão"
            description="Não altera permissões reais — só o padrão visual de UX para quem não tem acesso a uma ação."
            options={[
              { letter: 'A', label: 'Esconder', note: 'A ação nem aparece.', content: <PerDemo variant="A" /> },
              { letter: 'B', label: 'Desabilitado + explicação', note: 'Aparece cinza, com tooltip explicando o motivo.', content: <PerDemo variant="B" /> },
              { letter: 'C', label: 'Híbrida contextual', note: 'Esconde no menu; desabilita quando já dentro do fluxo.', content: <PerDemo variant="C" /> },
            ]}
          />
        </Subgroup>

        <Subgroup id="Mobile">
          <DecisionBlock
            code="MOB"
            title="Ação principal no mobile"
            description="Mesmo Design System, comportamento responsivo — não é uma identidade mobile separada."
            options={[
              { letter: 'A', label: 'Barra fixa no rodapé', note: 'Sempre visível, independente do scroll.', content: <MobDemo variant="A" /> },
              { letter: 'B', label: 'Inline no conteúdo', note: 'Rola junto com a página, sem elemento fixo.', content: <MobDemo variant="B" /> },
              { letter: 'C', label: 'Botão flutuante (FAB)', note: 'Fixo no canto, sobre o conteúdo.', content: <MobDemo variant="C" /> },
            ]}
          />
        </Subgroup>
      </div>
    </div>
  )
}
