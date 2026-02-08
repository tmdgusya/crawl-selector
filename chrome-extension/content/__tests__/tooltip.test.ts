import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { showTooltip, hideTooltip, destroyTooltip } from '../tooltip';

describe('Tooltip with data preview', () => {
  let tooltipEl: HTMLElement | null;

  beforeEach(() => {
    document.body.innerHTML = '<div id="test"></div>';
  });

  afterEach(() => {
    destroyTooltip();
    document.body.innerHTML = '';
  });

  it('should display preview data for single match', () => {
    showTooltip(100, 100, '.test', 1, 'DIV', ['Sample Text'], { type: 'text' });
    tooltipEl = document.getElementById('crawl-selector-tooltip');
    expect(tooltipEl?.textContent).toContain('Sample Text');
  });

  it('should display multiple samples for multiple matches', () => {
    showTooltip(100, 100, '.test', 3, 'DIV', ['First', 'Second', 'Third'], { type: 'text' });
    tooltipEl = document.getElementById('crawl-selector-tooltip');
    expect(tooltipEl?.textContent).toContain('First');
    expect(tooltipEl?.textContent).toContain('Second');
  });

  it('should truncate long preview text', () => {
    const longText = 'A'.repeat(100);
    showTooltip(100, 100, '.test', 1, 'DIV', [longText], { type: 'text' });
    tooltipEl = document.getElementById('crawl-selector-tooltip');
    expect(tooltipEl?.textContent?.length).toBeLessThan(100);
  });
});
