// ── Core domain types for Crawl Recipes ──

export interface StorageSchema {
  version: 1;
  recipes: Record<string, CrawlRecipe>;
  activeRecipeId: string | null;
}

export interface CrawlRecipe {
  id: string;
  name: string;
  url_pattern: string;
  created_at: string;
  updated_at: string;
  fields: SelectorField[];
  pagination?: PaginationConfig;
}

export interface SelectorField {
  id: string;
  field_name: string;
  selector: string;
  selector_type: 'css';
  fallback_selectors: string[];
  extract: ExtractConfig;
  transforms: TransformStep[];
  multiple: boolean;
  list_container?: string;
}

export interface ExtractConfig {
  type: 'text' | 'html' | 'attribute';
  attribute?: string;
}

export interface TransformStep {
  type: 'trim' | 'strip_html' | 'extract_number' | 'regex' | 'replace' | 'default';
  pattern?: string;
  replacement?: string;
  default_value?: string;
}

export interface PaginationConfig {
  type: 'next_button' | 'url_pattern' | 'infinite_scroll';
  selector?: string;
  url_template?: string;
  max_pages?: number;
  wait_ms?: number;
}

// ── Ephemeral session state ──

export interface SessionState {
  pickerActive: boolean;
  hoveredSelector: string | null;
  hoveredMatchCount: number;
  currentTabId: number | null;
}

// ── Extraction test results ──

export interface FieldTestResult {
  success: boolean;
  raw: string | string[];
  transformed: string | string[];
  matchCount: number;
  usedSelector: string;
  error?: string;
  timestamp: number;
}

export interface FullTestResult {
  url: string;
  extractedAt: string;
  fields: Record<string, FieldTestResult>;
  source: 'content-script' | 'fetch';
}

// ── Export format ──

export interface CrawlRecipeExport {
  $schema: string;
  name: string;
  url_pattern: string;
  version: string;
  fields: ExportField[];
  pagination?: PaginationConfig;
}

export interface ExportField {
  field_name: string;
  selector: string;
  selector_type: 'css';
  fallback_selectors?: string[];
  extract: ExtractConfig;
  transforms: TransformStep[];
  multiple: boolean;
  list_container?: string;
}
