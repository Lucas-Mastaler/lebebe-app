/**
 * Uma linha de NFe cujo código bate com Ref meia/Ref inteira de um produto
 * cadastrado normalmente seria tratada como aquele produto completo. Mas
 * quando a descrição da própria linha indica "VOLUME" (ex.: "VOLUME 01-
 * OFF WHITE/FREIJO/ECO"), a compra é de um volume avulso do produto, não do
 * produto completo — e por isso não deve ser contabilizada/exibida como
 * item normal (aba Itens), e sim tratada pelo fluxo de OS.
 *
 * Ver incidente do recebimento 33 (código 00061714, ref_inteira de "BERCO
 * ZUPY NEW MATIC") para o caso real que motivou esta regra.
 */
export function isDescricaoVolumeAvulso(descricao: string | null | undefined): boolean {
  return /\bVOLUME\b/i.test(descricao || '')
}
