// Laboratório SQL sem .env ou rede comercial.
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {criarBancoNegociacoes,usuario,cliente,unidade} from './banco-negociacoes-isolado.mjs'
const db=await criarBancoNegociacoes()
try{
 await db.exec('UPDATE atendimento_presencial_digital_config SET ativo=true')
 const origem=randomUUID()
 await db.query("INSERT INTO atendimento_presencial_atendimentos(id,cliente_id,consultora_usuario_id,unidade_id,status,resultado_atendimento,iniciado_em,concluido_em) VALUES($1,$2,$3,$4,'concluido','negociacao',now()-interval '10 days',now()-interval '10 days')",[origem,cliente,usuario,unidade])
 const ficha={versaoFluxo:2,tipoAtendimento:'cliente',versaoProdutos:2,versaoEssenciais:1,essenciais:{},criancas:[],departamentos:['moveis'],produtosInteresse:[{descricao:'COMODA',quantidade:1,vendido:true},{descricao:'BERCO',quantidade:1,vendido:false}],motivosResultado:[],resultadoAtendimento:'sim',consultoraNome:'ANA',etapaAtual:'ficha'}
 const criar=async(dados=ficha,negociacao=origem)=> (await db.query('SELECT atendimento_presencial_digital_criar($1,$2,$3,$4,$5,$6,$7,now()) id',[negociacao,usuario,randomUUID(),unidade,dados,'whatsapp',null])).rows[0].id
 await db.exec('UPDATE atendimento_presencial_digital_config SET ativo=false')
 await assert.rejects(criar(),e=>e.code==='42501')
 const legado=randomUUID()
 await db.query('SELECT atendimento_presencial_negociacao_digital($1,$2,$3,$4,$5,0,$6,null)',[origem,usuario,randomUUID(),'rascunho',legado,{clienteId:cliente,unidadeId:unidade,canal:'whatsapp',produtos:[{descricao:'BERCO',quantidade:1,vendido:true}]}])
 await db.exec('UPDATE atendimento_presencial_digital_config SET ativo=true')
 assert.equal((await db.query('SELECT atendimento_id FROM atendimento_presencial_vendas_digitais WHERE id=$1',[legado])).rows[0].atendimento_id,null)
 await assert.rejects(db.query('SELECT atendimento_presencial_negociacao_digital($1,$2,$3,$4,$5,0,$6,null)',[origem,usuario,randomUUID(),'rascunho',randomUUID(),{clienteId:cliente}]),e=>e.code==='23514')
 const id=await criar(),outro=await criar()
 assert.notEqual(id,outro)
 const resumo=(await db.query('SELECT atendimento_presencial_negociacoes_resumos($1,$2) r',[usuario,[origem]])).rows[0].r[origem]
 assert.equal(resumo.situacao,'aberta')
 assert.equal(resumo.rascunhos,3) // Dois integrais e um legado, nenhum encerramento.
 await assert.rejects(db.query('UPDATE atendimento_presencial_atendimentos SET cliente_id=null WHERE id=$1',[id]),e=>e.code==='23514')
 await assert.rejects(db.query("UPDATE atendimento_presencial_atendimentos SET natureza='presencial' WHERE id=$1",[id]),e=>e.code==='42501')
 await assert.rejects(db.query('SELECT atendimento_presencial_concluir($1,1,$2,54321,$3,null)',[id,usuario,'ANA']),e=>e.code==='42501')
 const concluir=()=>db.query('SELECT atendimento_presencial_digital_concluir($1,1,$2,54321,$3,null) r',[id,usuario,'ANA'])
 await concluir();await concluir()
 const encerrada=(await db.query('SELECT atendimento_presencial_negociacoes_resumos($1,$2) r',[usuario,[origem]])).rows[0].r[origem]
 assert.equal(encerrada.situacao,'venda')
 assert.equal(encerrada.atendimentoId,id)
 assert.ok(encerrada.encerradoEm)
 assert.equal(encerrada.rascunhos,2)
 assert.equal((await db.query("SELECT count(*)::int n FROM atendimento_presencial_negociacao_encerramentos WHERE NOT anulado")).rows[0].n,1)
 assert.equal((await db.query("SELECT count(*)::int n FROM atendimento_presencial_atendimentos WHERE status='concluido' AND natureza='presencial'")).rows[0].n,1)
 assert.equal((await db.query("SELECT sum(quantidade)::int pv FROM atendimento_presencial_produtos_interesse WHERE atendimento_id=$1 AND vendido",[id])).rows[0].pv,1)
 assert.equal((await db.query('SELECT status FROM atendimento_presencial_atendimentos WHERE id=$1',[outro])).rows[0].status,'rascunho')
 await assert.rejects(db.query('SELECT atendimento_presencial_digital_concluir($1,1,$2,54322,$3,null)',[outro,usuario,'ANA']),e=>e.code==='P0003')
 console.log('OK: criação independente, conclusão oficial, encerramento atômico, retry, PV 1, contagem física e conflito preservando rascunho')
 const raiz=randomUUID(),permanente=randomUUID()
 await db.query("INSERT INTO atendimento_presencial_atendimentos(id,cliente_id,consultora_usuario_id,unidade_id,status,resultado_atendimento,iniciado_em,concluido_em) VALUES($1,$2,$3,$4,'concluido','negociacao',now()-interval '7 days',now()-interval '7 days')",[raiz,cliente,usuario,unidade])
 await db.query('INSERT INTO atendimento_presencial_criancas_cadastro(id,dados,criado_por) VALUES($1,$2,$3)',[permanente,{situacao:'gestacao',nome:'LORENA'},usuario])
 await db.query('INSERT INTO atendimento_presencial_clientes_criancas(cliente_id,crianca_id,parentesco,criado_por) VALUES($1,$2,$3,$4)',[cliente,permanente,'Mãe',usuario])
 const produtos=['berco','comoda','roupeiro','poltrona','kit','coleito','banheira','baba','carrinho','bebe_conforto','base','colchao']
 await db.query("INSERT INTO atendimento_presencial_criancas(atendimento_id,ordem,local_id,situacao,nome,nome_nao_informado) VALUES($1,1,'nova','gestacao','LORENA',false)",[raiz])
 const filhos=[{id:'permanente',situacao:'gestacao',nome:'LORENA',criancaPermanenteId:permanente,vinculoClienteId:cliente},{id:'nova',situacao:'gestacao',nome:'LORENA',parentesco:'Mãe'}]
 const comCriancas={...ficha,criancas:filhos,essenciais:Object.fromEntries(filhos.map(c=>[c.id,Object.fromEntries(produtos.map(p=>[p,'sim']))]))}
 const completo=await criar(comCriancas,raiz)
 await db.query('SELECT atendimento_presencial_digital_concluir($1,1,$2,54323,$3,null)',[completo,usuario,'ANA'])
 assert.equal((await db.query('SELECT count(*)::int n FROM atendimento_presencial_essenciais_snapshots WHERE atendimento_id=$1',[completo])).rows[0].n,2)
 assert.equal((await db.query('SELECT count(*)::int n FROM atendimento_presencial_criancas WHERE atendimento_id=$1 AND crianca_permanente_id IS NOT NULL',[completo])).rows[0].n,2)
 assert.equal((await db.query('SELECT count(DISTINCT crianca_permanente_id)::int n FROM atendimento_presencial_criancas WHERE atendimento_id=$1',[completo])).rows[0].n,2)
 assert.equal((await db.query('SELECT crianca_permanente_id FROM atendimento_presencial_criancas WHERE atendimento_id=$1',[raiz])).rows[0].crianca_permanente_id,null)
 assert.equal((await db.query('SELECT count(*)::int n FROM atendimento_presencial_essenciais_eventos WHERE atendimento_id=$1',[completo])).rows[0].n,24)
 const antesEdicao=(await db.query('SELECT version FROM atendimento_presencial_atendimentos WHERE id=$1',[completo])).rows[0].version
 const corrigida={...comCriancas,observacoes:'Correção auditada',produtosInteresse:[{descricao:'COMODA',quantidade:2,vendido:true},{descricao:'BERCO',quantidade:1,vendido:false}]}
 await db.query('SELECT * FROM atendimento_presencial_digital_editar($1,$2,$3,$4,$5,$6,$7,$8,$9)',[completo,antesEdicao,usuario,corrigida,54323,'ANA',[],{canal:'telefone'},'Ajuste sintético de quantidade e canal'])
 assert.equal((await db.query('SELECT canal_digital FROM atendimento_presencial_atendimentos WHERE id=$1',[completo])).rows[0].canal_digital,'telefone')
 assert.equal((await db.query('SELECT quantidade FROM atendimento_presencial_produtos_interesse WHERE atendimento_id=$1 AND vendido',[completo])).rows[0].quantidade,2)
 const raizPosterior=randomUUID()
 await db.query("INSERT INTO atendimento_presencial_atendimentos(id,cliente_id,consultora_usuario_id,unidade_id,status,resultado_atendimento,iniciado_em,concluido_em) VALUES($1,$2,$3,$4,'concluido','negociacao',now(),now())",[raizPosterior,cliente,usuario,unidade])
 const posterior=await criar({...comCriancas,criancas:[filhos[0]],essenciais:{permanente:{banheira:'nao'}}},raizPosterior)
 await db.query('SELECT atendimento_presencial_digital_concluir($1,1,$2,54325,$3,null)',[posterior,usuario,'ANA'])
 const respostasPosteriores=(await db.query('SELECT respostas FROM atendimento_presencial_essenciais_snapshots WHERE atendimento_id=$1',[posterior])).rows[0].respostas
 assert.equal(respostasPosteriores.find(p=>p.produto==='berco').confirmada,false)
 assert.equal(respostasPosteriores.find(p=>p.produto==='banheira').confirmada,true)
 const estadoAntes=(await db.query('SELECT * FROM atendimento_presencial_essenciais_estado ORDER BY crianca_id,produto')).rows
 const versao=(await db.query('SELECT version FROM atendimento_presencial_atendimentos WHERE id=$1',[completo])).rows[0].version
 const anular=randomUUID()
 await db.query('SELECT atendimento_presencial_digital_anular($1,$2,$3,$4,$5)',[completo,usuario,versao,anular,'Teste sintético'])
 await db.query('SELECT atendimento_presencial_digital_anular($1,$2,$3,$4,$5)',[completo,usuario,versao,anular,'Teste sintético'])
 assert.deepEqual((await db.query('SELECT * FROM atendimento_presencial_essenciais_estado ORDER BY crianca_id,produto')).rows,estadoAntes)
 assert.equal((await db.query("SELECT resposta FROM atendimento_presencial_essenciais_estado WHERE crianca_id=$1 AND produto='banheira'",[permanente])).rows[0].resposta,'nao')
 assert.equal((await db.query('SELECT count(*)::int n FROM atendimento_presencial_essenciais_snapshots WHERE atendimento_id=$1',[completo])).rows[0].n,2)
 console.log('OK: criança permanente e nova, múltiplas crianças, snapshots/eventos oficiais; anulação idempotente mantém respostas e vínculos')
 const raizFalha=randomUUID()
 await db.query("INSERT INTO atendimento_presencial_atendimentos(id,cliente_id,consultora_usuario_id,unidade_id,status,resultado_atendimento,iniciado_em,concluido_em) VALUES($1,$2,$3,$4,'concluido','negociacao',now(),now())",[raizFalha,cliente,usuario,unidade])
 const falha=await criar({...comCriancas,essenciais:{}},raizFalha)
 await assert.rejects(db.query('SELECT atendimento_presencial_digital_concluir($1,1,$2,54324,$3,null)',[falha,usuario,'ANA']),e=>e.code==='23514')
 assert.equal((await db.query('SELECT status FROM atendimento_presencial_atendimentos WHERE id=$1',[falha])).rows[0].status,'rascunho')
 assert.equal((await db.query('SELECT count(*)::int n FROM atendimento_presencial_criancas WHERE atendimento_id=$1',[falha])).rows[0].n,0)
 assert.equal((await db.query('SELECT count(*)::int n FROM atendimento_presencial_vendas_digitais WHERE atendimento_id=$1',[falha])).rows[0].n,0)
 console.log('OK: identidade/natureza protegidas, conclusão direta recusada e falha de essenciais reverte filhos, produtos, venda e encerramento')
 const actor=randomUUID(),perfil=randomUUID(),outra=randomUUID(),modulo=randomUUID()
 await db.query("INSERT INTO usuarios_permitidos VALUES($1,'user',true)",[actor])
 await db.query("INSERT INTO app_perfis_acesso VALUES($1,'consultora',true)",[perfil])
 await db.query('INSERT INTO app_usuarios_perfis VALUES($1,$2)',[actor,perfil])
 await db.query("INSERT INTO app_unidades(id,ativo,nome) VALUES($1,true,'Outra filial')",[outra])
 await db.query('INSERT INTO app_usuarios_unidades VALUES($1,$2)',[actor,outra])
 await db.query("INSERT INTO app_modulos(id,chave,ativo,publico,somente_superadmin) VALUES($1,'atendimento_presencial_ficha',true,false,false)",[modulo])
 await db.query('INSERT INTO app_permissoes_usuario VALUES($1,$2,true)',[modulo,actor])
 await assert.rejects(db.query('SELECT atendimento_presencial_digital_anular($1,$2,1,$3,$4)',[completo,actor,randomUUID(),'Não autorizado']),e=>e.code==='42501')
 const daOutra=(await db.query('SELECT atendimento_presencial_digital_criar($1,$2,$3,$4,$5,$6,null,now()) id',[origem,actor,randomUUID(),outra,ficha,'whatsapp'])).rows[0].id
 assert.ok(daOutra)
 console.log('OK: gate fechado, legado legível, contrato reduzido bloqueado para novos registros; criação autorizada em outra filial sem conceder anulação alheia')
}finally{await db.close()}
