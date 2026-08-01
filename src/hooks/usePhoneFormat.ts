import { useCallback, useMemo } from 'react';

type CountryCode = 'BR' | 'US' | 'FR' | 'ES' | 'DE' | 'GB' | 'PT';

interface PhoneConfig {
  mask: string;
  placeholder: string;
  countryCode: string;
  maxLength: number;
}

const PHONE_CONFIGS: Record<CountryCode, PhoneConfig> = {
  BR: {
    mask: '(##) #####-####',
    placeholder: '(27) 99730-3135',
    countryCode: '+55',
    maxLength: 15,
  },
  US: {
    mask: '(###) ###-####',
    placeholder: '(555) 123-4567',
    countryCode: '+1',
    maxLength: 14,
  },
  GB: {
    mask: '#### ### ####',
    placeholder: '0712 345 6789',
    countryCode: '+44',
    maxLength: 13,
  },
  FR: {
    mask: '## ## ## ## ##',
    placeholder: '06 12 34 56 78',
    countryCode: '+33',
    maxLength: 14,
  },
  ES: {
    mask: '### ## ## ##',
    placeholder: '612 34 56 78',
    countryCode: '+34',
    maxLength: 12,
  },
  DE: {
    mask: '#### #######',
    placeholder: '0151 1234567',
    countryCode: '+49',
    maxLength: 13,
  },
  PT: {
    mask: '### ### ###',
    placeholder: '912 345 678',
    countryCode: '+351',
    maxLength: 11,
  },
};

// Map language codes to country codes for phone formatting
const LANG_TO_COUNTRY: Record<string, CountryCode> = {
  pt: 'BR',
  en: 'US',
  fr: 'FR',
  es: 'ES',
  de: 'DE',
};

function applyMask(value: string, mask: string): string {
  const digits = value.replace(/\D/g, '');
  let result = '';
  let digitIndex = 0;

  for (let i = 0; i < mask.length && digitIndex < digits.length; i++) {
    if (mask[i] === '#') {
      result += digits[digitIndex];
      digitIndex++;
    } else {
      result += mask[i];
    }
  }

  return result;
}

function validatePhone(value: string, country: CountryCode): boolean {
  const digits = value.replace(/\D/g, '');
  const config = PHONE_CONFIGS[country];

  // Count # in mask to know expected digit count
  const expectedDigits = (config.mask.match(/#/g) || []).length;
  return digits.length === expectedDigits;
}

export function usePhoneFormat(language: string = 'pt') {
  const country = useMemo<CountryCode>(() => {
    return LANG_TO_COUNTRY[language] || 'BR';
  }, [language]);

  const config = useMemo(() => PHONE_CONFIGS[country], [country]);

  const format = useCallback(
    (value: string): string => {
      return applyMask(value, config.mask);
    },
    [config.mask]
  );

  const validate = useCallback(
    (value: string): boolean => {
      return validatePhone(value, country);
    },
    [country]
  );

  const getDigits = useCallback((value: string): string => {
    return value.replace(/\D/g, '');
  }, []);

  return {
    format,
    validate,
    getDigits,
    mask: config.mask,
    placeholder: config.placeholder,
    countryCode: config.countryCode,
    maxLength: config.maxLength,
    country,
  };
}
