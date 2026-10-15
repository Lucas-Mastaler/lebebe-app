# Status — Decorisi

Projeto: decorisi-pedidos-personalizados
Estado: PUBLICADA — ativação comercial incompleta; gate de backend Vercel ainda indisponível
Atualizado: 2026-10-15

## Entrega vigente

- Fases 1–5: catálogo, cálculos, rascunhos, cotação/fechamento, gestão, anexos e histórico implementados. Doce Bebê: 90 DB; Xadrezia: 132 XP. Máscara em centésimos e resumo financeiro após medidas preservados.
- D-013: somente pedidos com pelo menos um item e TODOS PAPEL/CATALOGO seguem VENDA FECHADA → EM PRODUÇÃO → RECEBIDO. Qualquer personalizado ou painel mantém layout/aprovação. RPC decide pela composição persistida sob lock; gestão usa todos os itens, inclusive listagem/modal e atualização automática após fechar.
- Migration incremental aplicada pelo MCP oficial e registrada: `20261014205043_decorisi_papel_catalogo_fluxo.sql`. Históricas não editadas/reaplicadas. ACL service_role, security invoker, search_path e RLS preservados; hashes das RPCs legadas Moriah/Exclusive idênticos antes/depois. Sem alteração de preços, cálculos, referências ou dados comerciais reais.

## Validações D-013

- Corrigidos os três erros TypeScript em `FormularioDecorisi.tsx`: os callbacks aguardam `recarregar()` e descartam explicitamente seu retorno, compatíveis com `Promise<void>`. Typecheck agora reporta apenas os mesmos 15 erros preexistentes em testes de autenticação e Hub Vendas; nenhum em Decorisi.
- Build completo aprovado após permitir a conexão de rede para Caveat, Geist e Geist Mono. Lint direcionado: zero erros, um aviso existente de dependência de `useEffect` na gestão. `git diff --check` aprovado.
- 664 testes/30 arquivos aprovados. PostgreSQL descartável: 36 cenários SQL e 18 de concorrência/regressão, com sessões independentes.
- Supabase atual: sete composições até RECEBIDO, atalhos/layout indevidos rejeitados, replay rejeitado e histórico exato. Teste SQL transacional com rollback integral, IDs no manifesto. Personalizados usaram metadados sintéticos de anexos; nenhum upload/objeto Storage criado nesta rodada.
- Navegador autenticado e APIs reais: papel catálogo fechado, botão atualizado automaticamente para EM PRODUÇÃO, seletor sem layout/aprovação e fluxo até RECEBIDO. Painel Fofura mantém AGUARDANDO LAYOUT. API/Supabase: concorrência 200/409, atalho 422, aprovação, retorno e cancelamento confirmados.
- Dois pedidos persistidos de navegador removidos exclusivamente por IDs comprovados, com itens/medidas/histórico; o acesso daquela rodada foi revogado ao encerrá-la. Leitura remota atual confirmou zero resíduos em pedidos, itens, medidas, anexos, histórico, Storage e fila; disponibilidade comercial segue false.
- Pendência de segurança: leitura remota encontrou um acesso técnico ativo com finalidade `Homologação local Decorisi localhost`, com expiração em 16/10/2026 às 02:56 UTC (15/10 às 23:56 BRT). O acesso segue ativo até esse prazo; a ativação comercial exige nova leitura após expirar.
- Evidências: `output/decorisi-fluxo-{testes-final,sql,concorrencia,lint,typecheck-final}.txt`, `output/decorisi-fluxo-real-transacional.json`, `output/decorisi-fluxo-browser-manifesto.json`, `output/decorisi-fluxo-concorrencia-real.json`, SQL de limpeza e capturas `decorisi-fluxo-{direto-gestao,recebido,painel-layout}.png`.

## Pendências e homologação

- Commit `01988c76dcfc16d7bbcd38765af51949236b2b63` enviado a `main`; deploy Vercel `dpl_Hy6aReLUPnbWztRjBNP9S4A5N4bo` está READY. `/login` respondeu HTTP 200. Após ativar o fornecedor no banco, o endpoint de opções segue respondendo `FORNECEDOR_INDISPONIVEL`, pois o runtime exige `PEDIDOS_DECORISI_BACKEND=true` em produção.
- Typecheck global mantém 15 diagnósticos preexistentes em autenticação e Hub Vendas. O build completo passou; lint direcionado mantém um aviso existente na gestão.
- O único acesso técnico temporário foi removido pelo procedimento de revogação existente, após autorização expressa. Conferência posterior encontrou zero acessos ativos e zero pedidos dos três IDs sintéticos conhecidos.
- A disponibilidade do fornecedor Decorisi está true; Moriah e Exclusive continuam true. Ainda não há ativação funcional: Vercel recusou com HTTP 403 a configuração da variável `PEDIDOS_DECORISI_BACKEND` em production. A integração CLI não está instalada; não houve tentativa de contorno. Configurar essa variável via controle autorizado do projeto e fazer novo deploy para concluir.
