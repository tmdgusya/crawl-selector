import type { ExtractConfig } from './types';

/** Strip protocol and convert URL to a glob-like pattern. */
export function urlToPattern(url: string): string {
  try {
    const u = new URL(url);
    // e.g. "https://news.ycombinator.com/item?id=123" → "news.ycombinator.com/item*"
    const path = u.pathname === '/' ? '/*' : u.pathname + '*';
    return u.hostname + path;
  } catch {
    return url;
  }
}

export function guessFieldName(selector: string, attributes: Record<string, string>): string {
  // Try to derive a meaningful name from the selector or attributes
  const testId = attributes['data-testid'];
  if (testId) return toSnakeCase(testId);

  const ariaLabel = attributes['aria-label'];
  if (ariaLabel) return toSnakeCase(ariaLabel.slice(0, 30));

  // Extract meaningful parts from selector
  const classMatch = selector.match(/\.([\w-]+)/);
  if (classMatch) return toSnakeCase(classMatch[1]);

  const idMatch = selector.match(/#([\w-]+)/);
  if (idMatch) return toSnakeCase(idMatch[1]);

  return 'field_' + Date.now().toString(36).slice(-4);
}

export function guessExtractConfig(selector: string, attributes: Record<string, string>): ExtractConfig {
  if (attributes.href) return { type: 'attribute', attribute: 'href' };
  if (attributes.src) return { type: 'attribute', attribute: 'src' };
  return { type: 'text' };
}

export function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s\-]+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toLowerCase()
    .slice(0, 40);
}
