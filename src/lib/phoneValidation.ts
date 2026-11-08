/**
 * Validação, máscara e normalização de telefones brasileiros (DDD + Celular ou Fixo)
 * e geração de links para WhatsApp (https://wa.me/55DDDNUMERO).
 */

export const VALID_BR_DDDS = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19', // SP
  '21', '22', '24', '27', '28',                         // RJ / ES
  '31', '32', '33', '34', '35', '37', '38',             // MG
  '41', '42', '43', '44', '45', '46', '47', '48', '49', // PR / SC
  '51', '53', '54', '55',                               // RS
  '61', '62', '63', '64', '65', '66', '67', '68', '69', // DF / GO / TO / MT / MS / AC / RO
  '71', '73', '74', '75', '77', '79',                   // BA / SE
  '81', '82', '83', '84', '85', '86', '87', '88', '89', // PE / AL / PB / RN / CE / PI
  '91', '92', '93', '94', '95', '96', '97', '98', '99', // PA / AM / RR / AP / MA
]);

/**
 * Extrai apenas os dígitos do telefone brasileiro (10 ou 11 dígitos),
 * removendo o DDI 55 caso o cliente tenha colado "+55 27 99999-9999".
 */
export function normalizeBrPhoneDigits(raw: string | null | undefined): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return '';

  // Se o usuário colou com código do país 55 (12 ou 13 dígitos) e o DDD subsequente é válido
  if (
    (digits.length === 12 || digits.length === 13) &&
    digits.startsWith('55') &&
    VALID_BR_DDDS.has(digits.slice(2, 4))
  ) {
    return digits.slice(2, 13);
  }

  return digits.slice(0, 11);
}

/**
 * Aplica máscara dinâmica brasileira:
 * - Celular (11 dígitos): (27) 99999-9999
 * - Fixo (10 dígitos):    (27) 3333-4444
 */
export function formatBrPhoneMask(raw: string | null | undefined): string {
  const digits = normalizeBrPhoneDigits(raw);
  if (!digits) return '';

  if (digits.length <= 2) {
    return `(${digits}`;
  }
  const ddd = digits.slice(0, 2);
  const subscriber = digits.slice(2);

  if (subscriber.length <= 4) {
    return `(${ddd}) ${subscriber}`;
  }
  if (subscriber.length <= 8) {
    // Formato 10 dígitos (fixo ou em digitação): (27) 3333-4444
    return `(${ddd}) ${subscriber.slice(0, 4)}-${subscriber.slice(4)}`;
  }
  // Formato 11 dígitos (celular): (27) 99999-9999
  return `(${ddd}) ${subscriber.slice(0, 5)}-${subscriber.slice(5, 9)}`;
}

export interface PhoneValidationResult {
  valid: boolean;
  error?: string;
  digits: string;
  formatted: string;
  whatsappUrl: string | null;
}

/**
 * Valida telefone brasileiro verificando DDD válido, quantidade de dígitos (10 ou 11)
 * e regra de celular/fixo, retornando mensagens simples e claras para o cliente.
 */
export function validateBrPhone(raw: string | null | undefined): PhoneValidationResult {
  const digits = normalizeBrPhoneDigits(raw);
  const formatted = formatBrPhoneMask(digits);

  if (!digits) {
    return {
      valid: false,
      error: 'Digite seu telefone com DDD. Exemplo: (27) 99999-9999',
      digits: '',
      formatted: '',
      whatsappUrl: null,
    };
  }

  if (digits.length < 2) {
    return {
      valid: false,
      error: 'Informe o DDD com 2 dígitos + seu número. Exemplo: (27) 99999-9999',
      digits,
      formatted,
      whatsappUrl: null,
    };
  }

  const ddd = digits.slice(0, 2);
  if (!VALID_BR_DDDS.has(ddd)) {
    return {
      valid: false,
      error: `O DDD (${ddd}) não existe no Brasil. Digite um DDD válido, ex: (27) 99999-9999`,
      digits,
      formatted,
      whatsappUrl: null,
    };
  }

  if (digits.length < 10) {
    return {
      valid: false,
      error: 'Telefone incompleto. Digite o DDD + número completo. Ex: (27) 99999-9999',
      digits,
      formatted,
      whatsappUrl: null,
    };
  }

  const subscriber = digits.slice(2);

  // Bloquear sequências totalmente zeradas como (27) 00000-0000
  if (/^0+$/.test(subscriber)) {
    return {
      valid: false,
      error: 'Informe um número de telefone válido. Exemplo: (27) 99999-9999',
      digits,
      formatted,
      whatsappUrl: null,
    };
  }

  if (digits.length === 11) {
    // Celular de 9 dígitos sempre começa com 9 após o DDD
    if (subscriber[0] !== '9') {
      return {
        valid: false,
        error: 'Celular com 9 dígitos deve começar com 9 após o DDD. Ex: (27) 99999-9999',
        digits,
        formatted,
        whatsappUrl: null,
      };
    }
  } else if (digits.length === 10) {
    // Se tem 10 dígitos mas começa com 9, faltou 1 dígito do celular
    if (subscriber[0] === '9') {
      return {
        valid: false,
        error: 'Falta 1 dígito no seu celular. Exemplo: (27) 99999-9999',
        digits,
        formatted,
        whatsappUrl: null,
      };
    }
    if (subscriber[0] === '0' || subscriber[0] === '1') {
      return {
        valid: false,
        error: 'Número inválido. Informe celular ou fixo válido com DDD. Ex: (27) 99999-9999',
        digits,
        formatted,
        whatsappUrl: null,
      };
    }
  }

  return {
    valid: true,
    digits,
    formatted,
    whatsappUrl: `https://wa.me/55${digits}`,
  };
}

/**
 * Constrói o link oficial `https://wa.me/55DDDNUMERO` a partir do telefone cadastrado do cliente.
 * Retorna `null` se não houver telefone válido.
 */
export function buildWhatsAppUrl(rawPhone: string | null | undefined): string | null {
  if (!rawPhone) return null;
  const rawDigits = rawPhone.replace(/\D/g, '');
  if (!rawDigits) return null;

  const normalized = normalizeBrPhoneDigits(rawPhone);
  if (normalized.length === 10 || normalized.length === 11) {
    return `https://wa.me/55${normalized}`;
  }

  // Fallback para telefones internacionais que já possuam DDI
  if (rawDigits.length >= 12 && rawDigits.length <= 15) {
    return `https://wa.me/${rawDigits}`;
  }

  return null;
}

