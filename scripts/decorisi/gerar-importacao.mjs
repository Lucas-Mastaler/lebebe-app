import { readFile, writeFile } from 'node:fs/promises'
const caminho = process.argv[2]
if (!caminho || !/\d{14}_decorisi_referencias_db\.sql$/.test(caminho)) throw new Error('Informe o arquivo criado por supabase migration new decorisi_referencias_db')
const fonte = JSON.parse(await readFile(new URL('../../src/lib/pedidos-personalizados/decorisi/referencias-db.json', import.meta.url), 'utf8'))
if (fonte.registros.length !== 90 || !/^[a-f0-9]{64}$/.test(fonte.sha256)) throw new Error('Catálogo inválido')
const linhas = fonte.registros.map((r) => {
  if (!/^DB[78](0[1-9]|[1-3][0-9]|4[0-5])$/.test(r.referencia) || !/^\d+(?:\.\d{1,2})?$/.test(r.repeticaoM)) throw new Error('Referência inválida')
  return `('${r.referencia}',${r.repeticaoM})`
}).join(',\n')
await writeFile(caminho, `-- Gerado de referencias-db.json. NÃO executado em produção.\n-- Fonte: https://decorisi.com.br/#calculadora; SHA256 ${fonte.sha256}\ninsert into public.pedidos_personalizados_decorisi_referencias(fornecedor_id,referencia,repeticao_m,fonte,fonte_sha256,extraido_em)\nselect f.id,v.referencia,v.repeticao_m,'https://decorisi.com.br/#calculadora','${fonte.sha256}','${new Date(fonte.extraidoEm).toISOString()}'::timestamptz\nfrom public.pedidos_personalizados_fornecedores f cross join (values\n${linhas}\n) v(referencia,repeticao_m) where f.chave='decorisi';\n`)
console.info('[decorisi] Migration de importação preparada, 90 referências; nenhum SQL executado.')
