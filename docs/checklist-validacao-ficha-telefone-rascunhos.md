# Checklist de validacao manual - Ficha de Atendimento Presencial

PR #2: https://github.com/Lucas-Mastaler/lebebe-app/pull/2

> Use o preview da Vercel do PR (ou ambiente autenticado) com um usuario que tenha acesso ao modulo `atendimento_presencial_ficha`.

## A) Telefone em todas as etapas

1. [ ] Iniciar um novo atendimento.
2. [ ] Na etapa "ficha", confirmar que o campo rapido "Telefone da cliente" aparece na parte inferior (acima da barra de botoes) e que ele compartilha o MESMO valor do campo "Telefone opcional" do cadastro (digitar em um reflete no outro).
3. [ ] Selecionar/criar uma cliente e avancar para a etapa "resultado".
4. [ ] Confirmar que o campo "Telefone da cliente" continua visivel na etapa "resultado" (nao fixo, no fluxo da pagina, proximo aos botoes).
5. [ ] Alterar o telefone nessa etapa intermediaria; confirmar indicador "Salvando..." e depois o valor mascarado correto.
6. [ ] Avancar para "revisao"; confirmar que o telefone exibido na revisao reflete a alteracao feita na etapa anterior.
7. [ ] Recarregar a pagina (F5) e reabrir o rascunho; confirmar que o telefone alterado foi persistido.
8. [ ] Concluir o atendimento; confirmar que conclui normalmente (sem travar) com o telefone valido.
9. [ ] Testar telefone invalido (poucos digitos): confirmar mensagem de erro no campo rapido e que a alteracao invalida nao "quebra" o fluxo.
10. [ ] Confirmar que digitar o telefone em etapas posteriores NAO volta para a etapa de cliente e NAO abre modal sozinho.

## B) Cadastro/atualizacao da cliente

11. [ ] Cliente nova (sem clienteId): informar telefone e nome, confirmar criacao normal.
12. [ ] Cliente existente localizada pela busca: confirmar que o telefone aparece preenchido.
13. [ ] Alterar o telefone de uma cliente JA vinculada em etapa posterior: confirmar que persiste (recarregar e conferir).
14. [ ] Tentar salvar um telefone que ja pertence a OUTRA cliente ativa: confirmar mensagem "Telefone ja cadastrado em outra cliente".

## C) Rascunhos enriquecidos

15. [ ] Criar rascunho COM cliente; voltar a tela inicial e confirmar o nome da cliente no card.
16. [ ] Confirmar a consultora responsavel no card (e-mail e aceitavel, pois nao ha nome civil cadastrado).
17. [ ] Confirmar unidade, ultima atualizacao, expiracao e data de inicio no card.
18. [ ] Criar rascunho SEM cliente informada; confirmar o fallback "Cliente ainda nao informado".
19. [ ] (Se aplicavel) rascunho sem consultora resolvivel: confirmar "Consultora nao identificada".
20. [ ] Clicar em "Continuar preenchendo" e confirmar que retoma o rascunho corretamente.

## D) Separacao visual

21. [ ] Confirmar dois blocos distintos: "Novo atendimento" (fundo azul suave) e "Rascunhos em andamento" (fundo ambar suave), claramente separados.
22. [ ] Confirmar que a acao principal "Iniciar novo atendimento" nao se confunde com a lista de rascunhos.

## E) Responsividade (sem scroll horizontal)

Validar em 320 px, 375 px, 390 px, tablet e desktop:

23. [ ] 320 px: telefone e botoes de navegacao nao ficam comprimidos; sem scroll horizontal.
24. [ ] 375 px e 390 px: campo de telefone em coluna, input largura total, botoes acessiveis.
25. [ ] Tablet: layout equilibrado (telefone pode ficar em linha).
26. [ ] Desktop: campo de telefone em linha, sem ocupar largura excessiva.
27. [ ] Nome longo de cliente/consultora nos cards NAO quebra o layout (quebra por palavra, sem overflow).

## Observacoes tecnicas

- Fonte de verdade unica do telefone: `novoCliente.telefone` (antes de vincular) e o registro da cliente (`clienteSelecionada`) depois de vinculada. Nao ha telefone independente.
- Persistencia do telefone de cliente vinculada: `PATCH /api/atendimento-presencial/clientes/[id]` (apenas telefone, debounce 800 ms, concorrencia por `version`).
- O telefone NAO faz parte do payload do autosave do rascunho; e restaurado ao reabrir carregando a cliente por `clienteId`.
- Nomes dos rascunhos resolvidos em batch no backend (sem N+1).
