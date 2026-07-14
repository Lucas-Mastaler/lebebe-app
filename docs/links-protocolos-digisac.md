# Links de Protocolos Digisac

**Data:** 2026-07-14
**Status:** Implementado e validado (lint, typecheck, build).

---

## 1. Objetivo

Transformar todos os protocolos de chamados Digisac exibidos na interface em links clicaveis que abrem `https://lebebe.digisac.me/ticket-history/{UUID_DO_TICKET}` em nova aba. O texto visivel continua sendo o protocolo. Se nao houver UUID valido, manter como texto simples.

---

## 2. Auditoria

### 2.1 Onde o link ja estava implementado

**Tela:** Finalizacoes Automaticas Digisac (`src/app/digisac/finalizacoes-automaticas/PageClient.tsx`, linhas 879-891)

Padrao usado:
- Backend monta `ticket_history_url` via `montarUrlHistoricoTicket(ticketId)` e envia para o frontend
- Frontend renderiza `<a href={item.ticket_history_url} target="_blank" rel="noopener noreferrer">` com icone `ExternalLink`
- Fallback: `<span>` com texto simples se `protocolo` ou `ticket_history_url` forem ausentes

### 2.2 Helper existente (duplicado em 3 arquivos)

| Arquivo | Linha | Exportada? |
|---|---|---|
| `src/lib/digisac/finalizacoesAutomaticas.ts` | 779-781 | Sim |
| `src/lib/digisac/vacuoAtivo.ts` | 8-10 | Nao (privada) |
| `src/app/api/digisac/finalizacoes-automaticas/diagnostico/route.ts` | 133-135 | Nao (privada) |

Todas usam `DIGISAC_WEB_BASE_URL = 'https://lebebe.digisac.me'` e retornam `${DIGISAC_WEB_BASE_URL}/ticket-history/${ticketId}`.

### 2.3 Locais que exibiam protocolo como texto (sem link)

| # | Arquivo | Contexto | Tem UUID? |
|---|---|---|---|
| 1 | `ModalDetalheVenda.tsx` | Tabela de chamados do ciclo | Sim (`c.digisac_ticket_id`) |
| 2 | `ModalDetalheVenda.tsx` | Tabela de analise individual IA | Sim (`c.digisac_ticket_id`) |
| 3 | `ModalDetalheVenda.tsx` | Historico de chamados analisados | Sim (`c.digisac_ticket_id`) |
| 4 | `ModalDetalheVenda.tsx` | Consolidado: Negociacoes Prazo | Nao (apenas `item.protocolo`) |
| 5 | `ModalDetalheVenda.tsx` | Consolidado: Negociacoes Frete | Nao (apenas `item.protocolo`) |
| 6 | `ModalDetalheVenda.tsx` | Consolidado: Negociacoes Desconto | Nao (apenas `item.protocolo`) |
| 7 | `ModalDetalheVenda.tsx` | Consolidado: Negociacoes Pagamento | Nao (apenas `item.protocolo`) |
| 8 | `ModalDetalheVenda.tsx` | Consolidado: Valores citados | Nao (apenas `item.protocolo`) |

### 2.4 APIs — retorno do UUID

| API | Retorna UUID? | Campo |
|---|---|---|
| `GET /api/sgi/digisac/chamados-ciclo` | Sim | `digisac_ticket_id` |
| `GET /api/sgi/ia/analise-status` | Sim | `digisac_ticket_id` nos chamados individuais |
| Consolidado IA (DB) | Nao | `chamados_que_influenciaram[].ticket_id` contem o protocolo, nao UUID |

### 2.5 Mapeamento protocolo -> UUID para o consolidado

O consolidado da IA nao possui o UUID do ticket, apenas o protocolo. Para resolver isso sem alterar backend ou prompt da IA, foi construido um map `protocolo -> digisac_ticket_id` a partir do array de `chamados` individuais (que ja esta disponivel no mesmo componente `PainelAnaliseIA`). Esse map e usado nos 5 locais do consolidado.

---

## 3. Alteracoes realizadas

### 3.1 Helper centralizado criado

**Arquivo:** `src/lib/digisac/urls.ts`

```typescript
export const DIGISAC_WEB_BASE_URL = 'https://lebebe.digisac.me';

export function montarUrlHistoricoTicket(ticketId: string): string {
  return `${DIGISAC_WEB_BASE_URL}/ticket-history/${ticketId}`;
}
```

### 3.2 ModalDetalheVenda.tsx alterado

- Import de `montarUrlHistoricoTicket` e `ExternalLink`
- Map `protocoloToTicketId` construido a partir do array `chamados`
- Funcao `renderProtocoloLink(protocolo, ticketId?)` reutilizavel
- 3 locais com UUID direto transformados em link (chamados do ciclo, analise individual, historico)
- 5 locais do consolidado transformados em link usando o map
- Fallback: texto simples quando UUID nao esta disponivel

### 3.3 Arquivos nao alterados (por decisao)

- `src/lib/digisac/finalizacoesAutomaticas.ts` — mantem helper local exportado
- `src/lib/digisac/vacuoAtivo.ts` — mantem helper local privado
- `src/app/api/digisac/finalizacoes-automaticas/diagnostico/route.ts` — mantem helper local privado
- `src/app/digisac/finalizacoes-automaticas/PageClient.tsx` — ja funcionava, nao alterado
- Nenhum backend, banco ou API foi alterado

---

## 4. Validacoes

### 4.1 Comandos executados

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | Passou (0 erros) |
| `npx eslint src/lib/digisac/urls.ts src/components/inteligencia-comercial/ModalDetalheVenda.tsx` | Passou (0 erros) |
| `npx next build` | Passou (build completo) |

### 4.2 Validacao manual pendente

1. Abrir Inteligencia Comercial, clicar em uma venda com chamados sincronizados
2. Confirmar que o protocolo na tabela de chamados do ciclo e clicavel
3. Confirmar que o protocolo na tabela de analise individual e clicavel
4. Confirmar que o protocolo no historico de chamados e clicavel
5. Confirmar que os protocolos nas negociacoes comerciais do consolidado sao clicaveis
6. Confirmar que o clique abre `https://lebebe.digisac.me/ticket-history/{UUID}` em nova aba
7. Confirmar que o texto visivel continua sendo o protocolo (ex: `2026070671189`)
8. Testar um registro sem UUID e confirmar que permanece como texto sem quebrar

---

## 5. Pendencias

1. **Validacao manual** dos links em ambiente de desenvolvimento
2. **Refactor opcional:** substituir as 3 copias duplicadas do helper em `finalizacoesAutomaticas.ts`, `vacuoAtivo.ts` e `diagnostico/route.ts` pelo import do helper centralizado `urls.ts` (nao feito nesta tarefa para evitar refactor fora do escopo)
3. **IA consolidado:** o campo `ticket_id` em `chamados_que_influenciaram` e `chamados_sem_influencia` contem o protocolo, nao o UUID. Se no futuro a IA passar a retornar o UUID, o map podera ser dispensado

---

## 6. Riscos

1. **Protocolo sem UUID no consolidado:** se o protocolo do consolidado nao corresponder a nenhum chamado individual, o link nao sera gerado (texto simples). Isso e comportamento esperado e seguro.
2. **Protocolo duplicado para tickets diferentes:** o map usara o ultimo chamado com aquele protocolo. Caso raro, nao quebra a interface.
3. **Helpers duplicados:** 3 copias do helper continuam existindo. O helper centralizado em `urls.ts` e a versao recomendada para novos usos.

---

## 7. Proximo passo recomendado

1. Validar manualmente os links em uma venda real com chamados
2. Considerar substituir as 3 copias duplicadas pelo helper centralizado em uma tarefa separada de refactor
