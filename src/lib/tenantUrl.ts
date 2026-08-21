/**
 * tenantUrl.ts
 *
 * Centralizes tenant URL generation.
 * All environments (dev and prod) now use path-based routing: /slug
 */

/** Full public URL for a tenant's store page. */
export function getTenantPublicUrl(slug: string): string {
  if (!slug) return '/';
  return `${window.location.origin}/${slug}`;
}

/** Portal URL used in booking confirmations (POST-payment redirect). */
export function getTenantPortalUrl(slug: string): string {
  if (!slug) return '/';
  return `${window.location.origin}/${slug}/portal`;
}

/** Success page URL (POST-payment redirect). */
export function getTenantSuccessUrl(slug: string): string {
  if (!slug) return '/';
  return `${window.location.origin}/${slug}/sucesso`;
}

