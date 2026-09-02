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
				`SELECT id, created_at, ip, ip_masked, ip_hash, path, referrer, user_agent, country, colo
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
	const cf = request.cf || {};
	const path = cleanText(String(payload.path || '/'), 512);
	const referrer = cleanNullableText(payload.referrer, 512);
	const country = cleanNullableText(cf.country, 16);
	const colo = cleanNullableText(cf.colo, 16);
	const ipHash = await sha256(`${ip}:${env.IP_HASH_SECRET}`);

	await env.DB.prepare(
		`INSERT INTO visits (created_at, ip, ip_masked, ip_hash, path, referrer, user_agent, country, colo)
		 VALUES (datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?)`
	).bind(
		ip,
		maskIp(ip),
		ipHash,
		path,
		referrer,
		cleanText(userAgent, 512),
		country,
		colo
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

function cleanText(value: string, maxLength: number): string {
	return value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, maxLength);
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
