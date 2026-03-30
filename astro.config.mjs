// @ts-check
import { defineConfig } from 'astro/config';

import node from '@astrojs/node';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  site: 'https://notgym.org',
  security: {
    checkOrigin: false,
  },
  adapter: node({
    mode: 'standalone'
  }),

  integrations: [react()]
});