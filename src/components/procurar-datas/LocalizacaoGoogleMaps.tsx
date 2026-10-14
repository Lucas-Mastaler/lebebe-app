'use client'

import { useEffect, useRef, useState } from 'react'
import { Alert, Button, FormField, Input, useAsyncAction } from '@/components/design-system'
import type { LocalizacaoMapsVerificada } from '@/lib/procurar-datas/acesso-viario-maps'
import { deveAvisarAssociacaoViaMaps } from '@/lib/procurar-datas/localizacao-maps'

export function LocalizacaoGoogleMaps(props: {
  disabled: boolean
  onConfirmar: (local: LocalizacaoMapsVerificada) => void
  onInvalidar: () => void
}) {
  const [entrada, setEntrada] = useState('')
  const [local, setLocal] = useState<LocalizacaoMapsVerificada | null>(null)
  const [erro, setErro] = useState('')
  const requestRef = useRef<AbortController | null>(null)
  useEffect(() => () => { requestRef.current?.abort() }, [])
  const resolver = useAsyncAction(async () => {
    const controller = new AbortController()
    requestRef.current = controller
    setErro('')
    setLocal(null)
    props.onInvalidar()
    try {
      const response = await fetch('/api/procurar-datas/localizacao-maps', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entrada }), signal: controller.signal,
      })
      const data = await response.json()
      if (controller.signal.aborted) return
      if (!response.ok || !data.ok) throw new Error(data.error || 'Não foi possível identificar o local. Tente outro link ou copie as coordenadas do Google Maps.')
      setLocal(data.resultado)
      props.onConfirmar(data.resultado)
    } catch (error) {
      if (controller.signal.aborted) return
      setErro(error instanceof Error ? error.message : 'Não foi possível identificar o local. Tente novamente.')
    }
  })
  const bloqueado = props.disabled || resolver.loading
  const regiao = [local?.regiao?.cidade, local?.regiao?.uf].filter(Boolean).join(' - ')
  return (
    <div className="mb-4 space-y-3 border-b border-slate-200 pb-4">
      <FormField id="linkGoogleMaps" label="Link do Google Maps" error={erro}
        helper="Cole o link de um lugar ou as coordenadas enviadas pelo cliente. Não precisa de CEP ou endereço completo.">
        {(field) => <Input {...field} value={entrada} disabled={bloqueado} maxLength={8192}
          placeholder="Cole aqui o link enviado pelo cliente"
          onChange={(event) => { setEntrada(event.target.value); setLocal(null); setErro(''); props.onInvalidar() }} />}
      </FormField>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" disabled={bloqueado || !entrada.trim()} loading={resolver.loading} onClick={() => void resolver.run()}>
          Identificar localização
        </Button>
        {entrada && <Button type="button" variant="ghost" disabled={bloqueado} onClick={() => {
          setEntrada(''); setLocal(null); setErro(''); props.onInvalidar()
        }}>Limpar localização</Button>}
      </div>
      {local && <Alert tone="success" title="Localização identificada">
        <div className="space-y-2">
          {local.nome && <p className="font-medium">{local.nome}</p>}
          {regiao ? <p className="font-medium">{regiao}</p> : !local.nome && <p>Localização identificada por coordenadas</p>}
          <p>{local.fonte === 'coordenadas-diretas' ? 'Localização obtida pelas coordenadas informadas.' : 'Localização obtida pelo Google Maps.'} Já pode pesquisar as datas.</p>
          <a href={local.conferirUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline">Ver no Google Maps</a>
          {deveAvisarAssociacaoViaMaps(local.acessoViario.distanciaAteViaM) && <Alert tone="warning">
            A rota pode terminar antes do destino. Confira com o cliente o acesso à propriedade.
          </Alert>}
          <details>
            <summary className="cursor-pointer font-medium">Mostrar detalhes da localização</summary>
            <div className="mt-2 space-y-1">
              <p>Latitude: {local.lat} · Longitude: {local.lng}</p>
              <p>Origem das coordenadas: {local.fonte}</p>
              {local.regiao && <p>Município: {local.regiao.fonte}</p>}
              {local.nome && <p>Nome informado no link: {local.nome}</p>}
              <p>Rota OSRM: {(local.acessoViario.distanciaRotaM / 1000).toLocaleString('pt-BR')} km.</p>
              <p>Associação à via: {Math.round(local.acessoViario.distanciaAteViaM).toLocaleString('pt-BR')} m. Esse trecho não é somado à cobrança.</p>
              <a href={local.acessoViario.conferirViaUrl} target="_blank" rel="noopener noreferrer" className="block underline">Ver onde a rota termina</a>
            </div>
          </details>
          {local.regiao && <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="block text-xs underline">© OpenStreetMap contributors</a>}
        </div>
      </Alert>}
    </div>
  )
}
