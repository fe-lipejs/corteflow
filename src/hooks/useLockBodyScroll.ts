import { useEffect } from 'react';

let activeLocks = 0;
let savedHtmlOverflow = '';
let savedHtmlOverscroll = '';
let savedBodyOverflow = '';
let savedBodyOverscroll = '';

/**
 * Bloqueia o scroll da página de fundo enquanto o modal/sheet estiver aberto,
 * mantendo habilitado apenas o scroll interno do próprio modal/sheet.
 * Restaura exatamente o estado original ao fechar.
 */
export function useLockBodyScroll(locked: boolean = true) {
  useEffect(() => {
    if (!locked || typeof document === 'undefined') return;

    const html = document.documentElement;
    const body = document.body;

    if (activeLocks === 0) {
      savedHtmlOverflow = html.style.overflow;
      savedHtmlOverscroll = html.style.overscrollBehavior;
      savedBodyOverflow = body.style.overflow;
      savedBodyOverscroll = body.style.overscrollBehavior;

      html.style.overflow = 'hidden';
      html.style.overscrollBehavior = 'none';
      body.style.overflow = 'hidden';
      body.style.overscrollBehavior = 'none';
    }

    activeLocks += 1;

    return () => {
      activeLocks = Math.max(0, activeLocks - 1);
      if (activeLocks === 0) {
        html.style.overflow = savedHtmlOverflow;
        html.style.overscrollBehavior = savedHtmlOverscroll;
        body.style.overflow = savedBodyOverflow;
        body.style.overscrollBehavior = savedBodyOverscroll;
      }
    };
  }, [locked]);
}
