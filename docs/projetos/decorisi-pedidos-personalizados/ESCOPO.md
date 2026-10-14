# Escopo — Decorisi em Pedidos Personalizados

**Estado:** APROVADO

## Objetivo e arquitetura

Incluir Decorisi no cabeçalho compartilhado de Pedidos Personalizados, com referências, itens, medidas e anexos próprios. Preservar Moriah e Le Bébé Exclusive. A autorização vigente cobre a finalização técnica das Fases 1–5, aplicação da migration incremental pelo mecanismo oficial e testes sintéticos controlados no Supabase atual (D-008/D-009). O usuário autorizou commit/push exclusivamente da entrega Decorisi na main (D-011). Deploy manual, ativação comercial e modificação de dados reais continuam não autorizados.

## Regras aprovadas

- Quatro produtos: papel catálogo 36565/19075; papel personalizado 36566/19076; painel Fofura 36567/19077; painel personalizado 36568/19078. Uma unidade dos papéis = rolo inteiro 0,62 × 10 m; painéis em m².
- Doce Bebê: 90 DB701–DB745 e DB801–DB845. Xadrezia: 132 XP001–XP132, confirmados pelo usuário e extraídos da calculadora oficial com repetição real inclusive zero (D-010). Papel catálogo e personalizado selecionam catálogo e referência DB/XP original. PF200–PF280: 81 referências estáticas pesquisáveis; PF opcional para painel personalizado. Total de referências de papel: 222.
- Formulário Decorisi: entrada numérica automática em centésimos de metro, quatro dígitos/99,99m, sem alteração do domínio SQL; resumo financeiro imediatamente após medidas, divisores discretos e catálogo separado por origem. Troca de catálogo com referência preenchida exige confirmação, preservando medidas, descrição e anexos.
- Um card por arte; catálogo duplicado direciona ao card existente na UI. Personalizações distintas não são consolidadas. Até 10 itens, 20 medidas por item e 5 anexos por item.
- Centímetros inteiros; faixa = altura + repetição + 5 cm; faixas = floor(1000/faixa). Somar larguras por altura, somar frações exatas dos grupos e arredondar uma vez por arte. Sem desperdício adicional.
- Painel: soma exata largura × altura, quatro casas em m². Margens gratuitas não são cobradas. Arredondar somente subtotal monetário por arte e então somar.
- Rascunho admite composição incompleta; identificação válida é obrigatória. Antes de fechar, exigir referências, medidas, preços válidos e descrição/anexo por item personalizado. Anexos de catálogo opcionais em todas as etapas.
- Preço vem do cache SGI existente. Cotação alterada exige confirmação do novo total. Fechamento calcula no banco, congela preço/quantidade/subtotal/referência/repetição/versão do cálculo e impede alteração posterior da composição.
- Fluxo futuro igual à Moriah: RASCUNHO → VENDA FECHADA → AGUARDANDO LAYOUT → AGUARDANDO APROVAÇÃO DO CLIENTE → EM PRODUÇÃO → RECEBIDO; retorno aprovação/layout e cancelamento não terminal. Exigências administrativas existentes preservadas.
- Autorização por sessão, módulo, janela e unidade; criação no módulo novo; gestão no módulo gestão; acesso pelo módulo novo limitado a rascunhos/pedidos próprios. Nenhum acesso cliente direto às tabelas novas.

## Limites e aceite

Backend permanece desligado por flag e disponibilidade do fornecedor. As seis migrations anteriores não devem ser reaplicadas; a incremental Fase 5 foi autorizada e aplicada (D-009). Não habilitar flags de produção nesta entrega. Não modificar serviços, crons, preços ou unidades SGI. Não repetir a carga inicial concluída por outro Codex. Não criar sincronizador paralelo.

Aceite técnico local: cálculo TS/SQL equivalente, importação íntegra, persistência atômica, controle de versão/idempotência, proteção de preços e autorização testados. Aceite integral depende de migrations em ambiente autorizado, integração HTTP/banco real, Storage, UI, gestão e validação autenticada antes da ativação comercial.
