export type BlogCategory = 'Engines' | 'Produção' | 'Mobile' | 'Devlog';

export type BlogPostFrontmatter = {
	title: string;
	description: string;
	pubDate: string;
	updatedDate?: string;
	author: string;
	category: BlogCategory;
	tags: string[];
	readingTime: string;
	featured?: boolean;
};

type MarkdownPostModule = {
	frontmatter: BlogPostFrontmatter;
	default: unknown;
};

type BlogPost = BlogPostFrontmatter & {
	slug: string;
	Content: unknown;
};

const blogModules = import.meta.glob('../content/blog/*.md', { eager: true });

function slugFromPath(path: string) {
	return path.split('/').pop()?.replace(/\.md$/, '') ?? '';
}

export function getAllPosts(): BlogPost[] {
	return Object.entries(blogModules)
		.map(([path, module]) => {
			const postModule = module as MarkdownPostModule;

			return {
				slug: slugFromPath(path),
				Content: postModule.default,
				...postModule.frontmatter
			};
		})
		.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
}

export function getFeaturedPost(posts = getAllPosts()) {
	return posts.find((post) => post.featured) ?? posts[0];
}
