import type { ExtractConfig } from './types';

// Patterns that indicate auto-generated IDs (unstable across deploys)
export const AUTO_GENERATED_ID_PATTERN =
  /^(ember|react|vue|ng|svelte|_|js-|rc-|radix-|headlessui-)\d|^[0-9a-f]{8}-[0-9a-f]{4}-|^:r[0-9a-z]+:$/i;

// Class patterns that look auto-generated (CSS-in-JS hashes, Tailwind arbitrary, etc.)
const UNSTABLE_CLASS_PATTERN = /^(css|sc|styled|emotion|_)-?[a-z0-9]{4,}$|^[a-z]{1,2}[A-Z][a-zA-Z0-9]{3,}$/;

/**
 * Robustness tiers for CSS selectors (lower = more stable).
 */
export function selectorRobustnessScore(selector: string): number {
  if (/\[data-/.test(selector)) return 1;
  if (/#[^:\s]+/.test(selector) && !AUTO_GENERATED_ID_PATTERN.test(selector.replace('#', ''))) return 2;
  if (/\[role=/.test(selector) || /\[aria-/.test(selector)) return 3;
  if (/\.\w/.test(selector)) {
    const classes = selector.match(/\.[\w-]+/g) ?? [];
    const unstableCount = classes.filter((c) => UNSTABLE_CLASS_PATTERN.test(c.slice(1))).length;
    return unstableCount > 0 ? 5 : 4;
  }
  if (/:nth-child/.test(selector) || />/.test(selector)) return 6;
  return 7;
}

/**
 * Build a short selector fragment for a single element (no tree walk).
 * Returns null if nothing useful can be built.
 */
function elementFragment(el: Element): string | null {
  // Prefer stable ID
  if (el.id && !AUTO_GENERATED_ID_PATTERN.test(el.id)) {
    return `#${CSS.escape(el.id)}`;
  }
  // data-testid or similar
  for (const attr of el.attributes) {
    if (attr.name.startsWith('data-') && attr.name !== 'data-reactid') {
      return `[${attr.name}="${CSS.escape(attr.value)}"]`;
    }
  }
  // role + optional aria-label
  const role = el.getAttribute('role');
  if (role) {
    const label = el.getAttribute('aria-label');
    return label ? `[role="${role}"][aria-label="${CSS.escape(label)}"]` : `[role="${role}"]`;
  }
  // Stable class
  for (const cls of el.classList) {
    if (!UNSTABLE_CLASS_PATTERN.test(cls)) {
      return `${el.tagName.toLowerCase()}.${CSS.escape(cls)}`;
    }
  }
  return null;
}

/**
 * Collect all direct attribute-based candidate selectors for an element.
 */
function collectAttributeCandidates(element: Element): string[] {
  const candidates: string[] = [];

  // data-* attributes
  for (const attr of element.attributes) {
    if (attr.name.startsWith('data-') && attr.name !== 'data-reactid') {
      candidates.push(`[${attr.name}="${CSS.escape(attr.value)}"]`);
    }
  }

  // ID (if not auto-generated)
  if (element.id && !AUTO_GENERATED_ID_PATTERN.test(element.id)) {
    candidates.push(`#${CSS.escape(element.id)}`);
  }

  // ARIA / role
  const role = element.getAttribute('role');
  if (role) {
    const label = element.getAttribute('aria-label');
    candidates.push(label ? `[role="${role}"][aria-label="${CSS.escape(label)}"]` : `[role="${role}"]`);
  }

  // Stable class-based
  for (const cls of element.classList) {
    if (!UNSTABLE_CLASS_PATTERN.test(cls)) {
      candidates.push(`${element.tagName.toLowerCase()}.${CSS.escape(cls)}`);
    }
  }

  return candidates;
}

/**
 * Build an ancestor-scoped selector: find the nearest ancestor with a unique
 * attribute (up to 5 levels), then append a short child path.
 * e.g. "#sidebar > ul > li.active" — O(depth) attribute reads, no tree walk.
 */
function buildAncestorSelector(element: Element): string | null {
  const path: string[] = [];
  let current: Element | null = element;
  const maxDepth = 5;

  for (let depth = 0; depth < maxDepth && current && current !== document.body; depth++) {
    const frag = elementFragment(current);
    if (frag) {
      // Found an anchor — build the selector
      path.unshift(frag);
      const selector = path.join(' > ');
      try {
        const matches = document.querySelectorAll(selector);
        if (matches.length > 0 && Array.from(matches).includes(element)) {
          return selector;
        }
      } catch {
        // invalid selector
      }
    }
    // Add current tag to path and go up
    if (depth > 0 || !frag) {
      path.unshift(current.tagName.toLowerCase());
    }
    current = current.parentElement;
  }

  return null;
}

/**
 * Generate the best CSS selector for an element, plus ranked alternatives.
 * Uses only attribute reads + ancestor walking — no expensive DOM tree traversal.
 */
export function generateSelectors(element: Element): { best: string; alternatives: string[] } {
  const candidates = collectAttributeCandidates(element);

  // Add ancestor-scoped selector for more specific matching
  const ancestorSel = buildAncestorSelector(element);
  if (ancestorSel) {
    candidates.push(ancestorSel);
  }

  // Deduplicate and validate (each must actually select the target element)
  const seen = new Set<string>();
  const valid: string[] = [];

  for (const sel of candidates) {
    if (seen.has(sel)) continue;
    seen.add(sel);
    try {
      const matches = document.querySelectorAll(sel);
      if (matches.length > 0 && Array.from(matches).includes(element)) {
        valid.push(sel);
      }
    } catch {
      // invalid selector
    }
  }

  // Sort by robustness (most stable first)
  valid.sort((a, b) => selectorRobustnessScore(a) - selectorRobustnessScore(b));

  const best = valid[0] ?? element.tagName.toLowerCase();
  const alternatives = valid.slice(1, 5);

  return { best, alternatives };
}

/**
 * Count how many elements match a selector on the current page.
 */
export function countMatches(selector: string): number {
  try {
    return document.querySelectorAll(selector).length;
  } catch {
    return 0;
  }
}

/**
 * Lightweight selector generation for hover preview.
 * Does NOT call finder() — uses only O(1) attribute reads + querySelectorAll
 * validation. Typical cost: <2ms even on 10,000+ node DOMs.
 */
export function generateQuickSelector(element: Element): { selector: string; matchCount: number } {
  const candidates = collectAttributeCandidates(element);

  // Pick the best candidate — validate + count in one querySelectorAll call
  let bestSelector = element.tagName.toLowerCase();
  let bestScore = 7;
  let bestMatchCount = countMatches(bestSelector);

  const seen = new Set<string>();
  for (const sel of candidates) {
    if (seen.has(sel)) continue;
    seen.add(sel);

    const score = selectorRobustnessScore(sel);
    if (score >= bestScore) continue; // skip if not better

    try {
      const matches = document.querySelectorAll(sel);
      if (matches.length > 0 && Array.from(matches).includes(element)) {
        bestSelector = sel;
        bestScore = score;
        bestMatchCount = matches.length;
      }
    } catch {
      // invalid selector
    }
  }

  return { selector: bestSelector, matchCount: bestMatchCount };
}

/**
 * Get useful attributes from an element for the side panel display.
 */
export function getElementAttributes(element: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  const interesting = ['id', 'class', 'href', 'src', 'alt', 'title', 'role', 'aria-label', 'data-testid'];

  for (const name of interesting) {
    const value = element.getAttribute(name);
    if (value) attrs[name] = value;
  }

  return attrs;
}

// ── Data Extraction for Preview ──

/**
 * Extract data from a single element based on the extract config.
 */
export function extractDataFromElement(element: Element, config: ExtractConfig): string {
  switch (config.type) {
    case 'text':
      return element.textContent?.trim() ?? '';

    case 'html':
      return element.innerHTML;

    case 'attribute':
      return element.getAttribute(config.attribute ?? '') ?? '';

    default:
      return '';
  }
}

/**
 * Extract data from all elements matching a selector.
 * Returns up to 10 samples for preview purposes.
 */
export function extractDataFromSelector(selector: string, config: ExtractConfig): string[] {
  try {
    const elements = document.querySelectorAll(selector);
    const samples: string[] = [];

    for (let i = 0; i < Math.min(elements.length, 10); i++) {
      samples.push(extractDataFromElement(elements[i], config));
    }

    return samples;
  } catch {
    return [];
  }
}
