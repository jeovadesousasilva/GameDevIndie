import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
	site: 'https://jeovadesousasilva.github.io',
	base: '/GameDevIndie',
	trailingSlash: 'always',
	build: {
		format: 'directory'
	},
	integrations: [mdx(), sitemap()],
});
