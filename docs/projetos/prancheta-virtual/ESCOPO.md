# Escopo — Prancheta Virtual

## Nomes e filtros de consultoras — D-051 aprovada em 22/10/2026

Publicar as melhorias locais de normalização de consultoras sem acentos e de filtros de Registros: opções atualizadas ao abrir, consulta paginada dos nomes e nova ordem dos grupos de filtros. Incluir testes e migration já aplicada, sem replay. Não publicar alterações de pedidos personalizados, Harness geral, Mere IA ou outras frentes. Sem mudança de permissão ou regra comercial.

## Histórico comercial compartilhado — D-050 aprovada em 22/10/2026

Substitui exclusivamente as limitações comerciais de D-049: histórico SGI por telefone e por Prancheta disponível entre todas as filiais para usuários já autorizados ao Atendimento Presencial, com ou sem telefone e sem vínculo próprio de atendimento. Preservar autenticação/janela, bloqueios globais de identidade, dados oficiais, deduplicação e limite dez. Atendimentos completos, diagnósticos internos, edição, cadastro, pedidos personalizados e módulos administrativos conservam seus controles próprios. Validar SQL/APIs/regressão/build e publicação; não executar commit/push nem contornar o fluxo Git existente. Sem alteração no importador, unicidade, indicadores ou dados comerciais.

## Vinculação SGI pela Prancheta — D-049 aprovada em 21/10/2026

Associação complementar dinâmica ao cliente_id, inclusive sem telefone, por lançamento exato, filial e +/-2 dias de calendário SP. Exigir cliente ativo/nome preenchido, atendimento concluído/venda fechada, documento válido/importação concluída sem erros; bloquear ambiguidades globais e contradições antes de apresentar apenas dados autorizados. Integrar detalhe do atendimento e histórico do cliente; preservar a identificação telefônica com escopo explícito, deduplicar por ID SGI e ordenar/limitar dez após a união. Função SQL somente leitura/backend, diagnósticos objetivos e logs sem PII. Sem persistir associação, alterar cadastro/SGI/indicadores, criar cron/worker/tabela ou mudar o importador/chave global. Pendência do upsert global registrada separadamente em D-049. Sem commit, push ou publicação do app nesta execução.

## Publicação autorizada — D-042 (20/10/2026)

Após aprovação visual, usuário autorizou aplicar a migration desta entrega e executar commit, push e deploy de Produtos/PV, enxoval e comemoração. Autorização inclui ativação; usuário confirmou a variável Production no Vercel após 403 da integração. Preservar alterações locais não relacionadas e validar o SHA/build/domínio. Homologação comercial autenticada e em dispositivo físico permanece evidência separada.

## Refinamento de produtos e comemoração — D-041 (20/10/2026)

Ordem aprovada: entrada/+, auxiliares Lista de enxoval e Produto que não trabalhamos (lado a lado com espaço, quebra no celular), cabeçalho Produto | Qtd | Vendido, linhas e PV. Marcar/✓ Vendido verde substitui o interruptor; manter × e alvos de 44px. Percentual real sem teto e barra até 100% da largura.

Edição do nome na linha preserva quantidade/venda/posição, confirma por Enter/blur e cancela por Esc; nome não vazio, maiúsculas com acentos, espaços normalizados, até 80 caracteres. Pode gerar nomes iguais sem mesclar. Inclusão normal incrementa a primeira correspondência normalizada, mesmo após edições; marcador genérico continua especial e não editável. Validadores TS/SQL permitem nomes repetidos estruturados; remover somente a unicidade por descrição na migration local pendente, preservando dados/históricos e sem backfill.

Comemorar somente Venda fechada com PV ≥ 5 após sucesso confirmado pelo servidor, usando PV sincronizado antes do reset. Cena compartilhada com prévia, logo oficial do app, foguetes/fogos finitos, valores reais, 5s ou fechamento por Continuar/×/Esc; áudio local de três notas ascendentes suaves por 1,5s, sem voz/arquivo/serviço externo. Bloqueio do áudio mantém conclusão/visual, fechamento para notas, redução de movimento estática. Sem repetição por resposta duplicada, erro, negociação/perda, edição ou recarga e sem início automático de atendimento.

Esta decisão substitui a escolha explícita entre duplicados do escopo D-038 e os pontos visuais correspondentes da D-040. Autorização restrita a implementação/validação local; gates externos preservados.

## Produtos/PV e listas de enxoval — aprovado em 20/10/2026 (D-038/D-039)

Duas entregas independentes no projeto existente. A: texto livre com Enter/+, lista única compacta, quantidade inteira por toque, Vendido por linha inteira, duplicidade exata sem caixa/acentos/espaços, indicador PV no bloco de produtos (referência visual 5). Negociação/Perda com peças vendidas gera aviso sem bloqueio; resultado comercial não muda automaticamente. Marcador genérico Produto que não trabalhamos preservado, sem quantidade/venda e excluído do PV. Sem venda parcial, catálogo, SGI, metas acumuladas ou novos filtros nesta entrega.

Histórico permanece sem inferência: quantidade/venda não informadas; nenhuma consolidação, uppercase retroativo ou backfill. Somente interação explícita altera o produto histórico. Inclusão com múltiplas correspondências segue a primeira linha, conforme D-041. Ampliar tabela existente com campos nullable e versão do contrato, derivar PV sem coluna total. Proteger autosave/edição antigos contra descarte de metadados; preservar concorrência, cache, permissões e normalizadores vigentes, incluindo D-037.

B: oito PNGs originais fornecidos pelo usuário (Verão 1–4 e Inverno 1–4), estáticos em public, modal DS com estação/paginação, imagem original em outra aba e preservação do formulário. Sem PDF, upload ou painel administrativo. Conteúdo dos materiais mantido exatamente como enviado, inclusive a semelhança entre Verão 3/4.

Autorizada implementação e validação locais. Migration remota, ativação, commit, push e deploy dependem de autorização posterior. A3 requer homologação integrada/autenticada antes da publicação; teste sintético não equivale a esse aceite.

**Estado:** APROVADO

## Objetivo

Modernizar a Prancheta Virtual em até duas etapas, reaproveitando crianças e preservando dados comerciais e históricos. P1 aprovada pelo usuário em 15/10/2026; iniciar pela Entrega 1 e concluir sua validação antes das demais.

## Cadastro, filtros e rascunhos — aprovado em 19/10/2026 (D-031)

Editor de cliente existente (nome e telefone) na Prancheta e Clientes, preservando IDs/vínculos e concorrência. Novos telefones e alterações seguem DDD brasileiro existente, celular de nove dígitos iniciado em 9 ou fixo de oito iniciado em 2–5, com máscara/+55 e sem rejeição arbitrária de repetição. Telefones antigos fora desse formato são preservados e avisados; alterar somente nome não obriga corrigir telefone.

Consultora em maiúsculas, trim e espaços internos simples; unificar grafias equivalentes sem aproximar nomes diferentes ou unir contas. Nome da pessoa no atendimento apresentado como **Consultora do atendimento**, separado da conta de login. Normalizar valores operacionais existentes; preservar snapshots técnicos de auditoria.

Atendimentos Salvos: início por dias completos de São Paulo, virada DD/MM separada, tipo, cliente/telefone, lançamento exato, Com telefone/Sem telefone pela presença atual, departamentos e motivos multiselect (OR dentro, AND entre filtros), visita atual/histórica; contagens de atendimentos, clientes únicos e Não clientes antes de paginar. Retirar recusa histórica da apresentação operacional, sem apagar o fato técnico.

Rascunhos: cliente vinculado ou nome em preenchimento com Cadastro pendente, consultora do JSON, filtros básicos e operacionais, tipo não informado explícito, última atividade, vínculos, telefone, expiração em 24h; paginação de 20 itens e ordem estável. Cards com rótulos fortes, informações agrupadas, feedback e navegação preservada. Aplicação/limpeza manuais pelo DS. Sem compartilhamento, automações ou novas exclusões.

Execução local autorizada; migration remota e publicação permanecem em etapa posterior especificamente autorizada.

## P1 aprovada

- Identificação na primeira tela: unidade, nome manual da consultora e tipo Cliente/Não cliente; demais campos ocultos até selecionar o tipo.
- Não cliente: seleção única entre Entrega de mercadoria, Entregador/Uber Eats, Vendedor ambulante, Pedido de informação, Currículo/entrevista, Panfleto, Representante e Outros; finalização direta, sem cadastro comercial, crianças, resultado ou lançamento fictícios.
- Cliente: Venda fechada finaliza na primeira tela, sem motivos, com lançamento obrigatório; Negociação e Venda perdida usam segunda etapa, com lista atual de motivos e observação de não fechamento opcional (até 300 caracteres), separada das observações gerais. Voltar preserva dados. Remover revisão.
- Trocar tipo recolhe sem apagar o ramo temporariamente oculto do rascunho; somente o ramo ativo é concluído. Cadastro permanente de cliente já criado não é excluído por essa troca. Trocar cliente não transporta crianças indevidamente.
- Unidade única autorizada permanece automática pelas permissões; várias unidades exigem seleção e são limpas após sucesso. Nome da consultora sempre limpo. Nenhuma preferência de consultora compartilhada entre dispositivos.
- Entrega 4, complemento D-015: “Últimas consultoras” apresenta até quatro nomes distintos de atendimentos concluídos do mesmo login e unidade autorizada, por uso recente, deduplicando espaços/maiúsculas. Botões compactos preenchem o campo manual somente por escolha explícita; sem histórico, ocultar a área. Compartilhar sugestões entre dispositivos não compartilha o preenchimento do formulário nem altera o reset. Sem tabela específica, sem rascunhos como fonte e sem mudança nas demais entregas.
- Lançamento: identificar causa real do incidente com 22, 225, 2234 e 34566; preservar inteiro de 1 a 999999. Diferenciar vazio, formato e faixa; não criar limite mínimo de dígitos.
- Erros de campos em toda a Prancheta: mensagem local, destaque e acessibilidade DS, foco/rolagem ao primeiro inválido e remoção após correção; preservar demais dados. Erros operacionais permanecem gerais.
- Cadastro permanente de crianças, relacionamento cliente–criança e parentesco por vínculo (estrutura antecipada da P2). Preservar registros anteriores e parentesco geral como legado.
- Adendo autorizado de 16/10/2026 à consolidação P1: cliente vinculada e cadastro geral sem parentesco na interface; parentesco por criança restrito às 13 opções na ordem aprovada, com atalhos Mãe/Avó/Tia; cartões selecionáveis por toque/teclado sem antecipar confirmação histórica. Preservar histórico; sem migrations/deploy/commit/push exclusivamente pelo adendo.
- Crianças históricas como sugestões selecionáveis, sem recadastro; confirmação explícita persiste identidade e vínculo de forma atômica/idempotente, independentemente da conclusão comercial. Próximos atendimentos não reconfirmam o vínculo. Ambiguidades são resolvidas pela consultora, nunca por união automática de nomes. Correspondência histórica separada, sem reescrever origem.
- Crianças cadastradas em blocos compactos; Adicionar outra criança oferece Crianças cadastradas/Cadastrar nova criança; excluir selecionadas das opções; retirar do atendimento não exclui cadastro; manter limite de oito.
- Presente continua no fluxo da criança, com Já nasceu? Sim/Não, reutilizando idade/gestação. Condição de presente pertence ao contexto do atendimento.
- Idade aproximada: DATE estimada, dia 1 do mês obtido subtraindo meses/anos da data do atendimento; exibição dd/MM/aaaa e idade dinâmica sinalizada como aproximada. Separar nascimento real e previsão; não inventar datas históricas nem recalcular referência a cada seleção.
- Adaptar finalizados, detalhe, edição e histórico apenas na medida necessária; manter códigos sim/nao/negociacao e dados legados. Não clientes fora de contagens/denominadores comerciais; não criar dashboard/fórmula nova.

## Refinamento funcional aprovado — D-028 (16/10/2026)

Nova rodada local autorizada pelo pedido anexado: nove motivos de Venda perdida e sete de Negociação separados, sete motivos de Não cliente, lojas física/internet opcionais por motivo, preservação integral de históricos, Crianças cadastro antigo sem IDs visíveis, autosave novo após filial/consultora/tipo, Cadastrar e vincular confirmando somente o rascunho até a conclusão, modal vermelho Sim/Não para Cliente sem telefone válido com recusa estruturada por finalização, destaque SEM TELEFONE na gestão e sugestão Produto que não trabalhamos. Este adendo prevalece sobre as reservas de telefone/motivos abaixo exclusivamente nesses itens. Não autoriza automação, compartilhamento, outras P3, migration remota, commit, push ou deploy.

## P2/P3 reservadas

Pendência futura, fora da P1 e ainda sem classificação em fase: “Atendimentos de pessoas que procuram produtos fora da faixa etária ou do catálogo atendido pela Le Bébé devem ter uma forma simplificada de registro, sem exigir todo o cadastro comercial. Exemplo: procura por roupas para crianças de 6 anos. Fluxo e classificação ainda não definidos.” Não implementar nem presumir solução.

P2: telefone obrigatório/exceções (cliente comum, presente, recusa, números evidentemente inválidos), revisão complementar dos consumidores de parentesco, conferência de filiais e UX adicional baseada em evidências. Telefone continua opcional na P1. A referência a Presente na P2 significa apenas telefone, não seu cadastro aprovado na P1.

P3: revisão/separação de motivos, acompanhamento/recuperação e compra posterior, WhatsApp e esclarecimento com Robyson sobre transferência de rascunhos. Não implementar automações ou compartilhamento novo.

## Contratos e limites

Preservar módulo atendimento_presencial_ficha, permissões/janelas/perfis/unidades, autosave independente das etapas, concorrência por versão e histórico. Rascunho de servidor pode ser acessível ao mesmo login em outros dispositivos; formulários novos permanecem independentes.

Reutilizar Design System; não alterar componentes globais por conveniência. Preservar integrações atuais com histórico SGI/pedidos personalizados, sem redesenhar pedidos personalizados ou criar envio Digisac.

Sem commits, push ou publicação. Antes de migration validar schema e histórico remoto via MCP, preparar validação/recuperação e pedir autorização antes de aplicar em produção. Nenhuma operação destrutiva autorizada. Mudança funcional exige decisão humana. Não escrever no log legado congelado.

## Aceite

Critérios por entrega e matriz de testes em PLANO.md. Liberação nas lojas depende de homologação integrada dos quatro fluxos, compatibilidade histórica, dispositivos e autorização de produção. Decisões vinculantes em DECISOES.md.

## Adendo aprovado D-034 — 20/10/2026

Nos atendimentos salvos, mostrar parentesco junto ao nome da criança no cabeçalho e disponibilizar filtro multisseleção com as mesmas 13 opções do seletor. Dar mais contraste e divisão aos títulos dos grupos de filtro. Diálogos de confirmação devem ocupar aproximadamente 80% da largura disponível, respeitando o limite máximo definido pelo Design System.

Adicionar às opções de Venda perdida o motivo “Cliente Retira (Retirou apenas o item já comprado)”, com chave persistida `cliente_retira`; atualizar validadores e preparar migration local. A confirmação existente para cliente sem telefone deve permanecer igual e continuar funcionando em venda fechada, negociação e venda perdida, sem opção/resposta nova.

Na aprovação inicial, este adendo autorizava apenas implementação/preparação local. O usuário autorizou posteriormente a aplicação da migration necessária e a publicação do pacote na `main` (D-035).

## Adendo aprovado D-036 — 20/10/2026

No filtro de atendimentos salvos, posicionar “Virada do cartão” após Interesses e Motivos. As opções de Consultora do atendimento devem vir automaticamente dos registros concluídos dentro do perfil/unidades permitidos e atualizar ao abrir o seletor, sem cadastro manual. Nome sem atendimento concluído ainda não tem histórico para aparecer como opção.

Normalizar nomes de consultora com trim, espaços simples, maiúsculas e remoção de acentos: grafias como LETICIA/LETÍCIA representam o mesmo nome canônico, sem fundir nomes que diferem por outras palavras (por exemplo, ANA e ANA C). Aplicar o mesmo contrato em atendimentos, rascunhos e origem da consultora em clientes; preservar cada linha, ID e vínculo.

O pedido autoriza a atualização dos dados e da normalização no banco remoto. Publicação do código em `main`/produção não foi solicitada neste adendo.
