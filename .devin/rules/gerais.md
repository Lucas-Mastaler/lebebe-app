---
trigger: always_on
---

# RULES GERAIS DO PROJETO

## 1. Escopo
- Trabalhe somente no que foi pedido.
- Não faça refactors paralelos.
- Não altere nomes, estrutura, layout, fluxos, tipos ou arquivos fora do escopo sem autorização explícita.
- Se encontrar problemas extras, apenas liste separadamente. Não corrija por conta própria.

## 2. Nada de suposição
- Nunca assuma comportamento com base apenas em nome de arquivo, nome de função ou comentário.
- Toda conclusão deve ser baseada em leitura real do código.
- Quando algo não puder ser confirmado com segurança, escreva explicitamente: "não confirmado no código".

## 3. Antes de alterar qualquer coisa
- Identifique primeiro quais arquivos realmente participam do fluxo.
- Leia o fluxo completo antes de editar:
  - entrada da ação
  - componente envolvido
  - hooks
  - services
  - API route / server action
  - acesso ao banco
  - retorno para a UI
- Explique de forma objetiva o ponto exato que será alterado.

## 4. Mudança mínima viável
- Prefira a menor alteração possível para resolver a demanda.
- Preserve comportamento existente em tudo que não foi solicitado.
- Não “melhore” trechos vizinhos sem pedido.

## 5. Segurança nas respostas
- Nunca dizer que algo está implementado sem validar.
- Nunca dizer que corrigiu completamente sem listar exatamente o que mudou.
- Nunca ocultar risco colateral.
- Se houver chance de impacto em outro fluxo, avisar antes.

## 6. Investigação obrigatória
- Para qualquer tarefa, verificar:
  - arquivo principal
  - componentes filhos
  - funções chamadas
  - tipo de dados usados
  - origem dos dados
  - destino dos dados
  - validações existentes
  - impacto em autenticação/permissão, se houver

## 7. Banco e integrações
- Se a tarefa tocar banco, queries, migrations, policies, tipos gerados, joins, views, triggers ou nomes de colunas:
  - validar antes no MCP do Supabase
- Se a tarefa tocar integração externa:
  - validar no código onde a integração é configurada e usada
  - não inventar payload, retorno ou comportamento da API

## 8. UI e UX
- Não alterar layout, estilo, texto, ordem visual, componentes ou experiência do usuário sem pedido explícito.
- Em tarefa funcional, manter a interface o mais intacta possível.

## 9. Logs e diagnóstico
- Ao investigar bug, apontar primeiro a causa provável no código antes de propor alteração.
- Sempre que possível, sugerir logs pontuais em vez de alterações cegas.

## 10. Respeito à arquitetura existente
- Antes de criar novo helper, schema, hook, util ou service, verificar se já existe algo equivalente no projeto.
- Evitar duplicação de regra de negócio.
- Não espalhar regra nova em vários arquivos se o projeto já tiver um ponto central para isso.

## 11. Continuidade entre agentes e log de progresso
- Antes de iniciar qualquer tarefa relevante, ler `docs/ia/log_progress.md`, se existir.
- Tratar esse arquivo como resumo de continuidade — não como fonte absoluta da verdade. Validar no código real qualquer informação necessária antes de alterar arquivos.
- Ao finalizar uma tarefa relevante, atualizar `docs/ia/log_progress.md` registrando: data; agente/ferramenta usada; resumo do que foi feito; arquivos lidos; arquivos alterados/criados; validações realizadas; comandos rodados e resultados; pendências; riscos conhecidos; próximo passo recomendado.
- Não apagar histórico validado.
- Não inventar validação que não foi realizada.
- Não registrar secrets, tokens, senhas ou dados sensíveis.
- Não transformar o log em cópia do chat.
- Não tratar o log como substituto da leitura do código.
- Se algo não foi confirmado, escrever explicitamente "não confirmado".
- Quando houver banco de dados, consultar o MCP Supabase antes de assumir tabelas, colunas, relações, policies, migrations ou queries.