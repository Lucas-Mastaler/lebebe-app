export interface NotaPreview { id: string; numero_nf: string; data_emissao: string; volumes_total: number }

export function conciliarSelecao(anteriores: NotaPreview[], novas: NotaPreview[], selecionadas: Set<string>): Set<string> {
  const conhecidas = new Set(anteriores.map(nota => nota.id))
  return new Set(novas.filter(nota => selecionadas.has(nota.id) || !conhecidas.has(nota.id)).map(nota => nota.id))
}

export async function buscarNotasNoPeriodo(input: {
  lerCadastradas: () => Promise<NotaPreview[]>
  buscarEmail: () => Promise<{ ok: boolean; erros?: unknown[] }>
  mostrar: (notas: NotaPreview[]) => void
}): Promise<string> {
  // Mostra o que já existe antes de aguardar o e-mail.
  const anteriores = await input.lerCadastradas()
  input.mostrar(anteriores)
  let aviso = ''
  try {
    const resultado = await input.buscarEmail()
    if (!resultado.ok) aviso = 'Não conseguimos concluir a busca por novas notas no e-mail. Você pode continuar com as notas já cadastradas.'
    else if (resultado.erros?.length) aviso = 'Alguns anexos não puderam ser importados. As notas disponíveis estão na lista abaixo. Você pode tentar buscar novamente mais tarde.'
  } catch { aviso = 'Não conseguimos concluir a busca por novas notas no e-mail. Você pode continuar com as notas já cadastradas.' }
  // Também busca resultados que tenham sido confirmados antes de uma falha.
  try { input.mostrar(await input.lerCadastradas()) }
  catch { aviso = 'Não foi possível atualizar a lista após a busca. Mantivemos as notas que já estavam disponíveis. Tente buscar novamente mais tarde.' }
  return aviso
}
