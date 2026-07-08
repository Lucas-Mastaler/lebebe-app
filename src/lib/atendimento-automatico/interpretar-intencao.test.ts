import { describe, expect, it } from 'vitest';
import {
  calcularTentativasInvalidas,
  interpretarAcaoAlteracao,
  interpretarConfirmacao,
} from './interpretar-intencao';

describe('interpretarConfirmacao', () => {
  it('sim => confirmar', () => expect(interpretarConfirmacao('sim')).toBe('confirmar'));
  it('sim4 => confirmar (ruido curto)', () => expect(interpretarConfirmacao('sim4')).toBe('confirmar'));
  it('simm => confirmar', () => expect(interpretarConfirmacao('simm')).toBe('confirmar'));
  it('siim => confirmar', () => expect(interpretarConfirmacao('siim')).toBe('confirmar'));
  it('sin => confirmar', () => expect(interpretarConfirmacao('sin')).toBe('confirmar'));
  it('ss => confirmar', () => expect(interpretarConfirmacao('ss')).toBe('confirmar'));
  it('isso => confirmar', () => expect(interpretarConfirmacao('isso')).toBe('confirmar'));
  it('correto => confirmar', () => expect(interpretarConfirmacao('correto')).toBe('confirmar'));
  it('certo => confirmar', () => expect(interpretarConfirmacao('certo')).toBe('confirmar'));
  it('ta certo => confirmar', () => expect(interpretarConfirmacao('ta certo')).toBe('confirmar'));
  it('tá certo => confirmar (com acento)', () => expect(interpretarConfirmacao('tá certo')).toBe('confirmar'));
  it('está correto => confirmar', () => expect(interpretarConfirmacao('está correto')).toBe('confirmar'));
  it('esta correto => confirmar', () => expect(interpretarConfirmacao('esta correto')).toBe('confirmar'));
  it('ok => confirmar', () => expect(interpretarConfirmacao('ok')).toBe('confirmar'));
  it('okay => confirmar', () => expect(interpretarConfirmacao('okay')).toBe('confirmar'));
  it('confirmo => confirmar', () => expect(interpretarConfirmacao('confirmo')).toBe('confirmar'));
  it('confirmado => confirmar', () => expect(interpretarConfirmacao('confirmado')).toBe('confirmar'));
  it('pode ser => confirmar', () => expect(interpretarConfirmacao('pode ser')).toBe('confirmar'));
  it('e esse => confirmar', () => expect(interpretarConfirmacao('e esse')).toBe('confirmar'));
  it('é essa => confirmar', () => expect(interpretarConfirmacao('é essa')).toBe('confirmar'));

  it('não => negar', () => expect(interpretarConfirmacao('não')).toBe('negar'));
  it('nao => negar', () => expect(interpretarConfirmacao('nao')).toBe('negar'));
  it('n => negar', () => expect(interpretarConfirmacao('n')).toBe('negar'));
  it('errado => negar', () => expect(interpretarConfirmacao('errado')).toBe('negar'));
  it('outro => negar', () => expect(interpretarConfirmacao('outro')).toBe('negar'));
  it('outra => negar', () => expect(interpretarConfirmacao('outra')).toBe('negar'));
  it('não é esse => negar', () => expect(interpretarConfirmacao('não é esse')).toBe('negar'));
  it('nao e esse => negar', () => expect(interpretarConfirmacao('nao e esse')).toBe('negar'));
  it('não está correto => negar', () => expect(interpretarConfirmacao('não está correto')).toBe('negar'));
  it('nao esta correto => negar', () => expect(interpretarConfirmacao('nao esta correto')).toBe('negar'));
  it('endereco errado => negar', () => expect(interpretarConfirmacao('endereco errado')).toBe('negar'));

  it('qualquer coisa => ambigua', () => expect(interpretarConfirmacao('qualquer coisa')).toBe('ambigua'));
  it('abc => ambigua', () => expect(interpretarConfirmacao('abc')).toBe('ambigua'));
  it('vazio => ambigua', () => expect(interpretarConfirmacao('')).toBe('ambigua'));
  it('nao, esta errado — nao + confirmativa => negar', () =>
    expect(interpretarConfirmacao('não, está errado')).toBe('negar'));
});

describe('interpretarAcaoAlteracao', () => {
  it('1 => adiantar', () => expect(interpretarAcaoAlteracao('1')).toBe('adiantar'));
  it('adiantar => adiantar', () => expect(interpretarAcaoAlteracao('adiantar')).toBe('adiantar'));
  it('adianta => adiantar', () => expect(interpretarAcaoAlteracao('adianta')).toBe('adiantar'));
  it('antecipar => adiantar', () => expect(interpretarAcaoAlteracao('antecipar')).toBe('adiantar'));
  it('antecipa => adiantar', () => expect(interpretarAcaoAlteracao('antecipa')).toBe('adiantar'));
  it('antecipação => adiantar', () => expect(interpretarAcaoAlteracao('antecipação')).toBe('adiantar'));
  it('quero adiantar => adiantar', () => expect(interpretarAcaoAlteracao('quero adiantar')).toBe('adiantar'));
  it('quero antecipar => adiantar', () => expect(interpretarAcaoAlteracao('quero antecipar')).toBe('adiantar'));
  it('mais cedo => adiantar', () => expect(interpretarAcaoAlteracao('mais cedo')).toBe('adiantar'));
  it('antes => adiantar', () => expect(interpretarAcaoAlteracao('antes')).toBe('adiantar'));
  it('pra antes => adiantar', () => expect(interpretarAcaoAlteracao('pra antes')).toBe('adiantar'));
  it('para antes => adiantar', () => expect(interpretarAcaoAlteracao('para antes')).toBe('adiantar'));

  it('2 => postergar', () => expect(interpretarAcaoAlteracao('2')).toBe('postergar'));
  it('postergar => postergar', () => expect(interpretarAcaoAlteracao('postergar')).toBe('postergar'));
  it('postega => postergar', () => expect(interpretarAcaoAlteracao('postega')).toBe('postergar'));
  it('postergar entrega => postergar', () => expect(interpretarAcaoAlteracao('postergar entrega')).toBe('postergar'));
  it('jogar pra frente => postergar', () => expect(interpretarAcaoAlteracao('jogar pra frente')).toBe('postergar'));
  it('mais pra frente => postergar', () => expect(interpretarAcaoAlteracao('mais pra frente')).toBe('postergar'));
  it('pra frente => postergar', () => expect(interpretarAcaoAlteracao('pra frente')).toBe('postergar'));
  it('mais tarde => postergar', () => expect(interpretarAcaoAlteracao('mais tarde')).toBe('postergar'));
  it('depois => postergar', () => expect(interpretarAcaoAlteracao('depois')).toBe('postergar'));
  it('deixar para depois => postergar', () => expect(interpretarAcaoAlteracao('deixar para depois')).toBe('postergar'));
  it('deixar pra depois => postergar', () => expect(interpretarAcaoAlteracao('deixar pra depois')).toBe('postergar'));
  it('quero depois => postergar', () => expect(interpretarAcaoAlteracao('quero depois')).toBe('postergar'));

  it('não sei => ambigua', () => expect(interpretarAcaoAlteracao('não sei')).toBe('ambigua'));
  it('abc => ambigua', () => expect(interpretarAcaoAlteracao('abc')).toBe('ambigua'));
  it('vazio => ambigua', () => expect(interpretarAcaoAlteracao('')).toBe('ambigua'));
});

describe('calcularTentativasInvalidas', () => {
  it('primeiro erro neste estado => 1', () => {
    const r = calcularTentativasInvalidas({ tentativas_invalidas_ultimo_estado: 'outro_estado', tentativas_invalidas_estado: 5 }, 'aguardando_escolha_acao');
    expect(r).toBe(1);
  });
  it('segundo erro no mesmo estado => 2', () => {
    const r = calcularTentativasInvalidas({ tentativas_invalidas_ultimo_estado: 'aguardando_escolha_acao', tentativas_invalidas_estado: 1 }, 'aguardando_escolha_acao');
    expect(r).toBe(2);
  });
  it('metadata null => 1', () => {
    const r = calcularTentativasInvalidas(null, 'aguardando_escolha_acao');
    expect(r).toBe(1);
  });
  it('metadata sem contador => 1', () => {
    const r = calcularTentativasInvalidas({ tentativas_invalidas_ultimo_estado: 'aguardando_escolha_acao' }, 'aguardando_escolha_acao');
    expect(r).toBe(1);
  });
});
