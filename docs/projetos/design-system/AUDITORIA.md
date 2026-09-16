# Auditoria visual e técnica — Le Bébé App

Fase 1 do projeto Design System. Leitura direta do código-fonte, sem
nenhuma alteração. Cobre: foundations, componentes base (`src/components/ui/`),
`/pedidos-personalizados` em detalhe, e uma amostra representativa de outras
telas (dashboard, listagem/tabela, formulário/modal, Recebimento — só
visual, navegação/Sidebar, ícones).

## 1. Foundations já existentes (confirmado)

`src/app/globals.css` (Tailwind v4, sem `tailwind.config.*` — tema via
`@theme inline`):

- **Cor de marca:** `--primary: #00A5E6` (+ `--brand-secondary #3BBAE8`,
  `--brand-accent #FBF27B`). Token existe e está corretamente configurado.
- **Superfícies:** `--background #F7FAFC`, `--card #FFFFFF`,
  `--muted #F1F5F9` (= Tailwind `slate-100`), `--muted-foreground #475569`
  (= Tailwind `slate-600`).
- **Radius:** `--radius: 0.75rem` (12px), com escala derivada
  `--radius-sm/md/lg/xl/2xl/3xl/4xl`.
- **Modo escuro:** `.dark { ... }` já definido no CSS, mas **nenhum toggle
  de tema foi encontrado** — não confirmado se está em uso em produção.
- **Paleta categórica:** `--chart-1..5` já existe (para gráficos), mas não é
  reaproveitada como paleta de "tags"/seções coloridas em nenhum lugar
  auditado.
- **Sombra:** só uma sombra utilitária customizada, `.card-shadow`
  (`box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`),
  usada nos KPI cards do dashboard. A maioria dos cards do sistema usa
  `shadow-sm` (utilitário nativo do Tailwind) em vez dela — duas soluções de
  "elevação leve" convivendo.

## 2. Componentes base existentes (confirmado)

`src/components/ui/`: `button.tsx`, `input.tsx`, `select.tsx`, `dialog.tsx`,
`table.tsx`, `tabs.tsx`, `checkbox.tsx`, `multi-select.tsx`, `tooltip.tsx`,
`skeleton.tsx`, `popover.tsx`, `calendar.tsx`, `collapsible.tsx` — estilo
shadcn/ui ("new-york"), `cva` + Radix UI + `cn()` (`clsx` + `tailwind-merge`).

**Ausências confirmadas (nenhum arquivo encontrado):**
- `Card` — não existe. Cada tela reimplementa `rounded-2xl border bg-white p-4/6 shadow-sm` à mão.
- `Badge` — não existe. Pelo menos 3 implementações locais divergentes
  (`chamados-finalizados`, `recebimento`, `pedidos-personalizados`), com
  tons ligeiramente diferentes para o mesmo significado (ex. "erro":
  `red-700/bg-red-50/border-red-200` num lugar, `text-red-800 bg-red-100
  border-red-300` noutro).
- `Alert`/`Callout` — não existe. Cada tela recria banners de
  sucesso/aviso/erro à mão, ora com borda fina, ora com fundo cheio.
- `Label` (Radix) — não confirmado em uso; labels são `<label>` HTML puro.
- `RadioGroup` — não existe; onde precisou de opção binária/exclusiva
  (`CardTapete`), foi reimplementado com botões customizados.
- `Pagination` — não existe como componente; existe como função utilitária
  compartilhada (`paginasVisiveisLebebeExclusive`), mas cada tela desenha o
  HTML da paginação à mão.

**Inconsistência encontrada no próprio `ui/`:** `checkbox.tsx` e
`multi-select.tsx` usam cores Tailwind hardcoded (`border-slate-200`,
`bg-slate-900`, `text-slate-400` etc.) em vez dos tokens do tema
(`--border`, `--primary`, `--muted-foreground`) que os demais componentes
(`button.tsx`, `input.tsx`, `select.tsx`) já usam corretamente. Ou seja, a
inconsistência de "cor hardcoded vs. token" já existe dentro da própria
pasta de componentes base, não só nas páginas.

## 3. `/pedidos-personalizados` — avaliação dedicada

Auditoria completa em `src/app/pedidos-personalizados/**` e
`src/components/pedidos-personalizados/*` (10 arquivos, ~1220 linhas só no
componente de gestão). Ver anexo completo no histórico da conversa/relatório
do agente de auditoria — resumo abaixo.

### O que funciona bem / bons candidatos a padrão global

- **Padrão de campo de formulário** (label + `Input`/`Select` +
  `aria-invalid`/`aria-describedby` + erro em `role="alert"` logo abaixo) —
  consistente, acessível, repetido dezenas de vezes.
- **Hierarquia de raio por nível de aninhamento** (`rounded-2xl` → seção de
  1º nível; `rounded-xl` → subseção; `rounded-lg`/`rounded-full` →
  elementos pequenos) — leitura visual clara e consistente.
- **`min-h-11` (44px) como altura mínima tátil** em botões/inputs/itens —
  boa prática de acessibilidade já aplicada de forma disciplinada.
- **Contador de caracteres ao lado do label** em campos limitados
  (`{valor.length}/30`).
- **Paginação com reticências** para intervalos grandes — lógica já
  compartilhada como utilitário.
- **Padrão "tabela no desktop, cards no mobile"** (usado no catálogo de
  produtos do Lebebe Exclusive) — é a solução correta para tabelas em
  telas pequenas, mas hoje só é aplicada em 1 de 2 tabelas da própria
  pasta.
- Uso consistente de `aria-live`, `role="alert"`/`role="status"`,
  `aria-pressed` em estados dinâmicos.

### O que é "gosto local" — não deve virar padrão automaticamente

- Cor de marca escrita como hex literal dezenas de vezes
  (`bg-[#00A5E6]`, `text-[#00A5E6]`, `ring-[#00A5E6]`) em vez do token.
- Gradiente animado do botão "avançar status" — decoração de uma ação de
  negócio específica, não um padrão de botão geral.
- Gradientes tonais diferentes por modal (`sky→indigo`, `amber→orange`,
  `slate→sky`) sem critério aparente — parece decisão pontual, não regra.
- Fundo em gradiente de 3 cores só na seção de Filtros — nenhuma outra tela
  do sistema (nem o próprio `FormularioLebebeExclusive`) repete isso.
- Dois modais "manuais" fora do componente `Dialog` (catálogo via `iframe`,
  zoom de cores), cada um com cor de overlay diferente.
- Botões de resposta binária customizados em vez de um `RadioGroup`.
- Bloco `<pre>` de fundo escuro na prévia de mensagem — único elemento
  "dark" da tela, correto para o caso de uso, não um padrão de superfície.

### Inconsistências internas já dentro da própria pasta

Duas barras de ação fixas parecidas mas diferentes; duas tabelas de itens
com tratamento mobile diferente (uma com cards, outra só scroll horizontal);
badge "Produto SGI" reimplementado 3 vezes no mesmo arquivo; padding de
seção variando entre `sm:p-5` e `sm:p-6` sem motivo aparente de conteúdo;
`main` da página remontado com `max-w`/padding diferentes entre a listagem
e o formulário "novo" da mesma feature.

**Conclusão:** `/pedidos-personalizados` tem bons fundamentos de
acessibilidade e hierarquia visual, mas não é internamente 100% consistente
— não deve ser copiada literalmente. As alternativas da Fase 2 usam
características dela (radius, hierarquia de container, padrão de campo)
como **uma** das 3 opções em cada decisão, nunca como padrão pré-definido.

## 4. Outras telas — achados principais

- **Dashboard/KPIs**: grid `2→4→7` colunas, card `rounded-2xl border p-4
  card-shadow`, valor `text-2xl font-bold` com cor condicional hardcoded
  (`text-green-600`/`text-orange-500`/`text-red-600`). Tabs com estado ativo
  em `bg-[rgba(0,165,230,0.15)]` hardcoded. Tabela usa `<table>` HTML crua
  (não o componente `Table` do design system) — 1ª inconsistência de
  primitivo entre telas.
- **Listagem/tabela** (`chamados-finalizados` como melhor exemplo): usa o
  componente `Table` do shadcn corretamente; badge local reimplementado;
  paginação com `Button variant="outline" size="sm"` + ícones; scroll
  horizontal com colunas `sticky` para tabelas largas — nenhuma tela audita
  fora de `/pedidos-personalizados` usa "cards no mobile" para listagem
  tabular; a estratégia dominante no resto do sistema é scroll horizontal.
- **Formulário/modal** (Ficha de Atendimento Presencial): stepper linear de
  progresso com `bg-sky-600` (cor diferente de `#00A5E6`/`--primary` usada
  alhures — inconsistência de cor de marca dentro do próprio app); seções
  com `rounded-md` (menor que o `rounded-2xl` predominante); validação em
  nível de seção (não por campo individual); trio de cores
  vermelho/âmbar/esmeralda para erro/aviso/sucesso, mas com tons
  Tailwind diferentes dos usados em outras telas para o mesmo conceito.
- **Recebimento** (só visual, fluxo crítico não analisado quanto à lógica):
  header com ícone + `text-slate-800` (outras telas usam `text-slate-900`
  para h1 — inconsistência leve); abas customizadas fora do componente
  `Tabs`; badges de status com o mesmo vocabulário verde/âmbar/vermelho;
  timer compacto em pílula cinza com fonte `font-mono`; cards de item com
  barra de progresso semáforo (verde/âmbar/cinza) reimplementada
  localmente — o mesmo padrão de "barra de progresso por percentual"
  aparece em pelo menos 3 lugares do sistema, sempre reescrito.
- **Navegação/Sidebar**: sidebar fixa, 260px aberta / 72px colapsada no
  desktop, **sobrepõe o conteúdo no mobile sem backdrop** (não há
  hambúrguer nem drawer com overlay — controle é sempre `ChevronLeft`/
  `ChevronRight`). Topbar hoje está praticamente vazio (sem avatar, sem
  notificações, sem busca — só o botão de expandir sidebar no mobile).
  Estado ativo do item de menu usa `rgba(0,165,230,.10)`/`#00A5E6`
  hardcoded.
- **Ícones**: `lucide-react` é o padrão dominante (48 de 117 arquivos
  `.tsx`). Ainda assim há ~10 arquivos com SVG desenhado manualmente,
  incluindo pelo menos um caso confirmado de reimplementação de um ícone
  que o lucide já oferece pronto (`Info`, em `CardsEstatisticasDigisac.tsx`).

## 5. Cores hardcoded vs. tokens — achado mais acionável

Levantamento por grep em todo `src/app/**/*.tsx` e `src/components/**/*.tsx`
(117 arquivos `.tsx`):

| Padrão | Ocorrências / arquivos |
|---|---|
| `bg-slate-*` / `text-slate-*` | 409 / 1743 ocorrências — 65 arquivos (56% do total) |
| `bg-gray-*` / `border-gray-*` | 19 / 28 ocorrências — 9 arquivos |
| `bg-blue-*` / `text-blue-*` | 42 / 66 ocorrências — 21 arquivos |
| `#00A5E6` (hex da marca hardcoded) | 28 arquivos |
| `bg-primary` / `text-primary` (classe de token) | apenas 3 arquivos |

Achados-chave:

1. **A cor de marca quase não passa pelos tokens.** `--primary` está
   configurado corretamente em `globals.css`, mas 28 arquivos escrevem
   `#00A5E6`/`rgba(0,165,230,...)` direto no JSX contra só 3 que usam
   `bg-primary`/`text-primary`. Maior oportunidade de padronização de baixo
   risco visual (mesma cor, só trocando a forma de escrever).
2. **`slate-100`/`slate-600` já coincidem exatamente** com
   `--muted`/`--muted-foreground`, mas nenhuma tela usa as classes
   semânticas — todas escrevem a paleta Tailwind crua.
3. **Duas paletas de cinza convivem** (`slate` predominante, `gray` em
   ~9 arquivos, principalmente telas de auth e superadmin) sem critério
   aparente.
4. **`blue-*` parece ser uma "segunda cor de destaque" informal** (badges de
   "finalizado", NF), sem clareza se é intencional ou ad-hoc por tela.
5. **Radius varia por tela** sem regra documentada: `rounded-md` (Ficha de
   Atendimento) vs. `rounded-xl`/`rounded-2xl` (dashboard, listagens,
   pedidos personalizados).

## 6. Classificação resumida dos padrões levantados

| Padrão | Classificação |
|---|---|
| Token de cor de marca (`--primary`) | Consistente na intenção, **inconsistente na aplicação** — candidato a token reforçado |
| `slate-100`/`slate-600` como "muted" | Consistente visualmente, **candidato a virar classe semântica** (`bg-muted`) |
| Campo de formulário (label+input+erro acessível) | **Bom candidato a componente `FormField` oficial** |
| Hierarquia de radius por nível | **Bom candidato a pattern documentado** |
| `min-h-11` em alvos de toque | **Boa prática a preservar como regra** |
| Badge de status | **Inconsistente/duplicado** — candidato forte a componente `Badge` |
| Alert/banner de feedback | **Inconsistente/duplicado** — candidato forte a componente `Alert` |
| Card/container | **Duplicado em cada tela** — candidato forte a componente `Card` |
| Tabela em mobile | **Inconsistente**: scroll horizontal domina; "cards no mobile" é exceção isolada e correta — candidata a virar regra, não exceção |
| Sidebar mobile sem backdrop/hambúrguer | **Específico da implementação atual** — candidato a revisão futura (fora do escopo desta tarefa) |
| SVG manual duplicando ícone lucide existente | **Específico de página**, não deveria ser replicado |

## 7. Acessibilidade e responsividade — observações que alimentam a Fase 2

- Contraste: paleta atual (slate-900 sobre branco, `#00A5E6` sobre branco)
  tende a ter contraste adequado para texto grande/ações; badges com tons
  claros (`bg-*-50/100` + `text-*-700/800`) geralmente passam AA para texto
  pequeno, mas isso não foi medido pixel a pixel nesta auditoria.
- Foco visível: `button.tsx`/`input.tsx`/`select.tsx` já implementam
  `focus-visible:ring-*` de forma consistente — boa base para as
  alternativas da Fase 2.
- Áreas de toque: `min-h-11` (44px) já é praticamentre um padrão de fato em
  `/pedidos-personalizados`; não confirmado em todas as outras telas.
- Mobile: a estratégia dominante para tabelas é scroll horizontal (não
  reflow real); a Sidebar mobile sobrepõe conteúdo sem overlay/backdrop.
  Ambos os pontos alimentam alternativas explícitas na Fase 2 (decisões
  `TBL` e a nota sobre navegação, respectivamente).

## 8. O que esta auditoria NÃO cobriu (fora do escopo)

- Medição formal de contraste (WCAG AA/AAA) pixel a pixel.
- Toda e qualquer tela do sistema (34 rotas existem; uma amostra
  representativa foi lida, não a totalidade).
- Qualquer avaliação da lógica de negócio do Recebimento (timer, volumes,
  divergências) — só o visual/estrutural foi observado, por restrição
  explícita do escopo.
- Performance, SEO, ou testes automatizados de UI.
