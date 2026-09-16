import type { OptionLetter } from './selection-context'

/**
 * As 18 escolhas visuais (categorias A–I) + as 17 escolhas de
 * comportamento (categoria J) já feitas pelo usuário e aprovadas como
 * Design System v1 (ver `docs/projetos/design-system/DECISOES.md`).
 * Usadas só como preenchimento não-destrutivo na hidratação: se o
 * navegador já tem um valor salvo para um código (mesmo diferente deste
 * preset), o valor salvo sempre vence — isto só garante que as escolhas
 * já feitas não se percam num navegador/dispositivo sem o localStorage
 * anterior. `FLT-EXEC` não entra aqui — é regra fixa (`kind: 'fixed'`),
 * não uma escolha armazenada.
 */
export const PRESET_VISUAL_SELECTIONS: Record<string, OptionLetter> = {
  RAD: 'B',
  SHD: 'C',
  TYP: 'B',
  SPC: 'B',
  BTN: 'B',
  INP: 'A',
  HDR: 'A',
  TAB: 'C',
  CRD: 'C',
  KPI: 'B',
  TBL: 'B',
  FLT: 'A',
  FBK: 'A',
  EST: 'B',
  STA: 'A',
  PLS: 'A',
  PFM: 'B',
  PKS: 'A',
  'FLT-CLR': 'C',
  VAL: 'C',
  ERR: 'C',
  REQ: 'C',
  MSK: 'C',
  SAV: 'A',
  UNS: 'B',
  DST: 'A',
  FDB: 'C',
  LDG: 'A',
  KBD: 'A',
  CMB: 'B',
  DAT: 'A',
  ROW: 'A',
  MOD: 'A',
  PER: 'A',
  MOB: 'A',
}
