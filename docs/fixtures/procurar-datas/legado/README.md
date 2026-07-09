# Fixtures de Caracterização — Legado `/procurar-datas`

> **Data:** 12 de junho de 2026  
> **Status:** Estrutura criada. Fixtures reais pendentes de captura manual.

---

## 1. Para que servem estas fixtures

Este diretório armazena capturas reais (ou controladas) do fluxo legado da tela `/procurar-datas`, especificamente do endpoint:

```
POST /api/procurar-datas/pesquisar
```

Elas servem como **contrato de comportamento** para:

- Validar que o motor v2 diagnóstico produz resultados equivalentes ao legado
- Documentar o formato exato de payloads e responses em situações reais
- Ser usadas como entrada para futura rota de comparação `/api/procurar-datas/v2/comparar`

---

## 2. Natureza das fixtures

- Fixtures aqui armazenadas **caracterizam o comportamento do legado**
- **Não substituem testes automatizados** — são complementares
- **Não inventar dados** — salvar apenas capturas reais ou controladas
- Se ainda não houver captura real, manter apenas o template (`template-captura-legado.json`)

---

## 3. Regras de segurança e dados

- **Preferir ambiente de desenvolvimento/homologação** para capturar fixtures
- Se produção for inevitável, capturar **apenas com dados próprios/de teste**, nunca com dados reais de clientes
- **Anonimizar antes de salvar:**
  - Nomes reais de clientes → substituir por "Cliente Exemplo"
  - Endereços reais → substituir por "Rua Exemplo, 123, Centro, Curitiba - PR"
  - CEPs reais → substituir por CEP genérico (ex: "80000-000")
  - Coordenadas precisas → aproximar para 2 casas decimais
  - `clientToken` real → substituir por token sintético
- **Não salvar em repositório público sem revisão prévia**

---

## 4. O que não alterar

- A rota de produção `POST /api/procurar-datas/pesquisar` **não deve ser alterada**
- O frontend `src/app/procurar-datas/page.tsx` **não deve ser alterado**
- O motor v2 ainda é **apenas diagnóstico** — não está integrado em produção

---

## 5. Estrutura de arquivos esperada

```
docs/fixtures/procurar-datas/legado/
|-- README.md                              ← este arquivo
|-- template-captura-legado.json           ← template base para novas fixtures
|-- caso-normal-simples-YYYY-MM-DD.json    ← PENDENTE
|-- caso-premium-ou-especial-YYYY-MM-DD.json   ← PENDENTE
|-- caso-hora-marcada-YYYY-MM-DD.json      ← PENDENTE
|-- caso-sem-disponibilidade-YYYY-MM-DD.json   ← PENDENTE
|-- caso-entrada-invalida-YYYY-MM-DD.json  ← PENDENTE
|-- caso-sabado-YYYY-MM-DD.json            ← PENDENTE
|-- caso-domingo-YYYY-MM-DD.json           ← PENDENTE
`-- caso-rural-condominio-YYYY-MM-DD.json  ← PENDENTE
```

---

## 6. Casos mínimos pendentes de captura

| Caso | Arquivo esperado | Status |
|------|------------------|--------|
| Caso normal simples | `caso-normal-simples-2026-06-12.json` | CAPTURADO |
| Caso premium ou especial | `caso-premium-ou-especial-2026-06-12.json` | CAPTURADO |
| Caso hora marcada | `caso-hora-marcada-YYYY-MM-DD.json` | ⏳ PENDENTE |
| Caso sem disponibilidade | `caso-sem-disponibilidade-YYYY-MM-DD.json` | ⏳ PENDENTE |
| Caso entrada inválida sem tempo | `caso-entrada-invalida-YYYY-MM-DD.json` | BUG IDENTIFICADO E CORRIGIDO (HTTP 400) |
| Caso sábado | `caso-sabado-YYYY-MM-DD.json` | ⏳ PENDENTE |
| Caso domingo | `caso-domingo-YYYY-MM-DD.json` | ⏳ PENDENTE |
| Caso rural ou condomínio | `caso-rural-condominio-YYYY-MM-DD.json` | ⏳ PENDENTE |

---

## 7. Guia de captura manual no DevTools

### 7.1 Captura do `POST /api/procurar-datas/pesquisar`

1. Abrir a tela `/procurar-datas` no navegador
2. Abrir **DevTools** (`F12` ou `Cmd+Option+I`)
3. Ir na aba **Network**
4. Filtrar por `pesquisar`
5. Fazer uma busca **controlada** com dados de teste (não usar dados reais de clientes)
6. Aguardar a requisição aparecer
7. Clicar na requisição `POST pesquisar`
8. Copiar:
   - Aba **Payload** → copiar como JSON (`Request Body`)
   - Aba **Response** → copiar como JSON (`Response Body`)
   - Aba **Headers** → copiar o `Status Code`

### 7.2 Captura do polling `GET /api/procurar-datas/progresso`

1. Filtrar Network por `progresso`
2. Aguardar o polling avançar até `status: "done"`
3. Clicar na última requisição `GET progresso` com status `done`
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
4. **Anonimizar** (ver seção 3)
5. Preencher `sensibilidade.dadosAnonimizados: true`
6. Preencher `sensibilidade.camposRemovidos` com lista do que foi anonimizado
7. Salvar no diretório `docs/fixtures/procurar-datas/legado/`

---

## 8. Como o frontend monta o payload

Confirmado em `src/app/procurar-datas/page.tsx` (função `pesquisarDatas`):

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

**Observação:** `destLat`/`destLng` são iguais a `lat`/`lng` neste fluxo — o destino usa as mesmas coordenadas do endereço validado.

---

## 9. Próxima etapa após ter fixtures reais

Após ter ao menos 1 fixture real capturada e anonimizada:

1. Revisar campos mapeados em `docs/procurar-datas-legado-fixtures.md`
2. Atualizar seção 5.5 daquele documento marcando como capturado
3. Iniciar planejamento da rota de comparação `/api/procurar-datas/v2/comparar`

---

## 10. Referências

- `docs/procurar-datas-legado-fixtures.md` — Contratos e estrutura do legado
- `docs/procurar-datas-motor-v2-progresso.md` — Progresso do motor v2
- `docs/procurar-datas-contratos-payloads.md` — Contratos de payloads
- `docs/procurar-datas-fixtures.md` — Fixtures de caracterização geral
- `src/app/api/procurar-datas/pesquisar/route.ts` — Rota legado
- `src/app/procurar-datas/page.tsx` — Frontend (não alterar)
