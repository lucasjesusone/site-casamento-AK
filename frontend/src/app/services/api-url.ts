interface SiteRuntimeConfig {
  apiBaseUrl?: string;
}

const runtimeConfig = (globalThis as typeof globalThis & { __SITE_CONFIG__?: SiteRuntimeConfig }).__SITE_CONFIG__;
const apiBaseUrl = (runtimeConfig?.apiBaseUrl || '').replace(/\/$/, '');

export function apiUrl(path: string): string {
  return `${apiBaseUrl}${path}`;
}