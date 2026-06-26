import type { NextConfig } from 'next';

const config: NextConfig = {
  // No edge runtime — API route spawns a child process and needs Node.
  // Chromium binary bundled by puppeteer is large; exclude it from the
  // Next.js bundle analysis (it's accessed at runtime via the filesystem).
  serverExternalPackages: ['puppeteer', 'lighthouse', '@axe-core/puppeteer', 'launchcheck'],
};

export default config;
