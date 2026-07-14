export const DIGISAC_WEB_BASE_URL = 'https://lebebe.digisac.me';

export function montarUrlHistoricoTicket(ticketId: string): string {
  return `${DIGISAC_WEB_BASE_URL}/ticket-history/${ticketId}`;
}
