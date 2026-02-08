import { describe, it, expect } from 'vitest';
import { toSnakeCase, guessFieldName, guessExtractConfig, urlToPattern } from '../helpers';

describe('toSnakeCase', () => {
  it('converts camelCase to snake_case', () => {
    expect(toSnakeCase('camelCase')).toBe('camel_case');
    expect(toSnakeCase('myVariableName')).toBe('my_variable_name');
  });

  it('converts kebab-case to snake_case', () => {
    expect(toSnakeCase('some-thing')).toBe('some_thing');
    expect(toSnakeCase('my-long-name')).toBe('my_long_name');
  });

  it('converts spaces to underscores', () => {
    expect(toSnakeCase('hello world')).toBe('hello_world');
    expect(toSnakeCase('multiple   spaces')).toBe('multiple_spaces');
  });

  it('strips special characters', () => {
    expect(toSnakeCase('hello!world')).toBe('helloworld');
    expect(toSnakeCase('price$value')).toBe('pricevalue');
  });

  it('truncates to 40 characters', () => {
    const long = 'a'.repeat(50);
    expect(toSnakeCase(long)).toHaveLength(40);
  });

  it('converts to lowercase', () => {
    expect(toSnakeCase('UPPER')).toBe('upper');
    expect(toSnakeCase('MixedCase')).toBe('mixed_case');
  });
});

describe('guessFieldName', () => {
  it('uses data-testid when available', () => {
    expect(guessFieldName('.foo', { 'data-testid': 'productTitle' })).toBe('product_title');
  });

  it('uses aria-label as second priority', () => {
    expect(guessFieldName('.foo', { 'aria-label': 'Product Price' })).toBe('product_price');
  });

  it('truncates aria-label to 30 chars before conversion', () => {
    const longLabel = 'a'.repeat(40);
    const result = guessFieldName('.foo', { 'aria-label': longLabel });
    expect(result.length).toBeLessThanOrEqual(40);
  });

  it('extracts class name from selector', () => {
    expect(guessFieldName('.product-title', {})).toBe('product_title');
  });

  it('extracts id from selector when no class', () => {
    expect(guessFieldName('#mainContent', {})).toBe('main_content');
  });

  it('falls back to field_ prefix', () => {
    const result = guessFieldName('div > span', {});
    expect(result).toMatch(/^field_/);
  });

  it('prefers data-testid over aria-label', () => {
    expect(
      guessFieldName('.foo', { 'data-testid': 'testName', 'aria-label': 'Aria Name' }),
    ).toBe('test_name');
  });

  it('prefers aria-label over class name', () => {
    expect(guessFieldName('.some-class', { 'aria-label': 'Better Name' })).toBe('better_name');
  });

  it('prefers class over id in selector', () => {
    expect(guessFieldName('#myId .myClass', {})).toBe('my_class');
  });
});

describe('guessExtractConfig', () => {
  it('returns attribute config for href', () => {
    expect(guessExtractConfig('a.link', { href: '/foo' })).toEqual({
      type: 'attribute',
      attribute: 'href',
    });
  });

  it('returns attribute config for src', () => {
    expect(guessExtractConfig('img', { src: '/img.png' })).toEqual({
      type: 'attribute',
      attribute: 'src',
    });
  });

  it('prefers href over src', () => {
    expect(guessExtractConfig('a', { href: '/link', src: '/img.png' })).toEqual({
      type: 'attribute',
      attribute: 'href',
    });
  });

  it('returns text config by default', () => {
    expect(guessExtractConfig('span', {})).toEqual({ type: 'text' });
  });

  it('returns text config when no href/src attributes', () => {
    expect(guessExtractConfig('div', { class: 'foo', id: 'bar' })).toEqual({ type: 'text' });
  });
});

describe('urlToPattern', () => {
  it('converts full URL to hostname + path pattern', () => {
    expect(urlToPattern('https://example.com/products/123')).toBe('example.com/products/123*');
  });

  it('converts root path to hostname/*', () => {
    expect(urlToPattern('https://example.com/')).toBe('example.com/*');
    expect(urlToPattern('https://example.com')).toBe('example.com/*');
  });

  it('strips query parameters via wildcard', () => {
    expect(urlToPattern('https://news.ycombinator.com/item?id=123')).toBe(
      'news.ycombinator.com/item*',
    );
  });

  it('returns input unchanged for invalid URLs', () => {
    expect(urlToPattern('not-a-url')).toBe('not-a-url');
    expect(urlToPattern('')).toBe('');
  });

  it('handles URLs with subdomains', () => {
    expect(urlToPattern('https://docs.example.com/api/v2')).toBe('docs.example.com/api/v2*');
  });
});
