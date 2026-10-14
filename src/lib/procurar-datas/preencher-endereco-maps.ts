export type EnderecoComplementarMaps = Partial<Record<'cep' | 'numero' | 'logradouro' | 'bairro' | 'cidade' | 'uf', string>>
/** Campos digitados prevalecem. Metadados automáticos anteriores pertencem ao ponto anterior. */
export function preencherEnderecoMaps(atual: EnderecoComplementarMaps, identificado: EnderecoComplementarMaps, editados: ReadonlySet<string>): EnderecoComplementarMaps {
  return Object.fromEntries(['cep','numero','logradouro','bairro','cidade','uf'].map((campo) => {
    const chave = campo as keyof EnderecoComplementarMaps
    return [chave, editados.has(chave) && atual[chave]?.trim() ? atual[chave] : identificado[chave] || '']
  }))
}
