// Prova de origem das falhas sem checkout/reset/stash nem alteração de arquivos alheios.
import ts from 'typescript'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
const raiz = process.cwd()
execFileSync('git',['diff','--exit-code','HEAD','--','tsconfig.json','next-env.d.ts','package.json','package-lock.json'],{stdio:'pipe'})
const tracked = new Set(execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean))
const versoesHead = new Map()
for (const arquivo of execFileSync('git',['diff','--name-only','-z','HEAD','--','src'],{encoding:'utf8'}).split('\0').filter(Boolean)) {
  if (tracked.has(arquivo) && /\.tsx?$/.test(arquivo)) versoesHead.set(arquivo,execFileSync('git',['show',`HEAD:${arquivo}`],{encoding:'utf8'}))
}
const config = ts.readConfigFile('tsconfig.json',ts.sys.readFile)
if(config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText,'\n'))
const parsed = ts.parseJsonConfigFileContent(config.config,ts.sys,raiz,{incremental:false})
const relativos = (f) => path.relative(raiz,f).replaceAll('\\','/')
const gerado = (f) => relativos(f).startsWith('.next/')
const fontes = parsed.fileNames.filter((f)=>!gerado(f))
const baseline = fontes.filter((f)=>tracked.has(relativos(f)))
const hash=createHash('sha256')
for(const f of baseline) hash.update(relativos(f)).update(versoesHead.get(relativos(f)) ?? readFileSync(f))
function diagnosticos(arquivos, usarHead = false) {
  const host = ts.createCompilerHost(parsed.options)
  const carregar = host.getSourceFile.bind(host)
  host.getSourceFile = (arquivo, linguagem, ...resto) => {
    const texto = usarHead ? versoesHead.get(relativos(arquivo)) : undefined
    return texto === undefined
      ? carregar(arquivo, linguagem, ...resto)
      : ts.createSourceFile(arquivo, texto, linguagem, true)
  }
  const program=ts.createProgram(arquivos,parsed.options,host)
  return ts.getPreEmitDiagnostics(program).map((d)=>({
    arquivo:d.file?relativos(d.file.fileName):null,
    linha:d.file?d.file.getLineAndCharacterOfPosition(d.start??0).line+1:null,
    codigo:d.code,mensagem:ts.flattenDiagnosticMessageText(d.messageText,'\n'),
  })).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))
}
const antes=diagnosticos(baseline,true),depois=diagnosticos(fontes)
console.info(JSON.stringify({
  evidencia:'Configurações versionadas preservadas. Baseline usa fontes versionadas com conteúdo HEAD via CompilerHost; atual usa o worktree e inclui Decorisi. Nenhum checkout/reset/stash. Tipos .next excluídos e verificados separadamente pelo tsc global.',
  fontesRestauradasVirtualmente:[...versoesHead.keys()],
  baselineArquivos:baseline.length,atualArquivos:fontes.length,baselineSha256:hash.digest('hex'),
  baseline:antes,atual:depois,diagnosticosIdenticos:JSON.stringify(antes)===JSON.stringify(depois),
},null,2))
if(JSON.stringify(antes)!==JSON.stringify(depois)) process.exitCode=1
