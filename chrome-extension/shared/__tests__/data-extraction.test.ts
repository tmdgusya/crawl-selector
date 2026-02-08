import { describe, it, expect } from 'vitest';
import { extractDataFromSelector, extractDataFromElement } from '../selector-generator';
import type { ExtractConfig } from '../types';

describe('extractDataFromElement', () => {
  it('should extract text content', () => {
    const div = document.createElement('div');
    div.textContent = 'Hello World';
    const result = extractDataFromElement(div, { type: 'text' });
    expect(result).toBe('Hello World');
  });

  it('should extract HTML content', () => {
    const div = document.createElement('div');
    div.innerHTML = '<span>Hello</span> <em>World</em>';
    const result = extractDataFromElement(div, { type: 'html' });
    expect(result).toBe('<span>Hello</span> <em>World</em>');
  });

  it('should extract attribute value', () => {
    const a = document.createElement('a');
    a.href = 'https://example.com';
    const result = extractDataFromElement(a, { type: 'attribute', attribute: 'href' });
    expect(result).toBe('https://example.com');
  });

  it('should return empty string for missing attribute', () => {
    const div = document.createElement('div');
    const result = extractDataFromElement(div, { type: 'attribute', attribute: 'data-custom' });
    expect(result).toBe('');
  });
});

describe('extractDataFromSelector', () => {
  it('should return data from all matching elements', () => {
    document.body.innerHTML = `
      <div class="item">First</div>
      <div class="item">Second</div>
      <div class="item">Third</div>
    `;
    const result = extractDataFromSelector('.item', { type: 'text' });
    expect(result).toEqual(['First', 'Second', 'Third']);
    document.body.innerHTML = '';
  });

  it('should return empty array for no matches', () => {
    const result = extractDataFromSelector('.non-existent', { type: 'text' });
    expect(result).toEqual([]);
  });

  it('should limit results to 10 samples for multiple matches', () => {
    document.body.innerHTML = Array.from({ length: 20 }, (_, i) =>
      `<div class="item">Item ${i}</div>`
    ).join('');
    const result = extractDataFromSelector('.item', { type: 'text' });
    expect(result).toHaveLength(10);
    document.body.innerHTML = '';
  });
});
