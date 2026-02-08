# Crawl Selector

A Chrome extension for visually picking elements and exporting CSS selectors as Crawl Recipes.

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- **Visual Element Picker** - Click on any element to generate precise CSS selectors
- **Recipe Management** - Create, save, and manage multiple crawl recipes
- **Smart Selector Generation** - Uses [@medv/finder](https://github.com/antonmedv/finder) for robust CSS selector generation
- **Field Extraction** - Extract text, HTML, or attributes from selected elements
- **Export to JSON** - Export recipes in a structured format for crawling workflows
- **Live Preview** - See selector match count in real-time while hovering

## Installation

### Development

```bash
cd chrome-extension
npm install
npm run dev
```

This will start the WXT development server and open Chrome with the extension loaded.

### Build

```bash
npm run build        # Build for Chrome
npm run build:firefox # Build for Firefox
```

### Package

```bash
npm run zip          # Create distributable zip for Chrome
npm run zip:firefox  # Create distributable zip for Firefox
```

## Usage

1. Click the extension icon to open the side panel
2. Create a new recipe or select an existing one
3. Click "Pick Element" and hover over elements on the page
4. Click to select an element and add it as a field
5. Configure extraction settings (text, HTML, attribute)
6. Export the recipe as JSON for your crawling pipeline

## Project Structure

```
chrome-extension/
├── entrypoints/          # Extension entry points
│   ├── background.ts     # Service worker
│   ├── content.ts        # Content script injection
│   └── sidepanel/        # Side panel UI (React)
│       ├── App.tsx
│       ├── components/
│       ├── store/
│       └── styles/
├── content/              # Content script modules
│   ├── picker.ts         # Element picking logic
│   ├── highlighter.ts    # Visual highlighting
│   └── tooltip.ts        # Hover tooltip
├── shared/               # Shared utilities
│   ├── types.ts          # TypeScript definitions
│   ├── messages.ts       # Cross-context messaging
│   ├── storage.ts        # Chrome storage helpers
│   └── selector-generator.ts
├── public/               # Static assets
└── wxt.config.ts         # WXT configuration
```

## Recipe Format

Exported recipes follow this structure:

```typescript
interface CrawlRecipe {
  id: string;
  name: string;
  url_pattern: string;
  fields: SelectorField[];
  pagination?: PaginationConfig;
}

interface SelectorField {
  field_name: string;
  selector: string;
  selector_type: 'css';
  extract: {
    type: 'text' | 'html' | 'attribute';
    attribute?: string;
  };
  transforms: TransformStep[];
  multiple: boolean;
}
```

## Tech Stack

- [WXT](https://wxt.dev/) - Web Extension Toolkit
- [React](https://react.dev/) - UI Framework
- [TypeScript](https://www.typescriptlang.org/) - Type Safety
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Zustand](https://github.com/pmndrs/zustand) - State Management

## Permissions

- `activeTab` - Access current tab for element picking
- `storage` - Persist recipes locally
- `sidePanel` - Open extension in side panel
- `scripting` - Inject content scripts

## License

MIT
