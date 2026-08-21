/**
 * tenantUrl.ts
 *
 * Centralizes tenant URL generation.
 * - Production: slug.raffros.com
 * - Dev (localhost / ngrok): /slug  (path-based, no DNS setup needed)
 */

const PRODUCTION_DOMAIN = 'raffros.com';

/** True when running locally or via ngrok tunnel. */
function isDevEnvironment(): boolean {
  const h = window.location.hostname;
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h.endsWith('.ngrok.io') ||
    h.endsWith('.ngrok-free.app') ||
    h.endsWith('.netlify.app')
  );
}

/** Full public URL for a tenant's store page. */
export function getTenantPublicUrl(slug: string): string {
  if (!slug) return '/';
  if (isDevEnvironment()) return `/${slug}`;
  return `${window.location.protocol}//${slug}.${PRODUCTION_DOMAIN}`;
}

/** Portal URL used in booking confirmations (POST-payment redirect). */
export function getTenantPortalUrl(slug: string): string {
  if (!slug) return '/';
  if (isDevEnvironment()) return `${window.location.origin}/${slug}/portal`;
  return `${window.location.protocol}//${slug}.${PRODUCTION_DOMAIN}/portal`;
}

/** Success page URL (POST-payment redirect). */
export function getTenantSuccessUrl(slug: string): string {
  if (!slug) return '/';
  if (isDevEnvironment()) return `${window.location.origin}/${slug}/sucesso`;
  return `${window.location.protocol}//${slug}.${PRODUCTION_DOMAIN}/sucesso`;
}


