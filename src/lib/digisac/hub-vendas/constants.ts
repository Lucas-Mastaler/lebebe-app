export const HUB_VENDAS_SERVICE_ID = '4af28025-c210-4336-a560-785d2fb8a778'

export const HUB_VENDAS_LOJAS = {
  portao: {
    serviceId: 'c60d720f-5ad5-4a1b-bedb-e51495dee686',
    numero: '554184426528',
  },
  bigorrilho: {
    serviceId: '0973f84b-8294-4615-9657-ba95b6346246',
    numero: '554188043042',
  },
  hauer_marechal: {
    serviceId: '1352c41b-80a9-4e74-b9d9-4c5e7aed060e',
    numero: '554192220492',
  },
} as const

export type HubVendasLoja = keyof typeof HUB_VENDAS_LOJAS

export const HUB_VENDAS_SERVICE_IDS_MONITORADOS = new Set<string>([
  HUB_VENDAS_SERVICE_ID,
  ...Object.values(HUB_VENDAS_LOJAS).map((loja) => loja.serviceId),
])

export const HUB_VENDAS_SERVICE_ID_PARA_LOJA = new Map<string, HubVendasLoja>(
  Object.entries(HUB_VENDAS_LOJAS).map(([loja, config]) => [
    config.serviceId,
    loja as HubVendasLoja,
  ])
)

export const HUB_VENDAS_JANELA_CONVERSAO_MS = 24 * 60 * 60 * 1000
export const HUB_VENDAS_CICLO_MS = 14 * 24 * 60 * 60 * 1000
