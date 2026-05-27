import { fetchDigisac } from './clienteDigisac';

export async function transferirContatoParaDepartamento(params: {
  contactId: string;
  departmentId: string;
}): Promise<void> {
  const botUserId = process.env.DIGISAC_BOT_USER_ID;

  if (!botUserId) {
    throw new Error('DIGISAC_BOT_USER_ID não configurado');
  }

  await fetchDigisac(`/contacts/${params.contactId}/ticket/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      departmentId: params.departmentId,
      userId: null,
      comments: '',
      byUserId: botUserId,
    }),
  });
}
