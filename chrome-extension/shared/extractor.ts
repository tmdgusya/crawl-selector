import type { TransformStep, SelectorField, FieldTestResult, FullTestResult } from './types';

/**
 * Apply a single transform step to a string value.
 */
function applyStep(value: string, step: TransformStep): string {
  switch (step.type) {
    case 'trim':
      return value.trim();

    case 'strip_html':
      return value.replace(/<[^>]*>/g, '');

    case 'extract_number': {
      const nums = value.match(/[\d.]+/g);
      return nums ? nums.join('') : value;
    }

    case 'regex': {
      if (!step.pattern) return value;
      try {
        const re = new RegExp(step.pattern);
        const m = re.exec(value);
        if (!m) return value;
        // Return first capture group if present, otherwise the full match
        return m[1] ?? m[0];
      } catch {
        return value;
      }
    }

    case 'replace': {
      if (!step.pattern) return value;
      try {
        const re = new RegExp(step.pattern, 'g');
        return value.replace(re, step.replacement ?? '');
      } catch {
        return value;
      }
    }

    case 'default':
      return value === '' ? (step.default_value ?? '') : value;

    default:
      return value;
  }
}

/**
 * Sequentially apply an array of transform steps to a string value.
 * Each step's output becomes the next step's input.
 */
export function applyTransforms(value: string, transforms: TransformStep[]): string {
  return transforms.reduce((v, step) => applyStep(v, step), value);
}

/**
 * Extract a raw string value from a DOM element based on the extract config.
 */
function extractRawValue(el: Element, field: SelectorField): string {
  switch (field.extract.type) {
    case 'text':
      return el.textContent ?? '';
    case 'html':
      return el.innerHTML;
    case 'attribute':
      return el.getAttribute(field.extract.attribute ?? '') ?? '';
    default:
      return el.textContent ?? '';
  }
}

/**
 * Extract a single field's value from a document (or document fragment).
 *
 * Tries the main selector first, then each fallback in order.
 * Returns a FieldTestResult with both raw and transformed values.
 */
export function extractFieldValue(field: SelectorField, doc: Document): FieldTestResult {
  const timestamp = Date.now();

  // Resolve search root: scoped to list_container if specified
  let root: Document | Element = doc;
  if (field.list_container) {
    let container: Element | null;
    try {
      container = doc.querySelector(field.list_container);
    } catch {
      return {
        success: false,
        raw: field.multiple ? [] : '',
        transformed: field.multiple ? [] : '',
        matchCount: 0,
        usedSelector: field.selector,
        error: `list_container 셀렉터 문법 오류: "${field.list_container}"`,
        timestamp,
      };
    }
    if (!container) {
      return {
        success: false,
        raw: field.multiple ? [] : '',
        transformed: field.multiple ? [] : '',
        matchCount: 0,
        usedSelector: field.selector,
        error: `list_container "${field.list_container}"를 찾을 수 없습니다`,
        timestamp,
      };
    }
    root = container;
  }

  // Build ordered selector list: main selector first, then fallbacks
  const selectors = [field.selector, ...field.fallback_selectors];

  let lastSelectorError: string | null = null;

  for (const selector of selectors) {
    try {
      if (field.multiple) {
        const elements = root.querySelectorAll(selector);
        if (elements.length === 0) continue;

        let rawValues = Array.from(elements).map((el) => extractRawValue(el, field));
        let transformedValues = rawValues.map((v) =>
          field.transforms.length > 0 ? applyTransforms(v, field.transforms) : v
        );

        if (field.deduplicate) {
          const seen = new Set<string>();
          const uniqueIndices: number[] = [];
          for (let i = 0; i < transformedValues.length; i++) {
            if (!seen.has(transformedValues[i])) {
              seen.add(transformedValues[i]);
              uniqueIndices.push(i);
            }
          }
          rawValues = uniqueIndices.map((i) => rawValues[i]);
          transformedValues = uniqueIndices.map((i) => transformedValues[i]);
        }

        return {
          success: true,
          raw: rawValues,
          transformed: transformedValues,
          matchCount: transformedValues.length,
          usedSelector: selector,
          timestamp,
        };
      } else {
        const el = root.querySelector(selector);
        if (!el) continue;

        const raw = extractRawValue(el, field);
        const transformed =
          field.transforms.length > 0 ? applyTransforms(raw, field.transforms) : raw;

        return {
          success: true,
          raw,
          transformed,
          matchCount: 1,
          usedSelector: selector,
          timestamp,
        };
      }
    } catch {
      // Selector parse error — record and skip to next
      lastSelectorError = `셀렉터 문법 오류: "${selector}"`;
      continue;
    }
  }

  // No selector matched
  return {
    success: false,
    raw: field.multiple ? [] : '',
    transformed: field.multiple ? [] : '',
    matchCount: 0,
    usedSelector: field.selector,
    error: lastSelectorError ?? '매칭 요소 없음',
    timestamp,
  };
}

/**
 * Extract values for all fields from a document.
 * Returns a record keyed by field id with each field's test result.
 */
export function extractAllFields(
  fields: SelectorField[],
  doc: Document
): Record<string, FieldTestResult> {
  const results: Record<string, FieldTestResult> = {};
  for (const field of fields) {
    results[field.id] = extractFieldValue(field, doc);
  }
  return results;
}

/**
 * Create a failed FieldTestResult for a single field.
 */
export function createFieldErrorResult(field: SelectorField, error: string): FieldTestResult {
  return {
    success: false,
    raw: field.multiple ? [] : '',
    transformed: field.multiple ? [] : '',
    matchCount: 0,
    usedSelector: field.selector,
    error,
    timestamp: Date.now(),
  };
}

/**
 * Build error results for all fields and wrap them in a FullTestResult.
 */
export function buildFullTestError(
  fields: SelectorField[],
  error: string,
  source: 'content-script' | 'fetch',
  url: string,
): FullTestResult {
  const fieldResults: Record<string, FieldTestResult> = {};
  for (const field of fields) {
    fieldResults[field.id] = createFieldErrorResult(field, error);
  }
  return {
    url,
    extractedAt: new Date().toISOString(),
    fields: fieldResults,
    source,
  };
}
