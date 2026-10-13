/**
 * tenantUrl.ts
 *
 * Centralizes tenant URL generation.
 * All environments (dev and prod) now use path-based routing: /slug
 */

/** Full public URL for a tenant's store page. */
export function getTenantPublicUrl(slug: string, isDemo?: boolean): string {
  if (!slug) return '/';
  if (
    isDemo ||
    (typeof window !== 'undefined' &&
      (window.location.pathname.startsWith('/paginas') || window.location.pathname.startsWith('/testepaginas')))
  ) {
    return `/paginas/${slug}`;
  }
  return `/${slug}`;
}

/** Portal URL used in booking confirmations (POST-payment redirect). */
export function getTenantPortalUrl(slug: string, isDemo?: boolean): string {
  if (!slug) return '/';
  if (
    isDemo ||
    (typeof window !== 'undefined' &&
      (window.location.pathname.startsWith('/paginas') || window.location.pathname.startsWith('/testepaginas')))
  ) {
    return `/paginas/${slug}/portal`;
  }
  return `/${slug}/portal`;
}

/** Success page URL (POST-payment redirect). */
export function getTenantSuccessUrl(slug: string, isDemo?: boolean): string {
  if (!slug) return '/';
  if (
    isDemo ||
    (typeof window !== 'undefined' &&
      (window.location.pathname.startsWith('/paginas') || window.location.pathname.startsWith('/testepaginas')))
  ) {
    return `/paginas/${slug}/sucesso`;
  }
  return `/${slug}/sucesso`;
}

