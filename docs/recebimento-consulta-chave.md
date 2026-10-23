# Recebimento — consulta pontual pela chave da NF-e

## Funcionamento

No modal **Vincular XML**, a opção **Consultar pela chave** aceita a chave de
44 números, com ou sem espaços. O backend valida o dígito verificador e o
modelo 55 e chama exclusivamente `consChNFe` do serviço oficial
`NFeDistribuicaoDFe`, com certificado A1 em TLS. Não faz manifestação fiscal.

O transporte usa o runtime Node.js da aplicação, inclusive na Vercel. Não
precisa de serviço na VPS. O XML original em `docZip` é descompactado com
limite de tamanho, sem reconstruir ou reserializar o documento. Antes da
gravação, o importador confere chave, protocolo autorizado, ambiente e CNPJ
exato do destinatário. A raiz do CNPJ configurado deve corresponder ao A1
(identificador ICP-Brasil `2.16.76.1.3.3`). O arquivo A1, a senha, a validade
e a correspondência entre certificado e chave privada são conferidos no servidor.

Usa o mesmo `importarXmlRecebimento`, parser, RPC `importar_xml_recebimento`
e `salvarXmlDrive` do upload manual. Não há migration nesta etapa. Emitente
e destinatário ficam preservados no XML original; não foram criadas colunas
ou cadastros paralelos. O nome no Drive continua `<numero_nf>.xml`.

Se a chave já está cadastrada com hash validado e Drive confirmado, a API
retorna a nota sem consultar a SEFAZ. Se o Drive está pendente, recuperar o
XML novamente é uma necessidade operacional: a transação continua conferindo
o hash e nunca substitui dados divergentes.

## Arquivos da implementação

- `src/app/recebimento/VincularXmlModal.tsx`: opções Enviar XML e Consultar pela chave.
- `src/app/recebimento/ConsultarChaveNfe.tsx`: campo, validação e resultados da consulta.
- `src/app/api/recebimento/consultar-chave/route.ts`: autorização, consulta e importação.
- `src/lib/recebimento/dfe-config.ts`: leitura e conferência do A1 e da configuração fiscal.
- `src/lib/recebimento/dfe-soap.ts`: transporte mTLS, SOAP e leitura de docZip.
- `src/lib/recebimento/dfe-limites.ts`: limite compartilhado, concorrência e intervalos no Redis.
- `src/lib/recebimento/dfe-contract.ts`: estados e erros próprios, sem dados confidenciais.
- `src/lib/recebimento/nfe-chave.ts`: verificação da chave, compartilhada com o frontend.
- `src/lib/recebimento/importar-xml.ts`: pequena extração do cadastro/Drive da etapa 1.
- `src/lib/recebimento/xml-upload.ts`: validações opcionais de identidade para XML consultado.
- `src/app/api/recebimento/importar-xml/route.ts`: usa o helper comum, mantendo o upload.
- `package.json` e `package-lock.json`: leitor PFX `node-forge` e seus tipos.
- Testes: `dfe-config.test.ts`, `dfe-soap.test.ts`, `dfe-transporte.test.ts`,
  `dfe-limites.test.ts`, `dfe-limites.integration.test.ts` e `dfe.fixture.ts`
  em `src/lib/recebimento/`; `route.test.ts` em `src/app/api/recebimento/consultar-chave/`.

## Configuração segura

Configurar **somente no servidor**, no secret store da hospedagem ou em
`.env.local` não versionado, com acesso restrito aos responsáveis:

| Variável | Conteúdo |
| --- | --- |
| `NFE_DFE_A1_PFX_BASE64` | Arquivo A1 `.pfx`/`.p12` inteiro convertido para Base64, em uma linha |
| `NFE_DFE_A1_PASSWORD` | Senha do arquivo A1; pode ser vazia se o arquivo realmente não tiver senha |
| `NFE_DFE_CNPJ` | CNPJ do destinatário autorizado, sem pontuação, 14 posições e letras maiúsculas quando existentes |
| `NFE_DFE_UF_AUTOR` | Código IBGE de duas posições da UF do solicitante, por exemplo `35` para SP |
| `NFE_DFE_AMBIENTE` | `2` para homologação; `1` para produção. Não existe ambiente padrão |
| `UPSTASH_REDIS_REST_URL` | URL do Redis compartilhado já utilizado pelo projeto |
| `UPSTASH_REDIS_REST_TOKEN` | Token do mesmo Redis, somente no servidor |

O OAuth do Drive e `GOOGLE_DRIVE_RECEBIMENTO_XML_FOLDER_ID` continuam sendo
os da etapa 1. Cada ambiente de teste precisa de banco e pasta Drive isolados;
não reutilizar a pasta operacional para documentos de teste.

Para converter o PFX localmente sem imprimir seu conteúdo, em PowerShell:

```powershell
$a1Base64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes('CAMINHO_LOCAL_DO_A1.pfx'))
```

O responsável deve transferir esse valor diretamente ao secret store seguro.
Não executar comandos que imprimam a variável; não enviar o valor, o PFX ou
a senha pelo chat. Na Vercel, usar variáveis Sensitive e selecionar apenas
os ambientes pretendidos. Não usar prefixo `NEXT_PUBLIC_`, argumentos de
linha de comando contendo a senha, tabelas públicas ou arquivos versionados.

Esta implementação usa A1 com chave RSA, padrão suportado pelo leitor PFX
adotado. Formatos incompatíveis falham antes da consulta. A validação TLS do
servidor permanece habilitada; não desligar validação de certificados para
resolver erro de conexão. Falhas na cadeia de confiança devem ser investigadas
com o responsável técnico antes da homologação.

Na renovação, substituir PFX e senha no secret store, conferir CNPJ e validade
e reiniciar a aplicação local ou publicar uma nova versão **quando autorizado**.
Não há armazenamento permanente nem cache local de chaves privadas. Restringir
quem pode editar as variáveis e acompanhar a validade com o responsável fiscal.

## Resumo e manifestação

Resumo `resNFe` não contém os produtos necessários: não cria nota, itens ou
recebimento e não é enviado ao Drive. A interface informa que foi recebido
apenas o resumo e orienta o operador a solicitar ao responsável fiscal a
manifestação adequada, ou obter o XML do fornecedor. Eventos isolados também
não são tratados como XML completo.

O aplicativo não envia Ciência da Emissão, Confirmação, Desconhecimento nem
Operação não Realizada. Um futuro botão de Ciência é tecnicamente viável por
um serviço de eventos separado, com XML assinado pelo A1, autorização
explícita, identificação do operador e tratamento de repetição. Isso exige
outra entrega e revisão fiscal: Ciência não confirma o recebimento físico e
não deve ser apresentada como ação sem consequências.

## Limites, falhas e repetição

O Redis aplica scripts Lua atômicos por CNPJ completo e ambiente: até 20
consultas em janela móvel de uma hora, uma consulta em andamento por empresa
e intervalo mínimo de um minuto para repetir a mesma chave. A chave fiscal
e o CNPJ são transformados em hashes nas chaves do Redis; XML e credenciais
não são armazenados nele.

Retorno `656` bloqueia o CNPJ por uma hora. Documento indisponível mantém
a mesma chave em espera por uma hora. Resumo ou falha temporária mantém
espera mínima de um minuto. Não há tentativas fiscais automáticas.
`Retry-After` informa o intervalo ao frontend. Se Redis estiver ausente ou
falhar, nenhuma consulta fiscal nova é iniciada. Se a execução for interrompida
sem liberar a reserva, o bloqueio de segurança expira após uma hora.

Este controle cobre esta aplicação. Outros sistemas que consultem o mesmo
CNPJ também consomem o limite oficial e podem causar bloqueio externo.

Os logs registram etapa, categoria e código de retorno; nunca XML, chave de
acesso, CNPJ, senha, certificado ou texto bruto de falhas SOAP/TLS. A API
retorna mensagens próprias e não devolve o XML nem material do A1 ao navegador.

## Validação e teste manual

Os testes automatizados usam certificados inventados, SOAPs simulados e
banco/Drive simulados. O teste opt-in `dfe-limites.integration.test.ts` usa
somente chaves Redis com prefixo aleatório `teste-dfe:` e limpeza por lista
exata, sem SEFAZ, banco ou Drive. O script PostgreSQL descartável da etapa 1
continua verificando a transação e as permissões.

Para testar a aplicação após configurar o A1:

1. Usar homologação, banco e pasta Drive isolados. Certificado válido, CNPJ
   destinatário autorizado e uma chave de homologação com XML disponível são
   necessários. Nunca enviar XML experimental à pasta operacional.
2. Entrar com um usuário já autorizado ao módulo/Matic, abrir `/recebimento`,
   **Vincular XML → Consultar pela chave**, colar a chave e clicar em
   **Consultar nota**. A conta técnica de agentes não deve receber permissões
   adicionais apenas para este teste.
3. Com XML completo: conferir número, itens e quantidades, arquivo original
   `<numero_nf>.xml` na pasta isolada e nota na seleção de **Novo recebimento**.
   A consulta não cria recebimento nem executa entrada de estoque.
4. Consultar novamente: nota existente e Drive confirmado devem aparecer sem
   consulta fiscal adicional. Verificar isso pelos logs seguros.
5. Com resumo: conferir o aviso sobre manifestação e a ausência de cadastro
   novo e de arquivo no Drive. Não registrar evento fiscal durante o teste.
6. Testar o upload manual e a área de arrastar arquivos para regressão.

Sem A1 configurado, a interface e a API exibem pendência de configuração.
Mocks aprovados não significam homologação com a SEFAZ. O primeiro teste real
deve confirmar também a cadeia TLS, o contrato SOAP em uso e o acesso fiscal
da empresa. Nenhuma consulta autenticada real foi executada nesta entrega.

## Referências oficiais

- [NTs da NF-e — NT 2014.002, inclusive publicação v1.40](https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=04BIflQt1aY%3D).
- [Relação oficial de serviços](https://www.nfe.fazenda.gov.br/portal/webservices.aspx).
  Produção: `https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx`.
  Homologação: `https://hom.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx`.
- [MOC 7 — certificado, distribuição, SOAP e resumo/manifestação](https://www.confaz.fazenda.gov.br/legislacao/arquivo-manuais/moc7-visao-geral.pdf).
- [Aviso oficial sobre limites e espera após consumo indevido](https://hom.nfe.fazenda.gov.br/portal/informe.aspx?AspxAutoDetectCookieSupport=1&Informe=R%2F52iNPKnGs%3D&ehCTG=false).

O payload `distDFeInt` usa versão `1.01`; a versão da Nota Técnica não é a
versão desse XML. A publicação da NT v1.40 foi confirmada no índice oficial;
o PDF vigente não pôde ser baixado pelo ambiente de pesquisa. O contrato foi
conferido no MOC e em exemplos oficiais indexados da distribuição. A obtenção
anônima do WSDL de produção retornou HTTP 403; isso não valida mTLS nem uma
consulta fiscal autenticada.


## Integração com Novo recebimento

A entrada de XML fica dentro de **Novo recebimento → Vincular XML manual**.
Ao fechar a vinculação, o modal de recebimento recupera as notas pela data de
emissão, preservando período, observações e escolhas anteriores. Notas novas
entram selecionadas. Notas fora do período geram um aviso; as datas não mudam
sozinhas. Essa atualização não dispara nova consulta no Gmail ou na SEFAZ.

**Buscar NFs no período** mostra primeiro o cadastro local e depois executa
a busca existente no Gmail, com o mesmo remetente, assunto e caixa alternativa.
Se o e-mail falhar, a lista cadastrada permanece disponível. As leituras do
Gmail têm até três tentativas no total para falhas temporárias, com intervalos
curtos; erros permanentes de acesso não são repetidos. Não há repetição
automática de transações de cadastro ou consultas fiscais.

A migration `20261023152859_recebimento_email_anexos.sql` cria somente o controle
`nfe_email_anexos` e a função `importar_anexo_email_recebimento`. O controle guarda
um hash da caixa/mensagem/anexo e o ID da nota confirmada. Não guarda XML,
endereço de e-mail ou credenciais. A nota e o comprovante são confirmados na
mesma transação. Um anexo com erro permanece sem comprovante e pode ser tentado
novamente, enquanto anexos concluídos são ignorados antes do download.

A primeira busca de um histórico sem comprovantes pode baixar um anexo para
reconhecer sua chave. Se a nota já existe, seus itens e IDs são preservados.
Registros antigos sem chave só recebem essa identificação se os dados fiscais
conferirem. Não há atualização em massa ou recriação de itens históricos.
A importação de e-mail mantém as conversões anteriores de peso, volumes e
arredondamento de quantidade, usando o parser compartilhado e o cadastro
transacional já existente para notas novas. Não acrescenta envio ao Drive
nesse caminho; upload e consulta pela chave mantêm seu envio já implementado.

Teste da transação: `node scripts/recebimento/validar-email-anexos.mjs CAMINHO_DO_PGLITE`.
Usa PostgreSQL descartável e documentos inventados, sem conexão com produção.
