// Entrada exclusiva da fixture local. Sem autenticação, credenciais ou dados reais.
import React from 'react'
import {createRoot} from 'react-dom/client'
import {Toaster} from 'sonner'
import Ficha from '/src/app/atendimento-presencial/prancheta/FichaPageClient.tsx'
const params=new URLSearchParams(window.location.search)
const unidadeId='00000000-0000-4000-8000-000000000002'
const unidades=[{id:unidadeId,chave:'sintetica',nome:'UNIDADE SINTETICA'}]
if(params.get('unidades')==='duas')unidades.push({id:'00000000-0000-4000-8000-000000000004',chave:'segunda',nome:'SEGUNDA UNIDADE'})
const props={usuarioId:'00000000-0000-4000-8000-000000000001',contextoInicial:{perfil:'gestao',usuarioId:'00000000-0000-4000-8000-000000000001',acessoTotal:false,unidadesPermitidas:unidades},unidadeIdInicial:unidades.length===1?unidadeId:'',rascunhoIdInicial:params.get('rascunho')}
createRoot(document.getElementById('root')).render(<><Ficha {...props}/><Toaster richColors/></>)
