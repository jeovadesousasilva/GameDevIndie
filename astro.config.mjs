import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
	site: 'https://midnighttoronto.com.br',
	trailingSlash: 'always',
	build: {
		format: 'directory'
	},
	integrations: [mdx(), sitemap()],
});
