export type StudioLocale = 'pt-BR' | 'en';

type SeoContent = {
	title: string;
	description: string;
	keywords: string;
	ogLocale: string;
};

type NavContent = {
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
			title: 'Midnight Toronto | Shellbound e jogos indie',
			description:
				'Midnight Toronto apresenta Shellbound, novo jogo em desenvolvimento, junto ao catálogo autoral de jogos indie do estúdio.',
			keywords:
				'midnight toronto, shellbound, estúdio indie, desenvolvimento de jogos, game dev brasileiro, midnight bubbles, firezone zombies',
			ogLocale: 'pt_BR'
		},
		nav: {
			vision: 'Visão',
			projects: 'Projetos',
			contact: 'Contato',
			menu: 'Menu',
			close: 'Fechar',
			languageLabel: 'Idioma'
		},
		hero: {
			eyebrow: 'Novo jogo em desenvolvimento',
			title: 'Shellbound é guerra de bolso, turno por turno.',
			subtitle:
				'Um jogo 2D de batalhas táticas com tanques, leitura rápida e decisões curtas. Cada turno é simples de entender, mas abre espaço para posicionamento, risco e viradas.',
			primaryCta: 'Ver Shellbound',
			scrollHint: 'Role para continuar'
		},
		vision: {
			kicker: 'Visão do estúdio',
			title: 'Jogos pequenos com cara própria.',
			intro:
				'A gente não tenta parecer maior do que é. Preferimos fazer jogos menores, focados em uma ideia boa e com uma identidade própria desde o primeiro contato.',
			body: [
				'A Midnight Toronto faz jogos compactos, diretos e com bastante foco no visual. A ideia é simples: você bate o olho, entende o que está acontecendo e já quer testar.',
				'Shellbound representa bem o que queremos fazer daqui pra frente. Decisões simples que realmente fazem diferença.',
				'Jogos menores, com uma identidade clara e fáceis de reconhecer.'
			],
			notes: [
				'Ideias simples, mas bem executadas.',
				'Projetos com um tamanho que a gente realmente consegue terminar e entregar bem.'
			],
			stats: [
				{ value: '4', label: 'Projetos no catálogo' },
				{ value: 'PT + EN', label: 'Apresentação bilíngue do estúdio' },
				{ value: '2026', label: 'Nova fase com Shellbound' }
			]
		},
		projects: {
			kicker: 'Projetos em destaque',
			title: 'Quatro jogos, uma assinatura mais ousada.',
			intro:
				'Do puzzle ao FPS, agora com Shellbound no horizonte: cada jogo segue um caminho próprio, mas todos carregam leitura clara, impacto visual e identidade.',
			items: [
				{
					title: 'Shellbound',
					category: 'Estratégia / Turnos / 2D',
					status: 'Em desenvolvimento',
					description:
						'Batalhas de tanques em 2D, turno por turno, com foco em posicionamento, mira, terreno e decisões curtas que podem virar a partida.',
					note: 'Projeto em produção, pensado para ser fácil de ler no primeiro olhar e mais interessante a cada troca de tiro.',
					imageAlt: 'Arte do jogo Shellbound',
					image: 'Game04img02-1200.webp'
				},
				{
					title: 'Midnight Bubbles',
					category: 'Puzzle / Casual',
					status: 'Lançado',
					description:
						'Um puzzle de leitura imediata, construído para ser acessível no primeiro contato e interessante conforme o ritmo acelera.',
					note: 'Projeto pensado para sessões curtas, feedback claro e acabamento visual limpo.',
					imageAlt: 'Arte do jogo Midnight Bubbles',
					image: 'Game01Img03.png',
					downloadLabel: 'Baixar no Google Play',
					downloadUrl: 'https://play.google.com/store/apps/details?id=com.MidnightToronto.MidnightBubbles'
				},
				{
					title: 'Firezone: Zombies',
					category: 'FPS / Sobrevivência',
					status: 'Lançado',
					description:
						'Sobreviva a ondas de zumbis em um FPS mobile sombrio e intenso, feito para partidas rápidas, tensão constante e ação direta.',
					note: 'Projeto focado em clima pesado, combate responsivo e progressão por ondas.',
					imageAlt: 'Arte do jogo Firezone: Zombies',
					image: 'Game03img02.png',
					downloadLabel: 'Baixar no Google Play',
					downloadUrl: 'https://play.google.com/store/apps/details?id=com.midnighttoronto.firezonezombies'
				},
				{
					title: 'A Vingança do Herói',
					category: 'Ação / Aventura',
					status: 'Desenvolvimento pausado',
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
			title: 'Menos pose, mais direção.',
			intro:
				'A nova apresentação coloca o jogo na frente e deixa o estúdio falar pelo que está criando. Shellbound vira o ponto de entrada, e o catálogo mostra de onde a Midnight Toronto veio.',
			items: [
				{
					title: 'Primeiro o jogo',
					description:
						'A página abre com Shellbound porque é o projeto que melhor representa a próxima fase.'
				},
				{
					title: 'Texto mais humano',
					description:
						'A apresentação abandona frases genéricas e explica como o estúdio pensa jogos pequenos.'
				},
				{
					title: 'Tema sem fantasia demais',
					description:
						'A paleta usa céu, areia, metal e verde oliva para lembrar Shellbound sem transformar o site em propaganda barulhenta.'
				}
			]
		},
		contact: {
			kicker: 'Onde acompanhar',
			title: 'Veja os jogos e acompanhe as novidades.',
			description:
				'Use os links abaixo para encontrar os jogos publicados e seguir as próximas atualizações da Midnight Toronto.',
			availability: 'Shellbound ainda está em desenvolvimento; quando houver novidades públicas, elas aparecem primeiro por aqui.',
			socialsLabel: 'Links úteis',
			rights: 'Midnight Toronto'
		}
	},
	en: {
		locale: 'en',
		seo: {
			title: 'Midnight Toronto | Shellbound and indie games',
			description:
				'Midnight Toronto presents Shellbound, a new game in development, alongside the studio’s authored indie game catalog.',
			keywords:
				'midnight toronto, shellbound, indie game studio, game development, brazilian game dev, midnight bubbles, firezone zombies',
			ogLocale: 'en_US'
		},
		nav: {
			vision: 'Vision',
			projects: 'Projects',
			contact: 'Contact',
			menu: 'Menu',
			close: 'Close',
			languageLabel: 'Language'
		},
		hero: {
			eyebrow: 'New game in development',
			title: 'Shellbound is pocket war, turn by turn.',
			subtitle:
				'A 2D tactical tank game built around quick reads and short decisions. Each turn is easy to understand, but positioning, risk, and timing can flip the match.',
			primaryCta: 'See Shellbound',
			scrollHint: 'Scroll to continue'
		},
		vision: {
			kicker: 'Studio vision',
			title: 'Small games with a visible shape.',
			intro:
				'We are not trying to look bigger than we are. We prefer smaller games focused on one good idea, with their own identity from the first contact.',
			body: [
				'Midnight Toronto makes compact, direct games with a strong focus on visuals. The idea is simple: you look at the screen, understand what is happening, and want to try it.',
				'Shellbound represents what we want to make from here on: simple decisions that actually make a difference.',
				'Smaller games, with a clear identity and an easy-to-recognize shape.'
			],
			notes: [
				'Simple ideas, executed well.',
				'Projects sized so we can actually finish them and deliver them well.'
			],
			stats: [
				{ value: '4', label: 'Projects in the catalog' },
				{ value: 'PT + EN', label: 'Bilingual studio presentation' },
				{ value: '2026', label: 'New phase with Shellbound' }
			]
		},
		projects: {
			kicker: 'Featured projects',
			title: 'Four games, a bolder signature.',
			intro:
				'From puzzle to FPS, now with Shellbound on the horizon: each game follows its own path while keeping clear readability, visual impact, and identity.',
			items: [
				{
					title: 'Shellbound',
					category: 'Strategy / Turns / 2D',
					status: 'In development',
					description:
						'Turn-based 2D tank battles built around positioning, aim, terrain, and short decisions that can flip the match.',
					note: 'In production, designed to read clearly at first glance and become more interesting with every exchange.',
					imageAlt: 'Artwork for Shellbound',
					image: 'Game04img02-1200.webp'
				},
				{
					title: 'Midnight Bubbles',
					category: 'Puzzle / Casual',
					status: 'Released',
					description:
						'A puzzle game built for instant readability, designed to feel accessible at first glance and more engaging as the pace increases.',
					note: 'Built for short sessions, clear feedback, and clean visual polish.',
					imageAlt: 'Artwork for Midnight Bubbles',
					image: 'Game01Img03.png',
					downloadLabel: 'Download on Google Play',
					downloadUrl: 'https://play.google.com/store/apps/details?id=com.MidnightToronto.MidnightBubbles'
				},
				{
					title: 'Firezone: Zombies',
					category: 'FPS / Survival',
					status: 'Released',
					description:
						'Survive waves of zombies in a dark, intense mobile FPS built for quick sessions, constant tension, and direct action.',
					note: 'Focused on a heavy mood, responsive combat, and wave-based progression.',
					imageAlt: 'Artwork for Firezone: Zombies',
					image: 'Game03img02.png',
					downloadLabel: 'Download on Google Play',
					downloadUrl: 'https://play.google.com/store/apps/details?id=com.midnighttoronto.firezonezombies'
				},
				{
					title: 'A Vingança do Herói',
					category: 'Action / Adventure',
					status: 'Development paused',
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
			title: 'Less pose, more direction.',
			intro:
				'The new presentation puts the game first and lets the studio speak through what it is building. Shellbound becomes the entry point, while the catalog shows where Midnight Toronto came from.',
			items: [
				{
					title: 'Game first',
					description:
						'The page opens with Shellbound because it best represents the studio’s next phase.'
				},
				{
					title: 'More human copy',
					description:
						'The studio text drops generic phrasing and explains how we think about small games.'
				},
				{
					title: 'Theme without noise',
					description:
						'Sky, sand, metal, and olive tones hint at Shellbound without turning the site into loud advertising.'
				}
			]
		},
		contact: {
			kicker: 'Where to follow',
			title: 'Find the games and follow what comes next.',
			description:
				'Use the links below to find the released games and follow the next Midnight Toronto updates.',
			availability: 'Shellbound is still in development; when public updates are ready, they will appear here first.',
			socialsLabel: 'Useful links',
			rights: 'Midnight Toronto'
		}
	}
};
