# Confidencialidade de custos internos

## Gatilho

Carregue esta regra sempre que uma tela, componente, API, relatório,
exportação, impressão ou consulta ler, calcular ou exibir custo interno
da empresa. Vale para funcionalidade nova e para alteração de funcionalidade
existente.

Não se aplica a preço de venda, valor cobrado do cliente, desconto
comercial, frete cobrado do cliente nem valor total do pedido. Esses
valores comerciais continuam disponíveis aos perfis que já podem operar
a venda.

## Perfis restritos

A restrição vale somente para as chaves reais de `app_perfis_acesso`:

- `consultora` (nome exibido: Consultora)
- `supervisora_loja` (nome exibido: Supervisora Loja)

`allowedUser.role` não identifica esses perfis. Esse campo é `user` ou
`superadmin`. O perfil de negócio vem de `app_perfis_acesso.chave`,
exposto ao frontend em `/api/me/permissoes` como `perfilAtual.chave`.

Superadmin (`acessoTotal`) e os demais perfis, inclusive `gestao` e
`pos_venda`, continuam podendo receber custo interno. Não estenda a
restrição a outro perfil sem decisão humana explícita.

## O que é custo interno

Tratar como confidencial, qualquer que seja o nome do campo:

- custo de aquisição, fabricação, personalização ou fornecedor
- custo unitário e custo total
- custo interno de frete, entrega, montagem, serviço ou mão de obra
- margem, markup, lucro bruto, lucro líquido e margem de contribuição
- indicador calculado que revele esses valores

Preço de venda e total cobrado do cliente não são custo. Campo ambíguo
não deve ser ocultado nem mantido no chute: confirmar a origem do valor
antes de decidir.

## Regra

- Os perfis `consultora` e `supervisora_loja` não podem visualizar custos
  internos da empresa.
- A restrição vale para qualquer módulo, tela, componente, API, relatório
  ou exportação, existente ou futura.
- Ao desenvolver uma funcionalidade que utilize custo interno, é obrigatório
  verificar o perfil antes de disponibilizar os dados.
- Ocultar um componente no React, no CSS ou no menu não substitui a
  proteção dos dados.
- O frontend não recebe campos confidenciais sem autorização. A omissão
  ocorre na resposta do servidor, antes do JSON chegar ao navegador.
- Consulta direta ao Supabase pelo navegador não pode ser o caminho que
  devolve esses campos. A API que usa service role também precisa omiti-los,
  porque service role não herda a RLS do usuário.
- Valores comerciais da operação de vendas não devem ser confundidos com
  custo interno.
- Toda mudança que envolva campo de custo inclui teste dos perfis restritos
  e de pelo menos um perfil autorizado.
- Nenhuma tela com custo interno está concluída sem essa validação.

Enquanto a permissão do usuário ainda não foi confirmada, a interface não
exibe custo. Falha ao carregar a permissão também não exibe custo. No
servidor, perfil ausente, inativo ou não identificado também omite o custo.
Superadmin continua autorizado pelo acesso total, mesmo sem chave de perfil.
