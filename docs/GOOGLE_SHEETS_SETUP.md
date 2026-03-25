# Configuração do Google Sheets para Recebimento

Este documento explica como configurar a integração com Google Sheets para registrar automaticamente os dados de finalização de recebimentos.

## Passo 1: Preparar a Planilha

1. Acesse [Google Sheets](https://sheets.google.com)
2. Crie uma nova planilha ou abra uma existente
3. O script irá criar automaticamente uma aba chamada "Recebimentos" com os cabeçalhos

## Passo 2: Configurar o Apps Script

1. Na planilha, vá em **Extensões** > **Apps Script**
2. Apague qualquer código existente
3. Copie todo o conteúdo do arquivo `appscript/recebimento-to-sheets.gs`
4. Cole no editor do Apps Script
5. Clique em **Salvar** (ícone de disquete)

## Passo 3: Implantar como Web App

1. Clique em **Implantar** > **Nova implantação**
2. Clique no ícone de engrenagem ⚙️ e selecione **Aplicativo da Web**
3. Configure:
   - **Descrição**: Webhook Recebimento Le Bébé
   - **Executar como**: Eu (seu email)
   - **Quem tem acesso**: Qualquer pessoa
4. Clique em **Implantar**
5. **Copie a URL gerada** (vai ser algo como: `https://script.google.com/macros/s/ABC.../exec`)

## Passo 4: Configurar Variável de Ambiente

1. No projeto Next.js, abra o arquivo `.env.local`
2. Adicione a variável:
   ```
   GOOGLE_SHEET_RECEBIMENTO_URL=https://script.google.com/macros/s/ABC.../exec
   ```
   (substitua pela URL que você copiou)
3. Salve o arquivo
4. **Reinicie o servidor de desenvolvimento** para aplicar a variável

## Passo 5: Testar

1. Execute o recebimento de uma nota fiscal
2. Ao finalizar, preencha o formulário com os dados
3. Clique em "Finalizar"
4. Verifique se uma nova linha apareceu na planilha

## Estrutura dos Dados Enviados

A planilha receberá os seguintes campos:

| Campo | Descrição | Exemplo |
|-------|-----------|---------|
| Carimbo de data/hora | Data e hora da finalização | 14/07/2025 11:21:34 |
| QUEM ESTÁ PREENCHENDO? | Nome de quem finalizou | LUCAS |
| HORÁRIO INICIO DO RECEBIMENTO | Hora de início | 14:00:00 |
| HORÁRIO FIM DO RECEBIMENTO | Hora de término | 15:21:00 |
| TEMPO TOTAL (segundos) | Tempo do timer em segundos | 4860 |
| TEMPO TOTAL (formatado) | Tempo formatado HH:MM:SS | 01:21:00 |
| QUANTIDADE DE CHAPAS | Número de chapas utilizadas | 0 |
| MOTORISTA AJUDOU? | Sim ou Não | Sim |
| QUANTOS KILOS? | Peso total das NFes | 1500 |
| QUANTOS VOLUMES? | Total de volumes | 120 |
| NÚMERO DAS NF RECEBIDAS | Números das notas | 263815, 263814 |
| MOTORISTA | Nome do motorista | João Silva |
| ALGUM PROBLEMA QUE DEVE SER RESOLVIDO NOS PRÓXIMOS CARREGAMENTOS? | Observações | - |
| OUTROS TIPOS DE PROBLEMAS | Outras observações | - |

## Solução de Problemas

### Erro ao enviar para Google Sheets
- Verifique se a URL está correta no `.env.local`
- Certifique-se de ter reiniciado o servidor após adicionar a variável
- Verifique se o Apps Script está implantado como "Qualquer pessoa" pode acessar

### Dados não aparecem na planilha
- Abra o Apps Script e vá em **Execuções** para ver logs de erro
- Verifique se você autorizou o script a acessar sua planilha

### Campos em branco
- Alguns campos são opcionais e podem ficar vazios
- Campos obrigatórios: Carimbo, Quem preencheu

## Notas Importantes

- A integração com Google Sheets **não bloqueia** a finalização do recebimento
- Se houver erro ao enviar, o recebimento é finalizado normalmente
- Erros são registrados apenas nos logs do servidor
- Você pode testar o script manualmente usando a função `testar()` no Apps Script
