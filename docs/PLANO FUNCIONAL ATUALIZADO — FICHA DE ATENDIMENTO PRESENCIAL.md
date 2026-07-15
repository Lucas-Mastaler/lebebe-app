# PLANO FUNCIONAL ATUALIZADO — FICHA DE ATENDIMENTO PRESENCIAL

## 1. Objetivo do módulo

Criar um novo módulo no Le Bébé App para registrar os atendimentos presenciais realizados nas lojas.

O módulo terá três áreas principais:

1. **Ficha de Atendimento**
2. **Registros de Atendimentos**
3. **Clientes**

O preenchimento da ficha será prioritariamente realizado pelo celular durante o atendimento. Por isso, a interface deverá ser extremamente simples, rápida e orientada a toque.

As telas de registros e clientes também deverão funcionar em celular, mas serão planejadas principalmente para uso em desktop, com filtros, tabelas, histórico e análises.

---

# 2. Controle de acesso e perfis

## 2.1 Utilizar a estrutura existente

Não deverá ser criado um novo sistema paralelo de permissões.

O módulo deverá utilizar:

* os perfis já existentes;
* a tela atual de usuários;
* a lógica atual de liberação de telas e módulos;
* o campo já existente de filial ou filiais vinculadas ao usuário;
* as validações atuais de acesso no frontend e backend.

Cada nova tela do módulo deverá ser disponibilizada na configuração de usuários já existente.

Exemplos de telas configuráveis:

* Ficha de Atendimento;
* Registros de Atendimentos;
* Clientes;
* Histórico de Alterações;
* Relatórios futuros.

## 2.2 Perfis envolvidos

Os principais perfis inicialmente serão:

* Consultora;
* Supervisora loja;
* Gestão;
* Superadmins.

Os nomes e valores reais dos perfis e roles deverão ser confirmados no código antes da implementação.

## 2.3 Filial da consultora

A filial será obtida a partir do campo já salvo no perfil do usuário.

### Usuário com uma filial ativa

A filial será preenchida automaticamente.

Não será necessário selecionar a unidade a cada atendimento.

### Usuário com mais de uma filial ativa

Antes de iniciar ou salvar o atendimento, a usuária deverá selecionar qual unidade está utilizando naquele momento.

A seleção deverá ser apresentada como botões ou cartões grandes, e não como uma lista suspensa pequena.

Exemplo:

```text
Em qual unidade você está atendendo?

[ BIGORRILHO ]

[ HAUER ]

[ PORTÃO ]
```

A filial selecionada será aplicada somente ao atendimento atual.

## 2.4 Seleção da consultora responsável

### Perfil Consultora

* A consultora responsável será automaticamente o usuário autenticado.
* Ela não poderá selecionar outra consultora.
* Ela não poderá transferir o atendimento para outra consultora.
* O campo poderá aparecer apenas como informação, sem possibilidade de edição.

### Perfil Supervisora loja

A supervisora poderá selecionar:

* qualquer consultora permitida;
* qualquer filial permitida;
* a consultora responsável pelo atendimento;
* a filial em que o atendimento ocorreu.

A seleção deverá respeitar as permissões e os vínculos existentes no sistema.

### Gestão e Superadmins

Poderão possuir acesso ampliado conforme a configuração atual de usuários e telas.

---

# 3. Estrutura geral do módulo

## 3.1 Ficha de Atendimento

Tela mobile-first para:

* localizar ou cadastrar uma cliente;
* registrar dados da criança;
* registrar interesses;
* registrar produtos procurados;
* registrar observações;
* indicar se houve fechamento;
* salvar rascunhos;
* concluir o atendimento.

## 3.2 Registros de Atendimentos

Tela para:

* visualizar atendimentos;
* consultar rascunhos;
* aplicar filtros;
* editar registros autorizados;
* consultar fechamentos;
* acessar o histórico de alterações;
* abrir a página consolidada da cliente.

## 3.3 Clientes

Tela consolidada com:

* cadastro da cliente;
* telefone;
* parentesco;
* crianças vinculadas;
* atendimentos;
* interesses;
* observações;
* fechamentos;
* lançamentos;
* linha do tempo comercial.

---

# 4. Regra principal de experiência de uso

A Ficha de Atendimento deverá ser extremamente fácil de utilizar pelo celular.

## 4.1 Prioridades da interface

* botões grandes;
* cartões de seleção;
* poucas perguntas por tela;
* uma ação principal por etapa;
* evitar listas suspensas;
* evitar tabelas;
* teclado correto para cada campo;
* campos com boa altura para toque;
* textos curtos;
* confirmação visual após cada seleção;
* botão de continuar fixo na parte inferior;
* possibilidade de voltar sem perder dados;
* salvamento automático;
* funcionamento mesmo após fechamento acidental do navegador;
* indicadores claros de campo obrigatório;
* carregamentos visíveis;
* mensagens simples de erro.

## 4.2 Desktop

A Ficha de Atendimento deverá funcionar também no desktop, mas preservando o formato simples.

As telas de Registros e Clientes poderão utilizar:

* tabelas;
* painéis laterais;
* filtros avançados;
* múltiplas colunas;
* visualizações detalhadas.

---

# 5. Fluxo da Ficha de Atendimento

## Etapa 1 — Definição da unidade e consultora

Campos apresentados conforme o perfil:

### Consultora

* filial automática, caso possua apenas uma;
* seleção da filial, caso possua mais de uma;
* consultora automática e bloqueada.

### Supervisora loja

* seleção da filial;
* seleção da consultora responsável.

## Etapa 2 — Localizar ou cadastrar cliente

Busca por:

* nome;
* telefone;
* parte do nome;
* telefone com ou sem formatação.

A consultora poderá:

* selecionar uma cliente existente;
* cadastrar uma nova cliente;
* continuar com uma cliente encontrada automaticamente pelo telefone.

## Etapa 3 — Dados da cliente

* nome da cliente;
* telefone;
* parentesco da criança.

## Etapa 4 — Dados da criança

* situação;
* data prevista, quando estiver em gestação;
* idade, quando já tiver nascido;
* nome;
* sexo;
* adicionar outra criança.

## Etapa 5 — Interesses

* departamentos;
* produtos de interesse.

## Etapa 6 — Resultado do atendimento

* houve fechamento;
* principais motivos;
* número do lançamento, quando necessário.

## Etapa 7 — Observações

* observações sobre o atendimento.

## Etapa 8 — Revisão

Resumo completo antes de concluir.

## Etapa 9 — Finalização

Ações:

* concluir atendimento;
* continuar depois;
* retornar e corrigir.

---

# 6. Identificação e cadastro da cliente

## 6.1 Nome da cliente

Campo obrigatório.

Exemplo:

`Mariana Souza`

## 6.2 Telefone

Campo opcional, mas deve ser incentivado visualmente.

O telefone será a principal informação para:

* localizar a cliente;
* evitar duplicidade;
* relacionar atendimentos;
* localizar fechamentos posteriores;
* relacionar contatos do Digisac;
* relacionar dados da Inteligência Comercial.

Texto de apoio sugerido:

`O telefone permite localizar o histórico desta cliente e relacionar futuras compras.`

## 6.3 Parentesco da criança

Campo abaixo do nome da cliente.

Seleção preferencialmente por botões ou cartões.

Opções iniciais:

* Mãe;
* Pai;
* Avó;
* Avô;
* Tia;
* Tio;
* Irmã;
* Irmão;
* Madrinha;
* Padrinho;
* Amiga;
* Amigo;
* Outro.

Caso seja selecionado `Outro`, poderá aparecer um campo curto para especificação.

O campo antigo `Nome da mãe` deverá ser removido.

O cadastro da cliente deverá conter apenas:

* nome da cliente;
* telefone;
* parentesco em relação à criança.

## 6.4 Vinculação automática pelo telefone

Ao digitar o telefone:

1. O sistema normaliza o número.
2. Procura uma cliente existente.
3. Caso encontre correspondência exata, vincula o atendimento à cliente existente.
4. Não cria uma duplicidade.
5. Exibe claramente qual cliente foi localizada.

Mensagem sugerida:

`Este telefone já está vinculado a Mariana Souza. O atendimento será adicionado ao histórico desta cliente.`

A consultora poderá visualizar o cadastro antes de continuar.

## 6.5 Identificação técnica

O telefone normalizado será o principal identificador de negócio, mas não deverá ser a chave primária real da tabela.

Estrutura conceitual:

* ID interno imutável;
* telefone informado;
* telefone normalizado;
* status do cadastro.

Isso permite corrigir ou trocar o telefone no futuro sem quebrar todos os vínculos.

---

# 7. Dados da criança

O atendimento poderá possuir uma ou mais crianças.

## 7.1 Situação da criança

Opções:

* Gestação;
* Já nasceu;
* Presente para outra pessoa;
* Ainda não informado.

## 7.2 Gestação

Quando selecionado `Gestação`, mostrar:

### Data prevista de nascimento

Campo de data.

## 7.3 Criança já nascida

Quando selecionado `Já nasceu`, mostrar:

### Idade da criança

A idade será preenchida utilizando:

1. valor;
2. unidade.

### Unidade

Opções em botões:

* Meses;
* Anos.

### Valores permitidos

Se a unidade for `Meses`:

* mínimo: 1;
* máximo: 11.

Se a unidade for `Anos`:

* mínimo: 1;
* máximo: 6.

A interface poderá mostrar botões numéricos grandes.

Exemplo para meses:

```text
Quantos meses?

[ 1 ] [ 2 ] [ 3 ] [ 4 ]

[ 5 ] [ 6 ] [ 7 ] [ 8 ]

[ 9 ] [ 10 ] [ 11 ]
```

Exemplo para anos:

```text
Quantos anos?

[ 1 ] [ 2 ] [ 3 ]

[ 4 ] [ 5 ] [ 6 ]
```

Não será necessário registrar a data exata de nascimento.

## 7.4 Nome da criança

Campo opcional.

## 7.5 Sexo da criança

Opções:

* Menina;
* Menino;
* Ainda não informado;
* Prefere não informar.

## 7.6 Mais de uma criança

Botão:

`+ Adicionar outra criança`

Cada criança terá seus próprios dados.

---

# 8. Departamentos de interesse

A consultora poderá selecionar vários departamentos.

Opções:

* P. PESADA;
* MÓVEIS;
* P. LEVE;
* ENXOVAL;
* DECORAÇÃO;
* ROUPINHAS.

A seleção deverá utilizar cartões ou botões grandes.

Exemplo:

```text
Quais departamentos interessaram à cliente?

[ P. PESADA ]    [ MÓVEIS ]

[ P. LEVE ]      [ ENXOVAL ]

[ DECORAÇÃO ]    [ ROUPINHAS ]
```

---

# 9. Produtos de interesse

## 9.1 Primeira versão

Produtos de interesse serão registrados em um campo simples de escrita livre.

A consultora poderá digitar:

* nome do produto;
* frase curta;
* combinação de produto e característica;
* modelo ou marca, caso deseje.

Exemplos:

* Carrinho Salsa 4;
* Berço Formare branco;
* Cômoda com porta;
* Quarto completo em madeira;
* Bebê conforto Tulip.

## 9.2 Comportamento do campo

Ao pressionar:

* Enter;
* retorno;
* botão de adicionar;

o conteúdo digitado deverá se transformar em um item visual.

Exemplo:

```text
Produtos de interesse

[ Carrinho Salsa 4 × ]

[ Berço Formare branco × ]

[ Digite outro produto... ]
```

Cada item poderá ser removido antes de concluir o atendimento.

O campo não terá inicialmente:

* busca em catálogo;
* marca separada;
* modelo separado;
* SKU;
* departamento obrigatório;
* validação com o SGI.

O objetivo inicial é permitir registro rápido e flexível.

---

# 10. Observações sobre o atendimento

Campo de texto livre:

`Observações sobre esse atendimento`

O campo será opcional e poderá conter:

* dúvidas da cliente;
* preferências;
* faixa de orçamento;
* cores desejadas;
* objeções;
* prazo de decisão;
* produtos comparados;
* necessidade de conversar com outra pessoa;
* intenção de retorno;
* outras informações comercialmente relevantes.

O campo deverá:

* aceitar várias linhas;
* preservar quebras de linha;
* possuir limite de caracteres;
* funcionar bem no celular;
* ser salvo automaticamente no rascunho.

---

# 11. Resultado do atendimento

## 11.1 Houve fechamento?

Opções:

* Sim;
* Não;
* Ainda em negociação.

A seleção deverá utilizar botões grandes.

## 11.2 Principais motivos para fechamento ou não fechamento

Campo obrigatório.

O título será alterado conforme a resposta anterior.

### Quando houve fechamento

Mostrar:

`Principais motivos para o fechamento`

### Quando não houve fechamento

Mostrar:

`Principais motivos para o não fechamento`

### Quando ainda estiver em negociação

Mostrar:

`Principais fatores que influenciam a decisão`

A consultora poderá selecionar mais de um motivo.

## 11.3 Opções sugeridas

Opções gerais:

* Preço;
* Prazo de entrega;
* Produto disponível;
* Produto indisponível;
* Qualidade do produto;
* Design ou aparência;
* Cor ou acabamento;
* Tamanho ou medidas;
* Condição de pagamento;
* Desconto;
* Brinde;
* Atendimento;
* Confiança na loja;
* Variedade de produtos;
* Necessidade imediata;
* Comparação com concorrente;
* Precisa conversar com outra pessoa;
* Ainda está pesquisando;
* Sem orçamento no momento;
* Vai aguardar mais perto do nascimento;
* Indecisão entre produtos;
* Frete;
* Montagem;
* Outro.

Caso `Outro` seja selecionado, mostrar um campo curto de texto.

## 11.4 Melhor organização visual

Para não mostrar opções demais em uma única tela, os motivos podem ser agrupados:

### Produto

* qualidade;
* design;
* cor;
* tamanho;
* disponível;
* indisponível;
* variedade.

### Condição comercial

* preço;
* desconto;
* pagamento;
* brinde;
* frete;
* montagem.

### Prazo e necessidade

* prazo de entrega;
* necessidade imediata;
* vai aguardar;
* ainda pesquisando.

### Decisão

* concorrente;
* conversar com outra pessoa;
* sem orçamento;
* indecisão;
* confiança na loja;
* atendimento.

A consultora poderá expandir os grupos ou visualizar opções em cartões.

---

# 12. Número do lançamento

## 12.1 Obrigatoriedade

Se `Houve fechamento = Sim`, o número do lançamento será obrigatório.

O atendimento não poderá ser concluído como fechado sem essa informação.

## 12.2 Validação

O campo deverá aceitar apenas:

* números;
* valor mínimo: 1;
* valor máximo: 999999;
* no máximo seis dígitos.

Exemplos válidos:

* `1`
* `456`
* `19876`
* `999999`

Exemplos inválidos:

* `0`
* `1000000`
* `ABC123`
* `12-34`
* números negativos.

O campo deverá utilizar teclado numérico no celular.

---

# 13. Rascunho e proteção contra perda de dados

## 13.1 Salvamento automático

A Ficha de Atendimento deverá salvar automaticamente o que for preenchido.

O salvamento poderá ocorrer:

* ao sair de um campo;
* ao avançar de etapa;
* ao selecionar uma opção;
* em intervalos controlados;
* antes de fechar ou atualizar a página.

## 13.2 Cache local

Além do salvamento no banco, deverá existir um cache local no navegador.

O cache servirá para recuperar informações quando:

* a internet cair;
* a página for atualizada;
* o navegador for fechado;
* o aplicativo for fechado;
* o celular bloquear;
* o salvamento no banco falhar temporariamente.

Quando a conexão retornar, o sistema deverá tentar sincronizar o rascunho.

Deverá haver cuidado para não criar dois rascunhos do mesmo atendimento.

## 13.3 Rascunho no banco

Assim que informações mínimas forem preenchidas, o sistema poderá criar um registro com status:

`rascunho`

O rascunho ficará disponível na tela de Registros.

## 13.4 Destaque visual

O rascunho deverá aparecer de forma muito evidente.

Exemplo:

```text
RASCUNHO

Mariana Souza
Iniciado hoje às 14:35
Preenchimento incompleto

[ Continuar preenchendo ]
```

O status não deve depender somente de cor. Deve conter o texto explícito `RASCUNHO`.

## 13.5 Prazo do rascunho

O rascunho terá validade de cinco dias.

Após completar cinco dias sem conclusão:

* será excluído permanentemente do banco;
* deixará de aparecer no sistema;
* não será convertido em atendimento;
* o cache local correspondente também deverá ser removido quando possível.

## 13.6 Aviso de expiração

Antes da exclusão, poderá aparecer:

`Este rascunho será excluído em 1 dia.`

Na listagem, deverá ser possível visualizar:

* data de criação;
* última atualização;
* prazo restante;
* botão para continuar.

## 13.7 Exclusão automática

A exclusão dos rascunhos vencidos deverá ocorrer no backend.

Não deve depender apenas de a consultora abrir a tela.

O método técnico exato deverá ser definido após validar a infraestrutura atual do projeto.

---

# 14. Status do atendimento

Status sugeridos:

* Rascunho;
* Concluído;
* Cancelado, caso essa opção seja aprovada;
* Excluído por expiração, somente para auditoria técnica se necessário.

O rascunho não deverá entrar em:

* indicadores de atendimentos concluídos;
* análise de conversão;
* relatórios gerenciais;
* total de clientes atendidos.

---

# 15. Edição do atendimento

## 15.1 Consultora

A consultora poderá editar os próprios atendimentos concluídos durante três dias após a conclusão.

Após esse prazo:

* poderá visualizar;
* não poderá editar;
* poderá incluir fechamento posterior, conforme regra específica;
* não poderá alterar dados originais do atendimento.

## 15.2 Supervisora loja, Gestão e Superadmins

Após o prazo de três dias, poderão editar:

* Supervisora loja;
* Gestão;
* usuários com role `superadmins`.

A permissão real deverá utilizar os nomes e estruturas existentes no sistema.

## 15.3 Histórico obrigatório

Toda alteração deverá registrar:

* atendimento;
* usuário que alterou;
* perfil ou role;
* data e horário;
* campo alterado;
* valor anterior;
* valor novo;
* origem da alteração;
* motivo, caso seja solicitado.

Exemplo:

`15/07/2026 10:42 — Supervisora Ana alterou a filial de Hauer para Portão.`

Nenhuma edição deverá apagar o histórico anterior.

---

# 16. Fechamento posterior do atendimento

## 16.1 Problema comercial

Uma cliente pode:

1. realizar um atendimento presencial;
2. não fechar naquele momento;
3. continuar o contato pelo Digisac;
4. concluir a compra posteriormente;
5. ser atendida por outra consultora ou unidade.

O sistema precisa registrar esse fechamento sem alterar indevidamente o atendimento original.

## 16.2 Solução recomendada

Criar uma estrutura separada de **Fechamentos do Atendimento**.

O atendimento registra o que aconteceu naquele momento.

O fechamento registra quando e como ocorreu a venda.

Assim, um atendimento pode ter:

* nenhum fechamento;
* um fechamento posterior;
* mais de um fechamento, caso haja compras separadas relacionadas ao mesmo atendimento.

## 16.3 Botão no atendimento

Na visualização do atendimento, incluir:

`+ Incluir fechamento`

Esse botão poderá ser utilizado mesmo após os três dias, porque incluir um fechamento não significa editar o atendimento original.

A permissão do botão deverá ser definida pela configuração de acesso do módulo.

## 16.4 Campos do fechamento

### Filial

* preenchida automaticamente conforme o usuário;
* alterável conforme as permissões;
* supervisora poderá selecionar qualquer filial permitida.

### Data do fechamento

* preenchida inicialmente com a data atual;
* poderá ser alterada para a data real da venda;
* não poderá aceitar uma data futura;
* poderá ter limites conforme a regra de negócio.

### Consultora responsável pelo fechamento

* consultora comum: usuário autenticado;
* supervisora: poderá selecionar outra consultora;
* gestão ou superadmin: conforme permissão.

### Canal de fechamento

Opções:

* Presencial;
* Digisac.

Futuramente poderão ser adicionados:

* Telefone;
* Site;
* Instagram;
* Outro.

### Número do lançamento

Obrigatório.

Validações:

* apenas números;
* mínimo 1;
* máximo 999999;
* no máximo seis dígitos.

### Observações do fechamento

Campo livre e opcional.

Exemplos:

* cliente retornou após comparar os produtos;
* fechamento realizado pelo Digisac;
* comprou apenas parte dos produtos apresentados;
* fechamento feito por outra consultora;
* cliente aguardou disponibilidade.

## 16.5 Exibição no atendimento

O atendimento deverá mostrar uma seção:

### Fechamentos relacionados

Exemplo:

```text
FECHAMENTO

Data: 18/07/2026
Canal: Digisac
Filial: Bigorrilho
Consultora: Camila
Lançamento: 123456
```

## 16.6 Preservação do atendimento original

Ao incluir um fechamento posterior, não alterar automaticamente:

* resposta original de houve fechamento;
* motivos registrados no atendimento;
* consultora que realizou o atendimento;
* filial original;
* data original;
* observações originais.

Isso é importante para manter a análise correta:

* a cliente não fechou presencialmente;
* mas converteu posteriormente;
* o canal final foi Digisac;
* o atendimento presencial participou da jornada.

## 16.7 Situação comercial calculada

O sistema poderá apresentar dois campos diferentes:

### Resultado no momento do atendimento

* Fechou;
* Não fechou;
* Em negociação.

### Situação atual

* Sem fechamento;
* Fechamento registrado;
* Mais de um fechamento.

Assim, não é necessário reescrever a resposta original.

---

# 17. Como relacionar atendimento presencial e fechamento pelo Digisac

## 17.1 Primeira versão

A primeira versão poderá ser manual e simples.

Fluxo:

1. A consultora ou supervisora localiza o atendimento.
2. Clica em `Incluir fechamento`.
3. Preenche os dados.
4. Salva o fechamento.
5. O fechamento passa a aparecer no atendimento e na página da cliente.

Isso já resolve o problema sem depender de integração automática com o Digisac.

## 17.2 Ajuda para localizar o atendimento

Para facilitar, a tela de Clientes poderá mostrar:

* atendimentos sem fechamento;
* atendimentos ainda em negociação;
* atendimentos recentes;
* produtos de interesse;
* observações;
* telefone normalizado.

Ao receber uma mensagem no Digisac, a equipe poderá pesquisar a cliente pelo telefone e abrir o histórico.

## 17.3 Evolução futura

Futuramente, poderá existir integração automática:

1. Digisac fornece o telefone do contato.
2. O sistema normaliza o telefone.
3. Localiza a cliente.
4. Mostra atendimentos recentes sem fechamento.
5. Permite selecionar qual atendimento originou a venda.
6. Preenche automaticamente:

   * canal Digisac;
   * cliente;
   * telefone;
   * consultora, quando identificável;
   * data.

Por enquanto, essa automação não é necessária para a primeira versão.

---

# 18. Tela Registros de Atendimentos

## 18.1 Formato

### Mobile

* cartões;
* filtros em painel;
* botão grande para novo atendimento.

### Desktop

* tabela;
* filtros visíveis;
* ordenação;
* paginação;
* colunas configuradas conforme necessidade.

## 18.2 Informações principais

* status;
* nome da cliente;
* telefone;
* parentesco;
* data do atendimento;
* consultora;
* filial;
* departamentos;
* resultado do atendimento;
* existência de fechamento posterior;
* canal do fechamento;
* número do lançamento;
* última atualização.

## 18.3 Filtros

* status;
* rascunho;
* período;
* cliente;
* telefone;
* parentesco;
* filial;
* consultora;
* departamento;
* produto de interesse;
* resultado no atendimento;
* possui fechamento posterior;
* canal do fechamento;
* número do lançamento;
* motivo de fechamento ou não fechamento;
* idade da criança;
* data prevista de nascimento.

## 18.4 Ações

* visualizar;
* continuar rascunho;
* editar;
* incluir fechamento;
* abrir cliente;
* visualizar alterações.

---

# 19. Tela Clientes

## 19.1 Listagem

Filtros:

* nome;
* telefone;
* parentesco;
* filial do último atendimento;
* consultora;
* período do último atendimento;
* departamento;
* produto;
* possui fechamento;
* canal de fechamento;
* quantidade de atendimentos.

## 19.2 Página individual da cliente

### Dados principais

* nome;
* telefone;
* parentesco;
* data do cadastro;
* última atualização.

### Crianças

* nome;
* sexo;
* gestação ou já nasceu;
* data prevista;
* idade em meses ou anos.

### Resumo

* total de atendimentos concluídos;
* primeiro atendimento;
* último atendimento;
* filiais visitadas;
* consultoras envolvidas;
* departamentos recorrentes;
* produtos de interesse;
* atendimentos sem fechamento;
* fechamentos posteriores;
* lançamentos relacionados.

### Linha do tempo

Mostrar em ordem cronológica:

* atendimentos;
* alterações;
* fechamentos;
* canal de fechamento;
* consultora;
* filial;
* observações;
* lançamentos.

---

# 20. Estrutura conceitual dos dados

Os nomes reais deverão ser definidos após análise do banco e do código atual.

## 20.1 Cliente

* ID interno;
* nome;
* telefone informado;
* telefone normalizado;
* parentesco;
* status;
* criado em;
* atualizado em.

## 20.2 Criança

* ID;
* cliente;
* situação;
* nome;
* sexo;
* data prevista;
* idade valor;
* idade unidade;
* criado em;
* atualizado em.

## 20.3 Atendimento

* ID;
* cliente;
* consultora responsável;
* filial;
* iniciado em;
* concluído em;
* status;
* resultado no atendimento;
* observações;
* criado por;
* atualizado por;
* criado em;
* atualizado em;
* expira em, para rascunhos.

## 20.4 Departamento do atendimento

* atendimento;
* departamento.

## 20.5 Produto de interesse

* atendimento;
* descrição;
* ordem;
* criado em.

## 20.6 Motivo do resultado

* atendimento;
* motivo;
* complemento, quando for outro.

## 20.7 Fechamento

* ID;
* atendimento;
* cliente;
* filial;
* consultora;
* data do fechamento;
* canal;
* número do lançamento;
* observações;
* criado por;
* criado em;
* atualizado em.

## 20.8 Histórico de alterações

* ID;
* entidade;
* identificador da entidade;
* usuário;
* perfil ou role;
* data e horário;
* campo;
* valor anterior;
* valor novo;
* origem.

---

# 21. Regras importantes de análise comercial

Para manter os dados corretos, deverão existir diferenças claras entre:

* atendimento iniciado;
* rascunho;
* atendimento concluído;
* fechamento no momento do atendimento;
* fechamento posterior;
* canal do fechamento;
* consultora do atendimento;
* consultora do fechamento;
* filial do atendimento;
* filial do fechamento.

Isso permitirá responder perguntas como:

* quantos atendimentos presenciais fecharam no mesmo momento;
* quantos fecharam posteriormente;
* quantos fecharam pelo Digisac;
* quais produtos despertaram interesse;
* quais motivos impediram fechamento imediato;
* quais consultoras iniciaram atendimentos que converteram depois;
* qual filial realizou o atendimento;
* qual filial realizou a venda;
* quanto tempo levou entre atendimento e fechamento.

---

# 22. Fases recomendadas

## Fase 0 — Auditoria e planejamento

* mapear a lógica atual de permissões;
* mapear a tela atual de usuários;
* confirmar perfis e roles;
* confirmar o campo atual de filiais;
* confirmar usuários com múltiplas filiais;
* validar banco pelo MCP do Supabase;
* validar políticas RLS;
* mapear possível vínculo com Inteligência Comercial;
* criar documento específico de plano e progresso.

## Fase 1 — Estrutura de clientes

* cadastro;
* normalização de telefone;
* busca;
* prevenção de duplicidade;
* parentesco;
* página consolidada.

## Fase 2 — Ficha de Atendimento

* fluxo mobile;
* filial e consultora;
* cliente;
* criança;
* idade;
* departamentos;
* produtos livres;
* motivos;
* observações;
* resultado;
* lançamento.

## Fase 3 — Rascunhos

* cache local;
* pré-gravação no banco;
* sincronização;
* status destacado;
* recuperação;
* expiração em cinco dias;
* exclusão automática.

## Fase 4 — Registros e edição

* listagem;
* filtros;
* visualização;
* prazo de três dias;
* permissões especiais;
* histórico de alterações.

## Fase 5 — Fechamentos posteriores

* botão Incluir fechamento;
* formulário;
* canal;
* filial;
* consultora;
* lançamento;
* observações;
* linha do tempo.

## Fase 6 — Inteligência comercial

* indicadores;
* conversão imediata;
* conversão posterior;
* tempo até fechamento;
* canal;
* motivos;
* produtos;
* integração futura com Digisac e SGI.

---

# 23. Escopo sugerido para primeira versão

A primeira versão deverá conter:

* uso da permissão atual por tela;
* uso das filiais já cadastradas no usuário;
* seleção de unidade quando houver mais de uma;
* consultora automática e bloqueada;
* seleção de consultora pela supervisora;
* busca de cliente;
* vinculação por telefone;
* nome;
* telefone;
* parentesco;
* uma ou mais crianças;
* situação da criança;
* data prevista;
* idade em meses ou anos;
* nome e sexo;
* departamentos;
* produtos em campo livre com Enter;
* observações;
* resultado do atendimento;
* motivos obrigatórios;
* número do lançamento obrigatório quando houver fechamento;
* validação de lançamento;
* cache local;
* rascunho no banco;
* expiração em cinco dias;
* tela de registros;
* tela de clientes;
* edição por três dias;
* edição especial por perfis autorizados;
* histórico de alterações;
* inclusão manual de fechamento posterior;
* canal presencial ou Digisac;
* filial, data, consultora, lançamento e observações do fechamento.

---

# 24. Pontos ainda recomendados para decisão

1. Um atendimento poderá ter mais de um fechamento relacionado?
2. O mesmo número de lançamento poderá ser relacionado a mais de um atendimento?
3. A consultora poderá incluir fechamento posterior em atendimentos de outras consultoras?
4. A supervisora visualizará somente dados das próprias filiais?
5. Um fechamento posterior poderá ser editado depois de salvo?
6. Quem poderá excluir um fechamento lançado incorretamente?
7. Será necessário registrar o valor da venda no fechamento ou o valor virá futuramente da Inteligência Comercial?
8. Rascunhos com falha de sincronização deverão mostrar um aviso específico de que existem apenas localmente?
9. A cliente poderá possuir mais de um telefone?
10. Telefones compartilhados entre familiares serão permitidos?
