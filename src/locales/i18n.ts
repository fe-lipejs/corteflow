import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import pt from './pt.json';
import en from './en.json';
import es from './es.json';
import fr from './fr.json';
import de from './de.json';

// Nível 1: Detecção básica para Landing Page / Login
// O idioma será travado (Nível 2) após o login com base em tenants.language

const resources = {
  pt: { translation: pt },
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: navigator.language.split('-')[0], // simple auto-detection
    fallbackLng: 'pt',
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
  });

export default i18n;
