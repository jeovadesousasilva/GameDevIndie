import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

export default defineConfig({
	site: 'https://jeovadesousasilva.github.io',
	base: '/GameDevIndie',
	trailingSlash: 'always',
	build: {
		format: 'directory'
	},
	integrations: [mdx()],
});
