import { NextRequest, NextResponse } from 'next/server';
import { buscarAgendamentosFormatados } from '@/lib/digisac/agendamentos';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            dataAgendamentoInicio,
            dataAgendamentoFim,
            dataCriacaoInicio,
            dataCriacaoFim,
            departmentId,
            userId,
            status,
            conversaAberta,
            dataUltimoChamadoFechadoInicio,
            dataUltimoChamadoFechadoFim,
            page = 1,
            perPage = 30
        } = body;

        const resultado = await buscarAgendamentosFormatados({
            dataAgendamentoInicio,
            dataAgendamentoFim,
            dataCriacaoInicio,
            dataCriacaoFim,
            departmentId,
            userId,
            status,
            conversaAberta,
            dataUltimoChamadoFechadoInicio,
            dataUltimoChamadoFechadoFim,
            page,
            perPage
        });

        return NextResponse.json(resultado);

    } catch (error: unknown) {
        console.error('Erro na rota /api/agendamentos/pesquisar:', error);

        const errorMessage = error instanceof Error ? error.message : '';

        // Tratamento de erros conhecidos
        if (errorMessage.includes('autenticação')) {
            return NextResponse.json({ error: 'Falha de autenticação com provedor' }, { status: 401 });
        }
        if (errorMessage.includes('Rate Limit')) {
            return NextResponse.json({ error: 'Muitas requisições. Tente novamente em instantes.' }, { status: 429 });
        }
        if (errorMessage.includes('Data inválida')) {
            return NextResponse.json({ error: errorMessage }, { status: 400 });
        }

        return NextResponse.json(
            { error: 'Erro interno ao processar pesquisa' },
            { status: 500 }
        );
    }
}
