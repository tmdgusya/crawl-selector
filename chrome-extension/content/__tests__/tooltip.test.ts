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
    showTooltip(100, 100, '.test', 1, 'DIV', { samples: ['Sample Text'], extractType: 'text' });
    tooltipEl = document.getElementById('crawl-selector-tooltip');
    expect(tooltipEl?.textContent).toContain('Sample Text');
  });

  it('should display multiple samples for multiple matches', () => {
    showTooltip(100, 100, '.test', 3, 'DIV', { samples: ['First', 'Second', 'Third'], extractType: 'text' });
    tooltipEl = document.getElementById('crawl-selector-tooltip');
    expect(tooltipEl?.textContent).toContain('First');
    expect(tooltipEl?.textContent).toContain('Second');
  });

  it('should truncate long preview text', () => {
    const longText = 'A'.repeat(100);
    showTooltip(100, 100, '.test', 1, 'DIV', { samples: [longText], extractType: 'text' });
    tooltipEl = document.getElementById('crawl-selector-tooltip');
    expect(tooltipEl?.textContent?.length).toBeLessThan(100);
  });

  it('should display "No data" for empty samples', () => {
    showTooltip(100, 100, '.test', 1, 'DIV', { samples: [], extractType: 'text' });
    tooltipEl = document.getElementById('crawl-selector-tooltip');
    expect(tooltipEl?.textContent).toContain('No data');
  });

  it('should display HTML type indicator', () => {
    showTooltip(100, 100, '.test', 1, 'DIV', { samples: ['<span>Hello</span>'], extractType: 'html' });
    tooltipEl = document.getElementById('crawl-selector-tooltip');
    expect(tooltipEl?.textContent).toContain('Hello');
  });

  it('should display attribute type indicator', () => {
    showTooltip(100, 100, '.test', 1, 'A', { samples: ['https://example.com'], extractType: 'attribute' });
    tooltipEl = document.getElementById('crawl-selector-tooltip');
    expect(tooltipEl?.textContent).toContain('https://example.com');
  });
});
