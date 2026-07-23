/** App origin + Vite base, always with trailing slash. */
export function appBaseUrl(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}`.replace(/\/?$/, '/')
}

/**
 * Where Supabase should send users after Magic Link / email confirm.
 * Always use the current page origin so production never falls back to localhost
 * when Site URL in the dashboard is still the default.
 */
export function authEmailRedirectTo(): string {
  return appBaseUrl()
}

export function absoluteAppPath(path: string): string {
  const clean = path.replace(/^\//, '')
  return `${appBaseUrl()}${clean}`
}
