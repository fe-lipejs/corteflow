import { useParams } from 'react-router-dom';

/**
 * useTenantSlug
 *
 * Returns the tenant slug from React Router's :slug param.
 * All public tenant pages are now path-based (e.g. raffros.com/salao-do-joao).
 */
export function useTenantSlug(): string | null {
  const { slug: paramSlug } = useParams<{ slug?: string }>();
  return paramSlug ?? null;
}

