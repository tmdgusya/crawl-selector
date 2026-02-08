/**
 * Element picker — the core interaction loop.
 * Handles mousemove (hover highlight) and click (element selection).
 */

import { generateSelectors, countMatches, getElementAttributes } from '../shared/selector-generator';
import { highlightHover, highlightSelected, clearHover, clearAllHighlights, destroyHighlighter } from './highlighter';
import { showTooltip, hideTooltip, destroyTooltip } from './tooltip';

let active = false;
let lastHovered: Element | null = null;

function onMouseMove(e: MouseEvent): void {
  const target = e.target as Element;
  if (!target || target === lastHovered) return;

  // Skip our own overlay elements
  if (target.id === 'crawl-selector-tooltip' || target.id === 'crawl-selector-highlighter') return;

  lastHovered = target;
  const { best } = generateSelectors(target);
  const matchCount = countMatches(best);

  highlightHover(target);
  showTooltip(e.clientX, e.clientY, best, matchCount, target.tagName);

  // Notify background of hover
  chrome.runtime.sendMessage({
    type: 'ELEMENT_HOVERED',
    selector: best,
    matchCount,
    tagName: target.tagName,
  }).catch(() => {
    // Side panel might not be open
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

  const { best, alternatives } = generateSelectors(target);
  const attributes = getElementAttributes(target);

  highlightSelected(target);

  // Send picked element to background
  chrome.runtime.sendMessage({
    type: 'ELEMENT_PICKED',
    selector: best,
    alternatives,
    attributes,
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

  clearHover();
  hideTooltip();
  clearAllHighlights();
  destroyHighlighter();
  destroyTooltip();
}

export function isPickerActive(): boolean {
  return active;
}
