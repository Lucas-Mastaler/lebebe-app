# ========================================
# TESTE DE INTEGRAÇÃO - APPS SCRIPT API
# ========================================
# Script PowerShell para testar o endpoint de execução do Google Apps Script
# Testa com endereço estruturado (UTF-8) e endereço completo

# ─────────────────────────────────────────────────────────
# CONFIGURAÇÃO
# ─────────────────────────────────────────────────────────

# URL do endpoint (ajuste conforme necessário)
$API_URL = "https://lebebe.cloud/api/google/apps-script/executar"

# Token de autenticação (pegue do .env.local: APPS_SCRIPT_API_TOKEN)
$BEARER_TOKEN = "seu_token_aqui"

# ─────────────────────────────────────────────────────────
# TESTE 1: ENDEREÇO ESTRUTURADO (RECOMENDADO)
# ─────────────────────────────────────────────────────────

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TESTE 1: Endereço Estruturado (UTF-8)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$payload1 = @{
    logradouro = "Rua José de Alencar"
    numero = "1683"
    bairro = "Juvevê"
    cidade = "Curitiba"
    uf = "PR"
    cep = "80040-070"
    tempoNecessario = "00:30"
    isRural = $false
    isCondominio = $false
    monthYear = "2026-04"
} | ConvertTo-Json -Depth 10

Write-Host "Payload enviado:" -ForegroundColor Yellow
Write-Host $payload1 -ForegroundColor Gray
Write-Host ""

try {
    $headers = @{
        "Content-Type" = "application/json; charset=utf-8"
        "Authorization" = "Bearer $BEARER_TOKEN"
    }

    Write-Host "Enviando requisição..." -ForegroundColor Yellow
    $response1 = Invoke-RestMethod -Uri $API_URL -Method POST -Body $payload1 -Headers $headers -ContentType "application/json; charset=utf-8"
    
    Write-Host ""
    Write-Host "✅ RESPOSTA RECEBIDA:" -ForegroundColor Green
    Write-Host ($response1 | ConvertTo-Json -Depth 10) -ForegroundColor White
    Write-Host ""
    
    if ($response1.ok) {
        Write-Host "✅ Teste 1 PASSOU - Candidatos encontrados: $($response1.resultado.totalCandidatos)" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Teste 1 FALHOU - Erro: $($response1.error)" -ForegroundColor Red
    }
    
} catch {
    Write-Host ""
    Write-Host "❌ ERRO NA REQUISIÇÃO:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Detalhes:" -ForegroundColor Red
        Write-Host $_.ErrorDetails.Message -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Pressione qualquer tecla para continuar para o Teste 2..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# ─────────────────────────────────────────────────────────
# TESTE 2: ENDEREÇO COMPLETO (COMPATIBILIDADE)
# ─────────────────────────────────────────────────────────

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TESTE 2: Endereço Completo (Legado)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$payload2 = @{
    enderecoCompleto = "Rua José de Alencar, 1683, Juvevê, Curitiba, PR, 80040-070"
    tempoNecessario = "00:30"
    isRural = $false
    isCondominio = $false
    monthYear = "2026-04"
} | ConvertTo-Json -Depth 10

Write-Host "Payload enviado:" -ForegroundColor Yellow
Write-Host $payload2 -ForegroundColor Gray
Write-Host ""

try {
    $headers = @{
        "Content-Type" = "application/json; charset=utf-8"
        "Authorization" = "Bearer $BEARER_TOKEN"
    }

    Write-Host "Enviando requisição..." -ForegroundColor Yellow
    $response2 = Invoke-RestMethod -Uri $API_URL -Method POST -Body $payload2 -Headers $headers -ContentType "application/json; charset=utf-8"
    
    Write-Host ""
    Write-Host "✅ RESPOSTA RECEBIDA:" -ForegroundColor Green
    Write-Host ($response2 | ConvertTo-Json -Depth 10) -ForegroundColor White
    Write-Host ""
    
    if ($response2.ok) {
        Write-Host "✅ Teste 2 PASSOU - Candidatos encontrados: $($response2.resultado.totalCandidatos)" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Teste 2 FALHOU - Erro: $($response2.error)" -ForegroundColor Red
    }
    
} catch {
    Write-Host ""
    Write-Host "❌ ERRO NA REQUISIÇÃO:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Detalhes:" -ForegroundColor Red
        Write-Host $_.ErrorDetails.Message -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Pressione qualquer tecla para continuar para o Teste 3..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# ─────────────────────────────────────────────────────────
# TESTE 3: ENDEREÇO COM ACENTOS (TESTE UTF-8)
# ─────────────────────────────────────────────────────────

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TESTE 3: Endereço com Acentos (UTF-8)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$payload3 = @{
    logradouro = "Rua São José"
    numero = "123"
    bairro = "Juvevê"
    cidade = "Curitiba"
    uf = "PR"
    cep = "80000-000"
    tempoNecessario = "01:00"
    isRural = $false
    isCondominio = $false
} | ConvertTo-Json -Depth 10

Write-Host "Payload enviado:" -ForegroundColor Yellow
Write-Host $payload3 -ForegroundColor Gray
Write-Host ""

try {
    $headers = @{
        "Content-Type" = "application/json; charset=utf-8"
        "Authorization" = "Bearer $BEARER_TOKEN"
    }

    Write-Host "Enviando requisição..." -ForegroundColor Yellow
    $response3 = Invoke-RestMethod -Uri $API_URL -Method POST -Body $payload3 -Headers $headers -ContentType "application/json; charset=utf-8"
    
    Write-Host ""
    Write-Host "✅ RESPOSTA RECEBIDA:" -ForegroundColor Green
    Write-Host ($response3 | ConvertTo-Json -Depth 10) -ForegroundColor White
    Write-Host ""
    
    if ($response3.ok) {
        Write-Host "✅ Teste 3 PASSOU - Candidatos encontrados: $($response3.resultado.totalCandidatos)" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Teste 3 FALHOU - Erro: $($response3.error)" -ForegroundColor Red
    }
    
} catch {
    Write-Host ""
    Write-Host "❌ ERRO NA REQUISIÇÃO:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Detalhes:" -ForegroundColor Red
        Write-Host $_.ErrorDetails.Message -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TESTES CONCLUÍDOS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor Yellow
Write-Host "1. Verifique os logs do Apps Script (View > Executions)" -ForegroundColor Gray
Write-Host "2. Procure por [API-ENDERECO-UTF8] nos logs" -ForegroundColor Gray
Write-Host "3. Verifique se os acentos estão corretos" -ForegroundColor Gray
Write-Host ""



# CONFIGURE ESTAS VARIÁVEIS PRIMEIRO
$API_URL = "https://lebebe.cloud/api/google/apps-script/executar"
$BEARER_TOKEN = "wV8qf0mM4nJ7sP1xK9rL2aB6uD3yT5cH8zQ1eR4tY2U="

$payload = @{
    logradouro = "Rua Jose de Alencar" 
    numero = "1683"
    bairro = "Juveve" 
    cidade = "Curitiba"
    uf = "PR"
    cep = "80040-070"
    tempoNecessario = "00:30"
    isRural = $false
    isCondominio = $false
} | ConvertTo-Json -Depth 10

$headers = @{
    "Content-Type" = "application/json; charset=utf-8"
    "Authorization" = "Bearer $BEARER_TOKEN"
}

try {
    $response = Invoke-RestMethod -Uri $API_URL -Method POST -Body $payload -Headers $headers
    $response | ConvertTo-Json -Depth 10
}
catch {
    Write-Host "STATUS:" $_.Exception.Response.StatusCode.value__
    Write-Host "STATUS DESCRIPTION:" $_.Exception.Response.StatusDescription

    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $responseBody = $reader.ReadToEnd()
    $reader.Close()

    Write-Host "BODY:"
    Write-Host $responseBody
}