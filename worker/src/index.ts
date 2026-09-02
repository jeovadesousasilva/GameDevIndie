export interface Env {
	DB: D1Database;
	ADMIN_TOKEN: string;
	IP_HASH_SECRET: string;
	ALLOWED_ORIGINS?: string;
}

const DEFAULT_ALLOWED_ORIGINS = [
	'https://midnighttoronto.com.br',
	'https://www.midnighttoronto.com.br'
];

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === 'OPTIONS') {
			if (url.pathname === '/visit') {
				return new Response(null, { status: 204, headers: visitCorsHeaders(request, env) });
			}

			return new Response(null, { status: 404 });
		}

		if (url.pathname === '/visit' && request.method === 'POST') {
			return logVisit(request, env);
		}

		if (url.pathname === '/admin' && request.method === 'GET') {
			return html(adminPage());
		}

		if (url.pathname === '/admin/visits' && request.method === 'GET') {
			if (!isAuthorized(request, env)) {
				return json({ error: 'unauthorized' }, 401);
			}

			const limit = clamp(Number(url.searchParams.get('limit') || 100), 1, 500);
			const rows = await env.DB.prepare(
				`SELECT id, created_at, ip, ip_masked, ip_hash, path, referrer, user_agent,
				 country, city, region, region_code, postal_code, continent, latitude, longitude,
				 timezone, asn, as_organization, http_protocol, colo, device_type, browser_name,
				 os_name, browser_language, browser_timezone, screen_width, screen_height,
				 viewport_width, viewport_height, pixel_ratio
				 FROM visits
				 ORDER BY id DESC
				 LIMIT ?`
			).bind(limit).all();

			return json({ visits: rows.results });
		}

		if (url.pathname === '/admin/visits' && request.method === 'DELETE') {
			if (!isAuthorized(request, env)) {
				return json({ error: 'unauthorized' }, 401);
			}

			const olderThanDays = clamp(Number(url.searchParams.get('olderThanDays') || 90), 1, 365);
			const result = await env.DB.prepare(
				`DELETE FROM visits
				 WHERE created_at < datetime('now', ?)`
			).bind(`-${olderThanDays} days`).run();

			return json({ deleted: result.meta.changes, olderThanDays });
		}

		return json({ ok: true });
	}
};

async function logVisit(request: Request, env: Env): Promise<Response> {
	const payload = await safeJson(request);

	const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
	const userAgent = request.headers.get('user-agent') || '';
	const cf = getCloudflareData(request);
	const client = parseClient(userAgent);
	const path = cleanText(String(payload.path || '/'), 512);
	const referrer = cleanNullableText(payload.referrer, 512);
	const country = cleanNullableText(cf.country, 16);
	const colo = cleanNullableText(cf.colo, 16);
	const ipHash = await sha256(`${ip}:${env.IP_HASH_SECRET}`);

	await env.DB.prepare(
		`INSERT INTO visits (
			created_at, ip, ip_masked, ip_hash, path, referrer, user_agent, country, colo,
			city, region, region_code, postal_code, continent, latitude, longitude, timezone,
			asn, as_organization, http_protocol, device_type, browser_name, os_name,
			browser_language, browser_timezone, screen_width, screen_height, viewport_width,
			viewport_height, pixel_ratio
		)
		 VALUES (datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	).bind(
		ip,
		maskIp(ip),
		ipHash,
		path,
		referrer,
		cleanText(userAgent, 512),
		country,
		colo,
		cleanNullableText(cf.city, 128),
		cleanNullableText(cf.region, 128),
		cleanNullableText(cf.regionCode, 32),
		cleanNullableText(cf.postalCode, 32),
		cleanNullableText(cf.continent, 32),
		cleanNullableText(cf.latitude, 32),
		cleanNullableText(cf.longitude, 32),
		cleanNullableText(cf.timezone, 64),
		cleanNullableNumber(cf.asn),
		cleanNullableText(cf.asOrganization, 256),
		cleanNullableText(cf.httpProtocol, 32),
		client.deviceType,
		client.browserName,
		client.osName,
		cleanNullableText(payload.browserLanguage, 64),
		cleanNullableText(payload.browserTimezone, 64),
		cleanNullableNumber(payload.screenWidth),
		cleanNullableNumber(payload.screenHeight),
		cleanNullableNumber(payload.viewportWidth),
		cleanNullableNumber(payload.viewportHeight),
		cleanNullableNumber(payload.pixelRatio)
	).run();

	return json({ ok: true }, 200, visitCorsHeaders(request, env));
}

async function safeJson(request: Request): Promise<Record<string, unknown>> {
	try {
		const value = JSON.parse(await request.text());
		return value && typeof value === 'object' && !Array.isArray(value)
			? value as Record<string, unknown>
			: {};
	} catch {
		return {};
	}
}

function cleanNullableText(value: unknown, maxLength: number): string | null {
	if (typeof value !== 'string' || value.trim() === '') {
		return null;
	}

	return cleanText(value, maxLength);
}

function cleanNullableNumber(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}

	if (typeof value === 'string' && value.trim() !== '') {
		const number = Number(value);
		return Number.isFinite(number) ? number : null;
	}

	return null;
}

function cleanText(value: string, maxLength: number): string {
	return value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, maxLength);
}

function getCloudflareData(request: Request): Record<string, unknown> {
	return (request as Request & { cf?: Record<string, unknown> }).cf || {};
}

function parseClient(userAgent: string): {
	deviceType: string;
	browserName: string;
	osName: string;
} {
	const ua = userAgent || '';
	const lower = ua.toLowerCase();

	let deviceType = 'Desktop';
	if (/bot|crawler|spider|slurp|bingpreview/i.test(ua)) {
		deviceType = 'Bot';
	} else if (/ipad|tablet|kindle|silk/i.test(ua)) {
		deviceType = 'Tablet';
	} else if (/mobi|iphone|android/i.test(ua)) {
		deviceType = 'Celular';
	}

	let osName = 'Desconhecido';
	if (/iphone|ipad|ipod/i.test(ua)) {
		osName = 'iOS';
	} else if (/android/i.test(ua)) {
		osName = 'Android';
	} else if (/windows/i.test(ua)) {
		osName = 'Windows';
	} else if (/mac os x|macintosh/i.test(ua)) {
		osName = 'macOS';
	} else if (/linux/i.test(ua)) {
		osName = 'Linux';
	}

	let browserName = 'Desconhecido';
	if (lower.includes('edg/')) {
		browserName = 'Microsoft Edge';
	} else if (lower.includes('opr/') || lower.includes('opera')) {
		browserName = 'Opera';
	} else if (lower.includes('samsungbrowser')) {
		browserName = 'Samsung Internet';
	} else if (lower.includes('firefox/') || lower.includes('fxios/')) {
		browserName = 'Firefox';
	} else if (lower.includes('crios/') || lower.includes('chrome/')) {
		browserName = 'Chrome';
	} else if (lower.includes('safari/')) {
		browserName = 'Safari';
	}

	return { deviceType, browserName, osName };
}

function clamp(value: number, min: number, max: number): number {
	if (!Number.isFinite(value)) {
		return min;
	}

	return Math.min(Math.max(Math.floor(value), min), max);
}

function isAuthorized(request: Request, env: Env): boolean {
	const authorization = request.headers.get('authorization') || '';
	return authorization === `Bearer ${env.ADMIN_TOKEN}`;
}

function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
	return new Response(JSON.stringify(data, null, 2), {
		status,
		headers: {
			'content-type': 'application/json; charset=utf-8',
			...headers
		}
	});
}

function html(body: string, status = 200): Response {
	return new Response(body, {
		status,
		headers: {
			'content-type': 'text/html; charset=utf-8',
			'cache-control': 'no-store',
			'x-robots-tag': 'noindex, nofollow'
		}
	});
}

function visitCorsHeaders(request: Request, env: Env): HeadersInit {
	const origin = request.headers.get('origin') || '';
	const allowedOrigins = (env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(','))
		.split(',')
		.map((item) => item.trim())
		.filter(Boolean);

	const headers: Record<string, string> = {
		'access-control-allow-methods': 'POST, GET, DELETE, OPTIONS',
		'access-control-allow-headers': 'content-type, authorization',
		'access-control-max-age': '86400'
	};

	if (allowedOrigins.includes(origin)) {
		headers['access-control-allow-origin'] = origin;
		headers.vary = 'Origin';
	}

	return headers;
}

function adminPage(): string {
	return `<!doctype html>
<html lang="pt-BR">
	<head>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<meta name="robots" content="noindex,nofollow">
		<title>Visitas do site</title>
		<style>
			:root {
				color-scheme: light;
				--bg: #f4f6fb;
				--panel: #ffffff;
				--panel-soft: #f8fafc;
				--line: #dbe3ef;
				--text: #111827;
				--muted: #64748b;
				--accent: #f97316;
				--accent-soft: #fff1e8;
				--good: #0f766e;
			}

			* {
				box-sizing: border-box;
			}

			body {
				margin: 0;
				padding: 28px;
				font-family: Inter, Arial, sans-serif;
				color: var(--text);
				background: var(--bg);
			}

			main {
				max-width: 1240px;
				margin: 0 auto;
			}

			.topbar,
			.controls,
			.summary-card,
			.visit-card {
				border: 1px solid var(--line);
				border-radius: 8px;
				background: var(--panel);
				box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
			}

			.topbar {
				display: flex;
				align-items: flex-start;
				justify-content: space-between;
				gap: 18px;
				padding: 22px;
			}

			h1,
			h2,
			p {
				margin: 0;
			}

			h1 {
				font-size: 1.45rem;
			}

			p,
			.small {
				color: var(--muted);
			}

			.badge {
				display: inline-flex;
				align-items: center;
				min-height: 28px;
				padding: 0 10px;
				border-radius: 999px;
				color: #9a3412;
				background: var(--accent-soft);
				font-size: 0.78rem;
				font-weight: 800;
			}

			.controls {
				display: grid;
				grid-template-columns: 1fr auto auto;
				gap: 10px;
				margin: 16px 0;
				padding: 14px;
			}

			input,
			button {
				min-height: 42px;
				border-radius: 6px;
				font: inherit;
			}

			input {
				border: 1px solid var(--line);
				padding: 0 12px;
			}

			button {
				border: 0;
				padding: 0 16px;
				color: #ffffff;
				background: var(--accent);
				font-weight: 800;
				cursor: pointer;
			}

			button.secondary {
				color: var(--text);
				background: #e8edf6;
			}

			.summary {
				display: grid;
				grid-template-columns: repeat(4, minmax(0, 1fr));
				gap: 12px;
				margin-bottom: 16px;
			}

			.summary-card {
				padding: 15px;
			}

			.summary-card span {
				display: block;
				color: var(--muted);
				font-size: 0.76rem;
				font-weight: 800;
				text-transform: uppercase;
			}

			.summary-card strong {
				display: block;
				margin-top: 6px;
				font-size: 1.35rem;
			}

			.status {
				margin: 0 0 14px;
				color: var(--good);
				font-weight: 800;
			}

			.visits {
				display: grid;
				gap: 14px;
			}

			.visit-card {
				overflow: hidden;
			}

			.visit-head {
				display: flex;
				align-items: flex-start;
				justify-content: space-between;
				gap: 14px;
				padding: 16px;
				border-bottom: 1px solid var(--line);
				background: var(--panel-soft);
			}

			.visit-head h2 {
				font-size: 1rem;
			}

			.visit-grid {
				display: grid;
				grid-template-columns: repeat(5, minmax(0, 1fr));
				gap: 1px;
				background: var(--line);
			}

			.info-block {
				display: grid;
				gap: 10px;
				align-content: start;
				padding: 14px;
				background: var(--panel);
			}

			.info-block h3 {
				margin: 0;
				color: #334155;
				font-size: 0.78rem;
				text-transform: uppercase;
			}

			.field {
				display: grid;
				gap: 3px;
			}

			.field span {
				color: var(--muted);
				font-size: 0.74rem;
				font-weight: 800;
				text-transform: uppercase;
			}

			.field strong,
			.field code {
				min-width: 0;
				overflow-wrap: anywhere;
				font-size: 0.9rem;
			}

			code {
				font-family: Consolas, monospace;
			}

			.empty {
				padding: 22px;
				border: 1px dashed var(--line);
				border-radius: 8px;
				color: var(--muted);
				background: var(--panel);
				text-align: center;
			}

			@media (max-width: 1040px) {
				.visit-grid {
					grid-template-columns: repeat(2, minmax(0, 1fr));
				}

				.summary {
					grid-template-columns: repeat(2, minmax(0, 1fr));
				}
			}

			@media (max-width: 680px) {
				body {
					padding: 14px;
				}

				.topbar,
				.visit-head {
					display: grid;
				}

				.controls,
				.visit-grid,
				.summary {
					grid-template-columns: 1fr;
				}
			}
		</style>
	</head>
	<body>
		<main>
			<section class="topbar">
				<div>
					<h1>Visitas do site</h1>
					<p>Lista privada com IP, localização aproximada, dispositivo e origem do acesso.</p>
				</div>
				<span class="badge">Privado</span>
			</section>

			<form class="controls" id="login">
				<input id="token" type="password" autocomplete="current-password" placeholder="ADMIN_TOKEN">
				<button type="submit">Carregar</button>
				<button type="button" class="secondary" id="refresh">Atualizar</button>
			</form>

			<p class="status" id="status"></p>

			<section class="summary" id="summary" hidden>
				<div class="summary-card"><span>Visitas</span><strong id="totalVisits">0</strong></div>
				<div class="summary-card"><span>IPs únicos</span><strong id="uniqueIps">0</strong></div>
				<div class="summary-card"><span>Cidades</span><strong id="uniqueCities">0</strong></div>
				<div class="summary-card"><span>Celulares</span><strong id="mobileVisits">0</strong></div>
			</section>

			<section class="visits" id="visits">
				<div class="empty">Digite sua senha para carregar a lista.</div>
			</section>
		</main>

		<script>
			const form = document.querySelector('#login');
			const token = document.querySelector('#token');
			const visitsEl = document.querySelector('#visits');
			const statusEl = document.querySelector('#status');
			const refresh = document.querySelector('#refresh');
			const summary = document.querySelector('#summary');

			function escapeHtml(value) {
				return String(value ?? '').replace(/[&<>"']/g, function(char) {
					return {
						'&': '&amp;',
						'<': '&lt;',
						'>': '&gt;',
						'"': '&quot;',
						"'": '&#39;'
					}[char];
				});
			}

			function value(value, fallback) {
				return value === null || value === undefined || value === '' ? (fallback || '-') : value;
			}

			function field(label, content, code) {
				const tag = code ? 'code' : 'strong';
				return '<div class="field"><span>' + escapeHtml(label) + '</span><' + tag + '>' + escapeHtml(value(content)) + '</' + tag + '></div>';
			}

			function locationTitle(visit) {
				return [visit.city, visit.region, visit.country].filter(Boolean).join(', ') || 'Localização não informada';
			}

			function screenSize(visit) {
				if (!visit.screen_width || !visit.screen_height) {
					return '-';
				}

				return visit.screen_width + ' x ' + visit.screen_height + ' / janela ' + value(visit.viewport_width) + ' x ' + value(visit.viewport_height);
			}

			function renderVisit(visit) {
				return '<article class="visit-card">'
					+ '<div class="visit-head">'
						+ '<div><h2>#' + escapeHtml(visit.id) + ' - ' + escapeHtml(value(visit.path, '/')) + '</h2><p>' + escapeHtml(value(visit.created_at)) + '</p></div>'
						+ '<span class="badge">' + escapeHtml(value(visit.device_type)) + '</span>'
					+ '</div>'
					+ '<div class="visit-grid">'
						+ '<section class="info-block"><h3>Acesso</h3>'
							+ field('Página', visit.path)
							+ field('Origem', visit.referrer)
							+ field('Protocolo', visit.http_protocol)
						+ '</section>'
						+ '<section class="info-block"><h3>Localização aproximada</h3>'
							+ field('Cidade', visit.city)
							+ field('Estado/região', visit.region)
							+ field('País', visit.country)
							+ field('Coordenadas', visit.latitude && visit.longitude ? visit.latitude + ', ' + visit.longitude : null, true)
							+ field('Fuso por IP', visit.timezone)
						+ '</section>'
						+ '<section class="info-block"><h3>IP e rede</h3>'
							+ field('IP completo', visit.ip, true)
							+ field('IP mascarado', visit.ip_masked, true)
							+ field('ASN', visit.asn)
							+ field('Provedor/rede', visit.as_organization)
						+ '</section>'
						+ '<section class="info-block"><h3>Dispositivo</h3>'
							+ field('Tipo', visit.device_type)
							+ field('Sistema', visit.os_name)
							+ field('Navegador', visit.browser_name)
							+ field('Idioma', visit.browser_language)
							+ field('Fuso do navegador', visit.browser_timezone)
						+ '</section>'
						+ '<section class="info-block"><h3>Tela e técnico</h3>'
							+ field('Tela', screenSize(visit))
							+ field('Densidade', visit.pixel_ratio)
							+ field('Data center CF', visit.colo)
							+ field('User-agent', visit.user_agent)
						+ '</section>'
					+ '</div>'
				+ '</article>';
			}

			function updateSummary(visits) {
				const ipSet = new Set(visits.map(function(visit) { return visit.ip_hash; }).filter(Boolean));
				const citySet = new Set(visits.map(function(visit) { return locationTitle(visit); }).filter(function(item) { return item !== 'Localização não informada'; }));
				const mobileCount = visits.filter(function(visit) { return visit.device_type === 'Celular'; }).length;

				document.querySelector('#totalVisits').textContent = String(visits.length);
				document.querySelector('#uniqueIps').textContent = String(ipSet.size);
				document.querySelector('#uniqueCities').textContent = String(citySet.size);
				document.querySelector('#mobileVisits').textContent = String(mobileCount);
				summary.hidden = false;
			}

			async function loadVisits() {
				const password = token.value.trim();
				if (!password) {
					statusEl.textContent = 'Digite a senha primeiro.';
					return;
				}

				statusEl.textContent = 'Carregando...';

				const response = await fetch('/admin/visits?limit=100', {
					headers: {
						authorization: 'Bearer ' + password
					}
				});

				if (!response.ok) {
					statusEl.textContent = 'Senha incorreta ou acesso negado.';
					return;
				}

				const data = await response.json();
				const visits = data.visits || [];
				statusEl.textContent = visits.length ? 'Lista atualizada com ' + visits.length + ' visita(s).' : 'Nenhuma visita registrada.';
				updateSummary(visits);
				visitsEl.innerHTML = visits.length
					? visits.map(renderVisit).join('')
					: '<div class="empty">Nenhum registro encontrado.</div>';
			}

			form.addEventListener('submit', function(event) {
				event.preventDefault();
				loadVisits().catch(function() {
					statusEl.textContent = 'Não foi possível carregar a lista.';
				});
			});

			refresh.addEventListener('click', function() {
				loadVisits().catch(function() {
					statusEl.textContent = 'Não foi possível atualizar a lista.';
				});
			});
		</script>
	</body>
</html>`;
}

function legacyAdminPage(): string {
	return `<!doctype html>
<html lang="pt-BR">
	<head>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<meta name="robots" content="noindex,nofollow">
		<title>Visitas do site</title>
		<style>
			:root {
				color-scheme: light;
				--bg: #f5f7fb;
				--panel: #ffffff;
				--line: #dce2ec;
				--text: #111827;
				--muted: #64748b;
				--accent: #f97316;
			}

			* {
				box-sizing: border-box;
			}

			body {
				margin: 0;
				padding: 28px;
				font-family: Arial, sans-serif;
				color: var(--text);
				background: var(--bg);
			}

			main {
				max-width: 1180px;
				margin: 0 auto;
			}

			header,
			form,
			.table-wrap {
				border: 1px solid var(--line);
				border-radius: 8px;
				background: var(--panel);
			}

			header {
				padding: 20px;
			}

			h1 {
				margin: 0 0 6px;
				font-size: 1.4rem;
			}

			p {
				margin: 0;
				color: var(--muted);
			}

			form {
				display: flex;
				flex-wrap: wrap;
				gap: 10px;
				margin: 16px 0;
				padding: 14px;
			}

			input,
			button {
				min-height: 42px;
				border-radius: 6px;
				font: inherit;
			}

			input {
				flex: 1 1 280px;
				border: 1px solid var(--line);
				padding: 0 12px;
			}

			button {
				border: 0;
				padding: 0 16px;
				color: #ffffff;
				background: var(--accent);
				font-weight: 700;
				cursor: pointer;
			}

			.table-wrap {
				overflow-x: auto;
			}

			table {
				width: 100%;
				border-collapse: collapse;
				min-width: 980px;
			}

			th,
			td {
				padding: 11px 12px;
				border-bottom: 1px solid var(--line);
				text-align: left;
				vertical-align: top;
				font-size: 0.9rem;
			}

			th {
				background: #f8fafc;
				color: #334155;
				font-size: 0.78rem;
				text-transform: uppercase;
			}

			code {
				font-family: Consolas, monospace;
				font-size: 0.86rem;
			}

			.status {
				margin: 10px 0 0;
				font-weight: 700;
			}

			@media (max-width: 680px) {
				body {
					padding: 16px;
				}

				form button {
					width: 100%;
				}
			}
		</style>
	</head>
	<body>
		<main>
			<header>
				<h1>Visitas do site</h1>
				<p>Digite sua senha ADMIN_TOKEN para carregar a lista privada.</p>
				<p class="status" id="status"></p>
			</header>

			<form id="login">
				<input id="token" type="password" autocomplete="current-password" placeholder="ADMIN_TOKEN">
				<button type="submit">Carregar visitas</button>
				<button type="button" id="refresh">Atualizar</button>
			</form>

			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th>Registro</th>
							<th>Data/hora</th>
							<th>IP completo</th>
							<th>IP mascarado</th>
							<th>Página</th>
							<th>País</th>
							<th>Origem</th>
							<th>Navegador/dispositivo</th>
						</tr>
					</thead>
					<tbody id="rows">
						<tr><td colspan="8">Aguardando senha.</td></tr>
					</tbody>
				</table>
			</div>
		</main>

		<script>
			const form = document.querySelector('#login');
			const token = document.querySelector('#token');
			const rows = document.querySelector('#rows');
			const status = document.querySelector('#status');
			const refresh = document.querySelector('#refresh');

			function escapeHtml(value) {
				return String(value ?? '').replace(/[&<>"']/g, (char) => ({
					'&': '&amp;',
					'<': '&lt;',
					'>': '&gt;',
					'"': '&quot;',
					"'": '&#39;'
				})[char]);
			}

			async function loadVisits() {
				const password = token.value.trim();
				if (!password) {
					status.textContent = 'Digite a senha primeiro.';
					return;
				}

				status.textContent = 'Carregando...';

				const response = await fetch('/admin/visits?limit=100', {
					headers: {
						authorization: 'Bearer ' + password
					}
				});

				if (!response.ok) {
					status.textContent = 'Senha incorreta ou acesso negado.';
					return;
				}

				const data = await response.json();
				const visits = data.visits || [];
				status.textContent = visits.length ? visits.length + ' visita(s) encontradas.' : 'Nenhuma visita registrada.';

				rows.innerHTML = visits.length
					? visits.map((visit) => '<tr>'
						+ '<td>' + escapeHtml(visit.id) + '</td>'
						+ '<td>' + escapeHtml(visit.created_at) + '</td>'
						+ '<td><code>' + escapeHtml(visit.ip) + '</code></td>'
						+ '<td><code>' + escapeHtml(visit.ip_masked) + '</code></td>'
						+ '<td>' + escapeHtml(visit.path) + '</td>'
						+ '<td>' + escapeHtml(visit.country) + '</td>'
						+ '<td>' + escapeHtml(visit.referrer) + '</td>'
						+ '<td>' + escapeHtml(visit.user_agent) + '</td>'
					+ '</tr>').join('')
					: '<tr><td colspan="8">Nenhum registro.</td></tr>';
			}

			form.addEventListener('submit', (event) => {
				event.preventDefault();
				loadVisits().catch(() => {
					status.textContent = 'Não foi possível carregar a lista.';
				});
			});

			refresh.addEventListener('click', () => {
				loadVisits().catch(() => {
					status.textContent = 'Não foi possível atualizar a lista.';
				});
			});
		</script>
	</body>
</html>`;
}

async function sha256(value: string): Promise<string> {
	const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return [...new Uint8Array(buffer)]
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}

function maskIp(ip: string): string {
	if (!ip) {
		return '';
	}

	if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
		return ip.replace(/\.\d{1,3}$/, '.xxx');
	}

	const parts = ip.split(':');
	if (parts.length > 2) {
		return `${parts.slice(0, 4).join(':')}::`;
	}

	return ip;
}
