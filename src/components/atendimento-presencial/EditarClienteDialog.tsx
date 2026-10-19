'use client'

import { useRef, useState } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  FormField,
  Input,
} from '@/components/design-system'
import {
  normalizarNomeCliente,
  type ClientePresencialDTO,
} from '@/lib/atendimento-presencial/clientes'
import {
  mascararTelefoneClienteBR,
  mensagemTelefoneCliente,
} from '@/lib/atendimento-presencial/telefone'

export function EditarClienteDialog({
  cliente,
  onClose,
  onSaved,
}: {
  cliente: ClientePresencialDTO
  onClose: () => void
  onSaved: (cliente: ClientePresencialDTO) => void
}) {
  const [atual, setAtual] = useState(cliente)
  const [nome, setNome] = useState(cliente.nome)
  const [telefone, setTelefone] = useState(
    cliente.telefoneFormatado ?? cliente.telefone ?? '',
  )
  const telefoneInicial = useRef(telefone)
  const [salvando, setSalvando] = useState(false)
  const ocupado = useRef(false)
  const [erro, setErro] = useState<string | null>(null)
  const [campo, setCampo] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)
  const [conflito, setConflito] = useState<ClientePresencialDTO | null>(null)
  const aviso = telefone && mensagemTelefoneCliente(telefone)
  async function salvar() {
    if (ocupado.current) return
    const nomeNormalizado = normalizarNomeCliente(nome)
    const mudouTelefone = telefone !== telefoneInicial.current
    const invalido =
      nomeNormalizado.length < 2 || nomeNormalizado.length > 120
        ? 'nome'
        : mudouTelefone && telefone && mensagemTelefoneCliente(telefone)
          ? 'telefone'
          : null
    if (invalido) {
      setCampo(invalido)
      setErro(
        invalido === 'nome'
          ? 'Nome deve ter entre 2 e 120 caracteres.'
          : mensagemTelefoneCliente(telefone),
      )
      document.getElementById(`editar-cliente-${invalido}`)?.focus()
      return
    }
    ocupado.current = true
    setSalvando(true)
    setErro(null)
    setCampo(null)
    try {
      const response = await fetch(
        `/api/atendimento-presencial/clientes/${cliente.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version: atual.version,
            nome: nomeNormalizado,
            ...(mudouTelefone ? { telefone: telefone || null } : {}),
          }),
        },
      )
      const data = await response.json()
      if (!response.ok || !data.ok || !data.cliente) {
        if (response.status === 409 && data.cliente) {
          setConflito(data.cliente)
          throw new Error(
            'O cadastro foi alterado em outra sessão. Carregue a versão atual para revisar os dados antes de salvar.',
          )
        }
        setCampo(data.field ?? null)
        throw new Error(data.message ?? 'Não foi possível atualizar a cliente.')
      }
      setAtual(data.cliente)
      telefoneInicial.current =
        data.cliente.telefoneFormatado ?? data.cliente.telefone ?? ''
      setTelefone(telefoneInicial.current)
      setSucesso(true)
      onSaved(data.cliente)
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar a cliente.',
      )
    } finally {
      ocupado.current = false
      setSalvando(false)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !salvando) onClose()
      }}
    >
      <DialogContent aria-describedby={undefined}>
        <DialogHeader
          title="Editar cliente"
          description="Altera o cadastro utilizado nos atendimentos desta cliente."
        />
        <DialogBody className="space-y-4">
          {erro && !campo && <Alert tone="danger">{erro}</Alert>}
          {conflito && (
            <Button
              variant="secondary"
              onClick={() => {
                setAtual(conflito)
                setNome(conflito.nome)
                const novoTelefone =
                  conflito.telefoneFormatado ?? conflito.telefone ?? ''
                setTelefone(novoTelefone)
                telefoneInicial.current = novoTelefone
                setConflito(null)
                setErro(null)
                setCampo(null)
              }}
            >
              Carregar versão atual
            </Button>
          )}
          {sucesso && (
            <p role="status" className="font-semibold text-green-700">
              Cliente atualizada.
            </p>
          )}
          {aviso && !campo && (
            <Alert tone="warning">
              Telefone existente precisa de revisão. Você pode alterar somente o
              nome sem substituir o telefone.
            </Alert>
          )}
          <FormField
            id="editar-cliente-nome"
            label="Nome"
            required
            error={campo === 'nome' ? (erro ?? undefined) : undefined}
          >
            {(props) => (
              <Input
                {...props}
                value={nome}
                disabled={salvando || sucesso}
                onChange={(e) => {
                  setNome(e.target.value)
                  setCampo(null)
                  setErro(null)
                }}
              />
            )}
          </FormField>
          <FormField
            id="editar-cliente-telefone"
            label="Telefone"
            helper="Opcional. Inclua o DDD."
            error={campo === 'telefone' ? (erro ?? undefined) : undefined}
          >
            {(props) => (
              <Input
                {...props}
                inputMode="tel"
                value={telefone}
                disabled={salvando || sucesso}
                onChange={(e) => {
                  setTelefone(mascararTelefoneClienteBR(e.target.value))
                  setCampo(null)
                  setErro(null)
                }}
              />
            )}
          </FormField>
        </DialogBody>
        <DialogFooter className="px-6 py-4">
          <Button variant="secondary" disabled={salvando} onClick={onClose}>
            {sucesso ? 'Fechar' : 'Cancelar'}
          </Button>
          {!sucesso && (
            <Button
              loading={salvando}
              disabled={salvando || Boolean(conflito)}
              onClick={() => void salvar()}
            >
              Salvar cliente
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
