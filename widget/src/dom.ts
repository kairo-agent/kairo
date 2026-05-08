// Tiny DOM helpers — no framework. Keeps bundle <50KB gzip.

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  attrs?: Record<string, string>
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (attrs) for (const k in attrs) node.setAttribute(k, attrs[k]);
  return node;
}

export function svg(viewBox: string, paths: string): string {
  return `<svg viewBox="${viewBox}" aria-hidden="true">${paths}</svg>`;
}

export const ICON_CHAT = svg(
  '0 0 24 24',
  '<path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8l-5 4V6a2 2 0 0 1 1-2z"/><circle cx="9" cy="11" r="1"/><circle cx="13" cy="11" r="1"/><circle cx="17" cy="11" r="1"/>'
);

export const ICON_CLOSE = svg(
  '0 0 24 24',
  '<path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>'
);

export const ICON_SEND = svg(
  '0 0 24 24',
  '<path d="M3 11.5 21 3l-7.2 18-2.4-7.2L3 11.5z"/>'
);

export const ICON_LOGO = svg(
  '0 0 24 24',
  '<path d="M12 3 4 7v6c0 4.5 3.4 8.5 8 9 4.6-.5 8-4.5 8-9V7l-8-4z"/>'
);

export function focus(node: HTMLElement | null): void {
  if (node && typeof node.focus === 'function') {
    setTimeout(() => node.focus(), 0);
  }
}

/** Escape user-provided text before inserting into innerHTML/templates. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
