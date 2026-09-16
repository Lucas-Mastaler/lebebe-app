# Foundations — Design System v1

Tokens e fundamentos visuais. Todas as decisões aqui já foram aprovadas
pelo usuário (ver `docs/projetos/design-system/DECISOES.md`) — isto é
documentação do padrão final, não uma comparação de alternativas (essa
comparação, histórica, continua em `/design-system`).

## Cor

Tokens já existentes em `src/app/globals.css` (não renomeados, não
movidos):

| Token | Papel | Usar via |
|---|---|---|
| `--primary` | Cor de marca (`#00A5E6`) | `bg-primary`, `text-primary`, `border-primary` |
| `--background` / `--foreground` | Fundo/texto de página | `bg-background`, `text-foreground` |
| `--card` | Fundo de superfície elevada | `bg-card` |
| `--muted` / `--muted-foreground` | Superfície neutra / texto secundário (equivale a `slate-100`/`slate-600`) | `bg-muted`, `text-muted-foreground` |
| `--border` | Borda padrão | `border-border` (ou simplesmente `border`, já mapeado por padrão) |
| `--destructive` | Ação/estado destrutivo — também é o token de "danger" (não existe um token `--danger` separado, é o mesmo) | `bg-destructive`, `text-destructive` |
| `--success` **(novo)** | Estado de sucesso | `bg-success`, `text-success` |
| `--warning` **(novo)** | Estado de aviso | `bg-warning`, `text-warning` |
| `--info` **(novo)** | Estado informativo | `bg-info`, `text-info` |
| `--ring` | Foco visível (`focus-visible:ring-*`) — também cumpre o papel de "token de foco" | `ring-ring` |
| `--input-background` **(novo)** | Superfície interna de campos (INP=A, ajuste) — branco (`#FFFFFF`), distinto do `--background` da página | `bg-input-background` |

## Brand Foundation (consolidada em 2026-09-13)

**Fonte:** os tokens de marca já existiam em `globals.css`, sob o
comentário `/* Le Bébé Custom Colors */`, desde antes deste projeto —
não foram inventados nesta tarefa. Confirmados contra `public/logo.png`
(o logo real: badge azul, texto branco, estrela amarela) — não contra
`public/amostras-de-cores-2026.png`, que é um catálogo de cores de
**tapete/produto físico** (Gelo, Bege, Azul Bebé, ...), sem relação com a
identidade digital.

| Token | Hex | Papel | Origem |
|---|---|---|---|
| `--color-brand` (= `--primary`) | `#00A5E6` | Azul da marca — dominante | Já existia |
| `--color-brand-strong` **(novo)** | `#0080B3` | Azul forte — apoio/contraste, quando o azul padrão precisa de mais presença | Derivado de `--color-brand` (mesmo matiz/saturação, luminosidade reduzida via HSL — `hsl(197°,100%,45%)` → `hsl(197°,100%,35%)`), documentado aqui para não virar "hex mágico" |
| `--color-brand-secondary` (= `--secondary`) | `#3BBAE8` | Ciano — accent secundário da marca | Já existia |
| `--color-brand-accent` (= `--accent`) | `#FBF27B` | Amarelo da estrela — accent de marca, moderação | Já existia |
| `--color-brand-light` | `rgba(0,165,230,.10)` | Azul muito claro (ice) — surface leve | Já existia |

**Já coerente, preservado sem alteração de valor:** `--primary`
(`#00A5E6`) já É o azul da marca — auditado, nada a trocar (evita
mudança visual massiva em telas legadas que já consomem `--primary`).
`--ring` (foco) também já é `#00A5E6` — focus já conversa com a marca.

**Único ponto de hex hardcoded fora da fonte de verdade, corrigido:**
`src/lib/design-system/typography.ts`, papel `eyebrow`, usava
`text-[#00A5E6]` literal — trocado para `text-primary` (mesmo valor
exato, zero mudança visual, só passou a consumir o token em vez de
repetir o hex).

### Direção de uso

A interface Le Bébé é **predominantemente neutra e clara**, identificada
pela família azul da marca. **O amarelo da estrela funciona como acento
visual pontual, não como cor dominante de interação.**

- **Maioria da tela:** branco (`--card`/`bg-white`) + cinza muito claro
  (`--background`).
- **Identidade dominante:** azul (`--primary`) — ações primárias, links,
  item ativo de navegação, foco, ícones importantes.
- **Secundário:** ciano (`--color-brand-secondary`) — accents, ícones,
  surfaces leves, `section-2`.
- **Acento pontual:** amarelo (`--color-brand-accent`) — pequeno
  destaque, marcador, ícone de estrela, `section-3`. Nunca primary
  padrão, nunca fundo de tela inteira, nunca cor de navegação principal.

### Brand × Semantic — independência obrigatória

`brand-yellow ≠ warning` e `brand-blue/cyan ≠ info` — mesmo com famílias
de cor próximas, os papéis permanecem semanticamente independentes:

- **Brand yellow (`#FBF27B`) vs. `--warning` (`#F59E0B`):** valores hex
  já eram distintos antes desta tarefa (amarelo puro vs. âmbar/laranja).
  Auditado — nenhuma mudança necessária nos tokens. Estrutural: `Section`
  amarela usa texto **neutro** (`text-slate-800`, não `text-yellow-800`)
  — tratamento deliberado para nunca "ler" como alerta (ver
  `section-tones.ts`).
- **Brand blue (`#00A5E6`)/cyan (`#3BBAE8`) vs. `--info` (`#0EA5E9`):**
  tensão real, registrada com transparência — o hex de `info` já era
  (antes desta tarefa) muito próximo do azul da marca (diferença de 2
  pontos no canal verde). Não alterado (mudaria o significado semântico
  de todas as telas que já usam `info`, fora de escopo). A separação
  entre `section-1`/`section-2` (organização) e `info` (estado) depende
  também da estrutura do componente `Section` (accent lateral + divisor
  + heading, ausente em `Alert`) — não só da cor. Medido: a distância de
  cor entre `section-1` e `info` é menor que a de `section-3` vs.
  `warning` (~9 vs. ~35 em Lab) — um limite real da paleta compartilhada
  do produto, não ignorado, documentado aqui como conhecido. Ver
  DECISOES.md D-042.

### Section colors — CLR=B, tons derivados da marca (revisado em 2026-09-13)

`section-1`=azul, `section-2`=ciano, `section-3`=amarelo da estrela —
ver `section-tones.ts` para os valores exatos e o histórico completo da
decisão (auto-fit/sky-emerald-amber → `STN` experimental → Brand
Foundation) mais abaixo, em "Histórico da decisão de section colors".

### Superfície de campo — INP=A (ajuste aprovado em 2026-09-11)

A escolha visual `INP=A` (bordado) não mudou — o ajuste foi só a
**superfície interna**. Antes, `Input`/`Textarea`/`DateField`/`Combobox`
usavam `bg-transparent`, que na prática herdava a cor do que estivesse
atrás (geralmente `--background`, `#F7FAFC`) — o campo ficava quase
indistinguível do fundo da página. Agora usam `bg-input-background`
(`#FFFFFF` no claro, `#1E293B` no escuro — mesmo tom do `--card`, mas como
token próprio, não compartilhado, para poder divergir no futuro sem
afetar `Card`).

| Estado | Comportamento |
|---|---|
| Normal | `bg-input-background` + `border-input` — superfície clara, sutilmente distinta do fundo da página |
| Hover | Sem mudança de superfície (não é um controle que reage a hover; o destaque relevante é o foco) |
| Focus | `focus-visible:border-ring` + `ring-ring/50` — superfície permanece `bg-input-background` |
| Disabled | `disabled:opacity-50` sobre `bg-input-background` — já fica visualmente diferenciado (branco meio-transparente sobre o fundo), sem precisar de um token à parte |
| Readonly | `read-only:bg-muted read-only:text-muted-foreground` — superfície neutra, diferente tanto do normal quanto do disabled |
| Erro | `aria-invalid:border-destructive` — superfície continua `bg-input-background`; o erro é comunicado pela borda + mensagem inline (`FormField`), nunca só pela superfície |

Implementado em `Input`, `Textarea`, `DateField` e `Combobox`
(`src/components/design-system/`). Demonstrado em `/design-system`,
seção "Referência oficial" → "Superfície do campo".

**`FORM-CONTROL-SURFACE` — `Select` entra na família (2026-09-15):**
`Select`/`SelectTrigger` (`src/components/ui/select.tsx`, Radix, não
substituído por wrapper próprio) usava `bg-transparent` — dentro de um
`FilterPanel` (superfície tintada), o campo ficava quase indistinguível
do fundo do painel, mesmo já tendo borda (`border-input`) e focus
(`focus-visible:border-ring focus-visible:ring-ring/50`) idênticos ao
`Input`. Corrigido trocando para `bg-input-background` — mesma correção
que `Input` já tinha recebido em 2026-09-11, agora estendida ao `Select`
para fechar a família `FORM-CONTROL-SURFACE` (`Input`, `Textarea`,
`DateField`, `Combobox`, `Select`: mesma superfície, borda, radius e
estados de hover/focus/disabled). Sem efeito visual sobre fundo branco
(`bg-input-background` = `#FFFFFF`); o ganho aparece só sobre superfícies
tintadas (painel de filtros, `Section`).

**Correção do piloto (`/chamados-finalizados`, Fase 4, 2026-09-12):**
`Input` não encaminhava `ref` (função simples, sem `React.forwardRef`) —
quebraria qualquer tela que precise de autofoco/leitura direta do
elemento (achado real: a célula de observação editável da tela piloto
usa `ref` para focar o campo ao entrar em modo de edição). Corrigido com
`React.forwardRef`, sem mudar a API pública do componente.

**Achado da auditoria que continua válido:** a cor de marca ainda é
escrita como hex literal (`#00A5E6`) em ~28 arquivos de tela, em vez de
`bg-primary`/`text-primary`. Isso **não foi corrigido em massa nesta
fase** — é migração controlada (Fase 4). Todo componente novo do DS v1 já
usa o token corretamente.

**Hover:** o projeto já usa opacidade (`hover:bg-primary/90`,
`hover:bg-primary/15` etc.) em vez de um token `--primary-hover`
separado — mantido assim de propósito (Tailwind v4 já resolve isso via
`color-mix`, criar um token redundante seria abstração desnecessária).

## Radius — RAD=B (aprovado)

`--radius: 0.75rem` (12px) já é o valor usado hoje em todo o sistema —
**nenhuma mudança de valor foi necessária**, só a formalização do papel:

| Nível | Classe | Uso |
|---|---|---|
| Controles (botão, input, badge) | `rounded-md` | `Button`, `Textarea`, campos |
| Cards / containers de 1º nível | `rounded-2xl` | `Card`, `FormSection` |
| Overlays / modais | `rounded-lg` (já é o padrão do `Dialog` existente, não alterado) | `Dialog` |
| Elementos pequenos (chip, pílula) | `rounded-full` | `Badge` |

## Elevação — SHD=C (aprovado)

Contorno/glow sutil da cor de marca em vez de `box-shadow` tradicional.
Nova utilitária `.ds-elevation-glow` em `src/app/globals.css`:

```css
.ds-elevation-glow {
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--primary) 15%, transparent),
    0 0 0 4px color-mix(in srgb, var(--primary) 6%, transparent);
}
```

Usada pelo `Card` do DS v1. Modais continuam com o `shadow-lg` que o
`Dialog` (`src/components/ui/dialog.tsx`) já tinha — não alterado, e a
decisão SHD=C foi demonstrada especificamente em cards no laboratório, não
em overlays.

## Container clipping / TABLE-VIEWPORT-CLIP (princípio global, revisado em 2026-09-12)

**Regra:** se um container tem borda + radius, todo conteúdo/superfície
interna precisa respeitar a mesma silhueta — nenhum fundo interno pode
"vazar" quadrado sobre um canto arredondado, **em qualquer posição de
scroll**.

Achada no piloto de `/chamados-finalizados`, em duas rodadas:

1. Primeira rodada (radius por célula): o cabeçalho da tabela
   (`bg-slate-50`) e uma linha destacada (`bg-red-50`) tinham cantos retos
   por cima do container `rounded-2xl`. Corrigido aplicando `rounded-tl-*`/
   `rounded-tr-*`/`rounded-bl-*`/`rounded-br-*` diretamente nas células de
   borda (1ª/última coluna, cabeçalho/última linha).
2. **Uso manual real revelou que isso não é estrutural**: numa tabela com
   scroll horizontal, a silhueta pertencia às CÉLULAS, não à JANELA
   VISÍVEL. Ao arrastar a tabela para a direita, a célula "última coluna"
   deixa de estar na borda visível — uma célula do meio (quadrada) passa a
   ocupar o canto, expondo fundo quadrado por cima do radius (e o problema
   troca de lado ao arrastar para a esquerda).

**Solução estrutural correta — três níveis, cada um com uma
responsabilidade só (revisado em 2026-09-12 após uso manual real):**

- **OUTER SHELL** — só `rounded-2xl border ...`, SEM overflow nem
  clip-path. Dona da borda/silhueta externa: nítida, imóvel, nunca
  afetada por antialiasing de máscara.
- **INNER CLIP** — `rounded-2xl overflow-hidden bg-white`. A MESMA classe
  de radius do OUTER (não um valor separado). Corta qualquer superfície
  interna (cabeçalho colorido, hover, linha destacada, zebra) que tente
  passar do contorno, **independente da posição de scroll**.
- **HORIZONTAL SCROLLER** — `overflow-x-auto`, dono do scroll horizontal
  (nativo + arrastar com o mouse). Fica dentro do INNER CLIP, sem radius
  próprio.

**Por que não usar `clip-path` com um valor hardcoded — bug real
confirmado, não hipotético:** a primeira versão desta correção usava
`clip-path: inset(0 round 1rem)` (16px) no OUTER SHELL, para não
depender de `overflow-hidden` (testado quebrando `position: sticky`, ver
abaixo). O usuário reportou os cantos "apagados" durante scroll
horizontal — inspecionado via `getComputedStyle`, não assumido: o
container real usa `rounded-2xl` = **20px** (`--radius-2xl`,
`--radius: 0.75rem` + 8px), enquanto o `clip-path` usava **16px**
hardcoded — um descompasso de 4px entre a curva da borda e a curva da
máscara, que "comia" uma faixa da borda exatamente no canto. Corrigido
separando quem desenha a borda (OUTER, sem clip) de quem recorta o
conteúdo (INNER CLIP, `overflow-hidden`, com a MESMA classe `rounded-2xl`
do OUTER — nunca mais um valor numérico solto). O 1px de diferença entre
as duas caixas (a borda do OUTER) é aceito como desprezível — é o mesmo
padrão de qualquer "card com borda + conteúdo com overflow-hidden".

**Por que `overflow-hidden` agora é seguro** (antes tinha sido descartado
por quebrar `stickyHeader`): só passou a ser seguro depois da decisão
TABLE-NO-INTERNAL-VSCROLL (abaixo) — nenhuma tabela do DS depende mais de
`stickyHeader` ficar preso a um scroll vertical, então não há mais nada
para `overflow-hidden` "quebrar" nesse sentido.

## TABLE-NO-INTERNAL-VSCROLL (regra global, aprovada em 2026-09-12)

**Regra:** tabelas/listagens paginadas NÃO têm scroll vertical interno —
a página é responsável pelo scroll vertical, sempre.

Contexto: a correção anterior de `stickyHeader` (ver histórico em
`components-e-patterns.md`) só conseguia funcionar de verdade dando à
tabela um `max-h-[70vh] overflow-y-auto` — cabeçalho preso ao scroll
INTERNO da tabela, não da página (limitação real do CSS: qualquer elemento
com `overflow-x-auto` força o eixo vertical a também não ser `visible`,
interceptando `position: sticky` relativo à página — ver git history do
componente para a explicação completa). O usuário testou essa experiência
e reprovou: gera "scroll dentro de scroll" — o mouse precisa terminar o
scroll interno da tabela antes de continuar rolando a página. Removido.
Combinado com TABLE-PAGE-SIZE (máx. 20 linhas/página), o cabeçalho nunca
fica muito longe do topo — não há necessidade real de cabeçalho fixo em
tabelas desse tamanho. `stickyHeader` continua aceito como prop (não quebra
consumidores existentes) mas não tem efeito de fixação visível nesta
arquitetura — documentado como no-op seguro, não como feature funcional.

## TABLE-ZEBRA=ON (regra global, revisada em 2026-09-14)

**Regra:** tabelas de resultados usam alternância sutil de superfícies
por padrão (`bg-white`/`bg-slate-50`, nunca cor de marca/semântica) —
facilita acompanhar uma linha horizontalmente e perceber onde um registro
termina e o próximo começa. Reinicia a cada página (não mantém paridade
global entre páginas). **Sempre sólidas, sem opacidade** (`bg-slate-50`,
não `bg-slate-50/70`) — ver "Sticky columns" abaixo para o motivo.

**Precedência conceitual** (da mais forte para a mais fraca): (1)
`rowTone`/estado semântico da linha define a FAMÍLIA visual; (2)
seleção/destaque explícito, quando existir, pode substituir/elevar o
estado; (3) zebra/paridade escolhe a variante `base`/`alternate` DENTRO
dessa família (ou do neutro padrão, quando não há tom); (4) hover
(sempre sólido, embutido em cada variante) aplica-se sobre a superfície
resultante; (5) a célula sticky usa exatamente essa mesma superfície
final. O Design System não sabe o que cada tom significa (chamado sem
ação, pedido pendente, venda com problema, ...) — só recebe o NOME do
tom (ou a classe pronta, no caminho legado) da tela; a regra de negócio
fica na tela, nunca no componente.

**Row tones — zebra dentro do row-state (revisado em 2026-09-15, achado
real em `/chamados-finalizados`):** um `rowTone` explícito NÃO precisa
eliminar toda alternância entre linhas. Antes, uma linha destacada
(`rowClassName` com uma cor fixa) cobria o zebra por completo — como
várias linhas da tela podiam estar no mesmo estado, todas ficavam com a
MESMA cor uniforme (uma "faixa" sólida), perdendo a orientação visual
entre registros. Corrigido tornando cada tom uma FAMÍLIA
(`src/lib/design-system/row-tones.ts`, tipo `RowTone`) com duas
variantes (`base`/`alternate`) — o `ResponsiveTable` resolve qual
variante usar pela MESMA paridade que o zebra normal usaria; a tela só
declara `rowTone={(row) => 'danger'}` (ou o tom aplicável), nunca a
paridade. Resultado: linhas no mesmo `rowTone` continuam distinguíveis
entre si (duas intensidades sutis, não duas cores diferentes de negócio),
mantendo tanto o significado da linha quanto a leitura horizontal.
`dangerSubtle` é uma intensidade mais clara da família `danger`, criada
porque `/chamados-finalizados` achou a intensidade padrão forte demais
para uma tabela inteira de linhas destacadas — preferência ESPECÍFICA
dessa tela (não altera o token `--destructive` nem a família `danger`
padrão, que continua disponível para outras telas). Compatibilidade:
`rowClassName` continua aceito (tipografia, borda, background legado
quando não há `rowTone`) — ver `components-e-patterns.md` para a API
completa.

**Restrição de implementação:** as variantes de `RowTone` precisam ficar
como classes Tailwind literais no mapa de `row-tones.ts`. Uma classe
arbitrária interpolada em runtime não é descoberta pelo scanner do
Tailwind v4 e, portanto, não recebe CSS: a linha e a célula sticky ficam
transparentes mesmo com a classe presente no DOM. Isso não cria cores
novas: cada literal continua usando `color-mix()` com o token semântico
oficial.

**Zebra × status em célula (esclarecido em 2026-09-14, achado no uso
manual de `/chamados-finalizados`):** um `Badge` de status numa COLUNA
("Finalizado", "Agendado", "Erro", ...) não substitui o zebra da linha
automaticamente. O status já foi comunicado pelo Badge — colorir a linha
inteira também seria redundante e quebraria a leitura por zebra. Row-level
(`rowClassName`) fica reservado para quando a TELA decide explicitamente
que o registro inteiro precisa de destaque (ex.: falta uma ação
importante, erro operacional crítico, regra de negócio já definida para
aquela linha) — nunca derivado automaticamente de "este status existe".
Achado real: `ModalAgendamentosCliente` colorizava a linha inteira a
partir do MESMO status já mostrado no Badge da coluna — sem nenhuma regra
funcional que exigisse isso (era assim para os 3 status, uniformemente,
não só para casos críticos) — corrigido removendo o `rowClassName`
redundante, mantendo só zebra + Badge.

Não é obrigatório no mobile (`ResponsiveTable` já reflow para cards, que
têm separação própria via borda/sombra/espaçamento) — pode continuar em
listagens tabulares/row-like no mobile quando fizer sentido.
Desativável via prop (`zebra={false}`) quando realmente necessário.

Este princípio (TABLE-VIEWPORT-CLIP, TABLE-NO-INTERNAL-VSCROLL,
TABLE-ZEBRA) vale para qualquer card/superfície do DS, não só tabela — a
técnica concreta (OUTER/INNER CLIP/SCROLLER) é a forma recomendada quando
o container também precisa de scroll interno horizontal. Não migre cards
existentes por causa disso nesta fase — só o componente oficial
(`ResponsiveTable`), a documentação, o piloto e a demonstração em
`/design-system` foram ajustados; as demais telas serão corrigidas quando
migradas.

## TABLE-STICKY-OPAQUE (regra global, aprovada em 2026-09-14)

**Regra:** toda célula sticky que fica sobre conteúdo rolável precisa
possuir superfície OPACA e camada (`z-index`) adequada. Nunca depender de
background transparente/translúcido quando existe conteúdo passando por
baixo — vale para a primeira coluna sticky (`firstColumnSticky`), futuras
colunas sticky, e o cabeçalho sticky correspondente.

**Bug real corrigido, confirmado em uso manual de `/chamados-finalizados`
(não hipotético):** a primeira coluna sticky reaplicava a classe de
superfície da linha (zebra/`rowClassName`), o que parecia correto — mas
`ZEBRA_ODD` (`bg-slate-50/70`) e os `rowClassName` de estado então em uso
(`bg-destructive/10`, etc.) usavam OPACIDADE. Uma superfície com alpha <
100% é perfeitamente aceitável numa célula normal (só existe o fundo
branco do card atrás dela), mas numa célula STICKY existe conteúdo real
das outras colunas passando por baixo, na mesma posição de tela, durante
o scroll — a opacidade deixa esse conteúdo aparecer através, produzindo
texto "fantasma" sobreposto. Corrigido em duas frentes:

1. `ZEBRA_ODD` deixou de usar alpha (`bg-slate-50/70` → `bg-slate-50`).
2. Tons de linha inteira (`rowClassName`) passaram a usar
   `src/lib/design-system/row-tones.ts` — `color-mix(in srgb,
   var(--token) X%, white)`, que produz uma cor SÓLIDA (não uma camada
   translúcida) a partir do token semântico oficial. Mesma aparência
   visual de antes (a cor final, mesclada com branco, é idêntica ao que
   `bg-token/X` produzia sobre um fundo branco) — só deixou de ser
   transparente.

**Fonte única da superfície:** `resolveRowSurface()` (em
`ResponsiveTable.tsx`) calcula a classe da linha UMA VEZ e alimenta tanto
a `<tr>` quanto a célula sticky — nunca duas implementações paralelas de
precedência. A célula sticky sempre "parece parte da mesma linha": zebra
clara → sticky clara; zebra alternada → sticky alternada; `rowClassName`
→ sticky com o mesmo tom.

**Camadas (`z-index`), previsíveis, não `9999`:** conteúdo normal (sem
`z-index`) < célula sticky do corpo (`z-10`) < cabeçalho sticky (`z-20`)
< célula de interseção cabeçalho+coluna sticky (`z-30`, explícita — nunca
depender de herança implícita para o canto superior esquerdo).

**Divisor sutil:** a borda direita da coluna sticky ganha
`border-r border-slate-200` (token de borda já existente, sem sombra
nova) só quando há overflow horizontal de verdade (`hasOverflow`) —
reforça a percepção de que há conteúdo passando por baixo sem exagerar.

Validado com `getComputedStyle` em todas as posições de scroll
(esquerda/meio/direita): nenhuma cor computada apresenta canal de alpha —
todas resolvem para uma cor sólida (`rgb()`/`lab()`/`color()` sem
componente de opacidade).

**Hover também precisa ser opaco (revisado em 2026-09-15):** a célula
sticky pinta sua própria superfície por cima da `<tr>`, então um `hover:`
que só existisse na linha (`hover:bg-muted/50`, herdado de
`ui/table.tsx`) nunca apareceria sobre a coluna sticky — o hover ficaria
perceptível no resto da linha, mas "sumiria" exatamente na coluna fixa.
Corrigido dando a cada variante de superfície (zebra neutro e toda
família de `row-tones.ts`) seu próprio `hover:` sólido embutido
(`ZEBRA_EVEN`/`ZEBRA_ODD` → `hover:bg-slate-100`; tons → `color-mix`
também no hover) — o hover agora é sempre visível, em qualquer coluna,
em repouso e sobre qualquer `rowTone`.

## NO-CELL-OVERLAP (regra global, aprovada em 2026-09-15)

**Regra:** conteúdo de uma célula nunca pode pintar visualmente sobre uma
coluna adjacente. Toda coluna de `ResponsiveTable` escolhe explicitamente
uma de duas estratégias válidas: **crescer** (sem `max-w`, com
`whitespace-nowrap` — a coluna se dimensiona pelo maior conteúdo real,
scroll horizontal absorve o aumento) ou **quebrar** (`max-w` sempre
acompanhado de `whitespace-normal break-words` — se o conteúdo exceder o
teto, quebra em vez de vazar). O comportamento inválido — largura
limitada + `nowrap` + `overflow: visible` — nunca é usado por nenhum
papel de Column Sizing.

**Bug real corrigido, não hipotético:** em `/chamados-finalizados`, a
coluna "Nome Digisac" usava o papel `standard`
(`min-w-[120px] max-w-[220px]`, sem `whitespace-normal`). `TableCell`
(`ui/table.tsx`) já aplica `whitespace-nowrap` por padrão a toda célula, e
nenhum papel de Column Sizing jamais aplicou `overflow-hidden` a uma
célula de conteúdo — a combinação resultante (`max-w` + `nowrap` +
`overflow: visible`) deixava o texto continuar pintando depois da borda
da célula, sobre a coluna seguinte, sempre que o valor excedia 220px.
Exemplo real visto pelo usuário: `Ana Toledo | Biramar Baby Atacado
(2255)` aparecendo sobre a coluna "Loja". Corrigido em duas frentes: (1)
`standard`/`wide`/`fill` passaram a sempre incluir `whitespace-normal
break-words` junto de qualquer `max-w` (nunca mais a combinação
inválida); (2) criado o papel `content` (abaixo) para os casos em que o
valor precisa aparecer INTEIRO, numa linha só, mesmo quando varia bastante
em tamanho.

## Column Sizing (regra global, revisada em 2026-09-15)

**Regra:** colunas de `ResponsiveTable` declaram sua INTENÇÃO de largura
por um papel semântico — nunca `w-[137px]`/`min-w-[287px]` arbitrários
espalhados por tela, e nunca inferência automática a partir do texto do
header (o módulo declara, o Design System executa).

`src/lib/design-system/column-sizing.ts` define 5 papéis
(`ColumnWidth`), usados via `columns[].width` no `ResponsiveTable`:

| Papel | Comportamento | Uso típico |
|---|---|---|
| `compact` | `whitespace-nowrap`, sem min/max forçado — hugging de conteúdo, CRESCE | ID, contador, status curto (Badge), data/hora em formato fixo |
| `content` **(novo)** | Mecanicamente igual a `compact` (hugging, CRESCE), papel semântico distinto | Dado ESTRUTURADO que precisa aparecer inteiro: nome do cliente, "Nome Digisac", identificador legível — valores que variam bastante mas nunca podem ser cortados |
| `standard` | `min-w-[120px] max-w-[220px]`, QUEBRA se exceder o teto | Nomes curtos, loja, consultora, categoria |
| `wide` | `min-w-[240px] max-w-[420px]`, QUEBRA | Observação, comentário, endereço — narrativo secundário, potencialmente longo |
| `fill` | mesmo mínimo de `wide`, sem teto, `w-full`, QUEBRA — absorve o espaço restante | O campo narrativo PRINCIPAL da tabela (no máximo um por tabela, normalmente), também potencialmente ilimitado |

**Distinção `content` × `wide`/`fill` (não confundir):** conteúdo
ESTRUTURADO e finito que precisa aparecer inteiro numa linha só →
`content` (cresce, nunca quebra, nunca é cortado). Conteúdo NARRATIVO
potencialmente longo/ilimitado, onde quebra de linha é aceitável e
esperada → `wide`/`fill` (não crescem sem teto; quebram).

Valores calibrados contra a densidade/tipografia já aprovadas (SPC=B,
`text-sm`), não números universais — ver comentário do próprio
`column-sizing.ts` para a justificativa de cada mínimo/máximo. `width` é
opcional — uma coluna sem ele mantém o comportamento anterior (só
`className`), sem quebrar consumidores existentes.

**Geometria do sticky:** como a primeira coluna sticky é a MESMA célula
que participa do layout normal da tabela (só ganha `position: sticky`),
sua largura é sempre exatamente a largura real da coluna calculada pelo
navegador — cabeçalho, corpo e célula sticky nunca divergem, para
nenhum papel de largura, inclusive `content`.

Validado (`/chamados-finalizados` → "Ver agendamentos"): "Texto
agendamento" (`fill`) mediu 634px numa viewport de 1400px com 6 colunas,
"#" (`compact`) mediu 24px — a coluna narrativa principal absorve o
espaço disponível, as estruturadas ficam compactas. Comportamento
aplica-se à representação TABULAR (desktop) — o card mobile
(`renderMobileCard`) continua com layout próprio, natural, sem os papéis
de largura (`content` não afeta o mobile — ver
`column-sizing.test.ts`/`ResponsiveTable.tsx`).

## TABLE-PAGE-SIZE (regra global, aprovada em 2026-09-12)

**Regra:** listagens/tabelas de dados paginadas do sistema mostram no
máximo **20 registros por página** — valor oficial:
`TABLE_PAGE_SIZE` (`src/lib/design-system/pagination.ts`). Sem seletor de
10/25/50/100 como padrão geral — navegação simples e previsível (Anterior/
Próxima). Mesmo valor para desktop e mobile (mesma página, não busca
conjuntos diferentes por breakpoint). Não se aplica a tabelas estáticas
pequenas ou conteúdo meramente informativo embutido que não usa
paginação.

**Backend-enforced, não é corte no frontend:** a requisição paginada
precisa solicitar/retornar no máximo 20 registros — nunca "backend manda
500, frontend corta 20". `clampPageSize()` (mesmo módulo) garante isso
independente do que o cliente pedir: `Math.min(pedido, 20)`. Ver
`interaction-standards.md`, "Paginação de listagens", para o comportamento
completo (página 1 ao filtrar/limpar, etc.) e `components-e-patterns.md`
para como `/chamados-finalizados` aplica isso.

**Esclarecimento (2026-09-13, D-039) — payload paginado × processamento
interno do backend não são a mesma coisa.** O limite de 20 é sobre a
RESPOSTA final que o endpoint envia ao frontend para aquela página —
nunca sobre quanto o backend pode processar internamente antes de chegar
nesse resultado. Dois casos:

- **Errado:** a API busca 500 registros simples e o FRONTEND executa
  `array.slice(0, 20)` — isso é paginação mal implementada, viola a regra.
- **Correto:** o backend precisa consultar/processar um conjunto maior
  (de uma fonte externa, ou para agregar/agrupar/calcular/deduplicar
  antes de formar o resultado) e só DEPOIS aplica a paginação — a resposta
  que chega ao frontend continua limitada a 20. Isso é permitido, desde
  que exista motivo funcional real (não seja só uma paginação mal feita),
  o payload final continue limitado ao necessário, e não haja
  carregamento evitável.

Exemplo real, já implementado antes desta regra existir:
`/chamados-finalizados` (`src/lib/digisac/chamadosFinalizados.ts`) busca
um lote de até 200 tickets do Digisac (fonte externa) para conseguir
agregar por contato (cada contato pode ter vários tickets/agendamentos) —
só depois de agregar, a lista de contatos é paginada e a resposta HTTP
final (`paged`) é limitada a `TABLE_PAGE_SIZE`. O lote de 200 nunca chega
ao frontend inteiro; é insumo interno para montar a visão agregada.

## No accidental overlap (princípio global, adicionado em 2026-09-12)

**Regra:** conteúdo, texto, controles e ações não podem ocupar fisicamente
a mesma área de layout, salvo quando a sobreposição for explicitamente
parte do design aprovado. Em modal, dialog, drawer, card, page header,
toolbar, tabela e filtros, sobreposição acidental é bug — e não se
resolve só com `z-index` (`z-index` controla camadas; não corrige um
problema de espaço que não foi reservado).

Achada no piloto de `/chamados-finalizados` → "Ver agendamentos": o
cabeçalho do modal usava `position: sticky` + `z-50` sobre o botão fechar
(que não tinha `z-index` próprio, ou seja, `z-index: auto`/0). Como um
elemento posicionado com `z-index` explícito cria seu próprio contexto de
empilhamento e passa a pintar acima de irmãos com `z-index: auto`
independente da ordem no DOM, o header (com fundo branco sólido) pintava
por cima do botão `X`, sobrepondo-o visualmente em vez de só ficar atrás
dele na hierarquia visual.

**Solução estrutural — não é mais um hack de `z-index`/`padding`
reservando espaço "por fora":** o `Dialog` oficial
(`src/components/design-system/Dialog.tsx`) constrói o header como uma
LINHA FLEX: título/descrição em `min-w-0 flex-1` (encolhe, quebra linha)
e o botão fechar em `shrink-0`, **na mesma linha**, cada um com sua região
própria — geometricamente impossível o botão ficar coberto pelo título,
não importa o tamanho do texto. O header também sai da área de scroll
(`DialogBody` é quem rola; o header e o footer não), então não depende
de `position: sticky`/`z-index` para continuar visível — elimina a causa
raiz da disputa de camada. Testado com título curto, título muito longo
(quebra em várias linhas, empurra a altura do header, nunca passa por
baixo do X) e viewport mobile (375px) — sem sobreposição em nenhum caso
(medido via `getBoundingClientRect`, não só visualmente).

Vale para qualquer componente do DS que combine conteúdo de largura
variável com um controle de posição fixa/absoluta compartilhando a mesma
região — reserve o espaço do controle via layout (`flex`/`grid`), não via
`padding` arbitrário + `position: absolute` + `z-index`.

## Histórico da decisão de section colors (CLR=B / SEC=C)

Ver "Brand Foundation" no topo deste arquivo para o estado FINAL vigente
(section tones derivados da marca). Resumo do histórico, preservado por
rastreabilidade:

1. `CLR=B` (multi-matiz suave) e `SEC=C` (surface + acento + divisor)
   aprovados em 2026-09-12 — sem alternativas reapresentadas desde então.
2. Primeira composição concreta (sky/emerald/amber) coincidia
   literalmente com `info`/`success`/`warning` (D-038) — descartada.
3. Três alternativas experimentais neutras (`STN=A/B/C`) foram criadas
   para escolha do usuário (D-040) — **retiradas** quando o usuário optou
   por uma direção de MARCA em vez de uma paleta genérica (D-041).
4. Composição final: `section-1`=azul da marca, `section-2`=ciano da
   marca, `section-3`=amarelo da estrela — Brand Foundation, D-042.

Tokens estruturados para troca sem quebrar consumidores: nenhum
componente usa `blue`/`cyan`/`yellow` diretamente — todos recebem
`tone="section-N"` e resolvem via `SECTION_TONE_CLASSES`
(`section-tones.ts`); trocar o mapeamento de uma cor é uma alteração de
uma linha nesse arquivo, sem tocar `Section.tsx` nem nenhuma tela.

## Tipografia — TYP=B (aprovado)

Já é a escala usada hoje (`h1 text-xl sm:text-2xl font-bold`, corpo
`text-sm`) — formalizada como papéis semânticos em
`src/lib/design-system/typography.ts`:

| Papel | Classe | Uso |
|---|---|---|
| `pageTitle` | `text-xl font-bold tracking-tight text-slate-900 sm:text-2xl` | `<h1>` de página (`PageHeader`) |
| `sectionTitle` | `text-lg font-bold text-slate-900` | `<h2>` de seção |
| `cardTitle` | `text-base font-semibold text-slate-900` | Título dentro de um `Card` |
| `body` | `text-sm text-slate-700` | Texto de corpo |
| `secondaryBody` | `text-sm text-slate-500` | Descrição/subtítulo |
| `label` | `text-sm font-medium text-slate-700` | Label de campo |
| `helper` | `text-xs text-slate-500` | Texto de ajuda abaixo de um campo |
| `caption` | `text-xs text-slate-400` | Legenda pequena (ex. label de KPI) |
| `kpiValue` | `text-2xl font-bold text-slate-900` | Valor numérico de KPI |
| `eyebrow` | `text-xs font-semibold uppercase tracking-wider text-[#00A5E6]` | Categoria acima do título (`PageHeader`) |

Não existe token CSS separado para tipografia — a escala do Tailwind
(`text-xs`...`text-3xl`) já é o token; isto só nomeia as combinações
reutilizadas, para não repetir 4-5 classes por título em cada tela.

## Densidade / espaçamento — SPC=B (aprovado)

Também já é o padrão de hoje — sem token CSS novo (o espaçamento do
Tailwind, `p-1`...`p-8`/`gap-1`...`gap-8`, já É a escala oficial). Papéis
recomendados, por convenção (não impostos por componente):

| Contexto | Classe |
|---|---|
| Padding de card/seção | `p-4` (mobile) / `sm:p-6` (desktop) |
| Espaço vertical entre seções | `space-y-6` |
| Espaço vertical entre subseções | `space-y-4` |
| Gap de grid de campos | `gap-4` |
| Gap entre elementos inline (ícone+texto) | `gap-1.5` a `gap-2` |
| Altura mínima de alvo tátil (botão, input, item de lista) | `h-9` (36px) no desktop; considerar `min-h-11` (44px) em ações mobile-first |

## Filter layout (princípio global, adicionado em 2026-09-12)

**Regra:** dentro de uma área de filtros, os campos visíveis distribuem
TODA a largura disponível da linha — nunca ficam "buracos" de espaço
vazio quando há poucos campos (achado real do piloto de
`/chamados-finalizados`: 2 campos num grid de 2-3 colunas fixas deixavam
uma sobra grande no fim da linha, parecendo conteúdo faltando).

**Implementação (`FilterFieldGroup`):** flexbox — `flex flex-wrap
items-end gap-3` no container, cada campo envolvido em
`min-w-[220px] flex-1`. **Não é CSS Grid `auto-fit`/`minmax`** — foi a
primeira tentativa e foi descartada: `grid-template-columns:
repeat(auto-fit, minmax(220px, 1fr))` usa o mesmo número de colunas em
TODAS as linhas do grid (compartilham um único template), então uma
última linha incompleta (ex.: 5º campo sozinho, numa configuração de 4
por linha) fica com células vazias em vez de esticar — o mesmo problema
que a regra deveria resolver, só que na última linha em vez da única
linha. Flexbox resolve isso porque cada linha quebrada (`flex line`) faz
sua própria distribuição de `flex-grow`, independente das demais.

- **220px de largura mínima**, escolhida depois de checar os componentes
  reais do DS — abaixo disso o texto de um multi-select
  ("3 selecionada(s)") começa a truncar, e `Input`/`DateField` ficam
  apertados.
- **Desktop grande:** mais campos por linha (crescem juntos, `flex-1`).
- **Tablet/desktop menor:** menos campos por linha, sem quebra feia.
- **Mobile:** 1 campo por linha (nenhum cabe 2× 220px lado a lado abaixo
  de ~460px de largura útil).
- **Controle pequeno** (checkbox/switch/ação auxiliar): o *slot* ao redor
  dele participa do layout normalmente (recebe `min-w-[220px] flex-1`
  como qualquer campo); o controle em si não precisa esticar visualmente
  dentro do slot.
- Botões "Filtrar"/"Limpar" (`FilterPanel`) não são afetados por esta
  regra — continuam no tamanho do padrão de botão (`BTN=B`), não esticam
  junto com os campos.

## Surface do painel de filtros (ajuste, 2026-09-15)

**Regra:** a superfície base do `FilterPanel` tem separação visual sutil,
porém perceptível, em relação ao fundo da página (`--background`) — nunca
um contraste forte, nunca uma superfície escura, nunca uma mudança
chamativa de identidade.

Ajustado de `border-sky-100 bg-sky-50/40` para `border-sky-200
bg-sky-50/70` — mesma família de cor (ciano muito claro, já usado por
`section-2`/accents da marca), só uma opacidade maior. Antes, a
transparência alta (`/40`) deixava o painel quase se confundir com
`--background`, especialmente em telas com pouco conteúdo ao redor. Não é
um token novo, não muda radius/sombra/borda de nenhum outro componente —
é só a superfície neutra padrão do próprio `FilterPanel`. Continua a
identidade aprovada (página clara, azul dominante nas ações, cinza/branco
como base) — ver "Brand Foundation" acima.

## Layout / Page Shell (adicionado em 2026-09-11)

**Regra:** a página usa 100% da área útil disponível (já descontada a
Sidebar), com gutters laterais oficiais — não uma porcentagem fixa da
viewport, não um `max-width` pequeno arbitrário por tela.

| Contexto | Gutter | Breakpoint |
|---|---|---|
| Mobile | `16px` | `<640px` (sem prefixo) |
| Tablet | `24px` | `sm:` (`≥640px`) |
| Desktop | `32px` | `lg:` (`≥1024px`) |

Nenhum breakpoint novo foi criado — `sm`/`lg` já são os breakpoints
padrão do Tailwind já usados no resto do projeto.

### `PageContainer`

```tsx
import { PageContainer } from '@/components/design-system'

<PageContainer>
  <PageHeader ... />
  <FilterPanel ...>...</FilterPanel>
  <ResponsiveTable ... />
</PageContainer>
```

`src/components/LayoutWrapper.tsx` (não alterado) já envolve toda página
autenticada com `p-4 sm:p-6` (16px mobile / 24px a partir de 640px, sem
crescer no desktop) e já desloca o `<main>` pela largura real da Sidebar
(`pl-0 md:pl-[72px|260px]`) — por isso `PageContainer` **não** duplica a
compensação da Sidebar; ele só cancela o padding ambiente do
`LayoutWrapper` (`-mx-4 sm:-mx-6`) e reaplica os gutters oficiais
(`px-4 sm:px-6 lg:px-8`), incluindo o salto para 32px no desktop que o
wrapper atual não tinha.

**Sem `max-width` no `PageContainer`.** A largura total da página não
significa que todo componente interno precisa ficar esticado — ver
"FORM-PAGE-WIDTH" abaixo.

### Alinhamento interno

Em páginas de largura ampla, `PageHeader`, KPIs (`KpiSection`), filtros
(`FilterPanel`), tabs, alerts (`Alert`), cards (`Card`), tabela/listagem
(`ResponsiveTable`) e paginação são filhos diretos do `PageContainer`, sem
`max-width`/margem própria. Em uma página de formulário, `PageHeader` e as
sections compartilham o mesmo `FormPageContent`. Assim cada composição tem
um eixo intencional, sem alterar a largura do Page Shell.

### FORM-PAGE-WIDTH — conteúdo de formulário centralizado

`PageContainer` continua sempre em largura total. Quando uma página é
predominantemente de criação, edição, cadastro ou configuração e o
formulário não se beneficia da largura inteira, use `FormPageContent`: a
limitação é do **conteúdo**, nunca da página.

```tsx
<PageContainer>
  <FormPageContent>
    <PageHeader title="Editar perfil" />
    <FormSection title="Dados pessoais">...</FormSection>
  </FormPageContent>
</PageContainer>
```

`FormPageContent` é `w-full max-w-6xl mx-auto` (72rem/1152px). O limite
acomoda confortavelmente grids reais de duas e três colunas, labels,
ações e sections; abaixo dele o conteúdo ocupa 100% da largura disponível.
Em desktop largo as margens laterais ficam equilibradas; mobile e tablet
mantêm os gutters do `PageContainer`, sem overflow ou uma largura máxima
perceptível.

Não use em dashboards, tabelas extensas, listagens, grids densos ou telas
operacionais que ganham leitura com a largura ampla. Em páginas híbridas,
envolva somente o bloco de formulário — tabelas e outros blocos largos
continuam filhos diretos de `PageContainer`.

### Proibição

Uma tela não deve inventar `max-width`, `width: 80%`/`90%`, padding
lateral próprio ou container centralizado arbitrário quando
`PageContainer` já resolve o caso. Formulários elegíveis usam a capacidade
oficial `FormPageContent`; tabelas/listagens não recebem essa limitação.
O `PageContainer` nunca recebe `max-width`.

### Responsivo, não uma identidade separada

Não existe um "modo mobile" de layout — o mesmo `PageContainer` se
reorganiza pelos breakpoints padrão; os componentes internos
(`ResponsiveTable`, `MobileActionBar` etc.) já decidem sozinhos seu
comportamento por tamanho de tela.

## Lógica pura testável desta camada

`src/lib/design-system/typography.ts` é só constantes (sem teste
dedicado — não há lógica a testar). As demais decisões comportamentais
que também têm uma camada "foundation" de lógica pura (máscaras, datas)
estão documentadas em [interaction-standards.md](interaction-standards.md),
com testes em `src/lib/design-system/masks.test.ts` e `dates.test.ts`.

## Hierarquia de superfícies estruturadas

Cards e painéis com header estrutural usam header tonal sutil e corpo neutro.
`CardHeader` concentra o tom; `CardContent` e `CardFooter` permanecem neutros.
Não é regra para colorir cards sem separação real de conteúdo.

Sections decorativas consecutivas seguem `section-1 → section-2 → section-3`
em ciclo. `getSectionToneAt(index)` é a resolução canônica; significado
explícito de uma seção prevalece sobre o ciclo.
