// Site base path shared by the router and by any code that builds an
// absolute in-site URL (booking links, previews). The app is served at
// BOTH the GitHub Pages project path (/ekiddy-outreach-ai/) and a domain
// root (app.ekiddy.com), with a relative Vite base ('./'), so the base is
// detected from the live URL at runtime — never hard-coded.
export function getSiteBasePath(): string {
  const base = import.meta.env.BASE_URL as string | undefined;
  if (base && base !== './' && base !== '/') {
    return base.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/ekiddy-outreach-ai')) {
    return '/ekiddy-outreach-ai';
  }
  return '';
}

export function getSiteUrl(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (typeof window === 'undefined') return clean;
  return `${window.location.origin}${getSiteBasePath()}${clean}`;
}
