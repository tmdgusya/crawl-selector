#!/usr/bin/env python3
"""
Execute a crawl recipe using Playwright.

This script takes a Crawl Recipe JSON file and extracts data from websites
according to the recipe's specifications.
"""

import argparse
import csv
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urljoin, urlparse

from playwright.sync_api import sync_playwright, Page, Browser, Locator


@dataclass
class ExtractConfig:
    type: str  # 'text', 'html', 'attribute'
    attribute: Optional[str] = None


@dataclass
class TransformStep:
    type: str  # 'trim', 'strip_html', 'extract_number', 'regex', 'replace', 'default'
    pattern: Optional[str] = None
    replacement: Optional[str] = None
    default_value: Optional[str] = None


@dataclass
class ExportField:
    field_name: str
    selector: str
    selector_type: str
    extract: ExtractConfig
    transforms: list[TransformStep] = field(default_factory=list)
    multiple: bool = False
    fallback_selectors: list[str] = field(default_factory=list)
    list_container: Optional[str] = None


@dataclass
class PaginationConfig:
    type: str  # 'next_button', 'url_pattern', 'infinite_scroll'
    selector: Optional[str] = None
    url_template: Optional[str] = None
    max_pages: int = 1
    wait_ms: int = 1000


@dataclass
class CrawlRecipe:
    name: str
    url_pattern: str
    version: str
    fields: list[ExportField]
    pagination: Optional[PaginationConfig] = None


def parse_recipe(recipe_path: Path) -> CrawlRecipe:
    """Parse a recipe JSON file into a CrawlRecipe dataclass."""
    with open(recipe_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    fields = []
    for f in data.get('fields', []):
        extract = ExtractConfig(
            type=f['extract']['type'],
            attribute=f['extract'].get('attribute')
        )
        
        transforms = []
        for t in f.get('transforms', []):
            transforms.append(TransformStep(
                type=t['type'],
                pattern=t.get('pattern'),
                replacement=t.get('replacement'),
                default_value=t.get('default_value')
            ))
        
        fields.append(ExportField(
            field_name=f['field_name'],
            selector=f['selector'],
            selector_type=f.get('selector_type', 'css'),
            extract=extract,
            transforms=transforms,
            multiple=f.get('multiple', False),
            fallback_selectors=f.get('fallback_selectors', []),
            list_container=f.get('list_container')
        ))
    
    pagination = None
    if 'pagination' in data:
        p = data['pagination']
        pagination = PaginationConfig(
            type=p['type'],
            selector=p.get('selector'),
            url_template=p.get('url_template'),
            max_pages=p.get('max_pages', 1),
            wait_ms=p.get('wait_ms', 1000)
        )
    
    return CrawlRecipe(
        name=data['name'],
        url_pattern=data['url_pattern'],
        version=data.get('version', '1.0'),
        fields=fields,
        pagination=pagination
    )


def strip_html(html: str) -> str:
    """Remove HTML tags from a string."""
    clean = re.sub(r'<[^>]+>', '', html)
    return clean


def extract_number(text: str) -> str:
    """Extract numeric value from text (keeps digits and decimal point)."""
    # Remove currency symbols and keep digits, decimal points, and minus signs
    matches = re.findall(r'-?\d+\.?\d*', text.replace(',', ''))
    if matches:
        # Return the first number found
        return matches[0]
    return ''


def apply_transform(value: Any, transform: TransformStep) -> Any:
    """Apply a single transform to a value."""
    if value is None:
        value = ''
    
    # Handle list values
    if isinstance(value, list):
        return [apply_transform(v, transform) for v in value]
    
    value = str(value)
    
    if transform.type == 'trim':
        return value.strip()
    
    elif transform.type == 'strip_html':
        return strip_html(value)
    
    elif transform.type == 'extract_number':
        return extract_number(value)
    
    elif transform.type == 'regex':
        if transform.pattern:
            match = re.search(transform.pattern, value)
            if match:
                return match.group(0) if match.groups() == () else match.group(1) if match.groups() else match.group(0)
        return ''
    
    elif transform.type == 'replace':
        if transform.pattern:
            replacement = transform.replacement or ''
            return re.sub(transform.pattern, replacement, value)
        return value
    
    elif transform.type == 'default':
        if not value.strip():
            return transform.default_value or ''
        return value
    
    return value


def apply_transforms(value: Any, transforms: list[TransformStep]) -> Any:
    """Apply multiple transforms in sequence."""
    for transform in transforms:
        value = apply_transform(value, transform)
    return value


def extract_field_value(page: Page, field: ExportField) -> Any:
    """Extract a single field value from the page."""
    # Try main selector first, then fallbacks
    selectors = [field.selector] + field.fallback_selectors
    
    for selector in selectors:
        try:
            if field.multiple:
                # Extract multiple values
                locators = page.locator(selector).all()
                if not locators:
                    continue
                
                values = []
                for locator in locators:
                    value = extract_from_locator(locator, field.extract)
                    if value:
                        values.append(value)
                
                if values:
                    transformed = apply_transforms(values, field.transforms)
                    return transformed
            else:
                # Extract single value
                locator = page.locator(selector).first
                if locator.count() == 0:
                    continue
                
                value = extract_from_locator(locator, field.extract)
                if value is not None:
                    transformed = apply_transforms(value, field.transforms)
                    return transformed
                    
        except Exception:
            continue
    
    # Return None if no selector matched
    return None if not field.multiple else []


def extract_from_locator(locator: Locator, extract: ExtractConfig) -> Optional[str]:
    """Extract value from a locator based on extract config."""
    try:
        locator.wait_for(state='visible', timeout=5000)
    except Exception:
        pass
    
    if extract.type == 'text':
        return locator.text_content() or ''
    
    elif extract.type == 'html':
        return locator.inner_html() or ''
    
    elif extract.type == 'attribute':
        if extract.attribute:
            return locator.get_attribute(extract.attribute) or ''
    
    return None


def extract_data_from_page(page: Page, recipe: CrawlRecipe) -> dict[str, Any]:
    """Extract all fields from the current page."""
    result = {}
    for field in recipe.fields:
        result[field.field_name] = extract_field_value(page, field)
    return result


def handle_next_button_pagination(
    page: Page, 
    browser: Browser,
    recipe: CrawlRecipe, 
    start_url: str,
    headless: bool,
    timeout: int
) -> list[dict[str, Any]]:
    """Handle next button pagination."""
    results = []
    pagination = recipe.pagination
    if not pagination:
        return results
    
    current_page = 1
    
    while current_page <= pagination.max_pages:
        print(f"  Scraping page {current_page}...", file=sys.stderr)
        
        # Extract data from current page
        data = extract_data_from_page(page, recipe)
        
        # Check if we got any meaningful data
        has_data = any(v for v in data.values() if v not in (None, '', []))
        if has_data:
            results.append(data)
        
        # Look for next button
        if pagination.selector:
            try:
                next_button = page.locator(pagination.selector)
                if next_button.count() == 0:
                    print(f"  No next button found, ending pagination.", file=sys.stderr)
                    break
                
                # Check if button is disabled
                disabled = next_button.get_attribute('disabled') or next_button.get_attribute('aria-disabled')
                if disabled:
                    print(f"  Next button disabled, ending pagination.", file=sys.stderr)
                    break
                
                # Click next button
                next_button.click()
                page.wait_for_timeout(pagination.wait_ms)
                current_page += 1
                
            except Exception as e:
                print(f"  Error during pagination: {e}", file=sys.stderr)
                break
        else:
            break
    
    return results


def handle_url_pattern_pagination(
    page: Page,
    browser: Browser, 
    recipe: CrawlRecipe,
    start_url: str,
    headless: bool,
    timeout: int
) -> list[dict[str, Any]]:
    """Handle URL pattern pagination."""
    results = []
    pagination = recipe.pagination
    if not pagination or not pagination.url_template:
        return results
    
    for page_num in range(1, pagination.max_pages + 1):
        url = pagination.url_template.format(page=page_num)
        print(f"  Scraping page {page_num}: {url}", file=sys.stderr)
        
        try:
            page.goto(url, wait_until='networkidle', timeout=timeout * 1000)
            if pagination.wait_ms:
                page.wait_for_timeout(pagination.wait_ms)
            
            # Extract data
            data = extract_data_from_page(page, recipe)
            
            # Check if we got any meaningful data
            has_data = any(v for v in data.values() if v not in (None, '', []))
            if has_data:
                results.append(data)
            else:
                print(f"  No data found on page {page_num}, stopping.", file=sys.stderr)
                break
                
        except Exception as e:
            print(f"  Error loading page {page_num}: {e}", file=sys.stderr)
            break
    
    return results


def handle_infinite_scroll_pagination(
    page: Page,
    browser: Browser,
    recipe: CrawlRecipe,
    start_url: str,
    headless: bool,
    timeout: int
) -> list[dict[str, Any]]:
    """Handle infinite scroll pagination."""
    results = []
    pagination = recipe.pagination
    if not pagination:
        return results
    
    print(f"  Scraping with infinite scroll (max {pagination.max_pages} scrolls)...", file=sys.stderr)
    
    # Extract initial data
    last_results_count = 0
    scroll_attempts = 0
    no_new_content_count = 0
    max_no_new_content = 3
    
    while scroll_attempts < pagination.max_pages:
        # Extract current data
        current_data = extract_data_from_page(page, recipe)
        
        # Check if we got new content
        has_data = any(v for v in current_data.values() if v not in (None, '', []))
        
        # For lists, check if we got more items
        is_list_field = any(f.multiple for f in recipe.fields)
        if is_list_field and results:
            # Compare list lengths to detect new content
            for field in recipe.fields:
                if field.multiple:
                    current_list = current_data.get(field.field_name, [])
                    if isinstance(current_list, list) and len(current_list) > last_results_count:
                        no_new_content_count = 0
                        break
            else:
                no_new_content_count += 1
        elif has_data:
            no_new_content_count = 0
        else:
            no_new_content_count += 1
        
        if no_new_content_count >= max_no_new_content:
            print(f"  No new content after {max_no_new_content} scrolls, stopping.", file=sys.stderr)
            break
        
        # Save current data snapshot for comparison
        if has_data:
            # Only add if it's different from last
            if not results or current_data != results[-1]:
                results.append(current_data)
        
        # Scroll to bottom
        page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
        page.wait_for_timeout(pagination.wait_ms)
        
        scroll_attempts += 1
        print(f"  Scroll {scroll_attempts}/{pagination.max_pages}", file=sys.stderr)
    
    return results


def execute_recipe(
    recipe_path: Path,
    url: str,
    output_path: Path,
    output_format: str,
    headless: bool,
    timeout: int,
    additional_wait: int
) -> None:
    """Execute a crawl recipe and save results."""
    
    # Parse recipe
    print(f"Loading recipe: {recipe_path}", file=sys.stderr)
    recipe = parse_recipe(recipe_path)
    print(f"Recipe: {recipe.name}", file=sys.stderr)
    print(f"Fields: {len(recipe.fields)}", file=sys.stderr)
    
    # Launch browser
    print(f"Launching browser (headless={headless})...", file=sys.stderr)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(
            viewport={'width': 1280, 'height': 800},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.0'
        )
        page = context.new_page()
        
        try:
            # Navigate to starting URL
            print(f"Navigating to: {url}", file=sys.stderr)
            page.goto(url, wait_until='networkidle', timeout=timeout * 1000)
            
            if additional_wait:
                print(f"Waiting additional {additional_wait}ms...", file=sys.stderr)
                page.wait_for_timeout(additional_wait)
            
            # Extract data based on pagination type
            results = []
            
            if recipe.pagination:
                if recipe.pagination.type == 'next_button':
                    results = handle_next_button_pagination(
                        page, browser, recipe, url, headless, timeout
                    )
                elif recipe.pagination.type == 'url_pattern':
                    results = handle_url_pattern_pagination(
                        page, browser, recipe, url, headless, timeout
                    )
                elif recipe.pagination.type == 'infinite_scroll':
                    results = handle_infinite_scroll_pagination(
                        page, browser, recipe, url, headless, timeout
                    )
                else:
                    # Single page
                    data = extract_data_from_page(page, recipe)
                    results = [data]
            else:
                # Single page extraction
                data = extract_data_from_page(page, recipe)
                results = [data]
            
            print(f"\nExtracted {len(results)} record(s)", file=sys.stderr)
            
            # Save results
            if output_format == 'json':
                with open(output_path, 'w', encoding='utf-8') as f:
                    json.dump(results, f, indent=2, ensure_ascii=False)
            else:
                # CSV format
                if results:
                    with open(output_path, 'w', newline='', encoding='utf-8') as f:
                        writer = csv.DictWriter(f, fieldnames=results[0].keys())
                        writer.writeheader()
                        for row in results:
                            # Convert lists to strings for CSV
                            csv_row = {}
                            for k, v in row.items():
                                if isinstance(v, list):
                                    csv_row[k] = '; '.join(str(x) for x in v)
                                else:
                                    csv_row[k] = v
                            writer.writerow(csv_row)
            
            print(f"Results saved to: {output_path}", file=sys.stderr)
            
        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            raise
        finally:
            browser.close()


def main():
    parser = argparse.ArgumentParser(
        description='Execute a crawl recipe using Playwright'
    )
    parser.add_argument(
        '--recipe', '-r',
        required=True,
        help='Path to the recipe JSON file'
    )
    parser.add_argument(
        '--url', '-u',
        required=True,
        help='Starting URL to crawl'
    )
    parser.add_argument(
        '--output', '-o',
        default='results.json',
        help='Output file path (default: results.json)'
    )
    parser.add_argument(
        '--format', '-f',
        choices=['json', 'csv'],
        default='json',
        help='Output format (default: json)'
    )
    parser.add_argument(
        '--headless',
        action='store_true',
        help='Run browser in headless mode'
    )
    parser.add_argument(
        '--timeout',
        type=int,
        default=30,
        help='Page load timeout in seconds (default: 30)'
    )
    parser.add_argument(
        '--wait',
        type=int,
        default=0,
        help='Additional wait time after page load in ms (default: 0)'
    )
    
    args = parser.parse_args()
    
    recipe_path = Path(args.recipe)
    if not recipe_path.exists():
        print(f"Error: Recipe file not found: {recipe_path}", file=sys.stderr)
        sys.exit(1)
    
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    execute_recipe(
        recipe_path=recipe_path,
        url=args.url,
        output_path=output_path,
        output_format=args.format,
        headless=args.headless,
        timeout=args.timeout,
        additional_wait=args.wait
    )


if __name__ == '__main__':
    main()
