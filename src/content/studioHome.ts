export type StudioLocale = 'pt-BR' | 'en';

type SeoContent = {
	title: string;
	description: string;
	keywords: string;
	ogLocale: string;
};

type NavContent = {
	blog: string;
	vision: string;
	projects: string;
	contact: string;
	menu: string;
	close: string;
	languageLabel: string;
};

type HeroContent = {
	eyebrow: string;
	title: string;
	subtitle: string;
	primaryCta: string;
	secondaryCta: string;
	scrollHint: string;
};

type VisionContent = {
	kicker: string;
	title: string;
	intro: string;
	body: string[];
	notes: string[];
	stats: Array<{
		value: string;
		label: string;
	}>;
};

type ProjectContent = {
	title: string;
	category: string;
	status: string;
	description: string;
	note: string;
	imageAlt: string;
	image: string;
	downloadLabel?: string;
	downloadUrl?: string;
};

type ProjectsSectionContent = {
	kicker: string;
	title: string;
	intro: string;
	ctaLabel: string;
	items: ProjectContent[];
};

type ProcessContent = {
	kicker: string;
	title: string;
	intro: string;
	items: Array<{
		title: string;
		description: string;
	}>;
};

type ContactContent = {
	kicker: string;
	title: string;
	description: string;
	availability: string;
	socialsLabel: string;
	blogLabel: string;
	rights: string;
};

export type StudioHomeContent = {
	locale: StudioLocale;
	seo: SeoContent;
	nav: NavContent;
	hero: HeroContent;
	vision: VisionContent;
	projects: ProjectsSectionContent;
	process: ProcessContent;
	contact: ContactContent;
};

export const studioHomeContent: Record<StudioLocale, StudioHomeContent> = {
	'pt-BR': {
		locale: 'pt-BR',
		seo: {
			title: 'Midnight Toronto | Estúdio indie de games',
			description:
				'Midnight Toronto é um estúdio indie focado em experiências autorais, direção estética forte e jogos feitos com cuidado artesanal.',
			keywords:
				'midnight toronto, estúdio indie, desenvolvimento de jogos, game dev brasileiro, midnight bubbles, a vingança do herói',
			ogLocale: 'pt_BR'
		},
		nav: {
			blog: 'Blog',
			vision: 'Visão',
			projects: 'Projetos',
			contact: 'Contato',
			menu: 'Menu',
			close: 'Fechar',
			languageLabel: 'Idioma'
		},
		hero: {
			eyebrow: 'Estúdio autoral de desenvolvimento de jogos',
			title: 'Jogos com atmosfera, ritmo e identidade própria.',
			subtitle:
				'A Midnight Toronto nasce para criar experiências que ficam na memória: mundos compactos, direção visual forte e uma sensação artesanal em cada detalhe.',
			primaryCta: 'Explorar projetos',
			secondaryCta: 'Ler o blog',
			scrollHint: 'Role para continuar'
		},
		vision: {
			kicker: 'Visão do estúdio',
			title: 'Uma marca pequena, com intenção clara.',
			intro:
				'A Midnight Toronto foi pensada para parecer um estúdio criativo de verdade: menos ruído, mais intenção, mais personalidade.',
			body: [
				'Os projetos partem de uma ideia simples: jogos independentes podem ser compactos e ainda assim carregar atmosfera, tensão, humor e uma assinatura visual reconhecível.',
				'Em vez de perseguir excesso, a proposta do estúdio é lapidar o essencial. Mecânicas diretas, arte que sustenta a fantasia e uma experiência que respeita o tempo de quem joga.'
			],
			notes: [
				'Criação orientada por identidade visual e sensação de mundo.',
				'Escopo controlado para manter consistência e acabamento.'
			],
			stats: [
				{ value: '2', label: 'Projetos em desenvolvimento' },
				{ value: 'PT + EN', label: 'Apresentação bilíngue do estúdio' },
				{ value: '100%', label: 'Foco em produção indie autoral' }
			]
		},
		projects: {
			kicker: 'Projetos em destaque',
			title: 'Duas direções, a mesma assinatura.',
			intro:
				'Cada jogo segue um caminho próprio, mas ambos nascem do mesmo compromisso com atmosfera, legibilidade e presença visual.',
			ctaLabel: 'Acompanhar no blog',
			items: [
				{
					title: 'Midnight Bubbles',
					category: 'Puzzle / Casual',
					status: 'Lançado',
					description:
						'Um puzzle de leitura imediata, construído para ser acessível no primeiro contato e interessante conforme o ritmo acelera.',
					note: 'Projeto pensado para sessões curtas, feedback claro e acabamento visual limpo.',
					imageAlt: 'Arte do jogo Midnight Bubbles',
					image: 'GameGame01Img02.png',
					downloadLabel: 'Baixar no Google Play',
					downloadUrl: 'https://play.google.com/store/apps/details?id=com.MidnightToronto.MidnightBubbles'
				},
				{
					title: 'A Vingança do Herói',
					category: 'Ação / Aventura',
					status: 'Em breve',
					description:
						'Uma aventura com tom mais sombrio, presença mais dramática e combate moldado para sustentar a sensação de jornada.',
					note: 'Projeto orientado por atmosfera, progressão e identidade de mundo.',
					imageAlt: 'Arte do jogo A Vingança do Herói',
					image: 'Game02.png'
				}
			]
		},
		process: {
			kicker: 'Presença e processo',
			title: 'Um estúdio que trabalha no detalhe.',
			intro:
				'A Midnight Toronto não tenta parecer maior do que é. A força da marca vem de tratar cada elemento com intenção e coesão.',
			items: [
				{
					title: 'Direção antes do excesso',
					description:
						'Escolhas visuais e mecânicas são guiadas por identidade, não por volume ou moda do momento.'
				},
				{
					title: 'Produção com acabamento',
					description:
						'Escopo, interface e ritmo são pensados para chegar a um resultado mais sólido e menos improvisado.'
				},
				{
					title: 'Marca em construção constante',
					description:
						'O estúdio evolui jogo por jogo, com espaço para experimentar sem perder consistência.'
				}
			]
		},
		contact: {
			kicker: 'Contato e presença',
			title: 'Acompanhe a evolução da Midnight Toronto.',
			description:
				'Se você quer seguir os projetos, conversar sobre desenvolvimento ou observar o estúdio crescendo de perto, os canais abaixo são o melhor caminho.',
			availability: 'Atualizações, bastidores e novas publicações aparecem primeiro por aqui.',
			socialsLabel: 'Canais principais',
			blogLabel: 'Visitar o blog',
			rights: 'Midnight Toronto'
		}
	},
	en: {
		locale: 'en',
		seo: {
			title: 'Midnight Toronto | Indie game studio',
			description:
				'Midnight Toronto is an indie game studio focused on authored experiences, strong visual direction, and carefully built games.',
			keywords:
				'midnight toronto, indie game studio, game development, brazilian game dev, midnight bubbles, a vinganca do heroi',
			ogLocale: 'en_US'
		},
		nav: {
			blog: 'Blog',
			vision: 'Vision',
			projects: 'Projects',
			contact: 'Contact',
			menu: 'Menu',
			close: 'Close',
			languageLabel: 'Language'
		},
		hero: {
			eyebrow: 'Author-driven game development studio',
			title: 'Games built with atmosphere, rhythm, and a clear identity.',
			subtitle:
				'Midnight Toronto is shaped to create memorable experiences: compact worlds, deliberate visual direction, and a handcrafted feel in every layer.',
			primaryCta: 'Explore projects',
			secondaryCta: 'Read the blog',
			scrollHint: 'Scroll to continue'
		},
		vision: {
			kicker: 'Studio vision',
			title: 'Small in scale, precise in intention.',
			intro:
				'Midnight Toronto is meant to feel like a real creative studio: less noise, more intention, and a stronger sense of authorship.',
			body: [
				'Each project starts from a simple belief: independent games can stay compact and still carry atmosphere, tension, humor, and a distinct visual signature.',
				'Rather than chasing excess, the studio focuses on refining what matters. Clear mechanics, art that supports the fantasy, and an experience that respects the player’s time.'
			],
			notes: [
				'Creation guided by visual identity and world feeling.',
				'Controlled scope to preserve consistency and polish.'
			],
			stats: [
				{ value: '2', label: 'Projects in development' },
				{ value: 'PT + EN', label: 'Bilingual studio presentation' },
				{ value: '100%', label: 'Focus on authored indie production' }
			]
		},
		projects: {
			kicker: 'Featured projects',
			title: 'Two directions, one signature.',
			intro:
				'Each game follows its own path, but both come from the same commitment to atmosphere, readability, and visual presence.',
			ctaLabel: 'Follow on the blog',
			items: [
				{
					title: 'Midnight Bubbles',
					category: 'Puzzle / Casual',
					status: 'Released',
					description:
						'A puzzle game built for instant readability, designed to feel accessible at first glance and more engaging as the pace increases.',
					note: 'Built for short sessions, clear feedback, and clean visual polish.',
					imageAlt: 'Artwork for Midnight Bubbles',
					image: 'GameGame01Img02.png',
					downloadLabel: 'Download on Google Play',
					downloadUrl: 'https://play.google.com/store/apps/details?id=com.MidnightToronto.MidnightBubbles'
				},
				{
					title: 'A Vingança do Herói',
					category: 'Action / Adventure',
					status: 'Coming soon',
					description:
						'A darker adventure with a stronger dramatic tone and combat shaped to support the feeling of a long-form journey.',
					note: 'Driven by atmosphere, progression, and world identity.',
					imageAlt: 'Artwork for A Vingança do Herói',
					image: 'Game02.png'
				}
			]
		},
		process: {
			kicker: 'Presence and process',
			title: 'A studio built through detail.',
			intro:
				'Midnight Toronto does not try to look bigger than it is. Its strength comes from treating each element with intention and cohesion.',
			items: [
				{
					title: 'Direction over excess',
					description:
						'Visual and mechanical choices are guided by identity, not by volume or whatever happens to be trending.'
				},
				{
					title: 'Production with polish',
					description:
						'Scope, interface, and rhythm are shaped to reach a more solid result and avoid an improvised feel.'
				},
				{
					title: 'A brand that keeps evolving',
					description:
						'The studio grows one game at a time, with room to experiment without losing consistency.'
				}
			]
		},
		contact: {
			kicker: 'Contact and presence',
			title: 'Follow Midnight Toronto as it grows.',
			description:
				'If you want to follow the projects, talk about development, or watch the studio take shape over time, these are the right places to stay close.',
			availability: 'Updates, behind-the-scenes notes, and new posts tend to show up here first.',
			socialsLabel: 'Main channels',
			blogLabel: 'Visit the blog',
			rights: 'Midnight Toronto'
		}
	}
};
