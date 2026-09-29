import { defineConfig } from 'astro/config';

// SITE_URL and BASE_PATH are set by the GitHub Pages workflow.
// Preview:  https://traditionrealty.github.io/traditionlocal-site
// Live:     https://www.traditionlocal.com  (once the custom domain is connected, BASE_PATH becomes "/")
export default defineConfig({
  site: process.env.SITE_URL || 'https://www.traditionlocal.com',
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
});
