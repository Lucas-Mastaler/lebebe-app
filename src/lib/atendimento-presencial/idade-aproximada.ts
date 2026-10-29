export function dataAtendimentoLocal(instante = new Date().toISOString()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instante))
}
export function calcularReferenciaNascimento(dataAtendimento: string, unidade: 'meses' | 'anos', idade: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataAtendimento) || !Number.isInteger(idade) || idade < 0 || (unidade === 'anos' && idade === 0)) throw new Error('Idade ou data inválida')
  const data = new Date(`${dataAtendimento}T12:00:00Z`)
  if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== dataAtendimento) throw new Error('Idade ou data inválida')
  const [ano, mes] = dataAtendimento.split('-').map(Number)
  const meses = ano * 12 + mes - 1 - idade * (unidade === 'anos' ? 12 : 1)
  return `${Math.floor(meses / 12)}-${String(meses % 12 + 1).padStart(2, '0')}-01`
}
export function descreverIdadeAproximada(referencia: string, dataConsulta = dataAtendimentoLocal()) {
  const [ano, mes] = referencia.split('-').map(Number)
  const [anoConsulta, mesConsulta] = dataConsulta.split('-').map(Number)
  const meses = (anoConsulta - ano) * 12 + mesConsulta - mes
  if (meses < 0) return 'Referência estimada futura — confira os dados'
  if (meses < 12) return `Aproximadamente ${meses} ${meses === 1 ? 'mês' : 'meses'}`
  const anos = Math.floor(meses / 12)
  return `Aproximadamente ${anos} ${anos === 1 ? 'ano' : 'anos'}`
}
export function criancaJaNasceu(crianca: { situacao: string; presenteJaNasceu?: boolean }) {
  return crianca.situacao === 'ja_nasceu' || (crianca.situacao === 'presente_outra_pessoa' && crianca.presenteJaNasceu === true)
}
