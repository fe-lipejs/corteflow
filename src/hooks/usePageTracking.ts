import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../lib/analytics';

/**
 * Hook to automatically log page views whenever route changes
 */
export function usePageTracking() {
  const location = useLocation();

  useEffect(() => {
    // Delay slightly so document.title can update
    const timeout = setTimeout(() => {
      trackPageView(location.pathname + location.search);
    }, 150);

    return () => clearTimeout(timeout);
  }, [location.pathname, location.search]);
}

