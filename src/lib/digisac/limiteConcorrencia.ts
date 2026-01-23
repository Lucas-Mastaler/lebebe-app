/**
 * Executa uma lista de factories de Promises com limite de concorrência.
 * @param tasks Array de funções que retornam Promises
 * @param limit Número máximo de execuções simultâneas
 */
export async function executarComLimite<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<void>[] = [];

    // Mapear original index para garantir ordem se necessário, 
    // mas aqui vamos simplificar preenchendo results. 
    // Se a ordem importar, teremos que cuidar disso. 
    // O Promise.all no final garante que esperamos tudo, 
    // mas a ordem de 'push' em results pode variar se nao cuidarmos.
    // Melhor approach: usar um array de promises e depois Promise.all nele é o padrão, 
    // mas aqui queremos throttle.

    // Vamos usar um worker simples

    let i = 0;
    const allResultPromises: Promise<T>[] = [];

    const runTask = async (index: number) => {
        const task = tasks[index];
        return task();
    };

    // Inicializa array de resultados com promises vazias
    // Mais simples: usar biblioteca p-limit se pudesse, mas vamos fazer na mão

    const resultsMap = new Map<number, T>();

    const queue = tasks.map((task, index) => ({ task, index }));

    const worker = async () => {
        while (queue.length > 0) {
            const item = queue.shift();
            if (!item) break;

            try {
                const res = await item.task();
                resultsMap.set(item.index, res);
            } catch (err) {
                // Se der erro, decide se lança ou guarda erro. 
                // A especificação diz "Se algum contato falhar, continuar".
                // Então aqui vamos deixar explodir e quem chama trata, OU tratar aqui.
                // Mas esse helper é genérico. Vamos deixar explodir? 
                // Não, o helper deve ser transparente. Se a task falhar, ela que trate ou o catch pega.
                // Vou assumir que o caller trata o catch dentro da task se quiser continuar.
                throw err;
            }
        }
    };

    const workers = Array(Math.min(limit, tasks.length)).fill(null).map(() => worker());
    await Promise.all(workers);

    // Reconstrói array na ordem
    return tasks.map((_, idx) => resultsMap.get(idx)!);
}
