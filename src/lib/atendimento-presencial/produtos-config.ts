/** Ativar somente depois da migration e da homologação dos leitores/escritores. */
export const PRODUTOS_V2_HABILITADOS = process.env.NEXT_PUBLIC_PRANCHETA_PRODUTOS_V2 === '1'
