/**
 * Element picker — the core interaction loop.
 * Handles mousemove (hover highlight) and click (element selection).
 */

import { generateSelectors, countMatches, getElementAttributes, extractDataFromElement, extractDataFromSelector } from '../shared/selector-generator';
import type { ExtractConfig } from '../shared/types';
import { highlightHover, highlightSelected, clearHover, clearAllHighlights, destroyHighlighter } from './highlighter';
import { showTooltip, hideTooltip, destroyTooltip } from './tooltip';

let active = false;
let lastHovered: Element | null = null;

// Performance optimization: RAF throttling
let rafId: number | null = null;
let pendingMouseEvent: MouseEvent | null = null;

// Performance optimization: Cache selector results per element
const selectorCache = new WeakMap<Element, { best: string; alternatives: string[]; timestamp: number }>();
const CACHE_TTL = 2000; // 2 seconds

// Performance optimization: Debounced message sending
let messageTimeout: ReturnType<typeof setTimeout> | null = null;
const MESSAGE_DEBOUNCE_MS = 16; // ~1 frame at 60fps

function guessExtractConfig(element: Element): ExtractConfig {
  // Check for common attributes first
  if (element.getAttribute('href')) return { type: 'attribute', attribute: 'href' };
  if (element.getAttribute('src')) return { type: 'attribute', attribute: 'src' };
  if (element.getAttribute('data-testid')) return { type: 'attribute', attribute: 'data-testid' };

  // Default to text extraction
  return { type: 'text' };
}

// Get cached selectors or generate new ones
function getCachedSelectors(target: Element): { best: string; alternatives: string[] } {
  const now = Date.now();
  const cached = selectorCache.get(target);

  if (cached && now - cached.timestamp < CACHE_TTL) {
    return { best: cached.best, alternatives: cached.alternatives };
  }

  const { best, alternatives } = generateSelectors(target);
  selectorCache.set(target, { best, alternatives, timestamp: now });
  return { best, alternatives };
}

// Debounced message send to reduce IPC overhead
function debouncedSendMessage(message: unknown): void {
  if (messageTimeout) {
    clearTimeout(messageTimeout);
  }
  messageTimeout = setTimeout(() => {
    chrome.runtime.sendMessage(message).catch(() => {
      // Side panel might not be open
    });
  }, MESSAGE_DEBOUNCE_MS);
}

// Process mouse move with throttling via RAF
function processMouseMove(): void {
  rafId = null;

  if (!pendingMouseEvent || !active) return;

  const e = pendingMouseEvent;
  pendingMouseEvent = null;

  const target = e.target as Element;
  if (!target || target === lastHovered) return;

  // Skip our own overlay elements
  if (target.id === 'crawl-selector-tooltip' || target.id === 'crawl-selector-highlighter') return;

  lastHovered = target;

  // Performance profiling
  const start = performance.now();
  const timings: Record<string, number> = {};

  // Use cached selectors for better performance
  const t1 = performance.now();
  const { best } = getCachedSelectors(target);
  timings.selectors = performance.now() - t1;

  const t2 = performance.now();
  const matchCount = countMatches(best);
  timings.countMatches = performance.now() - t2;

  const t3 = performance.now();
  const extractConfig = guessExtractConfig(target);
  timings.extractConfig = performance.now() - t3;

  // Compute preview data - this might be expensive
  const t4 = performance.now();
  const samples = extractDataFromSelector(best, extractConfig);
  timings.extractData = performance.now() - t4;

  const t5 = performance.now();
  highlightHover(target);
  timings.highlight = performance.now() - t5;

  const t6 = performance.now();
  const previewData = { samples, extractType: extractConfig.type as 'text' | 'html' | 'attribute' };
  showTooltip(e.clientX, e.clientY, best, matchCount, target.tagName, previewData);
  timings.tooltip = performance.now() - t6;

  const total = performance.now() - start;

  // Log if slow (> 16ms = 1 frame)
  if (total > 16) {
    console.log('[CrawlSelector] Slow frame:', { total: total.toFixed(2), ...timings, target: target.tagName });
  }

  // Debounced message to reduce IPC overhead
  debouncedSendMessage({
    type: 'ELEMENT_HOVERED',
    selector: best,
    matchCount,
    tagName: target.tagName,
    previewData,
  });
}

function onMouseMove(e: MouseEvent): void {
  // Store the latest event and schedule processing via RAF
  pendingMouseEvent = e;

  if (!rafId) {
    rafId = requestAnimationFrame(processMouseMove);
  }
}

function onClick(e: MouseEvent): void {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  const target = e.target as Element;
  if (!target) return;

  // Skip our own elements
  if (target.id === 'crawl-selector-tooltip' || target.id === 'crawl-selector-highlighter') return;

  // Use cached selectors if available, otherwise generate
  const { best, alternatives } = getCachedSelectors(target);
  const attributes = getElementAttributes(target);
  const extractConfig = guessExtractConfig(target);

  // Compute preview data for the picked element
  const samples = [extractDataFromElement(target, extractConfig)];

  highlightSelected(target);

  const previewData = { samples, extractType: extractConfig.type as 'text' | 'html' | 'attribute' };

  // Clear any pending hover message and send immediately
  if (messageTimeout) {
    clearTimeout(messageTimeout);
    messageTimeout = null;
  }

  // Send picked element to background (include preview data)
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

  // Cancel any pending RAF
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  pendingMouseEvent = null;

  // Clear any pending message
  if (messageTimeout) {
    clearTimeout(messageTimeout);
    messageTimeout = null;
  }

  document.removeEventListener('mousemove', onMouseMove, true);
  document.removeEventListener('click', onClick, true);
  document.removeEventListener('keydown', onKeyDown, true);

  document.documentElement.style.cursor = '';

  clearHover();
  hideTooltip();
  clearAllHighlights();
  destroyHighlighter();
  destroyTooltip();
}

export function isPickerActive(): boolean {
  return active;
}
