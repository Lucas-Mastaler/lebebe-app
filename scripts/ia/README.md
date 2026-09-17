# Controlador de loops Claude (genérico) + Fila 2 do Design System

Documentação operacional mínima. Regras de negócio, escopo e estado das
telas continuam em `docs/projetos/design-system/STATUS.md` — este arquivo é
só sobre a infraestrutura dos scripts.

Dois arquivos:

- **`executar-loop-claude.ps1`** — controlador genérico. Não sabe nada sobre
  Design System ou qualquer domínio específico; o conteúdo de cada sessão
  vem inteiramente do arquivo de prompt (`-PromptFile`). Reutilizável para
  qualquer fila futura.
- **`executar-design-system-fila-2.ps1`** — wrapper fino que chama o
  controlador genérico com o prompt e `NomeExecucao=design-system-fila-2`
  fixos desta fila. **Continua sendo o comando de sempre**, sem mudança de
  interface.

## Como iniciar (Fila 2 do Design System — comando de sempre)

```powershell
powershell.exe -File "C:\le-bebe\scripts\ia\executar-design-system-fila-2.ps1" -MaxExecucoes 2
```

## Como criar uma fila nova (genérico)

```powershell
powershell.exe -File "C:\le-bebe\scripts\ia\executar-loop-claude.ps1" `
    -PromptFile "C:\le-bebe\scripts\ia\minha-nova-fila-prompt.txt" `
    -NomeExecucao "design-system-fila-3" `
    -MaxExecucoes 10
```

Só é preciso escrever o novo arquivo de prompt (mesmo contrato de saída
estruturada `CONTINUE`/`DONE`/`CRITICAL` do prompt da Fila 2) e escolher um
`NomeExecucao`. `-ProjectDir` é opcional (padrão `C:\le-bebe`).
`-MaxExecucoes` conta só execuções **úteis** (uma unidade de trabalho
concluída, bloqueada localmente, `DONE` ou `CRITICAL`) — tentativas que caem
em `RATE_LIMIT` não contam. O modelo (`claude-sonnet-5`) e o effort
(`medium`) são **constantes fixas** no script, não parâmetros — todo loop
criado com este controlador usa exatamente essa configuração até uma
decisão futura explícita mudar isso.

## Onde fica cada coisa

Cada `NomeExecucao` tem seus próprios logs, isolados dos de outras filas:

| O quê | Onde |
|---|---|
| Log resumido, legível, uma linha JSON por execução/evento | `scripts/ia/logs/<NomeExecucao>/controller.log` |
| Resposta bruta completa de cada tentativa (útil, rate limit ou erro) | `scripts/ia/logs/<NomeExecucao>/runs/AAAA-MM-DD_HHmmss_tentativa-N_<session-id>.json` |
| Checkpoint do controlador (estado atual, atualizado atomicamente) | `scripts/ia/logs/<NomeExecucao>/controller-state.json` |
| Lock contra duas execuções simultâneas | `scripts/ia/logs/controller.lock` (**por repositório**, não por fila — ver "Lock" abaixo) |

Para a Fila 2 do Design System, `<NomeExecucao>` = `design-system-fila-2`.
`NomeExecucao` é sanitizado automaticamente (só letras, números, hífen e
underscore); um nome que sanitize para vazio é rejeitado.

**Histórico anterior a esta reorganização**: os arquivos antigos em
`scripts/ia/logs/design-system-fila-2.log`, `scripts/ia/logs/runs/`,
`scripts/ia/logs/controller-state.json` e `scripts/ia/logs/controller.lock`
(sem subpasta por nome) continuam no disco, intactos, como registro — não
foram movidos nem reescritos. A partir desta reorganização, novos logs da
Fila 2 vão para `scripts/ia/logs/design-system-fila-2/`. Entradas antigas
com mojibake (bug de encoding já corrigido) também não foram reescritas —
são evidência histórica.

## Lock: por que é por repositório, não por fila

Duas automações **diferentes** (nomes diferentes) rodando ao mesmo tempo no
mesmo worktree têm o mesmo risco de conflito — edições simultâneas, git
status inconsistente, uma sessão vendo mudanças não commitadas de outra no
meio do trabalho — que duas instâncias da mesma automação. Não existe hoje
um mecanismo simples e claramente seguro para isolar automações diferentes
no mesmo worktree (git não foi desenhado para múltiplos escritores
concorrentes descoordenados). Por isso o lock bloqueia **qualquer** segunda
execução deste controlador no mesmo `-ProjectDir`, seja da mesma fila ou de
outra. Rodar duas filas ao mesmo tempo requer dois `-ProjectDir` diferentes
(ex.: worktrees git separados) — não suportado automaticamente ainda.

## Retomar depois de fechar a janela ou reiniciar o PC

Rode o mesmo comando de novo. Ao iniciar, o controlador:

1. Lê `controller-state.json`. Se o run anterior terminou num estado
   terminal (`DONE`, `CRITICAL`, `CONTROLLER_ERROR`,
   `RATE_LIMIT_INTERVENCAO_HUMANA`), só registra isso e segue normalmente.
2. Se o run anterior ficou em estado não-terminal (`RUNNING`,
   `WAITING_RATE_LIMIT`, `SESSION_COMPLETED`, `STARTING`) e o PID registrado
   não existe mais, registra `EXECUCAO_INTERROMPIDA` no log — isso é só
   informativo, não muda o comportamento.
3. Nunca usa `--continue`/`--resume` e nunca descarta/reverte nada. A
   retomada real acontece do jeito de sempre: a próxima sessão nova lê o
   repositório e o `STATUS.md` reais e decide sozinha onde continuar.
4. Se detectar outra instância do controlador **realmente rodando** (lock
   com PID vivo), recusa iniciar e informa o PID.

## Requested vs. resolved (modelo/effort)

Cada execução registra dois pares de valores, nunca misturados:

- `modelo_solicitado` / `effort_solicitado` — o que foi explicitamente
  passado em `--model`/`--effort` nesta chamada (sempre presente).
- `modelo_resolvido` / `effort_confirmado` — o que foi **realmente
  confirmado** pela sessão, lido da transcrição local
  (`~/.claude/projects/**/<session_id>.jsonl`, campos `message.model` e
  `effort`). Se a transcrição não for encontrada ou não tiver o campo, o
  valor registrado é literalmente `NAO_EXPOSTO_PELO_CLI` — nunca um valor
  inventado.

Antes de cada sessão real, o controlador também valida que os argumentos que
serão de fato enviados ao CLI contêm `--model claude-sonnet-5` e `--effort
medium` explicitamente; se essa validação falhar, a sessão não é iniciada e
o controlador encerra com `CONFIG_MODEL_EFFORT_ERROR` (exit code 6).

## Códigos de saída

| Exit code | Significado |
|---|---|
| 0 | `CONTINUE` ou `DONE` |
| 2 | `CRITICAL` |
| 3 | `CONTROLLER_ERROR` |
| 4 | `RATE_LIMIT_INTERVENCAO_HUMANA` (limite de uso persistente, precisa de checagem humana) |
| 5 | Outra instância do controlador já ativa |
| 6 | `CONFIG_MODEL_EFFORT_ERROR` |
