import { isValid } from 'date-fns';

/**
 * Converte datas do input (dd/mm/aaaa) considerando o dia inteiro em SP
 * para range UTC ISO strings.
 * 
 * Ex: 
 * Entrada: 22/01/2026 (SP)
 * Inicio SP: 2026-01-22 00:00:00-03:00 -> UTC: 2026-01-22T03:00:00.000Z
 * Fim SP:    2026-01-22 23:59:59.999-03:00 -> UTC: 2026-01-23T02:59:59.999Z
 */
export function montarRangeUtcSaoPaulo(dataDe: string, dataAte: string) {
    const regex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!regex.test(dataDe) || !regex.test(dataAte)) {
        throw new Error('Formato de data inválido. Use dd/mm/aaaa');
    }

    // Parse básico das strings dd/mm/yyyy
    // O construtor Date(y, m-1, d) cria data local do servidor onde roda o node 
    // mas aqui vamos ser agnósticos manipulando strings ISO primeiro se possível, 
    // ou usando offsets fixos já que a regra é explicita para SP (-03:00) 
    // Simplificação: Vamos assumir offset -03:00 fixo para SP (ignoring horario verao antigo, ja que nao existe mais ou é irrelevante para validação simples)
    // OU melhor: criar a data manualmente como string ISO com offset

    // Método robusto manual para evitar confusão de timezone do servidor:
    const [d1, m1, y1] = dataDe.split('/');
    const [d2, m2, y2] = dataAte.split('/');

    // Datas em SP: yyyy-mm-ddT00:00:00-03:00
    // Criar objetos Date a partir dessas strings ISO com offset
    const startSp = new Date(`${y1}-${m1}-${d1}T00:00:00-03:00`);

    // Se a data final é hoje (considerando SP), usar horário atual ao invés de 23:59:59.999
    const agora = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const diaHoje = pad(agora.getDate());
    const mesHoje = pad(agora.getMonth() + 1);
    const anoHoje = String(agora.getFullYear());
    const hojeStr = `${diaHoje}/${mesHoje}/${anoHoje}`;

    let endSp: Date;
    if (dataAte === hojeStr) {
        const hh = pad(agora.getHours());
        const mm = pad(agora.getMinutes());
        const ss = pad(agora.getSeconds());
        const ms = String(agora.getMilliseconds()).padStart(3, '0');
        endSp = new Date(`${y2}-${m2}-${d2}T${hh}:${mm}:${ss}.${ms}-03:00`);
    } else {
        endSp = new Date(`${y2}-${m2}-${d2}T23:59:59.999-03:00`);
    }

    if (isNaN(startSp.getTime()) || isNaN(endSp.getTime())) {
        throw new Error('Data inválida');
    }

    if (startSp > endSp) {
        throw new Error('Data inicial maior que data final');
    }

    return {
        inicioUtc: startSp.toISOString(),
        fimUtc: endSp.toISOString()
    };
}
