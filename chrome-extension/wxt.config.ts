import { defineConfig } from 'wxt';

export default defineConfig({
  outDir: 'dist',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Crawl Selector',
    description: 'Visually pick elements and export CSS selectors as Crawl Recipes',
    version: '0.1.0',
    permissions: ['activeTab', 'storage', 'sidePanel', 'scripting'],
    action: {},
  },
});
