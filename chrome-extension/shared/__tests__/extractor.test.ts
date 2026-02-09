import { describe, it, expect, beforeEach } from 'vitest';
import { applyTransforms, extractFieldValue, createFieldErrorResult, buildFullTestError } from '../extractor';
import type { TransformStep, SelectorField } from '../types';

describe('applyTransforms', () => {
  describe('trim', () => {
    it('removes leading and trailing whitespace', () => {
      const transforms: TransformStep[] = [{ type: 'trim' }];
      expect(applyTransforms('  hello world  ', transforms)).toBe('hello world');
    });

    it('removes tabs and newlines', () => {
      const transforms: TransformStep[] = [{ type: 'trim' }];
      expect(applyTransforms('\n\t value \t\n', transforms)).toBe('value');
    });

    it('returns empty string when input is only whitespace', () => {
      const transforms: TransformStep[] = [{ type: 'trim' }];
      expect(applyTransforms('   ', transforms)).toBe('');
    });
  });

  describe('strip_html', () => {
    it('removes HTML tags preserving text content', () => {
      const transforms: TransformStep[] = [{ type: 'strip_html' }];
      expect(applyTransforms('<p>Hello <strong>World</strong></p>', transforms)).toBe(
        'Hello World',
      );
    });

    it('handles self-closing tags', () => {
      const transforms: TransformStep[] = [{ type: 'strip_html' }];
      expect(applyTransforms('Line 1<br/>Line 2', transforms)).toBe('Line 1Line 2');
    });

    it('handles tags with attributes', () => {
      const transforms: TransformStep[] = [{ type: 'strip_html' }];
      expect(applyTransforms('<a href="/link" class="btn">Click</a>', transforms)).toBe('Click');
    });

    it('returns plain text unchanged', () => {
      const transforms: TransformStep[] = [{ type: 'strip_html' }];
      expect(applyTransforms('no tags here', transforms)).toBe('no tags here');
    });
  });

  describe('extract_number', () => {
    it('extracts number from Korean won price "₩1,399,000"', () => {
      const transforms: TransformStep[] = [{ type: 'extract_number' }];
      expect(applyTransforms('₩1,399,000', transforms)).toBe('1399000');
    });

    it('extracts decimal number', () => {
      const transforms: TransformStep[] = [{ type: 'extract_number' }];
      expect(applyTransforms('Price: $49.99', transforms)).toBe('49.99');
    });

    it('joins multiple number fragments', () => {
      const transforms: TransformStep[] = [{ type: 'extract_number' }];
      expect(applyTransforms('10개 중 3개', transforms)).toBe('103');
    });

    it('returns original value when no digits found', () => {
      const transforms: TransformStep[] = [{ type: 'extract_number' }];
      expect(applyTransforms('no numbers', transforms)).toBe('no numbers');
    });

    it('handles standalone integer', () => {
      const transforms: TransformStep[] = [{ type: 'extract_number' }];
      expect(applyTransforms('42', transforms)).toBe('42');
    });
  });

  describe('regex', () => {
    it('returns first capture group when present', () => {
      const transforms: TransformStep[] = [{ type: 'regex', pattern: 'price: (\\d+)' }];
      expect(applyTransforms('price: 500', transforms)).toBe('500');
    });

    it('returns full match when no capture group', () => {
      const transforms: TransformStep[] = [{ type: 'regex', pattern: '\\d+' }];
      expect(applyTransforms('item 42 units', transforms)).toBe('42');
    });

    it('returns original value when pattern does not match', () => {
      const transforms: TransformStep[] = [{ type: 'regex', pattern: '\\d+' }];
      expect(applyTransforms('no numbers', transforms)).toBe('no numbers');
    });

    it('returns original value when pattern is missing', () => {
      const transforms: TransformStep[] = [{ type: 'regex' }];
      expect(applyTransforms('hello', transforms)).toBe('hello');
    });

    it('returns original value for invalid regex pattern', () => {
      const transforms: TransformStep[] = [{ type: 'regex', pattern: '[invalid(' }];
      expect(applyTransforms('hello', transforms)).toBe('hello');
    });
  });

  describe('replace', () => {
    it('replaces pattern with replacement string', () => {
      const transforms: TransformStep[] = [
        { type: 'replace', pattern: ',', replacement: '' },
      ];
      expect(applyTransforms('1,399,000', transforms)).toBe('1399000');
    });

    it('replaces globally (all occurrences)', () => {
      const transforms: TransformStep[] = [
        { type: 'replace', pattern: '-', replacement: '/' },
      ];
      expect(applyTransforms('2024-01-15', transforms)).toBe('2024/01/15');
    });

    it('defaults to empty replacement when replacement is undefined', () => {
      const transforms: TransformStep[] = [{ type: 'replace', pattern: '\\s+' }];
      expect(applyTransforms('hello  world', transforms)).toBe('helloworld');
    });

    it('returns original value when pattern is missing', () => {
      const transforms: TransformStep[] = [{ type: 'replace' }];
      expect(applyTransforms('hello', transforms)).toBe('hello');
    });

    it('returns original value for invalid regex pattern', () => {
      const transforms: TransformStep[] = [
        { type: 'replace', pattern: '[invalid(', replacement: 'x' },
      ];
      expect(applyTransforms('hello', transforms)).toBe('hello');
    });
  });

  describe('default', () => {
    it('replaces empty string with default value', () => {
      const transforms: TransformStep[] = [{ type: 'default', default_value: 'N/A' }];
      expect(applyTransforms('', transforms)).toBe('N/A');
    });

    it('leaves non-empty string unchanged', () => {
      const transforms: TransformStep[] = [{ type: 'default', default_value: 'N/A' }];
      expect(applyTransforms('existing value', transforms)).toBe('existing value');
    });

    it('uses empty string when default_value is undefined', () => {
      const transforms: TransformStep[] = [{ type: 'default' }];
      expect(applyTransforms('', transforms)).toBe('');
    });
  });

  describe('chained transforms pipeline', () => {
    it('applies transforms in sequence: strip_html → trim → extract_number', () => {
      const transforms: TransformStep[] = [
        { type: 'strip_html' },
        { type: 'trim' },
        { type: 'extract_number' },
      ];
      expect(applyTransforms('  <span>₩1,299,000</span>  ', transforms)).toBe('1299000');
    });

    it('applies regex then default for no-match fallback', () => {
      const transforms: TransformStep[] = [
        { type: 'regex', pattern: 'SKU-(\\w+)' },
        { type: 'default', default_value: 'unknown' },
      ];
      // Pattern matches — capture group returned
      expect(applyTransforms('SKU-ABC123', transforms)).toBe('ABC123');
      // Pattern doesn't match — original value kept, not empty, so default skipped
      expect(applyTransforms('no match', transforms)).toBe('no match');
    });

    it('applies trim then replace then default', () => {
      const transforms: TransformStep[] = [
        { type: 'trim' },
        { type: 'replace', pattern: '.*', replacement: '' },
        { type: 'default', default_value: '없음' },
      ];
      // After trim: "  " → "", replace ".*" on "" → "", default "" → "없음"
      expect(applyTransforms('   ', transforms)).toBe('없음');
    });
  });

  describe('edge cases', () => {
    it('returns value unchanged with empty transforms array', () => {
      expect(applyTransforms('hello', [])).toBe('hello');
    });

    it('handles empty string input', () => {
      const transforms: TransformStep[] = [{ type: 'trim' }];
      expect(applyTransforms('', transforms)).toBe('');
    });
  });
});

// ── extractFieldValue tests ──

/** Helper to build a SelectorField with sensible defaults */
function makeField(overrides: Partial<SelectorField> = {}): SelectorField {
  return {
    id: 'test-field',
    field_name: 'Test',
    selector: '.target',
    selector_type: 'css',
    fallback_selectors: [],
    extract: { type: 'text' },
    transforms: [],
    multiple: false,
    ...overrides,
  };
}

describe('extractFieldValue', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('text extraction', () => {
    it('extracts textContent from matched element', () => {
      document.body.innerHTML = '<div class="target">Hello World</div>';
      const field = makeField();
      const result = extractFieldValue(field, document);

      expect(result.success).toBe(true);
      expect(result.raw).toBe('Hello World');
      expect(result.transformed).toBe('Hello World');
      expect(result.matchCount).toBe(1);
      expect(result.usedSelector).toBe('.target');
      expect(result.error).toBeUndefined();
    });

    it('includes nested element text in textContent', () => {
      document.body.innerHTML = '<div class="target">Price: <span>₩1,000</span></div>';
      const field = makeField();
      const result = extractFieldValue(field, document);

      expect(result.success).toBe(true);
      expect(result.raw).toBe('Price: ₩1,000');
    });
  });

  describe('html extraction', () => {
    it('extracts innerHTML from matched element', () => {
      document.body.innerHTML = '<div class="target">Hello <strong>World</strong></div>';
      const field = makeField({ extract: { type: 'html' } });
      const result = extractFieldValue(field, document);

      expect(result.success).toBe(true);
      expect(result.raw).toBe('Hello <strong>World</strong>');
      expect(result.transformed).toBe('Hello <strong>World</strong>');
    });
  });

  describe('attribute extraction', () => {
    it('extracts href attribute', () => {
      document.body.innerHTML = '<a class="target" href="/products/123">Link</a>';
      const field = makeField({
        extract: { type: 'attribute', attribute: 'href' },
      });
      const result = extractFieldValue(field, document);

      expect(result.success).toBe(true);
      expect(result.raw).toBe('/products/123');
      expect(result.transformed).toBe('/products/123');
    });

    it('extracts custom data attribute', () => {
      document.body.innerHTML = '<div class="target" data-sku="ABC-123">Item</div>';
      const field = makeField({
        extract: { type: 'attribute', attribute: 'data-sku' },
      });
      const result = extractFieldValue(field, document);

      expect(result.success).toBe(true);
      expect(result.raw).toBe('ABC-123');
    });

    it('returns empty string for missing attribute', () => {
      document.body.innerHTML = '<div class="target">No attr</div>';
      const field = makeField({
        extract: { type: 'attribute', attribute: 'data-missing' },
      });
      const result = extractFieldValue(field, document);

      expect(result.success).toBe(true);
      expect(result.raw).toBe('');
    });
  });

  describe('multiple mode', () => {
    it('returns string[] for all matching elements', () => {
      document.body.innerHTML = `
        <ul>
          <li class="item">Apple</li>
          <li class="item">Banana</li>
          <li class="item">Cherry</li>
        </ul>
      `;
      const field = makeField({
        selector: '.item',
        multiple: true,
      });
      const result = extractFieldValue(field, document);

      expect(result.success).toBe(true);
      expect(result.raw).toEqual(['Apple', 'Banana', 'Cherry']);
      expect(result.transformed).toEqual(['Apple', 'Banana', 'Cherry']);
      expect(result.matchCount).toBe(3);
    });

    it('applies transforms to each value in array', () => {
      document.body.innerHTML = `
        <span class="price">₩1,000</span>
        <span class="price">₩2,500</span>
      `;
      const field = makeField({
        selector: '.price',
        multiple: true,
        transforms: [{ type: 'extract_number' }],
      });
      const result = extractFieldValue(field, document);

      expect(result.success).toBe(true);
      expect(result.raw).toEqual(['₩1,000', '₩2,500']);
      expect(result.transformed).toEqual(['1000', '2500']);
    });
  });

  describe('list_container scoping', () => {
    it('searches only within the specified container', () => {
      document.body.innerHTML = `
        <div id="sidebar"><span class="title">Sidebar Title</span></div>
        <div id="main"><span class="title">Main Title</span></div>
      `;
      const field = makeField({
        selector: '.title',
        list_container: '#main',
      });
      const result = extractFieldValue(field, document);

      expect(result.success).toBe(true);
      expect(result.raw).toBe('Main Title');
    });

    it('returns error when list_container is not found', () => {
      document.body.innerHTML = '<div class="target">Content</div>';
      const field = makeField({
        list_container: '#nonexistent',
      });
      const result = extractFieldValue(field, document);

      expect(result.success).toBe(false);
      expect(result.error).toContain('#nonexistent');
      expect(result.matchCount).toBe(0);
    });

    it('scopes multiple mode within container', () => {
      document.body.innerHTML = `
        <div class="outside"><span class="tag">Outside</span></div>
        <div id="container">
          <span class="tag">Inside A</span>
          <span class="tag">Inside B</span>
        </div>
      `;
      const field = makeField({
        selector: '.tag',
        multiple: true,
        list_container: '#container',
      });
      const result = extractFieldValue(field, document);

      expect(result.success).toBe(true);
      expect(result.raw).toEqual(['Inside A', 'Inside B']);
      expect(result.matchCount).toBe(2);
    });
  });

  describe('fallback selectors', () => {
    it('uses fallback when main selector fails', () => {
      document.body.innerHTML = '<div class="alt-target">Fallback Value</div>';
      const field = makeField({
        selector: '.primary',
        fallback_selectors: ['.alt-target'],
      });
      const result = extractFieldValue(field, document);

      expect(result.success).toBe(true);
      expect(result.raw).toBe('Fallback Value');
      expect(result.usedSelector).toBe('.alt-target');
    });

    it('tries fallbacks in order and uses first match', () => {
      document.body.innerHTML = '<div class="third">Third</div>';
      const field = makeField({
        selector: '.first',
        fallback_selectors: ['.second', '.third', '.fourth'],
      });
      const result = extractFieldValue(field, document);

      expect(result.success).toBe(true);
      expect(result.raw).toBe('Third');
      expect(result.usedSelector).toBe('.third');
    });

    it('prefers main selector over fallbacks when both match', () => {
      document.body.innerHTML = `
        <div class="primary">Primary</div>
        <div class="fallback">Fallback</div>
      `;
      const field = makeField({
        selector: '.primary',
        fallback_selectors: ['.fallback'],
      });
      const result = extractFieldValue(field, document);

      expect(result.success).toBe(true);
      expect(result.raw).toBe('Primary');
      expect(result.usedSelector).toBe('.primary');
    });
  });

  describe('no match', () => {
    it('returns error result when no selectors match', () => {
      document.body.innerHTML = '<div class="other">Nothing here</div>';
      const field = makeField({
        selector: '.missing',
        fallback_selectors: ['.also-missing'],
      });
      const result = extractFieldValue(field, document);

      expect(result.success).toBe(false);
      expect(result.error).toBe('매칭 요소 없음');
      expect(result.matchCount).toBe(0);
      expect(result.raw).toBe('');
      expect(result.transformed).toBe('');
      expect(result.usedSelector).toBe('.missing');
    });

    it('returns arrays for no-match in multiple mode', () => {
      document.body.innerHTML = '<div>Content</div>';
      const field = makeField({
        selector: '.missing',
        multiple: true,
      });
      const result = extractFieldValue(field, document);

      expect(result.success).toBe(false);
      expect(result.raw).toEqual([]);
      expect(result.transformed).toEqual([]);
    });
  });

  describe('transforms integration', () => {
    it('passes through raw value when transforms array is empty', () => {
      document.body.innerHTML = '<div class="target">  spaced value  </div>';
      const field = makeField({ transforms: [] });
      const result = extractFieldValue(field, document);

      expect(result.success).toBe(true);
      expect(result.raw).toBe('  spaced value  ');
      expect(result.transformed).toBe('  spaced value  ');
    });

    it('applies transforms to extracted value', () => {
      document.body.innerHTML = '<div class="target">  ₩1,299,000  </div>';
      const field = makeField({
        transforms: [
          { type: 'trim' },
          { type: 'extract_number' },
        ],
      });
      const result = extractFieldValue(field, document);

      expect(result.success).toBe(true);
      expect(result.raw).toBe('  ₩1,299,000  ');
      expect(result.transformed).toBe('1299000');
    });
  });

  describe('result metadata', () => {
    it('includes timestamp in result', () => {
      document.body.innerHTML = '<div class="target">Value</div>';
      const field = makeField();
      const before = Date.now();
      const result = extractFieldValue(field, document);
      const after = Date.now();

      expect(result.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.timestamp).toBeLessThanOrEqual(after);
    });

    it('skips invalid selectors without throwing', () => {
      document.body.innerHTML = '<div class="fallback">OK</div>';
      const field = makeField({
        selector: '[[[invalid',
        fallback_selectors: ['.fallback'],
      });
      const result = extractFieldValue(field, document);

      expect(result.success).toBe(true);
      expect(result.raw).toBe('OK');
      expect(result.usedSelector).toBe('.fallback');
    });
  });
});

describe('createFieldErrorResult', () => {
  it('returns a failed result with the given error message', () => {
    const field = makeField({ selector: '.price' });
    const result = createFieldErrorResult(field, '매칭 요소 없음');

    expect(result.success).toBe(false);
    expect(result.error).toBe('매칭 요소 없음');
    expect(result.usedSelector).toBe('.price');
    expect(result.matchCount).toBe(0);
    expect(result.raw).toBe('');
    expect(result.transformed).toBe('');
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it('returns arrays for raw/transformed when field.multiple is true', () => {
    const field = makeField({ multiple: true });
    const result = createFieldErrorResult(field, 'error');

    expect(result.raw).toEqual([]);
    expect(result.transformed).toEqual([]);
  });

  it('returns strings for raw/transformed when field.multiple is false', () => {
    const field = makeField({ multiple: false });
    const result = createFieldErrorResult(field, 'error');

    expect(result.raw).toBe('');
    expect(result.transformed).toBe('');
  });
});

describe('buildFullTestError', () => {
  it('creates a FullTestResult with error results for every field', () => {
    const fields = [
      makeField({ id: 'f1', selector: '.title' }),
      makeField({ id: 'f2', selector: '.price', multiple: true }),
    ];
    const result = buildFullTestError(fields, '네트워크 오류', 'fetch', 'https://example.com');

    expect(result.url).toBe('https://example.com');
    expect(result.source).toBe('fetch');
    expect(result.extractedAt).toBeTruthy();
    expect(Object.keys(result.fields)).toHaveLength(2);

    expect(result.fields['f1'].success).toBe(false);
    expect(result.fields['f1'].error).toBe('네트워크 오류');
    expect(result.fields['f1'].raw).toBe('');

    expect(result.fields['f2'].success).toBe(false);
    expect(result.fields['f2'].error).toBe('네트워크 오류');
    expect(result.fields['f2'].raw).toEqual([]);
  });

  it('sets correct source for content-script mode', () => {
    const fields = [makeField({ id: 'f1' })];
    const result = buildFullTestError(fields, 'error', 'content-script', '');

    expect(result.source).toBe('content-script');
    expect(result.url).toBe('');
  });
});
