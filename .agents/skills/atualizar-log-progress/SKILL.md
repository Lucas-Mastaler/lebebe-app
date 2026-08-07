---
name: atualizar-log-progress
description: "Use ao final de qualquer tarefa relevante para registrar uma entrada curta em docs/ia/log_progress.md, preservando encoding e sem reescrever o histórico. NÃO use para reler o arquivo inteiro (dezenas de milhares de linhas), nem para duplicar o progresso completo de um Projeto Multifase — nesse caso a entrada aponta para o STATUS.md do projeto."
metadata:
  author: le-bebe-app
  version: "1.0.0"
---

# Atualizar Log Progress

Padroniza a atualização segura de `docs/ia/log_progress.md` (continuidade
global). As outras skills apontam para esta em vez de repetir estas regras.

## Consulta (antes de escrever)

Nunca leia o arquivo inteiro. Leia só o necessário para confirmar o padrão
de separador/formatação mais recente — as primeiras dezenas de linhas, ou
uma busca dirigida por módulo/assunto/projeto se precisar de contexto
específico.

## Escrita seguinte — regra obrigatória de encoding

Um round-trip de leitura/escrita ingênuo já corrompeu este arquivo uma vez
nesta sessão (revertido antes de qualquer commit) — por isso o procedimento
abaixo não é opcional:

1. **Nunca** use `echo "texto com acento" >> arquivo` nem qualquer
   redirecionamento de shell/PowerShell com texto acentuado.
2. **Nunca** regrave o arquivo inteiro para adicionar uma entrada.
3. Use Node.js com `fs.readFileSync`/`fs.writeFileSync` em `'utf8'`
   explícito, adicionando **só** a entrada nova por concatenação — não
   reformate o que já existe.
4. Não corrija corrupção histórica encontrada no arquivo — fora de escopo
   desta skill.
5. Depois de escrever, confirme por comparação de bytes (ou `git diff
   --stat` mostrando só inserções, 0 remoções) que nada além da entrada
   nova mudou. Não confie só no round-trip de leitura.
6. Nunca registre secrets, tokens, senhas ou dados sensíveis.

## Conteúdo da entrada

Formato padrão (`AGENTS.md` §11):

```
## <data> - <agente/ferramenta> - <resumo curto>

- **Resumo:** ...
- **Arquivos lidos:** ...
- **Arquivos alterados/criados:** ...
- **Validações:** ...
- **Comandos/resultados:** ...
- **Pendências:** ...
- **Riscos:** ...
- **Próximo passo:** ...
```

Entrada curta e proporcional à tarefa — não é o lugar para reproduzir o
relatório inteiro de `.agents/skills/validar-entrega/SKILL.md`.

## Projeto Multifase

Se a tarefa pertence a um projeto em `docs/projetos/<slug>/`: a entrada
aqui fica **curta** e aponta para `<slug>/STATUS.md` — não duplique o
progresso detalhado, que já vive no projeto (ver
`.agents/skills/projeto-multifase/SKILL.md`, seção "Log global").

## Esforço recomendado

Baixo-médio — mecânico, mas o passo de verificação de encoding não pode
ser pulado.
