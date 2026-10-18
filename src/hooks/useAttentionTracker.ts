import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackEvent } from '../lib/analytics';

/**
 * useAttentionTracker
 * Rastreia comportamento em alto nível:
 * - Tempo ativo na aba (desconta aba em segundo plano)
 * - Marcos de permanência (5s, 15s, 30s, 60s, 180s)
 * - Profundidade máxima de rolagem (25%, 50%, 75%, 90%, 100%)
 * - Ponto de saída (qual seção o usuário estava quando fechou/saiu)
 * - Seções observadas (tempo de atenção em cada bloco com IntersectionObserver)
 */
export function useAttentionTracker() {
  const location = useLocation();
  const activeSecondsRef = useRef(0);
  const maxScrollRef = useRef(0);
  const currentSectionRef = useRef<string>('hero');
  const sectionTimesRef = useRef<Record<string, number>>({});
  const milestonesReachedRef = useRef<Set<number>>(new Set());
  const scrollMilestonesReachedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    // Reset para cada rota
    activeSecondsRef.current = 0;
    maxScrollRef.current = 0;
    currentSectionRef.current = 'hero';
    sectionTimesRef.current = {};
    milestonesReachedRef.current = new Set();
    scrollMilestonesReachedRef.current = new Set();

    let isTabActive = document.visibilityState === 'visible';

    const handleVisibilityChange = () => {
      isTabActive = document.visibilityState === 'visible';
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 1. Contador de Tempo Ativo por Segundo
    const interval = setInterval(() => {
      if (!isTabActive) return;

      activeSecondsRef.current += 1;
      const sec = activeSecondsRef.current;

      // Incrementa tempo na seção atual
      const cur = currentSectionRef.current || 'topo';
      sectionTimesRef.current[cur] = (sectionTimesRef.current[cur] || 0) + 1;

      // Marcos de Permanência (5s, 15s, 30s, 60s, 180s)
      const milestones = [5, 15, 30, 60, 180];
      for (const m of milestones) {
        if (sec >= m && !milestonesReachedRef.current.has(m)) {
          milestonesReachedRef.current.add(m);
          trackEvent(`dwell_${m}s`, {
            eventType: 'click',
            metadata: {
              active_seconds: m,
              current_section: cur,
              max_scroll: maxScrollRef.current,
            },
          });
        }
      }
    }, 1000);

    // 2. Rastreamento de Profundidade de Scroll
    const handleScroll = () => {
      const h = document.documentElement;
      const b = document.body;
      const st = 'scrollTop';
      const sh = 'scrollHeight';
      const scrollPercent = Math.min(
        100,
        Math.round(((h[st] || b[st]) / ((h[sh] || b[sh]) - h.clientHeight)) * 100) || 0
      );

      if (scrollPercent > maxScrollRef.current) {
        maxScrollRef.current = scrollPercent;
      }

      // Marcos de Scroll (25%, 50%, 75%, 90%)
      const scrollMilestones = [25, 50, 75, 90];
      for (const sm of scrollMilestones) {
        if (scrollPercent >= sm && !scrollMilestonesReachedRef.current.has(sm)) {
          scrollMilestonesReachedRef.current.add(sm);
          trackEvent(`scroll_depth_${sm}`, {
            eventType: 'click',
            metadata: {
              depth_percent: sm,
              active_seconds: activeSecondsRef.current,
              current_section: currentSectionRef.current,
            },
          });
        }
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    // 3. IntersectionObserver para saber qual seção prende o olhar
    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              const secId =
                entry.target.id ||
                entry.target.getAttribute('data-section') ||
                entry.target.className.split(' ')[0] ||
                'secao';
              currentSectionRef.current = secId;
            }
          }
        },
        { threshold: 0.35 }
      );

      // Observa seções na landing page
      const sections = document.querySelectorAll('section, [data-section], main > div');
      sections.forEach((sec) => observer?.observe(sec));
    }

    // 4. Ponto de Saída ao Fechar ou Mudar de Página
    const handleExit = () => {
      if (activeSecondsRef.current > 0) {
        trackEvent('session_exit', {
          eventType: 'click',
          metadata: {
            total_seconds: activeSecondsRef.current,
            max_scroll: maxScrollRef.current,
            exit_section: currentSectionRef.current,
            section_breakdown: sectionTimesRef.current,
          },
        });
      }
    };

    window.addEventListener('beforeunload', handleExit);
    window.addEventListener('pagehide', handleExit);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('beforeunload', handleExit);
      window.removeEventListener('pagehide', handleExit);
      if (observer) observer.disconnect();
      handleExit();
    };
  }, [location.pathname]);
}
