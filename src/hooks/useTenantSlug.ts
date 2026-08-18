import { useParams } from 'react-router-dom';

/**
 * useTenantSlug
 *
 * Returns the tenant slug from the current context:
 * - Production (*.raffros.com): extracted from the hostname subdomain.
 * - Development (localhost / ngrok): extracted from React Router's :slug param.
 *
 * This hook is the single source of truth for the public tenant pages.
 * Swap this hook and nothing else changes.
 */
export function useTenantSlug(): string | null {
  // React Router path param (available in dev via /:slug routes)
  const { slug: paramSlug } = useParams<{ slug?: string }>();

  const hostname = window.location.hostname;
  const isLocalDev =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.ngrok.io') ||
    hostname.endsWith('.ngrok-free.app');

  if (isLocalDev) {
    // Dev mode: use the path param (:slug)
    return paramSlug ?? null;
  }

  // Production mode: extract subdomain from hostname
  // e.g. "kauan-barbearia.raffros.com" → "kauan-barbearia"
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    const subdomain = parts[0];
    // Exclude reserved subdomains
    if (subdomain !== 'app' && subdomain !== 'admin' && subdomain !== 'www') {
      return subdomain;
    }
  }

  // Fallback: if somehow on app/admin subdomain, no tenant slug
  return null;
}
