<#
.SYNOPSIS
  Wrapper fino: roda a Fila 2 do Design System usando o controlador genérico
  executar-loop-claude.ps1. Mantido para compatibilidade com o comando já em
  uso — nenhuma opção nova aqui, só encaminha para o controlador genérico com
  o prompt e o NomeExecucao fixos desta fila.

.DESCRIPTION
  A partir da generalização do controlador (ver scripts/ia/README.md), os
  logs, runs e checkpoint desta fila passaram de
  scripts/ia/logs/design-system-fila-2.log (plano) para
  scripts/ia/logs/design-system-fila-2/controller.log (por NomeExecucao). O
  histórico antigo permanece no local antigo, intacto, como registro.

.PARAMETER ProjectDir
  Diretório raiz do repositório. Padrão: C:\le-bebe.

.PARAMETER MaxExecucoes
  Número máximo de execuções úteis nesta chamada.

.PARAMETER ClaudeExe
  Caminho completo do claude.exe standalone. Ver executar-loop-claude.ps1.
#>

[CmdletBinding()]
param(
    [string]$ProjectDir = "C:\le-bebe",
    [int]$MaxExecucoes = 2,
    [string]$ClaudeExe = ""
)

$genericScript = Join-Path $PSScriptRoot "executar-loop-claude.ps1"
$promptFile = Join-Path $PSScriptRoot "design-system-fila-2-prompt.txt"

& $genericScript -PromptFile $promptFile -NomeExecucao "design-system-fila-2" -ProjectDir $ProjectDir -MaxExecucoes $MaxExecucoes -ClaudeExe $ClaudeExe
exit $LASTEXITCODE
