# Escopo — Prancheta Virtual

**Estado:** APROVADO

## Objetivo

Modernizar a Prancheta Virtual em até duas etapas, reaproveitando crianças e preservando dados comerciais e históricos. P1 aprovada pelo usuário em 15/10/2026; iniciar pela Entrega 1 e concluir sua validação antes das demais.

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
