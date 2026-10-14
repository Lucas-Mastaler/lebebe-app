# Status — Decorisi

Projeto: decorisi-pedidos-personalizados
Estado: EM_EXECUCAO — ajustes finais e Xadrezia implementados; aguardando rehomologação manual
Atualizado: 2026-10-14
Checkpoint: Fases 1–5 entregues; D-010 amplia catálogos para 222 referências. Sem ativação comercial.

## Entrega vigente

- Doce Bebê: 90 DB preservados. Xadrezia: 132 XP001–XP132 únicos com repetições oficiais. JSON com fonte/data/hash; reextração conferiu todos os valores DB anteriores. XP e DB usam a mesma calculadora física; produtos/preços SGI preservados.
- Papel catálogo/personalizado: catálogo separado, referência filtrada, pesquisa código/número, confirmação antes de limpar referência incompatível. Medidas, descrição e anexos preservados; painéis permanecem Fofura/personalizado.
- Máscara automática de quatro dígitos: 350 → 3,50m, 1234 → 12,34m, 10000 → 10,00m. Cursor, seleção, Backspace, Delete e colagem numérica; letras/sinais/separadores manuais recusados. Valores antigos carregados não são truncados automaticamente.
- Resumo financeiro imediatamente após medidas, antes de observações/anexos; quantidade de rolos ou área com quatro casas, preço unitário/subtotal e quatro divisores discretos. Cálculo comercial existente reutilizado; inválido/sem preço não recebe subtotal definitivo.
- Gestão, fechamento/snapshots, histórico, transições até RECEBIDO, anexos privados e controle de concorrência continuam integrados. Checklist de acesso local nominativo no PLANO.

## Banco e segurança

- Supabase phsoawbdvhurroryfnok: migration D-010 aceita pelo MCP oficial e registrada como **20261013204930_decorisi_catalogo_xadrezia.sql**. Constraint ampliada e 132 XP inseridos. Conferência remota: valores/hash XP idênticos ao JSON; 90 DB integralmente iguais; índices/triggers/ACL/RLS preservados.
- Seis migrations anteriores e Fase 5 (20261013141811) não reaplicadas nem editadas. Nenhuma RPC, permissão, produto SGI ou tabela de pedido alterada nesta migration.
- Disponibilidade comercial false. Conferência autenticada de 14/10 reutilizou acesso nominativo por uma hora, revogado ao encerrar. Um rascunho sintético XP foi criado, editado e reaberto; pedido/item/medida removidos por IDs comprovados, sem alterar auditoria/permissões. Zero testadores ativos e zero resíduos do teste; nenhum upload realizado. Manifesto: output/decorisi-conferencia-real.json.

## Validação desta rodada

- 647 testes direcionados/28 arquivos aprovados; 30 cenários SQL no PostgreSQL descartável aprovados, incluindo XP catálogo/personalizado, cálculo, rejeição XP inválido/painel e compatibilidade de pedido DB criado antes da migration.
- Lint direcionado sem erros. Typecheck: 15 diagnósticos externos (auth/Hub), nenhum Decorisi. Build final aprovado com fontes originais; git diff --check aprovado. Evidências: output/decorisi-xadrezia-{testes,sql,lint,typecheck,build-final}.txt e output/decorisi-xadrezia-banco.json.
- Navegador com componentes reais/APIs simuladas: máscara/limite/edição/colagem, filtro XP por número, troca de catálogo/cancelamento, XP catálogo/personalizado, salvar/reabrir com medidas PT-BR, resumo/separadores, desktop e móvel 390×844 sem overflow. Capturas em output/decorisi-xadrezia-desktop.png e output/decorisi-xadrezia-mobile.png.
- Conferência adicional autenticada em 14/10: aplicação Next com fontes reais conferidos por hash, sem mocks, sessão técnica e Supabase reais. Cache isolado/Webpack preservou o Next do usuário na porta 3000. Confirmados os quatro requisitos, todos os exemplos da máscara durante digitação (inclusive 300→3,00), foco em unidade/altura inválida, subtotal bloqueado para altura impossível, DB813/XP001, XP catálogo e personalizado salvos, reabertura com 350/270cm e Xadrezia preservados, painel 9,4500m², quatro divisores e móvel 390×844 sem overflow. Comparação com Moriah real e console sem erros. Capturas: output/decorisi-conferencia-real-{desktop,mobile}.png. Nenhuma correção adicional de código necessária.
- Reexecução de 14/10: 647 testes/28 arquivos aprovados, lint direcionado limpo, typecheck com os mesmos 15 erros auth/Hub. Build de 13/10 aprovado; não repetido sem alteração de código nem para disputar cache com o servidor ativo do usuário. Evidências: output/decorisi-conferencia-final-{testes,lint,typecheck}.txt.
- Limitação: não repetiu fechamento/uploads autenticados nesta rodada nem suíte global. Fase 5 anterior validou fluxo real e limpeza exata (manifestos output/decorisi-fase5-223f54fb.json e output/decorisi-fase5-52b322d6.json). Base global conhecida: 19 falhas de testes, 15 erros TS e lint legado; nenhum refactor externo realizado.

## Próximo passo

Commit e push exclusivamente da Decorisi na main autorizados pelo usuário (D-011). Rehomologar na aplicação autenticada conforme PLANO, incluindo Xadrezia e máscara de centésimos. Deploy manual, alterações VPS/SGI e ativação global continuam fora desta autorização.
