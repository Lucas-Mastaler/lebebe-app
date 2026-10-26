import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { devolverSessoesInativas } from '@/lib/atendimento-automatico/inatividade';
vi.mock('@/lib/atendimento-automatico/inatividade', () => ({ devolverSessoesInativas: vi.fn() }));
beforeEach(() => { vi.resetAllMocks(); process.env.CRON_SECRET = 'teste-local'; });
it('recusa requisição sem segredo antes de processar', async () => {
  expect((await GET(new NextRequest('https://teste/api/cron/posvenda-inatividade'))).status).toBe(401);
  expect(devolverSessoesInativas).not.toHaveBeenCalled();
});
it('sem configuração não abre a rota', async () => {
  delete process.env.CRON_SECRET;
  expect((await GET(new NextRequest('https://teste/api/cron/posvenda-inatividade'))).status).toBe(500);
  expect(devolverSessoesInativas).not.toHaveBeenCalled();
});
it('propaga simulação explicitamente', async () => {
  vi.mocked(devolverSessoesInativas).mockResolvedValue({ examinadas: 0, elegiveis: 0, devolvidas: 0, ignoradas: 0, erros: 0 });
  const response = await GET(new NextRequest('https://teste/api/cron/posvenda-inatividade?simulacao=true',
    { headers: { authorization: 'Bearer teste-local' } }));
  expect(response.status).toBe(200);
  expect(devolverSessoesInativas).toHaveBeenCalledWith({ simulacao: true });
});
