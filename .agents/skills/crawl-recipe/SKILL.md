---
name: crawl-recipe
description: |
  Execute web crawling recipes in Crawl Recipe JSON format.
  
  This skill enables automated data extraction from websites using CSS selectors,
  with support for pagination, data transforms, and multiple output formats.
  
  Trigger when:
  - User mentions "crawl recipe" or "crawl-recipe"
  - User has a `.recipe.json` file
  - User wants to execute web crawling based on a JSON recipe
  - User mentions extracting data from websites using CSS selectors
  - User wants to scrape/web crawl using Playwright with a predefined recipe
---

# Crawl Recipe Skill

Execute web crawling recipes exported from the Crawl-Bot Chrome extension.

## Recipe JSON Format

A crawl recipe defines how to extract structured data from web pages:

```typescript
interface CrawlRecipeExport {
  $schema: 'https://crawl-bot/recipe.schema.json';
  name: string;
  url_pattern: string;  // URL pattern to match (e.g., "https://example.com/products/*")
  version: '1.0';
  fields: ExportField[];
  pagination?: PaginationConfig;
}

interface ExportField {
  field_name: string;           // Snake_case field name
  selector: string;             // CSS selector
  selector_type: 'css';
  fallback_selectors?: string[]; // Alternative selectors if main fails
  extract: ExtractConfig;
  transforms: TransformStep[];
  multiple: boolean;            // Whether to extract all matches or just first
  list_container?: string;      // CSS selector for list container (if extracting from list)
}

interface ExtractConfig {
  type: 'text' | 'html' | 'attribute';
  attribute?: string;           // Required when type is 'attribute' (e.g., "href", "src")
}

interface TransformStep {
  type: 'trim' | 'strip_html' | 'extract_number' | 'regex' | 'replace' | 'default';
  pattern?: string;             // For regex/replace
  replacement?: string;         // For replace
  default_value?: string;       // For default transform
}

interface PaginationConfig {
  type: 'next_button' | 'url_pattern' | 'infinite_scroll';
  selector?: string;            // For next_button: CSS selector of next page button
  url_template?: string;        // For url_pattern: e.g., "https://example.com/page/{page}"
  max_pages?: number;
  wait_ms?: number;
}
```

## Quick Start

### 1. Execute a Recipe

```bash
python .agents/skills/crawl-recipe/scripts/execute_recipe.py \
  --recipe product-scraper.recipe.json \
  --url "https://example.com/products" \
  --output results.json
```

### 2. Output Formats

The script supports both JSON and CSV output:

```bash
# JSON output (default)
python execute_recipe.py --recipe recipe.json --url URL --output data.json

# CSV output
python execute_recipe.py --recipe recipe.json --url URL --output data.csv --format csv
```

### 3. Headless Mode

Run in headless mode (no browser window):

```bash
python execute_recipe.py --recipe recipe.json --url URL --headless
```

## Recipe Execution Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Load Recipe    │────▶│  Navigate to    │────▶│  Extract Data   │
│  (JSON file)    │     │  URL            │     │  (CSS selectors)│
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Output Results │◄────│  Handle         │◄────│  Apply          │
│  (JSON/CSV)     │     │  Pagination     │     │  Transforms     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Field Extraction

### Basic Extraction

```json
{
  "field_name": "title",
  "selector": "h1.product-title",
  "selector_type": "css",
  "extract": { "type": "text" },
  "transforms": [{ "type": "trim" }],
  "multiple": false
}
```

### Extracting Attributes

```json
{
  "field_name": "image_url",
  "selector": "img.product-image",
  "selector_type": "css",
  "extract": { "type": "attribute", "attribute": "src" },
  "transforms": [],
  "multiple": false
}
```

### Extracting Multiple Items

```json
{
  "field_name": "tags",
  "selector": ".tag-item",
  "selector_type": "css",
  "extract": { "type": "text" },
  "transforms": [{ "type": "trim" }],
  "multiple": true
}
```

### Fallback Selectors

```json
{
  "field_name": "price",
  "selector": ".price-current",
  "selector_type": "css",
  "fallback_selectors": [".price", "[data-price]"],
  "extract": { "type": "text" },
  "transforms": [{ "type": "extract_number" }],
  "multiple": false
}
```

## Data Transforms

Transforms are applied in order after extraction:

| Transform | Description | Options |
|-----------|-------------|---------|
| `trim` | Remove leading/trailing whitespace | - |
| `strip_html` | Remove HTML tags from content | - |
| `extract_number` | Extract numeric value (removes non-digits except decimal point) | - |
| `regex` | Apply regex pattern match | `pattern` (required) |
| `replace` | Replace substring or regex | `pattern`, `replacement` |
| `default` | Set default if value is empty | `default_value` |

### Transform Examples

```json
// Extract price as number
"transforms": [
  { "type": "trim" },
  { "type": "extract_number" }
]
// "$1,299.99" → "1299.99"

// Extract using regex
"transforms": [
  { "type": "regex", "pattern": "\\d+" }
]
// "Page 5 of 10" → "5"

// Replace text
"transforms": [
  { "type": "replace", "pattern": "USD", "replacement": "$" }
]
// "100 USD" → "100 $"

// Default value
"transforms": [
  { "type": "trim" },
  { "type": "default", "default_value": "N/A" }
]
// "" → "N/A"
```

## Pagination

### Next Button Pagination

```json
{
  "pagination": {
    "type": "next_button",
    "selector": "a.next-page",
    "max_pages": 10,
    "wait_ms": 1000
  }
}
```

### URL Pattern Pagination

```json
{
  "pagination": {
    "type": "url_pattern",
    "url_template": "https://example.com/products?page={page}",
    "max_pages": 5,
    "wait_ms": 1500
  }
}
```

### Infinite Scroll

```json
{
  "pagination": {
    "type": "infinite_scroll",
    "max_pages": 20,
    "wait_ms": 2000
  }
}
```

## Complete Example

```json
{
  "$schema": "https://crawl-bot/recipe.schema.json",
  "name": "E-commerce Product Scraper",
  "url_pattern": "https://example.com/products/*",
  "version": "1.0",
  "fields": [
    {
      "field_name": "product_name",
      "selector": "h1.product-title",
      "selector_type": "css",
      "extract": { "type": "text" },
      "transforms": [{ "type": "trim" }],
      "multiple": false
    },
    {
      "field_name": "price",
      "selector": ".price",
      "selector_type": "css",
      "fallback_selectors": ["[data-price]"],
      "extract": { "type": "text" },
      "transforms": [
        { "type": "trim" },
        { "type": "extract_number" }
      ],
      "multiple": false
    },
    {
      "field_name": "description",
      "selector": ".product-description",
      "selector_type": "css",
      "extract": { "type": "html" },
      "transforms": [{ "type": "strip_html" }, { "type": "trim" }],
      "multiple": false
    },
    {
      "field_name": "image_urls",
      "selector": ".gallery img",
      "selector_type": "css",
      "extract": { "type": "attribute", "attribute": "src" },
      "transforms": [],
      "multiple": true
    }
  ],
  "pagination": {
    "type": "next_button",
    "selector": "a.pagination-next",
    "max_pages": 5,
    "wait_ms": 1500
  }
}
```

## Script Usage

```
usage: execute_recipe.py [-h] --recipe RECIPE --url URL [--output OUTPUT]
                         [--format {json,csv}] [--headless] [--timeout TIMEOUT]
                         [--wait WAIT]

Execute a crawl recipe using Playwright

options:
  -h, --help            show this help message and exit
  --recipe RECIPE, -r RECIPE
                        Path to the recipe JSON file
  --url URL, -u URL     Starting URL to crawl
  --output OUTPUT, -o OUTPUT
                        Output file path (default: results.json)
  --format {json,csv}, -f {json,csv}
                        Output format (default: json)
  --headless            Run browser in headless mode
  --timeout TIMEOUT     Page load timeout in seconds (default: 30)
  --wait WAIT           Additional wait time after page load in ms (default: 0)
```

## Error Handling

The script handles common scenarios:

- **Missing selectors**: Returns `null` for fields that don't match
- **Network errors**: Retries with exponential backoff
- **Pagination end**: Stops when next button is disabled/missing
- **Rate limiting**: Respects `wait_ms` between pages

## Tips

1. **Test selectors first**: Use browser DevTools to verify CSS selectors
2. **Use fallbacks**: Add fallback selectors for more robust extraction
3. **Set appropriate wait times**: Account for JavaScript-rendered content
4. **Handle dynamic content**: Use longer `wait_ms` for SPAs and lazy-loaded content
5. **Respect robots.txt**: Check website's robots.txt before crawling
