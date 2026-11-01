// ─── Single Source of Truth para Validação e Normalização de Telefones (BR) ───

export const VALID_BRAZILIAN_DDDS = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '21', '22', '24',
  '27', '28',
  '31', '32', '33', '34', '35', '37', '38',
  '41', '42', '43', '44', '45', '46',
  '47', '48', '49',
  '51', '53', '54', '55',
  '61', '62', '63', '64', '65', '66', '67', '68', '69',
  '71', '73', '74', '75', '77',
  '79',
  '81', '82', '83', '84', '85', '86', '87', '88', '89',
  '91', '92', '93', '94', '95', '96', '97', '98', '99'
]);

export interface PhoneValidationResult {
  isValid: boolean;
  normalized: string | null;
  formatted: string | null;
  error: string | null;
}

/**
 * Normaliza e valida um número de telefone brasileiro seguindo rigorosamente as regras:
 * 1. Remove qualquer máscara, espaço ou caracter não numérico.
 * 2. Rejeita números com prefixos inválidos como múltiplos zeros ('00', '000', etc).
 * 3. Trata código internacional (+55 ou 55).
 * 4. Trata prefixo nacional único (0 antes do DDD).
 * 5. Garante a presença e validade do DDD brasileiro oficial.
 * 6. Exige obrigatoriamente o 9º dígito móvel (número deve começar com '9' após o DDD).
 * 7. Exige exatamente 11 dígitos no total (2 do DDD + 9 do celular).
 * 
 * Retorna { isValid, normalized: '11988887777', formatted: '(11) 98888-7777', error }
 */
export function normalizeBrazilianPhone(rawPhone: string | null | undefined): PhoneValidationResult {
  if (!rawPhone || typeof rawPhone !== 'string' || !rawPhone.trim()) {
    return {
      isValid: false,
      normalized: null,
      formatted: null,
      error: 'Informe o telefone com DDD. Ex.: (11) 98888-7777.'
    };
  }

  const trimmed = rawPhone.trim();

  // 1. Rejeita múltiplos zeros antes do número (ex: 0011..., 00055...)
  if (/^00+/.test(trimmed) || /^(\+?00+)/.test(trimmed)) {
    return {
      isValid: false,
      normalized: null,
      formatted: null,
      error: 'Informe um telefone brasileiro válido. Ex.: (11) 98888-7777.'
    };
  }

  // 2. Extrai apenas dígitos
  let digits = trimmed.replace(/\D/g, '');

  if (!digits) {
    return {
      isValid: false,
      normalized: null,
      formatted: null,
      error: 'Informe o telefone com DDD. Ex.: (11) 98888-7777.'
    };
  }

  // 3. Remove código internacional 55 se presente no início
  // Exemplos: 5511988887777 (13 dígitos) -> 11988887777 (11 dígitos)
  // ou 55011988887777 (14 dígitos) -> 011988887777 -> 11988887777
  if (digits.startsWith('55') && digits.length >= 13) {
    digits = digits.slice(2);
  }

  // 4. Remove prefixo nacional único '0' antes do DDD se presente
  // Exemplo: 011988887777 (12 dígitos) -> 11988887777 (11 dígitos)
  if (digits.startsWith('0') && digits.length === 12) {
    digits = digits.slice(1);
  }

  // 5. Validação de quantidade total de dígitos
  // Se tiver 8 ou 9 dígitos: não possui DDD
  if (digits.length <= 9) {
    return {
      isValid: false,
      normalized: null,
      formatted: null,
      error: 'Informe o telefone com DDD. Ex.: (11) 98888-7777.'
    };
  }

  // Se tiver 10 dígitos: provavelmente falta o 9º dígito (ex: 1188887777)
  if (digits.length === 10) {
    return {
      isValid: false,
      normalized: null,
      formatted: null,
      error: 'Informe um telefone celular válido com DDD. Ex.: (11) 98888-7777.'
    };
  }

  // Se tiver tamanho diferente de 11 dígitos
  if (digits.length !== 11) {
    return {
      isValid: false,
      normalized: null,
      formatted: null,
      error: 'Informe um telefone celular válido com DDD. Ex.: (11) 98888-7777.'
    };
  }

  // 6. Validação do DDD
  const ddd = digits.slice(0, 2);
  if (!VALID_BRAZILIAN_DDDS.has(ddd)) {
    return {
      isValid: false,
      normalized: null,
      formatted: null,
      error: 'DDD inválido. Informe um DDD brasileiro válido.'
    };
  }

  // 7. Validação do 9º dígito (para celular móvel, o primeiro dígito após o DDD deve ser 9)
  const firstMobileDigit = digits.charAt(2);
  if (firstMobileDigit !== '9') {
    return {
      isValid: false,
      normalized: null,
      formatted: null,
      error: 'Informe um telefone celular válido com DDD. Ex.: (11) 98888-7777.'
    };
  }

  // 8. Formatação para exibição: (XX) 9XXXX-XXXX
  const formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;

  return {
    isValid: true,
    normalized: digits,
    formatted,
    error: null
  };
}

/**
 * Formata um telefone enquanto o usuário digita na interface.
 */
export function formatPhoneMask(value: string): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '').slice(0, 11);
  
  if (digits.length <= 2) {
    return digits.length > 0 ? `(${digits}` : '';
  }
  if (digits.length <= 7) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

