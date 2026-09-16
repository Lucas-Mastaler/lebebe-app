// ============================================================
// FILIAIS DE VENDAS SGI — cadastro canônico das filiais que fecham
// documentos de saída (vendas) no SGI (`sgi_documentos_saida.filial`)
//
// Escopo estrito: filial de VENDA/DOCUMENTO no SGI. Esta lista NÃO
// representa todo o universo de unidades/estabelecimentos do SGI — só o
// conjunto de valores válidos da coluna `filial` de
// `sgi_documentos_saida`. Existem outros conceitos no SGI com grão
// diferente (ex.: local de estocagem por produto — ver nota sobre
// "Depósito C.D." abaixo) que NÃO pertencem a esta constante enquanto não
// houver confirmação de que participam do mesmo conceito de filial de
// venda. Se algum dia for necessário modelar esses outros universos,
// crie constantes próprias e explícitas (não generalize esta).
//
// Também NÃO é uma lista genérica de "unidades comerciais Le Bébé" e NÃO
// deve ser reutilizada por DigiSac ou qualquer outro sistema — cada
// sistema tem seu próprio universo e nomenclatura de unidades/conexões.
// Em particular, "Pós-venda" é um contexto de conexão DigiSac (ver
// docs/inteligencia-comercial/inteligencia-comercial-multiplas-conexoes-digisac.md,
// linha ~22/367), não uma filial de venda SGI — não incluir aqui. Se no
// futuro for necessário relacionar uma filial SGI a uma conexão DigiSac,
// isso deve ser um mapeamento explícito e próprio, nunca comparação de
// string ou reuso direto desta constante.
//
// Filiais de venda não são inferidas de `sgi_documentos_saida` em tempo
// de consulta — documentos são dado transacional (o que foi vendido), não
// cadastro mestre de filiais. Uma filial sem movimento no período/recorte
// consultado continua sendo uma opção válida de filtro; ela só não deve
// retornar resultados, nunca desaparecer da lista de opções.
//
// Valores confirmados por consulta direta ao banco em 2026-09-15
// (`select distinct filial from sgi_documentos_saida`): só existem estas
// 4 grafias, todas com o prefixo "LEBEBE " e acentuação real (não
// "PORTAO" sem acento). Não são os mesmos valores de `app_unidades`
// (cadastro de escopo de acesso do superadmin: chaves como "portao"/nome
// "PORTAO", sem "LEBEBE " e sem acento, e inclui "pos_venda", que ali é
// uma unidade de escopo de acesso, não uma filial de venda SGI).
//
// "LEBEBE DEPÓSITO (CD)" NÃO está incluído: a coluna `filial` de
// `sgi_documentos_saida` só tem as 4 grafias abaixo (consulta `distinct`
// direta, sem paginação/corte). O único lugar onde "Depósito"/"C.D."
// aparece hoje no SGI é `local_estocagem` em
// `sgi_documentos_saida_produtos` ("Depósito C.D.", 1742 linhas) — local
// físico de estoque por linha de produto, não filial de venda do
// documento. Ver investigação registrada no histórico do projeto
// (docs/projetos/design-system/STATUS.md) antes de tratar CD como filial
// de venda.
// ============================================================

export const FILIAIS_VENDAS_SGI = [
  'LEBEBE PORTÃO',
  'LEBEBE BIGORRILHO',
  'LEBEBE MARECHAL',
  'LEBEBE FEIRA',
] as const

export type FilialVendaSgi = (typeof FILIAIS_VENDAS_SGI)[number]
