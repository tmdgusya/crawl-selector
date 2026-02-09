/**
 * Element picker — the core interaction loop.
 * Handles mousemove (hover highlight) and click (element selection).
 *
 * Performance optimizations for large-DOM pages (LinkedIn, etc.):
 * - rAF throttle: process hover at most once per animation frame
 * - WeakMap cache: skip selector generation on re-hover of same element
 * - Message debounce: batch ELEMENT_HOVERED messages to background (100ms)
 * - Attribute-based selectors only (no expensive DOM tree traversal)
 */

import { generateSelectors, generateQuickSelector, getElementAttributes, extractDataFromElement, extractDataFromSelector } from '../shared/selector-generator';
import type { ExtractConfig } from '../shared/types';
import { highlightHover, highlightSelected, clearHover, clearAllHighlights, destroyHighlighter } from './highlighter';
import { showTooltip, hideTooltip, destroyTooltip } from './tooltip';

let active = false;
let lastHovered: Element | null = null;

// --- Performance state ---
let rafId: number | null = null;
let selectorCache = new WeakMap<Element, { selector: string; matchCount: number }>();
let hoverMsgTimer: ReturnType<typeof setTimeout> | null = null;

function guessExtractConfig(element: Element): ExtractConfig {
  if (element.getAttribute('href')) return { type: 'attribute', attribute: 'href' };
  if (element.getAttribute('src')) return { type: 'attribute', attribute: 'src' };
  if (element.getAttribute('data-testid')) return { type: 'attribute', attribute: 'data-testid' };
  return { type: 'text' };
}

function processHover(e: MouseEvent): void {
  const target = e.target as Element;
  if (!target || target === lastHovered) return;

  // Skip our own overlay elements
  if (target.id === 'crawl-selector-tooltip' || target.id === 'crawl-selector-highlighter') return;

  lastHovered = target;

  const t0 = performance.now();

  // Use cached result or generate a quick selector
  let cached = selectorCache.get(target);
  const wasCached = !!cached;
  if (!cached) {
    cached = generateQuickSelector(target);
    selectorCache.set(target, cached);
  }

  const t1 = performance.now();
  const { selector, matchCount } = cached;

  const extractConfig = guessExtractConfig(target);
  const samples = extractDataFromSelector(selector, extractConfig);
  const previewData = { samples, extractType: extractConfig.type as 'text' | 'html' | 'attribute' };

  highlightHover(target);
  const t2 = performance.now();

  showTooltip(e.clientX, e.clientY, selector, matchCount, target.tagName, previewData);
  const t3 = performance.now();

  const total = t3 - t0;
  if (total > 2) {
    console.debug(
      `[picker-perf] ${total.toFixed(1)}ms total | selector=${(t1 - t0).toFixed(1)}ms${wasCached ? '(cached)' : ''} highlight=${(t2 - t1).toFixed(1)}ms tooltip=${(t3 - t2).toFixed(1)}ms | "${selector}"`,
    );
  }

  // Debounced notify to background (100ms)
  if (hoverMsgTimer !== null) {
    clearTimeout(hoverMsgTimer);
  }
  hoverMsgTimer = setTimeout(() => {
    hoverMsgTimer = null;
    chrome.runtime.sendMessage({
      type: 'ELEMENT_HOVERED',
      selector,
      matchCount,
      tagName: target.tagName,
      previewData,
    }).catch(() => {
      // Side panel might not be open
    });
  }, 100);
}

function onMouseMove(e: MouseEvent): void {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
  }
  const mouseEvent = e;
  rafId = requestAnimationFrame(() => {
    rafId = null;
    processHover(mouseEvent);
  });
}

function onClick(e: MouseEvent): void {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  const target = e.target as Element;
  if (!target) return;

  // Skip our own elements
  if (target.id === 'crawl-selector-tooltip' || target.id === 'crawl-selector-highlighter') return;

  // Click path uses full generateSelectors for alternative selectors
  const { best, alternatives } = generateSelectors(target);
  const attributes = getElementAttributes(target);
  const extractConfig = guessExtractConfig(target);
  const samples = [extractDataFromElement(target, extractConfig)];
  const previewData = { samples, extractType: extractConfig.type as 'text' | 'html' | 'attribute' };

  highlightSelected(target);

  // Clear any pending hover message
  if (hoverMsgTimer !== null) {
    clearTimeout(hoverMsgTimer);
    hoverMsgTimer = null;
  }

  // Send picked element to background
  chrome.runtime.sendMessage({
    type: 'ELEMENT_PICKED',
    selector: best,
    alternatives,
    attributes,
    previewData,
  }).catch(() => {});
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    deactivatePicker();
    chrome.runtime.sendMessage({ type: 'PICKER_DEACTIVATED' }).catch(() => {});
  }
}

export function activatePicker(): void {
  if (active) return;
  active = true;

  // Use capture phase so we intercept before any page handlers
  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown, true);

  // Change cursor to crosshair
  document.documentElement.style.cursor = 'crosshair';
}

export function deactivatePicker(): void {
  if (!active) return;
  active = false;
  lastHovered = null;

  document.removeEventListener('mousemove', onMouseMove, true);
  document.removeEventListener('click', onClick, true);
  document.removeEventListener('keydown', onKeyDown, true);

  document.documentElement.style.cursor = '';

  // Clean up performance state
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (hoverMsgTimer !== null) {
    clearTimeout(hoverMsgTimer);
    hoverMsgTimer = null;
  }
  selectorCache = new WeakMap();

  clearHover();
  hideTooltip();
  clearAllHighlights();
  destroyHighlighter();
  destroyTooltip();
}

export function isPickerActive(): boolean {
  return active;
}
