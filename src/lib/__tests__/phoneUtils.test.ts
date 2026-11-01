import { describe, it, expect } from 'vitest';
import { normalizeBrazilianPhone } from '../phoneUtils';

describe('normalizeBrazilianPhone — Suite Oficial de Testes', () => {
  const VALID_EQUIVALENTS = [
    '11988887777',
    '011988887777',
    '(11) 98888-7777',
    '11 98888-7777',
    '11-98888-7777',
    '+55 11 98888-7777',
    '+5511988887777',
    '5511988887777',
  ];

  it('deve normalizar todos os formatos válidos equivalentes para 11988887777', () => {
    for (const input of VALID_EQUIVALENTS) {
      const result = normalizeBrazilianPhone(input);
      expect(result.isValid, `Falhou em validar: "${input}"`).toBe(true);
      expect(result.normalized, `Falhou na normalização de: "${input}"`).toBe('11988887777');
      expect(result.formatted).toBe('(11) 98888-7777');
      expect(result.error).toBeNull();
    }
  });

  const INVALID_CASES = [
    { input: '988887777', reason: 'Sem DDD' },
    { input: '1188887777', reason: 'Celular sem o 9º dígito' },
    { input: '01188887777', reason: 'Celular com 0 mas sem o 9º dígito' },
    { input: '0011988887777', reason: 'Dois zeros antes do DDD' },
    { input: '00011988887777', reason: 'Prefixo inválido com múltiplos zeros' },
    { input: '0005511988887777', reason: 'Prefixo inválido com múltiplos zeros e DDI' },
    { input: '1198888777', reason: 'Quantidade incorreta de dígitos (10 dígitos)' },
    { input: '119888877779', reason: 'Quantidade incorreta de dígitos (12 dígitos)' },
    { input: '10988887777', reason: 'DDD 10 inexistente no Brasil' },
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

