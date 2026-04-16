import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
	site: 'https://jeovadesousasilva.github.io/GameDevIndie/',
	integrations: [mdx()],
});
