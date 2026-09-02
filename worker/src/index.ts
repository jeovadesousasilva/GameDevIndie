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

		if (url.pathname === '/admin/visits' && request.method === 'GET') {
			if (!isAuthorized(request, env)) {
				return json({ error: 'unauthorized' }, request, env, 401);
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
				return json({ error: 'unauthorized' }, request, env, 401);
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
