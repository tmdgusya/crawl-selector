import { describe, it, expect } from 'vitest';
import { selectorRobustnessScore, AUTO_GENERATED_ID_PATTERN } from '../selector-generator';

describe('selectorRobustnessScore', () => {
  it('scores data-attr selectors as 1', () => {
    expect(selectorRobustnessScore('[data-testid="foo"]')).toBe(1);
    expect(selectorRobustnessScore('[data-cy="submit"]')).toBe(1);
  });

  it('scores ID selectors (non-auto-generated) as 2', () => {
    expect(selectorRobustnessScore('#main-content')).toBe(2);
    expect(selectorRobustnessScore('#sidebar')).toBe(2);
  });

  it('scores ARIA/role selectors as 3', () => {
    expect(selectorRobustnessScore('[role="button"]')).toBe(3);
    expect(selectorRobustnessScore('[aria-label="Close"]')).toBe(3);
    expect(selectorRobustnessScore('[role="dialog"][aria-label="Confirm"]')).toBe(3);
  });

  it('scores stable class selectors as 4', () => {
    expect(selectorRobustnessScore('.product-title')).toBe(4);
    expect(selectorRobustnessScore('.nav-item')).toBe(4);
  });

  it('scores unstable class selectors as 5', () => {
    expect(selectorRobustnessScore('.css-1a2b3c4d')).toBe(5);
    expect(selectorRobustnessScore('.sc-abc12345')).toBe(5);
  });

  it('scores structural selectors as 6', () => {
    expect(selectorRobustnessScore('div > span')).toBe(6);
    expect(selectorRobustnessScore('li:nth-child(3)')).toBe(6);
  });

  it('scores tag-only selectors as 7', () => {
    expect(selectorRobustnessScore('div')).toBe(7);
    expect(selectorRobustnessScore('span')).toBe(7);
  });
});

describe('AUTO_GENERATED_ID_PATTERN', () => {
  it('matches ember IDs', () => {
    expect(AUTO_GENERATED_ID_PATTERN.test('ember123')).toBe(true);
  });

  it('matches react-prefixed IDs with digits', () => {
    expect(AUTO_GENERATED_ID_PATTERN.test('react1')).toBe(true);
  });

  it('matches UUID format', () => {
    expect(AUTO_GENERATED_ID_PATTERN.test('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
  });

  it('matches React :r1: format', () => {
    expect(AUTO_GENERATED_ID_PATTERN.test(':r1:')).toBe(true);
    expect(AUTO_GENERATED_ID_PATTERN.test(':r2a:')).toBe(true);
  });

  it('does not match normal IDs', () => {
    expect(AUTO_GENERATED_ID_PATTERN.test('main-content')).toBe(false);
    expect(AUTO_GENERATED_ID_PATTERN.test('sidebar')).toBe(false);
    expect(AUTO_GENERATED_ID_PATTERN.test('nav')).toBe(false);
  });
});
