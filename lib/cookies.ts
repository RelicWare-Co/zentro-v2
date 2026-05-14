export function setSidebarCookie(name: string, value: boolean, maxAge: number) {
  // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API lacks universal browser support; document.cookie is the only cross-browser way to persist sidebar state for SSR hydration.
  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}`;
}
