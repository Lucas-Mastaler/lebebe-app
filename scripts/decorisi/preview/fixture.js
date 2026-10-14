import React from 'react'
import {createRoot} from 'react-dom/client'
import FormularioNovoPedido from '@/components/pedidos-personalizados/FormularioNovoPedido.tsx'
import fonte from '@/lib/pedidos-personalizados/decorisi/referencias-db.json'
import fonteXp from '@/lib/pedidos-personalizados/decorisi/referencias-xp.json'
import '@/app/globals.css'
const db=[...fonte.registros,...fonteXp.registros].map((r,i)=>({id:`db-${i}`,referencia:r.referencia,repeticao_m:r.repeticaoM,versao:1}))
const unidades=[{id:'20000000-0000-4000-8000-000000000001',chave:'bigorrilho',nome:'BIGORRILHO'},{id:'20000000-0000-4000-8000-000000000002',chave:'portao',nome:'PORTÃO'}]
const precos=[36565,36566,36567,36568].map((id,i)=>({produto_id_sgi:id,codigo:String(19075+i),preco:['530.00','660.00','230.00','320.00'][i],ativo:true,fora_linha:false,descricao:'Produto sintético',ultima_validacao_sgi:new Date().toISOString()}))
const opcoesDecorisi={ok:true,db,pf:Array.from({length:81},(_,i)=>`PF${200+i}`),unidades,precos}
const moriah={id:'moriah',chave:'moriah_tapetes',nome:'Moriah'}
const opcoes={ok:true,fornecedor:moriah,fornecedores:[moriah,{id:'exclusive',chave:'lebebe_exclusive',nome:'Exclusive'}],unidades,produtos:['21157','21158','21159'].map((codigo,i)=>({id:`produto-${i}`,codigo,descricao:'Tapete sintético',precoM2Centavos:10000})),cores:Array.from({length:31},(_,i)=>({id:`cor-${i}`,nome:`Cor ${i}`,numero:String(i+1),codigo:`K-${i+1}`,ordem:i+1})),formatos:['REDONDO','RETANGULAR','ORGANICO'],limites:{tapetesPorPedido:10,coresPorTapete:6,medidaMinimaCm:10,medidaMaximaCm:1500}}
const pedidos=new Map(JSON.parse(sessionStorage.getItem("decorisi-pedidos-sinteticos")??"[]"))
let uploadFalhou=false
window.fetch=async(input,init={})=>{
 const url=new URL(String(input),window.location.origin),parts=url.pathname.split('/'),method=init.method??'GET'
 let resultado,status=200
 if(url.pathname==='/api/pedidos-personalizados/opcoes')resultado=opcoes
 else if(url.pathname==='/api/pedidos-personalizados/decorisi/opcoes')resultado=opcoesDecorisi
 else if(url.pathname.endsWith('/cotacao')){const p=pedidos.get(parts.at(-2));resultado={ok:true,cotacao:{version:p.version,completa:false,totalCentavos:null,itens:[]}}}
 else if(parts.includes('anexos')){
  const id=parts[5],itemId=parts[7],pedido=pedidos.get(id),item=pedido.itens.find((i)=>i.id===itemId),anexoId=parts[9]
  if(method==='GET')resultado={ok:true,url:'data:application/pdf,%25PDF-1'}
  else if(method==='DELETE'){item.anexos=item.anexos.filter((a)=>a.id!==anexoId);pedido.version++;resultado={ok:true,version:pedido.version}}
  else if(!uploadFalhou){uploadFalhou=true;status=503;resultado={ok:false,erro:'UPLOAD_PENDENTE',mensagem:'Envio não confirmado (falha simulada). Repita para validar a recuperação.'}}
  else{const form=init.body,f=form.get('arquivo'),id=anexoId??init.headers['Idempotency-Key'];item.anexos=item.anexos.filter((a)=>a.id!==id);item.anexos.push({id,slot:Number(form.get('slot')),nome_original:f.name,mime_type:f.type,tamanho_bytes:f.size});pedido.version++;resultado={ok:true,version:pedido.version}}
 }
 else if(url.pathname.includes('/decorisi/pedidos')){
  let id=parts[5]
  if(method==='POST'){id=crypto.randomUUID();const b=JSON.parse(init.body);pedidos.set(id,{id,version:1,status:'RASCUNHO',unidade_id:unidades.find((u)=>u.chave===b.unidade).id,consultora:b.consultora,cliente:b.cliente,telefone_normalizado:b.telefone.replace(/\D/g,''),itens:converter(b.itens)});resultado={ok:true,pedidoId:id,version:1}}
  else if(method==='PATCH'){const p=pedidos.get(id),b=JSON.parse(init.body);if(b.expectedVersion!==p.version){status=409;resultado={ok:false,mensagem:'Versão alterada.'}}else{const anexos=new Map(p.itens.map((i)=>[i.id,i.anexos]));p.itens=converter(b.itens).map((i)=>({...i,anexos:anexos.get(i.id)??[]}));p.version++;Object.assign(p,{unidade_id:unidades.find((u)=>u.chave===b.identificacao.unidade).id,consultora:b.identificacao.consultora,cliente:b.identificacao.cliente,telefone_normalizado:b.identificacao.telefone.replace(/\D/g,'')});resultado={ok:true,version:p.version,pedidoId:id}}}
  else resultado={ok:true,pedido:pedidos.get(id)}
 }else{status=404;resultado={ok:false,mensagem:'API não simulada'}}
 sessionStorage.setItem("decorisi-pedidos-sinteticos",JSON.stringify([...pedidos])); return new Response(JSON.stringify(resultado),{status,headers:{'Content-Type':'application/json'}})
}
function converter(itens){return itens.map((i,n)=>({id:i.id,ordem:n+1,tipo:i.tipo,classificacao:i.classificacao,referencia_db_id:db.find((r)=>r.referencia===i.referencia)?.id??null,referencia_pf:i.tipo==='PAINEL'?i.referencia:null,descricao:i.descricao,observacoes:i.observacoes,medidas:i.medidas.map((m,j)=>({ordem:j+1,ambiente:m.ambiente,largura_cm:m.larguraCm,altura_cm:m.alturaCm})),anexos:[]}))}
createRoot(document.getElementById('root')).render(React.createElement(FormularioNovoPedido))
