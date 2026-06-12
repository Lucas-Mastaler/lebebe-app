# Fixtures de CaracterizaÃ§Ã£o â€” Legado `/procurar-datas`

> **Data:** 12 de junho de 2026  
> **Status:** Estrutura criada. Fixtures reais pendentes de captura manual.

---

## 1. Para que servem estas fixtures

Este diretÃ³rio armazena capturas reais (ou controladas) do fluxo legado da tela `/procurar-datas`, especificamente do endpoint:

```
POST /api/procurar-datas/pesquisar
```

Elas servem como **contrato de comportamento** para:

- Validar que o motor v2 diagnÃ³stico produz resultados equivalentes ao legado
- Documentar o formato exato de payloads e responses em situaÃ§Ãµes reais
- Ser usadas como entrada para futura rota de comparaÃ§Ã£o `/api/procurar-datas/v2/comparar`

---

## 2. Natureza das fixtures

- Fixtures aqui armazenadas **caracterizam o comportamento do legado**
- **NÃ£o substituem testes automatizados** â€” sÃ£o complementares
- **NÃ£o inventar dados** â€” salvar apenas capturas reais ou controladas
- Se ainda nÃ£o houver captura real, manter apenas o template (`template-captura-legado.json`)

---

## 3. Regras de seguranÃ§a e dados

- **Preferir ambiente de desenvolvimento/homologaÃ§Ã£o** para capturar fixtures
- Se produÃ§Ã£o for inevitÃ¡vel, capturar **apenas com dados prÃ³prios/de teste**, nunca com dados reais de clientes
- **Anonimizar antes de salvar:**
  - Nomes reais de clientes â†’ substituir por "Cliente Exemplo"
  - EndereÃ§os reais â†’ substituir por "Rua Exemplo, 123, Centro, Curitiba - PR"
  - CEPs reais â†’ substituir por CEP genÃ©rico (ex: "80000-000")
  - Coordenadas precisas â†’ aproximar para 2 casas decimais
  - `clientToken` real â†’ substituir por token sintÃ©tico
- **NÃ£o salvar em repositÃ³rio pÃºblico sem revisÃ£o prÃ©via**

---

## 4. O que nÃ£o alterar

- A rota de produÃ§Ã£o `POST /api/procurar-datas/pesquisar` **nÃ£o deve ser alterada**
- O frontend `src/app/procurar-datas/page.tsx` **nÃ£o deve ser alterado**
- O motor v2 ainda Ã© **apenas diagnÃ³stico** â€” nÃ£o estÃ¡ integrado em produÃ§Ã£o

---

## 5. Estrutura de arquivos esperada

```
docs/fixtures/procurar-datas/legado/
â”œâ”€â”€ README.md                              â† este arquivo
â”œâ”€â”€ template-captura-legado.json           â† template base para novas fixtures
â”œâ”€â”€ caso-normal-simples-YYYY-MM-DD.json    â† PENDENTE
â”œâ”€â”€ caso-premium-ou-especial-YYYY-MM-DD.json   â† PENDENTE
â”œâ”€â”€ caso-hora-marcada-YYYY-MM-DD.json      â† PENDENTE
â”œâ”€â”€ caso-sem-disponibilidade-YYYY-MM-DD.json   â† PENDENTE
â”œâ”€â”€ caso-entrada-invalida-YYYY-MM-DD.json  â† PENDENTE
â”œâ”€â”€ caso-sabado-YYYY-MM-DD.json            â† PENDENTE
â”œâ”€â”€ caso-domingo-YYYY-MM-DD.json           â† PENDENTE
â””â”€â”€ caso-rural-condominio-YYYY-MM-DD.json  â† PENDENTE
```

---

## 6. Casos mÃ­nimos pendentes de captura

| Caso | Arquivo esperado | Status |
|------|------------------|--------|
| Caso normal simples | `caso-normal-simples-2026-06-12.json` | CAPTURADO |
| Caso premium ou especial | `caso-premium-ou-especial-2026-06-12.json` | CAPTURADO |
| Caso hora marcada | `caso-hora-marcada-YYYY-MM-DD.json` | â³ PENDENTE |
| Caso sem disponibilidade | `caso-sem-disponibilidade-YYYY-MM-DD.json` | â³ PENDENTE |
| Caso entrada invÃ¡lida sem tempo | `caso-entrada-invalida-YYYY-MM-DD.json` | BUG IDENTIFICADO E CORRIGIDO (HTTP 400) |
| Caso sÃ¡bado | `caso-sabado-YYYY-MM-DD.json` | â³ PENDENTE |
| Caso domingo | `caso-domingo-YYYY-MM-DD.json` | â³ PENDENTE |
| Caso rural ou condomÃ­nio | `caso-rural-condominio-YYYY-MM-DD.json` | â³ PENDENTE |

---

## 7. Guia de captura manual no DevTools

### 7.1 Captura do `POST /api/procurar-datas/pesquisar`

1. Abrir a tela `/procurar-datas` no navegador
2. Abrir **DevTools** (`F12` ou `Cmd+Option+I`)
3. Ir na aba **Network**
4. Filtrar por `pesquisar`
5. Fazer uma busca **controlada** com dados de teste (nÃ£o usar dados reais de clientes)
6. Aguardar a requisiÃ§Ã£o aparecer
7. Clicar na requisiÃ§Ã£o `POST pesquisar`
8. Copiar:
   - Aba **Payload** â†’ copiar como JSON (`Request Body`)
   - Aba **Response** â†’ copiar como JSON (`Response Body`)
   - Aba **Headers** â†’ copiar o `Status Code`

### 7.2 Captura do polling `GET /api/procurar-datas/progresso`

1. Filtrar Network por `progresso`
2. Aguardar o polling avanÃ§ar atÃ© `status: "done"`
3. Clicar na Ãºltima requisiÃ§Ã£o `GET progresso` com status `done`
4. Copiar:
   - `Response Body` completo (inclui `payload`, `normais`, `extras`)

Para captura diagnostica/fixture fora do polling normal da tela, usar `modoCaptura=1` na URL do progresso:

```js
const progressoUrl = `/api/procurar-datas/progresso?clientToken=${encodeURIComponent(clientToken)}&modoCaptura=1`
```

### 7.3 Salvar a fixture

1. Duplicar `template-captura-legado.json`
2. Renomear para o caso capturado (ex: `caso-normal-simples-2026-06-13.json`)
3. Substituir todos os campos `PENDENTE_CAPTURA_REAL`
4. **Anonimizar** (ver seÃ§Ã£o 3)
5. Preencher `sensibilidade.dadosAnonimizados: true`
6. Preencher `sensibilidade.camposRemovidos` com lista do que foi anonimizado
7. Salvar no diretÃ³rio `docs/fixtures/procurar-datas/legado/`

---

## 8. Como o frontend monta o payload

Confirmado em `src/app/procurar-datas/page.tsx` (funÃ§Ã£o `pesquisarDatas`):

```typescript
const body: PesquisarDatasRequest = {
  ...form,
  clientToken: token,
  tempoNecessario,
  cep: addressResult.cep || '',
  lat: addressResult.lat,
  lng: addressResult.lng,
  destLat: addressResult.lat,
  destLng: addressResult.lng,
  destDisplay: addressResult.enderecoCompleto || addressResult.display || addressResult.display_name || '',
  destProvider: addressResult.provider || '',
  enderecoCompleto: addressResult.enderecoCompleto || addressResult.display || addressResult.display_name || '',
  monthYear: form.dataInicial,
}
```

**ObservaÃ§Ã£o:** `destLat`/`destLng` sÃ£o iguais a `lat`/`lng` neste fluxo â€” o destino usa as mesmas coordenadas do endereÃ§o validado.

---

## 9. PrÃ³xima etapa apÃ³s ter fixtures reais

ApÃ³s ter ao menos 1 fixture real capturada e anonimizada:

1. Revisar campos mapeados em `docs/procurar-datas-legado-fixtures.md`
2. Atualizar seÃ§Ã£o 5.5 daquele documento marcando como capturado
3. Iniciar planejamento da rota de comparaÃ§Ã£o `/api/procurar-datas/v2/comparar`

---

## 10. ReferÃªncias

- `docs/procurar-datas-legado-fixtures.md` â€” Contratos e estrutura do legado
- `docs/procurar-datas-motor-v2-progresso.md` â€” Progresso do motor v2
- `docs/procurar-datas-contratos-payloads.md` â€” Contratos de payloads
- `docs/procurar-datas-fixtures.md` â€” Fixtures de caracterizaÃ§Ã£o geral
- `src/app/api/procurar-datas/pesquisar/route.ts` â€” Rota legado
- `src/app/procurar-datas/page.tsx` â€” Frontend (nÃ£o alterar)
