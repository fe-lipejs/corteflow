import { describe, it, expect } from 'vitest';
import { normalizeBrazilianPhone } from '../phoneUtils';

describe('normalizeBrazilianPhone — Suite Oficial de Testes', () => {
  const VALID_EQUIVALENTS = [
    '27997303135',
    '027997303135',
    '(27) 99730-3135',
    '27 99730-3135',
    '27-99730-3135',
    '+55 27 99730-3135',
    '+5527997303135',
    '5527997303135',
  ];

  it('deve normalizar todos os formatos válidos equivalentes para 27997303135', () => {
    for (const input of VALID_EQUIVALENTS) {
      const result = normalizeBrazilianPhone(input);
      expect(result.isValid, `Falhou em validar: "${input}"`).toBe(true);
      expect(result.normalized, `Falhou na normalização de: "${input}"`).toBe('27997303135');
      expect(result.formatted).toBe('(27) 99730-3135');
      expect(result.error).toBeNull();
    }
  });

  const INVALID_CASES = [
    { input: '997303135', reason: 'Sem DDD' },
    { input: '2797303135', reason: 'Celular sem o 9º dígito' },
    { input: '02797303135', reason: 'Celular com 0 mas sem o 9º dígito' },
    { input: '0027997303135', reason: 'Dois zeros antes do DDD' },
    { input: '00027997303135', reason: 'Prefixo inválido com múltiplos zeros' },
    { input: '0005527997303135', reason: 'Prefixo inválido com múltiplos zeros e DDI' },
    { input: '2799730313', reason: 'Quantidade incorreta de dígitos (10 dígitos)' },
    { input: '279973031356', reason: 'Quantidade incorreta de dígitos (12 dígitos)' },
    { input: '10997303135', reason: 'DDD 10 inexistente no Brasil' },
    { input: '00', reason: 'Apenas zeros' },
    { input: '', reason: 'String vazia' },
  ];

  it('deve rejeitar todos os formatos inválidos especificados', () => {
    for (const { input, reason } of INVALID_CASES) {
      const result = normalizeBrazilianPhone(input);
      expect(result.isValid, `Deveria ter rejeitado (${reason}): "${input}"`).toBe(false);
      expect(result.normalized).toBeNull();
      expect(result.error).not.toBeNull();
    }
  });

  it('deve validar e normalizar DDDs válidos de diferentes estados (SP, RJ, MG, BA, RS)', () => {
    expect(normalizeBrazilianPhone('11988887777').normalized).toBe('11988887777'); // SP
    expect(normalizeBrazilianPhone('21977776666').normalized).toBe('21977776666'); // RJ
    expect(normalizeBrazilianPhone('31966665555').normalized).toBe('31966665555'); // MG
    expect(normalizeBrazilianPhone('71955554444').normalized).toBe('71955554444'); // BA
    expect(normalizeBrazilianPhone('51944443333').normalized).toBe('51944443333'); // RS
  });
});

