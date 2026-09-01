import { defineConfig } from 'astro/config';

export default defineConfig({
	site: 'https://midnighttoronto.com.br',
	trailingSlash: 'always',
	build: {
		format: 'directory'
	}
});
