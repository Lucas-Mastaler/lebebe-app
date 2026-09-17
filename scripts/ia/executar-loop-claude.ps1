<#
.SYNOPSIS
  Controlador local genérico do loop "nova sessão -> uma unidade de trabalho
  -> STATUS/Harness do próprio prompt -> encerra" para qualquer fila baseada
  no Claude Code CLI. Generalização de executar-design-system-fila-2.ps1
  (mantido como wrapper fino para a Fila 2 do Design System).

.DESCRIPTION
  Inicia execuções NÃO interativas e SEQUENCIAIS do Claude Code CLI, cada uma
  uma sessão nova (sem --continue/--resume). O CONTEÚDO do que cada sessão
  deve fazer (ler qual Harness, qual arquivo de estado, qual fila) vem
  inteiramente do arquivo de prompt (-PromptFile) — este script não sabe
  nada sobre Design System, Fila 2, ou qualquer domínio específico.

  Nunca executa duas sessões em paralelo: cada chamada ao Claude bloqueia o
  PowerShell até o processo terminar (sem polling). Um lock file impede duas
  execuções deste controlador rodando ao mesmo tempo no mesmo repositório —
  o lock é por REPOSITÓRIO (ProjectDir), não por NomeExecucao: duas
  automações diferentes (nomes diferentes) editando o mesmo worktree ao
  mesmo tempo têm o mesmo risco de conflito de arquivos/git que duas
  instâncias da mesma automação, e não há hoje um mecanismo simples e
  claramente seguro para permitir isso. Ver seção "Lock" em
  scripts/ia/README.md para a decisão completa.

  Não usa --dangerously-skip-permissions / bypassPermissions. Usa
  --permission-mode acceptEdits combinado com --permission-prompts none.

  Modelo e effort são CONSTANTES fixas (claude-sonnet-5 / medium), não
  parâmetros — decisão explícita desta tarefa, para garantir que todo loop
  use exatamente essa configuração até decisão futura. Validação fail-closed
  confirma isso nos argumentos reais antes de cada sessão.

  Trata RATE_LIMIT (limite de uso da assinatura) como condição do
  controlador, não como erro: espera localmente (Start-Sleep, sem chamar o
  Claude) até o horário de reset informado + margem de segurança, e não
  consome MaxExecucoes.

  Documentação operacional completa: scripts/ia/README.md.

.PARAMETER PromptFile
  Caminho do arquivo de prompt operacional (texto completo enviado via
  stdin a cada sessão nova). Obrigatório — este script não assume nenhum
  prompt padrão.

.PARAMETER NomeExecucao
  Identificador desta automação/fila, usado para nomear os arquivos de log,
  runs e checkpoint (scripts/ia/logs/<NomeExecucao>/...). Obrigatório.
  Sanitizado automaticamente para conter só letras, números, hífen e
  underscore; se o resultado ficar vazio, o controlador recusa iniciar.

.PARAMETER ProjectDir
  Diretório raiz do repositório onde as sessões vão trabalhar. Padrão:
  C:\le-bebe (único projeto em uso até hoje). Validado (precisa existir e
  ser raiz de um repositório git) antes de qualquer sessão.

.PARAMETER MaxExecucoes
  Número máximo de execuções ÚTEIS (que não sejam RATE_LIMIT) do Claude
  nesta chamada do controlador.

.PARAMETER ClaudeExe
  Caminho completo do claude.exe standalone. Se omitido, tenta `claude` no
  PATH e depois %USERPROFILE%\.local\bin\claude.exe.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$PromptFile,
    [Parameter(Mandatory = $true)][string]$NomeExecucao,
    [string]$ProjectDir = "C:\le-bebe",
    [int]$MaxExecucoes = 2,
    [string]$ClaudeExe = ""
)

# --- 0. Correção de encoding (causa raiz do mojibake) -------------------------
#
# Diagnóstico confirmado com chamadas reais mínimas ao CLI: em um processo
# powershell.exe novo, $OutputEncoding (a variável do PowerShell que rege o
# encoding usado ao ENVIAR texto para um processo nativo via pipe) tem
# default US-ASCII (CodePage 20127) — mesmo com [Console]::OutputEncoding já
# em UTF-8 (65001). Isso corrompia o PROMPT enviado via stdin ao claude.exe
# (não a captura de stdout, que já estava correta). Sem a linha abaixo, um
# prompt pedindo eco de texto acentuado voltava como "Migra????o"; com ela,
# volta idêntico ao enviado.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding  = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$ErrorActionPreference = "Stop"

# Modelo e effort são constantes fixas, não parâmetros (decisão desta
# tarefa): todo loop criado com este controlador usa exatamente esta
# configuração até uma decisão futura explícita alterar isto aqui.
$Model = "claude-sonnet-5"
$Effort = "medium"

# --- Funções utilitárias -------------------------------------------------------

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] $Message"
}

function Write-Fields {
    # Imprime um conjunto de campos, um por linha ("chave=valor"), pulando
    # campos vazios/nulos. $Fields é um [ordered]@{} para preservar a ordem.
    param([Parameter(Mandatory)][System.Collections.Specialized.OrderedDictionary]$Fields)
    foreach ($key in $Fields.Keys) {
        $value = $Fields[$key]
        if ($null -ne $value -and [string]$value -ne "") {
            Write-Host "$key=$value"
        }
    }
}

function ConvertTo-SafeName {
    # Sanitiza NomeExecucao para uso seguro em caminhos de arquivo: só
    # letras, números, hífen e underscore. Retorna $null se o resultado
    # ficar vazio (nome inválido).
    param([string]$Name)
    if ([string]::IsNullOrWhiteSpace($Name)) { return $null }
    $safe = ($Name.Trim() -replace '[^a-zA-Z0-9_-]', '-') -replace '-{2,}', '-'
    $safe = $safe.Trim('-')
    if ([string]::IsNullOrWhiteSpace($safe)) { return $null }
    return $safe
}

function New-RunId { [guid]::NewGuid().ToString() }

function Write-JsonAtomic {
    # Escrita atômica: grava em arquivo temporário no mesmo diretório e só
    # então substitui o arquivo final (Move-Item -Force), para nunca deixar
    # um JSON parcialmente escrito se o processo for encerrado no meio.
    param([Parameter(Mandatory)]$Object, [Parameter(Mandatory)][string]$Path)
    $tmpPath = "$Path.tmp-$([guid]::NewGuid().ToString('N'))"
    $json = $Object | ConvertTo-Json -Depth 12
    [System.IO.File]::WriteAllText($tmpPath, $json, (New-Object System.Text.UTF8Encoding($false)))
    Move-Item -LiteralPath $tmpPath -Destination $Path -Force
}

function Read-JsonSafe {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    try {
        $text = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
        return $text | ConvertFrom-Json -ErrorAction Stop
    } catch {
        return $null
    }
}

function Test-ProcessAlive {
    param([int]$ProcessId)
    if (-not $ProcessId) { return $false }
    try { Get-Process -Id $ProcessId -ErrorAction Stop | Out-Null; return $true }
    catch { return $false }
}

function Get-SessionTranscriptPath {
    # Localiza a transcrição local da sessão (~/.claude/projects/**/<id>.jsonl)
    # por busca recursiva pelo nome do arquivo, sem depender de um algoritmo
    # específico de nome de pasta por projeto (evita assumir formato).
    param([string]$ProjectsDir, [string]$SessionId)
    if (-not $SessionId -or -not (Test-Path -LiteralPath $ProjectsDir)) { return $null }
    $hit = Get-ChildItem -LiteralPath $ProjectsDir -Filter "$SessionId.jsonl" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($hit) { return $hit.FullName }
    return $null
}

function Get-SessionEvidence {
    # Extrai modelo/effort REALMENTE confirmados na transcrição local da
    # sessão (campos "model" dentro de message, e "effort" no registro
    # assistant). Nunca inventa: se não encontrar, retorna
    # "NAO_EXPOSTO_PELO_CLI" explicitamente.
    param([string]$TranscriptPath)
    $result = [ordered]@{ ModelResolved = "NAO_EXPOSTO_PELO_CLI"; EffortConfirmado = "NAO_EXPOSTO_PELO_CLI" }
    if (-not $TranscriptPath -or -not (Test-Path -LiteralPath $TranscriptPath)) { return $result }
    try {
        $lines = Get-Content -LiteralPath $TranscriptPath -Encoding UTF8
        for ($i = $lines.Count - 1; $i -ge 0; $i--) {
            $obj = $null
            try { $obj = $lines[$i] | ConvertFrom-Json -ErrorAction Stop } catch { continue }
            if ($obj.type -ne "assistant") { continue }
            if ($result.ModelResolved -eq "NAO_EXPOSTO_PELO_CLI" -and $obj.message -and $obj.message.model -and $obj.message.model -ne "<synthetic>") {
                $result.ModelResolved = [string]$obj.message.model
            }
            if ($result.EffortConfirmado -eq "NAO_EXPOSTO_PELO_CLI" -and $obj.PSObject.Properties.Name -contains "effort" -and $obj.effort) {
                $result.EffortConfirmado = [string]$obj.effort
            }
            if ($result.ModelResolved -ne "NAO_EXPOSTO_PELO_CLI" -and $result.EffortConfirmado -ne "NAO_EXPOSTO_PELO_CLI") { break }
        }
    } catch {
        # mantém defaults NAO_EXPOSTO_PELO_CLI
    }
    return $result
}

function Assert-ModelEffortArgs {
    # Fail-closed: confirma que os argumentos que serão REALMENTE enviados ao
    # CLI contêm --model <esperado> e --effort <esperado> explicitamente,
    # antes de qualquer chamada real.
    param([string[]]$ArgsArray, [string]$ExpectedModel, [string]$ExpectedEffort)
    $modelIdx = [array]::IndexOf($ArgsArray, "--model")
    $effortIdx = [array]::IndexOf($ArgsArray, "--effort")
    if ($modelIdx -lt 0 -or ($modelIdx + 1) -ge $ArgsArray.Length -or $ArgsArray[$modelIdx + 1] -ne $ExpectedModel) { return $false }
    if ($effortIdx -lt 0 -or ($effortIdx + 1) -ge $ArgsArray.Length -or $ArgsArray[$effortIdx + 1] -ne $ExpectedEffort) { return $false }
    return $true
}

# --- Tratamento de limite de uso (RATE_LIMIT) ---------------------------------
#
# Texto real observado (CLI 2.1.273, campo "result" do JSON de saída):
#   "You've hit your session limit · resets 2:30pm (America/Sao_Paulo)"

function Test-RateLimitMessage {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return $false }
    return ($Text -match '(?i)hit your\s+[\w\s-]{0,30}?\blimit\b') -or
           ($Text -match '(?i)\b(session|usage|rate|5-hour|five-hour)\s+limit\b') -or
           ($Text -match '(?i)\blimit\b.{0,20}\breset')
}

function Get-RateLimitResetInfo {
    param([string]$Text)
    $result = [ordered]@{ HasTime = $false; ResetLocal = $null; TimeZoneRaw = $null; RawMatch = $null }
    $m = [regex]::Match($Text, '(?i)resets?\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:\(([^)]+)\))?')
    if (-not $m.Success) { return $result }
    $result.RawMatch = $m.Value.Trim()
    $timeStr = ($m.Groups[1].Value).Trim() -replace '\s', ''
    $tzRaw = $m.Groups[2].Value.Trim()
    $result.TimeZoneRaw = $tzRaw

    $ianaToWindows = @{
        "America/Sao_Paulo"   = "E. South America Standard Time"
        "UTC"                 = "UTC"
        "America/New_York"    = "Eastern Standard Time"
        "America/Los_Angeles" = "Pacific Standard Time"
    }

    $tzInfo = $null
    if ($tzRaw) {
        $winId = $ianaToWindows[$tzRaw]
        if (-not $winId) { $winId = $tzRaw }
        try { $tzInfo = [System.TimeZoneInfo]::FindSystemTimeZoneById($winId) } catch { $tzInfo = $null }
    }
    if (-not $tzInfo) { $tzInfo = [System.TimeZoneInfo]::Local }

    $formats = @("h:mmtt", "H:mm", "htt")
    $parsedTime = New-Object DateTime
    $ok = $false
    foreach ($fmt in $formats) {
        $tmp = New-Object DateTime
        if ([datetime]::TryParseExact($timeStr, $fmt, [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::None, [ref]$tmp)) {
            $parsedTime = $tmp; $ok = $true; break
        }
    }
    if (-not $ok) { return $result }

    $nowInTz = [System.TimeZoneInfo]::ConvertTimeFromUtc([datetime]::UtcNow, $tzInfo)
    $candidate = Get-Date -Year $nowInTz.Year -Month $nowInTz.Month -Day $nowInTz.Day -Hour $parsedTime.Hour -Minute $parsedTime.Minute -Second 0
    $candidate = [datetime]::SpecifyKind($candidate, [DateTimeKind]::Unspecified)
    if ($candidate -le $nowInTz) { $candidate = $candidate.AddDays(1) }
    $candidateUtc = [System.TimeZoneInfo]::ConvertTimeToUtc($candidate, $tzInfo)

    $result.HasTime = $true
    $result.ResetLocal = $candidateUtc.ToLocalTime()
    return $result
}

# --- 1. Validação do ambiente ------------------------------------------------

if (-not (Test-Path -LiteralPath $ProjectDir -PathType Container)) {
    Write-Error "Diretório do projeto não encontrado: $ProjectDir"
    exit 1
}

if (-not (Test-Path -LiteralPath (Join-Path $ProjectDir ".git") -PathType Container)) {
    Write-Error "$ProjectDir não parece ser a raiz de um repositório git (.git não encontrado). Recusando rodar em diretório sem esse contexto mínimo esperado."
    exit 1
}

if (-not (Test-Path -LiteralPath $PromptFile -PathType Leaf)) {
    Write-Error "Prompt operacional não encontrado: $PromptFile"
    exit 1
}
$promptText = Get-Content -LiteralPath $PromptFile -Raw -Encoding UTF8

$NomeExecucaoSeguro = ConvertTo-SafeName -Name $NomeExecucao
if (-not $NomeExecucaoSeguro) {
    Write-Error "NomeExecucao inválido: '$NomeExecucao'. Use letras, números, hífen ou underscore (não pode ficar vazio após sanitização)."
    exit 1
}
if ($NomeExecucaoSeguro -ne $NomeExecucao) {
    Write-Log "Aviso: NomeExecucao sanitizado de '$NomeExecucao' para '$NomeExecucaoSeguro'."
}

if ([string]::IsNullOrWhiteSpace($ClaudeExe)) {
    $onPath = Get-Command "claude" -ErrorAction SilentlyContinue
    if ($onPath) {
        $ClaudeExe = $onPath.Source
    } else {
        $fallback = Join-Path $env:USERPROFILE ".local\bin\claude.exe"
        if (Test-Path -LiteralPath $fallback -PathType Leaf) {
            $ClaudeExe = $fallback
        } else {
            Write-Error "Não foi possível localizar o CLI standalone 'claude' no PATH nem em $fallback. Informe -ClaudeExe explicitamente (NÃO use o executável interno do Claude Desktop em %APPDATA%\Claude\claude-code\...)."
            exit 1
        }
    }
}

if (-not (Test-Path -LiteralPath $ClaudeExe -PathType Leaf)) {
    Write-Error "claude.exe não encontrado em: $ClaudeExe"
    exit 1
}

# Confirma que é o CLI standalone autenticado, não um binário qualquer.
$versionCheck = & $ClaudeExe --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Falha ao executar '$ClaudeExe --version'. Saída: $versionCheck"
    exit 1
}
$authCheckRaw = & $ClaudeExe auth status 2>&1
try {
    $authCheck = $authCheckRaw | ConvertFrom-Json -ErrorAction Stop
} catch {
    Write-Error "Não foi possível interpretar 'claude auth status'. Saída: $authCheckRaw"
    exit 1
}
if (-not $authCheck.loggedIn) {
    Write-Error "CLI em $ClaudeExe não está autenticado (loggedIn=false). Rode 'claude setup-token' ou faça login antes de continuar."
    exit 1
}

# --- Caminhos: logs/runs/checkpoint são por NomeExecucao; lock é por repositório ---
#
# Decisão de lock: por REPOSITÓRIO (ProjectDir), não por NomeExecucao. Duas
# automações diferentes rodando ao mesmo tempo no mesmo worktree têm o mesmo
# risco de conflito (edições simultâneas, git status inconsistente, uma
# sessão vendo mudanças não commitadas da outra no meio do trabalho) que duas
# instâncias da mesma automação. Não existe hoje um mecanismo simples e
# claramente seguro para isolar automações diferentes no mesmo worktree, então
# a postura conservadora pedida nesta tarefa é bloquear por repositório
# inteiro até uma decisão futura explícita mudar isso.
$logDirBase = Join-Path $ProjectDir "scripts\ia\logs"
$logDir = Join-Path $logDirBase $NomeExecucaoSeguro
$runsDir = Join-Path $logDir "runs"
foreach ($dir in @($logDirBase, $logDir, $runsDir)) {
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
}
$logFile = Join-Path $logDir "controller.log"
$checkpointFile = Join-Path $logDir "controller-state.json"
$lockFile = Join-Path $logDirBase "controller.lock"

Write-Log "CLI: $ClaudeExe ($versionCheck) | autenticado como $($authCheck.email) via $($authCheck.authMethod)"
Write-Log "Projeto: $ProjectDir"
Write-Log "NomeExecucao: $NomeExecucaoSeguro | Prompt: $PromptFile"
Write-Log "Modelo exigido: $Model | Effort exigido: $Effort | Max execuções úteis: $MaxExecucoes"
Write-Log "Log resumido: $logFile"
Write-Log "Runs (JSON bruto por sessão): $runsDir"
Write-Log "Checkpoint: $checkpointFile"
Write-Log "Lock (por repositório, compartilhado entre automações): $lockFile"

# --- 2. Lock: impede duas execuções simultâneas no mesmo repositório --------

$existingLock = Read-JsonSafe -Path $lockFile
if ($existingLock -and (Test-ProcessAlive -ProcessId $existingLock.pid)) {
    Write-Error "Outra execução deste controlador já está rodando neste repositório (PID $($existingLock.pid), nome '$($existingLock.nome_execucao)', iniciada em $($existingLock.started_at)). Encerrando sem iniciar nenhuma sessão Claude."
    exit 5
}
if ($existingLock -and -not (Test-ProcessAlive -ProcessId $existingLock.pid)) {
    Write-Log "Lock encontrado de uma execução anterior (PID $($existingLock.pid), nome '$($existingLock.nome_execucao)') que não está mais rodando — tratado como lock abandonado, não como instância ativa."
}
$controllerPid = $PID
$lockState = [ordered]@{ pid = $controllerPid; nome_execucao = $NomeExecucaoSeguro; started_at = (Get-Date -Format "o") }
Write-JsonAtomic -Object $lockState -Path $lockFile
Write-Log "Lock adquirido (PID $controllerPid)."

# --- 3. Checkpoint anterior: detectar execução interrompida ------------------

$terminalStates = @("DONE", "CRITICAL", "CONTROLLER_ERROR", "RATE_LIMIT_INTERVENCAO_HUMANA")
$prevCheckpoint = Read-JsonSafe -Path $checkpointFile
if ($prevCheckpoint) {
    if ($terminalStates -contains $prevCheckpoint.status) {
        Write-Log "Checkpoint anterior (run $($prevCheckpoint.run_id)) terminou normalmente em status=$($prevCheckpoint.status) às $($prevCheckpoint.updated_at). Iniciando novo run."
    } elseif (-not (Test-ProcessAlive -ProcessId $prevCheckpoint.pid)) {
        Write-Log "EXECUCAO_INTERROMPIDA detectada: run anterior ($($prevCheckpoint.run_id), PID $($prevCheckpoint.pid)) estava em status=$($prevCheckpoint.status) na tela '$($prevCheckpoint.ultima_tela)' (execução útil $($prevCheckpoint.execucao_util)/$($prevCheckpoint.max_execucoes)) e não terminou normalmente — o processo não existe mais. Nenhum arquivo será descartado ou revertido. A retomada segue o mecanismo normal: a próxima sessão nova lê o repositório real + o que o prompt indicar e decide sozinha como continuar (sem --continue/--resume, sem reconstrução de memória de chat)."
    }
} else {
    Write-Log "Nenhum checkpoint anterior encontrado para '$NomeExecucaoSeguro' — primeiro run conhecido."
}

$runId = New-RunId
$startedAt = Get-Date

function Update-Checkpoint {
    param([string]$Status, [string]$UltimaTela = "", [string]$UltimaAcao = "", [string]$UltimoEstado = "", [string]$UltimoSessionId = "", [string]$ResetPrevisto = "")
    $state = [ordered]@{
        run_id            = $runId
        nome_execucao     = $NomeExecucaoSeguro
        pid               = $controllerPid
        started_at        = $startedAt.ToString("o")
        updated_at        = (Get-Date -Format "o")
        status            = $Status
        tentativa_global  = $tentativaGlobal
        execucao_util     = $execucao
        max_execucoes     = $MaxExecucoes
        modelo_exigido    = $Model
        effort_exigido    = $Effort
        ultima_tela       = $UltimaTela
        ultima_acao       = $UltimaAcao
        ultimo_estado     = $UltimoEstado
        ultimo_session_id = $UltimoSessionId
        reset_previsto    = $ResetPrevisto
        ultimo_ponto_seguro = (Get-Date -Format "o")
    }
    Write-JsonAtomic -Object $state -Path $checkpointFile
}

try {
    $execucao = 0
    $tentativaGlobal = 0
    $tentativasRateLimitConsecutivas = 0
    $concluidas = 0
    $bloqueadas = 0
    $MaxTentativasRateLimitConsecutivas = 5    # salvaguarda interna contra loop sem fim
    $MargemSegurancaMinutosRateLimit = 2
    $EsperaConservadoraHorasRateLimit = 2
    $acaoFinal = $null

    Update-Checkpoint -Status "STARTING"

    # --- 4. Estado do git (só visibilidade, nunca descarta nada) ----------------

    Push-Location $ProjectDir
    try {
        $gitStatus = git status --porcelain 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Error "git status falhou neste diretório. Abortando antes de iniciar qualquer sessão."
            $acaoFinal = "CONTROLLER_ERROR"
            throw "git status falhou"
        }
        if ($gitStatus) {
            Write-Log "Aviso: há alterações não commitadas no worktree. O controlador NÃO vai descartá-las; cada sessão trabalha sobre o estado atual."
            $gitStatus | ForEach-Object { Write-Log "  $_" }
        } else {
            Write-Log "Worktree limpo."
        }
    } finally {
        Pop-Location
    }

    Update-Checkpoint -Status "RUNNING"

    # --- 5. Loop sequencial, sem paralelismo, sem polling ------------------------

    while ($execucao -lt $MaxExecucoes) {
        $tentativaGlobal++
        Write-Log "==================================================================="
        Write-Log "Tentativa $tentativaGlobal — iniciando NOVA sessão Claude (execução útil pretendida: $($execucao + 1) de $MaxExecucoes; sem --continue/--resume)..."

        # O prompt é enviado via STDIN, não como argumento de linha de comando
        # (evita truncamento por repasse de aspas do PowerShell a processos
        # nativos).
        $claudeArgs = @(
            "-p",
            "--output-format", "json",
            "--permission-mode", "acceptEdits",
            "--permission-prompts", "none",
            "--model", $Model,
            "--effort", $Effort,
            "--allowedTools", "Read,Edit,Write,Grep,Glob,TodoWrite"
        )

        # --- Fail-closed: modelo/effort precisam estar explicitamente nos argumentos ---
        if (-not (Assert-ModelEffortArgs -ArgsArray $claudeArgs -ExpectedModel $Model -ExpectedEffort $Effort)) {
            Write-Log "CONFIG_MODEL_EFFORT_ERROR: os argumentos montados não contêm explicitamente --model $Model e --effort $Effort. Nenhuma sessão será iniciada."
            $acaoFinal = "CONFIG_MODEL_EFFORT_ERROR"
            break
        }
        Write-Log "modelo_solicitado=$Model"
        Write-Log "effort_solicitado=$Effort"

        $tentativaStart = Get-Date
        $stderrFile = Join-Path $logDir "stderr-$tentativaGlobal.tmp.log"
        $rawOutput = $null
        $exitCode = $null

        Push-Location $ProjectDir
        try {
            $rawOutput = $promptText | & $ClaudeExe @claudeArgs 2> $stderrFile
            $exitCode = $LASTEXITCODE
        } catch {
            Write-Log "ERRO ao iniciar/executar o processo Claude: $($_.Exception.Message)"
            Write-Log "Interrompendo o controlador (erro de processo não é uma condição segura para continuar)."
            $acaoFinal = "CONTROLLER_ERROR"
            Pop-Location
            break
        }
        Pop-Location
        $tentativaEnd = Get-Date
        $duracaoSegundos = [Math]::Round(($tentativaEnd - $tentativaStart).TotalSeconds, 1)

        $stderrContent = ""
        if (Test-Path -LiteralPath $stderrFile) {
            $stderrContent = Get-Content -LiteralPath $stderrFile -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
            if ($stderrContent) { Write-Log "stderr da tentativa $tentativaGlobal (informativo): $stderrContent" }
            Remove-Item -LiteralPath $stderrFile -ErrorAction SilentlyContinue
        }

        $rawText = ($rawOutput -join "`n")
        $runTimestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"

        # --- Parse defensivo do JSON de nível superior do CLI --------------------
        $parsed = $null
        try {
            $parsed = $rawText | ConvertFrom-Json -ErrorAction Stop
        } catch {
            Write-Log "ERRO: saída do CLI não é um JSON válido (exit code $exitCode)."
            Write-Log "Saída bruta (truncada a 2000 caracteres): $($rawText.Substring(0, [Math]::Min(2000, $rawText.Length)))"
            $rawFilePath = Join-Path $runsDir "$runTimestamp`_tentativa-$tentativaGlobal`_NOSESSION.json"
            Write-JsonAtomic -Object ([ordered]@{
                tentativa_global = $tentativaGlobal; execucao_util_pretendida = ($execucao + 1)
                started_at = $tentativaStart.ToString("o"); ended_at = $tentativaEnd.ToString("o"); duracao_segundos = $duracaoSegundos
                modelo_solicitado = $Model; effort_solicitado = $Effort
                exit_code = $exitCode; stderr = $stderrContent
                raw_stdout_nao_json = $rawText
                classificacao = "CONTROLLER_ERROR"
            }) -Path $rawFilePath
            $acaoFinal = "CONTROLLER_ERROR"
            break
        }

        $sessionId = $parsed.session_id
        $transcriptPath = Get-SessionTranscriptPath -ProjectsDir $authCheck.projectsDirectory -SessionId $sessionId
        $evidence = Get-SessionEvidence -TranscriptPath $transcriptPath

        # --- Detecção de RATE_LIMIT (limite de uso da assinatura) ----------------
        $resultTextRL = ""
        if ($parsed.PSObject.Properties.Name -contains "result") { $resultTextRL = [string]$parsed.result }
        $apiErrorStatus = $null
        if ($parsed.PSObject.Properties.Name -contains "api_error_status") { $apiErrorStatus = $parsed.api_error_status }
        $isRateLimit = (Test-RateLimitMessage $resultTextRL) -or ($apiErrorStatus -eq 429)

        # Arquivo bruto desta tentativa, sempre gravado (útil, rate limit ou erro).
        $rawFilePath = Join-Path $runsDir "$runTimestamp`_tentativa-$tentativaGlobal`_$(if ($sessionId) { $sessionId } else { 'NOSESSION' }).json"
        Write-JsonAtomic -Object ([ordered]@{
            tentativa_global      = $tentativaGlobal
            execucao_util_pretendida = ($execucao + 1)
            started_at            = $tentativaStart.ToString("o")
            ended_at              = $tentativaEnd.ToString("o")
            duracao_segundos      = $duracaoSegundos
            modelo_solicitado     = $Model
            effort_solicitado     = $Effort
            modelo_resolvido      = $evidence.ModelResolved
            effort_confirmado     = $evidence.EffortConfirmado
            session_id            = $sessionId
            exit_code             = $exitCode
            stderr                = $stderrContent
            classificacao_preliminar = $(if ($isRateLimit) { "RATE_LIMIT" } else { "A_DETERMINAR" })
            cli_stdout_bruto      = $parsed
        }) -Path $rawFilePath

        if ($isRateLimit) {
            $tentativasRateLimitConsecutivas++
            $sanitized = $resultTextRL
            if ($sanitized.Length -gt 300) { $sanitized = $sanitized.Substring(0, 300) + "..." }

            $resetInfo = Get-RateLimitResetInfo -Text $resultTextRL
            $detectadoEm = Get-Date

            Write-Log "-------------------------------------------------------------------"
            Write-Host "RATE_LIMIT"
            Write-Fields -Fields ([ordered]@{
                detectado_em      = $detectadoEm.ToString("yyyy-MM-dd HH:mm:ss")
                mensagem          = $sanitized
                reset_informado   = $resetInfo.RawMatch
                timezone_informado = $resetInfo.TimeZoneRaw
                reset_calculado   = $(if ($resetInfo.HasTime) { $resetInfo.ResetLocal.ToString("yyyy-MM-dd HH:mm") } else { $null })
                tentativa_global  = $tentativaGlobal
                execucao_util     = "$execucao de $MaxExecucoes (nao consumida por rate limit)"
                tentativa_rate_limit_consecutiva = "$tentativasRateLimitConsecutivas/$MaxTentativasRateLimitConsecutivas"
                session_id        = $sessionId
            })

            $logLineRL = [ordered]@{
                tipo = "RATE_LIMIT"; timestamp = (Get-Date -Format "o"); mensagem = $sanitized
                reset_informado_bruto = $resetInfo.RawMatch; timezone_informado = $resetInfo.TimeZoneRaw
                reset_local_calculado = $(if ($resetInfo.HasTime) { $resetInfo.ResetLocal.ToString("o") } else { $null })
                tentativa_rate_limit_consecutiva = $tentativasRateLimitConsecutivas; session_id = $sessionId
                modelo_solicitado = $Model; effort_solicitado = $Effort
            } | ConvertTo-Json -Compress
            Add-Content -LiteralPath $logFile -Value $logLineRL -Encoding UTF8

            Update-Checkpoint -Status "WAITING_RATE_LIMIT" -UltimoSessionId $sessionId -ResetPrevisto $(if ($resetInfo.HasTime) { $resetInfo.ResetLocal.ToString("o") } else { "" })

            if ($tentativasRateLimitConsecutivas -ge $MaxTentativasRateLimitConsecutivas) {
                Write-Log "Tentativas consecutivas de RATE_LIMIT atingiram o limite de segurança interno ($MaxTentativasRateLimitConsecutivas). Parando o controlador para intervenção humana (não é CRITICAL — não há risco de regressão, só limite de assinatura persistente)."
                $acaoFinal = "RATE_LIMIT_INTERVENCAO_HUMANA"
                break
            }

            if ($resetInfo.HasTime) {
                $retomada = $resetInfo.ResetLocal.AddMinutes($MargemSegurancaMinutosRateLimit)
                $sleepSeconds = [Math]::Max(1, [int]([Math]::Ceiling(($retomada - (Get-Date)).TotalSeconds)))
                Write-Host "retomada_prevista=$($retomada.ToString('yyyy-MM-dd HH:mm')) (margem de $MargemSegurancaMinutosRateLimit min)"
            } else {
                $sleepSeconds = [int]([TimeSpan]::FromHours($EsperaConservadoraHorasRateLimit).TotalSeconds)
                Write-Host "retomada_prevista=NAO_DETERMINADO -> espera conservadora de $EsperaConservadoraHorasRateLimit h antes de uma unica nova tentativa"
            }

            Write-Host "Controlador aguardando localmente. Nenhuma chamada ao Claude será feita durante a espera."
            Write-Log "Aguardando (Start-Sleep) por aproximadamente $([Math]::Round($sleepSeconds / 60, 1)) minuto(s))..."
            Start-Sleep -Seconds $sleepSeconds
            Write-Log "Retomando após espera de limite de uso em $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')."

            $logLineResume = [ordered]@{ tipo = "RATE_LIMIT_RESUMED"; timestamp = (Get-Date -Format "o") } | ConvertTo-Json -Compress
            Add-Content -LiteralPath $logFile -Value $logLineResume -Encoding UTF8
            Update-Checkpoint -Status "RUNNING" -UltimoSessionId $sessionId

            continue   # não incrementa $execucao; próxima iteração tenta de novo, sem consumir MaxExecucoes
        }

        $tentativasRateLimitConsecutivas = 0
        $execucao++

        # --- Extração defensiva da saída estruturada (acao/tela/estado/...) ------
        $structured = $null
        if ($parsed.PSObject.Properties.Name -contains "structured_output" -and $parsed.structured_output) {
            $structured = $parsed.structured_output
        } else {
            $resultText = [string]$parsed.result
            $match = [regex]::Match($resultText, '\{[^{}]*"acao"\s*:\s*"[^"]*"[\s\S]*?\}', 'Singleline')
            if ($match.Success) {
                try { $structured = $match.Value | ConvertFrom-Json -ErrorAction Stop } catch { $structured = $null }
            }
        }

        if (-not $structured -or -not $structured.acao) {
            Write-Log "ERRO: não foi possível extrair saída estruturada (acao/tela/estado/resumo/qa_manual) da resposta da execução $execucao."
            Write-Log "is_error do CLI: $($parsed.is_error) | subtype: $($parsed.subtype) | session_id: $sessionId"
            $acaoFinal = "CONTROLLER_ERROR"
            $logLine = [ordered]@{
                execucao = $execucao; timestamp = (Get-Date -Format "o"); tela = ""; estado = ""
                acao = "CONTROLLER_ERROR"; resumo = "Saida estruturada ausente ou invalida."; session_id = $sessionId
                modelo_solicitado = $Model; effort_solicitado = $Effort
                modelo_resolvido = $evidence.ModelResolved; effort_confirmado = $evidence.EffortConfirmado
                duracao_segundos = $duracaoSegundos
            } | ConvertTo-Json -Compress
            Add-Content -LiteralPath $logFile -Value $logLine -Encoding UTF8
            Update-Checkpoint -Status "CONTROLLER_ERROR" -UltimoSessionId $sessionId -UltimaAcao "CONTROLLER_ERROR"
            break
        }

        $acao = [string]$structured.acao
        $tela = [string]$structured.tela
        $estado = [string]$structured.estado
        $resumo = [string]$structured.resumo
        $qaManual = [string]$structured.qa_manual
        $motivo = [string]$structured.motivo

        if ($estado -eq "BLOQUEADA") { $bloqueadas++ }
        if ($acao -eq "CONTINUE" -and $estado -and $estado -ne "BLOQUEADA") { $concluidas++ }

        Write-Log "-------------------------------------------------------------------"
        Write-Host "[$($tentativaEnd.ToString('yyyy-MM-dd HH:mm:ss'))] Execução $execucao concluída"
        Write-Fields -Fields ([ordered]@{
            acao               = $acao
            tela               = $tela
            estado             = $estado
            modelo_solicitado  = $Model
            modelo_resolvido   = $evidence.ModelResolved
            effort_solicitado  = $Effort
            effort_confirmado  = $evidence.EffortConfirmado
            session_id         = $sessionId
            duracao            = "$duracaoSegundos s"
            resumo             = $resumo
            qa_manual          = $qaManual
            motivo             = $motivo
        })
        Write-Log "-------------------------------------------------------------------"

        $resumoCurto = $resumo
        if ($resumoCurto.Length -gt 300) { $resumoCurto = $resumoCurto.Substring(0, 300) + "..." }

        $logLine = [ordered]@{
            execucao = $execucao; timestamp = (Get-Date -Format "o"); inicio = $tentativaStart.ToString("o"); fim = $tentativaEnd.ToString("o")
            duracao_segundos = $duracaoSegundos; tela = $tela; estado = $estado; acao = $acao
            resumo = $resumoCurto; qa_manual = $qaManual; session_id = $sessionId
            modelo_solicitado = $Model; effort_solicitado = $Effort
            modelo_resolvido = $evidence.ModelResolved; effort_confirmado = $evidence.EffortConfirmado
        } | ConvertTo-Json -Compress
        Add-Content -LiteralPath $logFile -Value $logLine -Encoding UTF8
        Update-Checkpoint -Status "SESSION_COMPLETED" -UltimaTela $tela -UltimaAcao $acao -UltimoEstado $estado -UltimoSessionId $sessionId

        switch ($acao) {
            "CRITICAL" {
                Write-Log "*** BLOQUEIO CRÍTICO DA ROTINA *** — parando o controlador imediatamente. Motivo: $motivo"
                $acaoFinal = "CRITICAL"
            }
            "DONE" {
                Write-Log "Sessão sinalizou DONE — não há mais trabalho automático autorizado nesta fila."
                $acaoFinal = "DONE"
            }
            "CONTINUE" {
                $acaoFinal = "CONTINUE"
                if ($execucao -ge $MaxExecucoes) {
                    Write-Log "Limite MaxExecucoes=$MaxExecucoes atingido. Parando mesmo que ainda existam itens PENDENTE."
                }
            }
            default {
                Write-Log "ERRO: valor de 'acao' desconhecido ('$acao'). Tratando como condição insegura para continuar."
                $acaoFinal = "CONTROLLER_ERROR"
            }
        }

        if ($acaoFinal -in @("CRITICAL", "CONTROLLER_ERROR", "DONE")) { break }
    }
} finally {
    if (Test-Path -LiteralPath $lockFile) {
        $currentLock = Read-JsonSafe -Path $lockFile
        if ($currentLock -and $currentLock.pid -eq $controllerPid) {
            Remove-Item -LiteralPath $lockFile -ErrorAction SilentlyContinue
        }
    }
}

$duracaoTotal = [Math]::Round(((Get-Date) - $startedAt).TotalMinutes, 1)
Update-Checkpoint -Status $acaoFinal

Write-Log "==================================================================="
Write-Host "CONTROLADOR FINALIZADO"
Write-Fields -Fields ([ordered]@{
    nome_execucao    = $NomeExecucaoSeguro
    acao_final       = $acaoFinal
    execucoes_uteis  = "$execucao de $MaxExecucoes"
    tentativas_totais = $tentativaGlobal
    concluidas       = $concluidas
    bloqueadas       = $bloqueadas
    duracao_total    = "$duracaoTotal min"
    checkpoint       = $checkpointFile
    log              = $logFile
    runs_dir         = $runsDir
})

switch ($acaoFinal) {
    "CRITICAL" { exit 2 }
    "CONTROLLER_ERROR" { exit 3 }
    "RATE_LIMIT_INTERVENCAO_HUMANA" { exit 4 }
    "CONFIG_MODEL_EFFORT_ERROR" { exit 6 }
    default { exit 0 }
}
