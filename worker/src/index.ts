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
				 timezone, asn, as_organization, http_protocol, colo, device_type, device_model, browser_name,
				 os_name, browser_language, browser_timezone, screen_width, screen_height,
				 viewport_width, viewport_height, pixel_ratio, session_id, last_seen_at, closed_at,
				 duration_seconds, is_open, location_permission, precise_latitude, precise_longitude,
				 precise_accuracy, precise_altitude, precise_heading, precise_speed, visitor_id_hash,
				 probable_person_id
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
	const event = cleanText(String(payload.event || 'start'), 32);
	const sessionId = cleanNullableText(payload.sessionId, 96);

	if (sessionId && ['heartbeat', 'close', 'location'].includes(event)) {
		await updateVisitSession(env, sessionId, event, payload);
		return json({ ok: true }, 200, visitCorsHeaders(request, env));
	}

	const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
	const userAgent = request.headers.get('user-agent') || '';
	const cf = getCloudflareData(request);
	const client = parseClient(userAgent);
	const path = cleanText(String(payload.path || '/'), 512);
	const referrer = cleanNullableText(payload.referrer, 512);
	const country = cleanNullableText(cf.country, 16);
	const colo = cleanNullableText(cf.colo, 16);
	const ipHash = await sha256(`${ip}:${env.IP_HASH_SECRET}`);
	const deviceModel = cleanNullableText(payload.deviceModel, 128) || client.deviceModel;
	const identity = await createVisitorIdentity(payload, env, { ipHash, userAgent, deviceModel });

	await env.DB.prepare(
		`INSERT INTO visits (
			created_at, ip, ip_masked, ip_hash, path, referrer, user_agent, country, colo,
			city, region, region_code, postal_code, continent, latitude, longitude, timezone,
			asn, as_organization, http_protocol, device_type, device_model, browser_name, os_name,
			browser_language, browser_timezone, screen_width, screen_height, viewport_width,
			viewport_height, pixel_ratio, session_id, last_seen_at, duration_seconds, is_open,
			location_permission, precise_latitude, precise_longitude, precise_accuracy,
			precise_altitude, precise_heading, precise_speed, visitor_id_hash, probable_person_id
		)
		 VALUES (datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
		cleanNullableScalarText(cf.latitude, 32),
		cleanNullableScalarText(cf.longitude, 32),
		cleanNullableText(cf.timezone, 64),
		cleanNullableNumber(cf.asn),
		cleanNullableText(cf.asOrganization, 256),
		cleanNullableText(cf.httpProtocol, 32),
		client.deviceType,
		deviceModel,
		client.browserName,
		client.osName,
		cleanNullableText(payload.browserLanguage, 64),
		cleanNullableText(payload.browserTimezone, 64),
		cleanNullableNumber(payload.screenWidth),
		cleanNullableNumber(payload.screenHeight),
		cleanNullableNumber(payload.viewportWidth),
		cleanNullableNumber(payload.viewportHeight),
		cleanNullableNumber(payload.pixelRatio),
		sessionId,
		cleanNullableNumber(payload.durationSeconds) || 0,
		1,
		cleanNullableText(payload.locationPermission, 32),
		cleanNullableScalarText(payload.preciseLatitude, 32),
		cleanNullableScalarText(payload.preciseLongitude, 32),
		cleanNullableNumber(payload.preciseAccuracy),
		cleanNullableScalarText(payload.preciseAltitude, 32),
		cleanNullableScalarText(payload.preciseHeading, 32),
		cleanNullableScalarText(payload.preciseSpeed, 32),
		identity.visitorIdHash,
		identity.probablePersonId
	).run();

	return json({ ok: true }, 200, visitCorsHeaders(request, env));
}

async function updateVisitSession(env: Env, sessionId: string, event: string, payload: Record<string, unknown>): Promise<void> {
	const durationSeconds = cleanNullableNumber(payload.durationSeconds);
	const deviceModel = cleanNullableText(payload.deviceModel, 128);
	const locationPermission = cleanNullableText(payload.locationPermission, 32);
	const preciseLatitude = cleanNullableScalarText(payload.preciseLatitude, 32);
	const preciseLongitude = cleanNullableScalarText(payload.preciseLongitude, 32);
	const preciseAccuracy = cleanNullableNumber(payload.preciseAccuracy);
	const preciseAltitude = cleanNullableScalarText(payload.preciseAltitude, 32);
	const preciseHeading = cleanNullableScalarText(payload.preciseHeading, 32);
	const preciseSpeed = cleanNullableScalarText(payload.preciseSpeed, 32);
	const identity = await createVisitorIdentity(payload, env, { deviceModel });

	await env.DB.prepare(
		`UPDATE visits
		 SET last_seen_at = datetime('now'),
			 closed_at = CASE WHEN ? = 'close' THEN datetime('now') ELSE closed_at END,
			 is_open = CASE WHEN ? = 'close' THEN 0 ELSE is_open END,
			 duration_seconds = COALESCE(?, CAST(strftime('%s', 'now') - strftime('%s', created_at) AS INTEGER), duration_seconds),
			 device_model = COALESCE(?, device_model),
			 location_permission = COALESCE(?, location_permission),
			 precise_latitude = COALESCE(?, precise_latitude),
			 precise_longitude = COALESCE(?, precise_longitude),
			 precise_accuracy = COALESCE(?, precise_accuracy),
			 precise_altitude = COALESCE(?, precise_altitude),
			 precise_heading = COALESCE(?, precise_heading),
			 precise_speed = COALESCE(?, precise_speed),
			 visitor_id_hash = COALESCE(?, visitor_id_hash),
			 probable_person_id = COALESCE(?, probable_person_id)
		 WHERE session_id = ?`
	).bind(
		event,
		event,
		durationSeconds,
		deviceModel,
		locationPermission,
		preciseLatitude,
		preciseLongitude,
		preciseAccuracy,
		preciseAltitude,
		preciseHeading,
		preciseSpeed,
		identity.visitorIdHash,
		identity.probablePersonId,
		sessionId
	).run();
}

async function createVisitorIdentity(
	payload: Record<string, unknown>,
	env: Env,
	context: { ipHash?: string | null; userAgent?: string | null; deviceModel?: string | null }
): Promise<{ visitorIdHash: string | null; probablePersonId: string | null }> {
	const visitorId = cleanNullableText(payload.visitorId, 160);
	if (visitorId) {
		const visitorIdHash = await sha256(`visitor:${visitorId}:${env.IP_HASH_SECRET}`);
		return {
			visitorIdHash,
			probablePersonId: formatProbablePersonId(visitorIdHash)
		};
	}

	if (!context.ipHash || !context.userAgent) {
		return { visitorIdHash: null, probablePersonId: null };
	}

	const softSignals = [
		context.ipHash,
		cleanText(context.userAgent, 512),
		cleanNullableText(payload.browserTimezone, 64) || '',
		cleanNullableText(payload.browserLanguage, 64) || '',
		context.deviceModel || '',
		cleanNullableNumber(payload.screenWidth) || '',
		cleanNullableNumber(payload.screenHeight) || '',
		cleanNullableNumber(payload.pixelRatio) || ''
	].join('|');
	const probableHash = await sha256(`probable:${softSignals}:${env.IP_HASH_SECRET}`);

	return {
		visitorIdHash: null,
		probablePersonId: formatProbablePersonId(probableHash)
	};
}

function formatProbablePersonId(hash: string): string {
	return `MP-${hash.slice(0, 10).toUpperCase()}`;
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

function cleanNullableScalarText(value: unknown, maxLength: number): string | null {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return cleanText(String(value), maxLength);
	}

	return cleanNullableText(value, maxLength);
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
	deviceModel: string | null;
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

	const deviceModel = detectDeviceModel(ua, osName);

	return { deviceType, deviceModel, browserName, osName };
}

function detectDeviceModel(userAgent: string, osName: string): string | null {
	const patterns = [
		/\b(SM-[A-Z0-9]+)\b/i,
		/\b(GT-[A-Z0-9]+)\b/i,
		/\b(Pixel [A-Z0-9 ]+)\b/i,
		/\b(Moto [A-Z0-9 ]+)\b/i,
		/\b(Redmi [A-Z0-9 ]+)\b/i,
		/\b(POCO [A-Z0-9 ]+)\b/i,
		/\b(Mi [A-Z0-9 ]+)\b/i,
		/\b(Huawei [A-Z0-9 -]+)\b/i,
		/\b(HONOR [A-Z0-9 -]+)\b/i,
		/\b(OnePlus [A-Z0-9 ]+)\b/i,
		/\b(XQ-[A-Z0-9]+)\b/i
	];

	for (const pattern of patterns) {
		const match = userAgent.match(pattern);
		if (match?.[1]) {
			return cleanText(match[1].trim(), 128);
		}
	}

	if (/iphone/i.test(userAgent)) {
		return 'iPhone';
	}

	if (/ipad/i.test(userAgent)) {
		return 'iPad';
	}

	if (/ipod/i.test(userAgent)) {
		return 'iPod';
	}

	return osName === 'Android' ? 'Android não informado' : null;
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
				color-scheme: dark;
				--bg: #05070c;
				--panel: rgba(8, 14, 24, 0.92);
				--panel-soft: rgba(12, 23, 38, 0.96);
				--line: rgba(83, 250, 172, 0.17);
				--line-strong: rgba(83, 250, 172, 0.36);
				--text: #e9fff6;
				--muted: #87a39a;
				--accent: #53faac;
				--accent-2: #38bdf8;
				--accent-soft: rgba(83, 250, 172, 0.13);
				--warn-soft: rgba(251, 191, 36, 0.15);
				--danger-soft: rgba(148, 163, 184, 0.13);
				--good: #53faac;
			}

			* {
				box-sizing: border-box;
			}

			body {
				margin: 0;
				padding: 28px;
				font-family: Inter, Arial, sans-serif;
				color: var(--text);
				background:
					linear-gradient(rgba(83, 250, 172, 0.035) 1px, transparent 1px),
					linear-gradient(90deg, rgba(83, 250, 172, 0.035) 1px, transparent 1px),
					radial-gradient(circle at 50% -20%, rgba(56, 189, 248, 0.18), transparent 34%),
					linear-gradient(145deg, #05070c 0%, #07111d 52%, #02040a 100%);
				background-size: 34px 34px, 34px 34px, auto, auto;
				min-height: 100vh;
			}

			body::before {
				position: fixed;
				inset: 0;
				pointer-events: none;
				content: '';
				background: linear-gradient(180deg, transparent, rgba(83, 250, 172, 0.035), transparent);
				animation: scan 9s linear infinite;
				opacity: 0.7;
			}

			main {
				position: relative;
				z-index: 1;
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
				box-shadow: 0 18px 42px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.04);
				backdrop-filter: blur(16px);
			}

			.topbar {
				display: flex;
				align-items: flex-start;
				justify-content: space-between;
				gap: 18px;
				padding: 22px;
				border-color: var(--line-strong);
				background:
					linear-gradient(135deg, rgba(83, 250, 172, 0.12), transparent 42%),
					linear-gradient(160deg, rgba(8, 14, 24, 0.98), rgba(4, 8, 16, 0.94));
			}

			h1,
			h2,
			p {
				margin: 0;
			}

			h1 {
				font-size: 1.45rem;
				letter-spacing: 0;
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
				border: 1px solid rgba(83, 250, 172, 0.24);
				color: var(--accent);
				background: var(--accent-soft);
				font-size: 0.78rem;
				font-weight: 800;
			}

			.badge.open {
				color: #b8ffe1;
				background: rgba(16, 185, 129, 0.18);
			}

			.badge.closed {
				color: #cbd5e1;
				background: var(--danger-soft);
			}

			.badge.stale {
				color: #fde68a;
				background: var(--warn-soft);
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
				color: var(--text);
				background: rgba(2, 6, 23, 0.72);
				padding: 0 12px;
				outline: 0;
			}

			input:focus {
				border-color: var(--accent);
				box-shadow: 0 0 0 3px rgba(83, 250, 172, 0.12);
			}

			button {
				border: 0;
				padding: 0 16px;
				color: #03120b;
				background: linear-gradient(135deg, var(--accent), var(--accent-2));
				font-weight: 800;
				cursor: pointer;
			}

			button.secondary {
				border: 1px solid var(--line);
				color: var(--text);
				background: rgba(255, 255, 255, 0.06);
			}

			.summary {
				display: grid;
				grid-template-columns: repeat(6, minmax(0, 1fr));
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

			.visit-meta {
				display: flex;
				flex-wrap: wrap;
				justify-content: flex-end;
				gap: 8px;
			}

			.identity-chip {
				display: inline-flex;
				align-items: center;
				min-height: 28px;
				padding: 0 10px;
				border: 1px solid rgba(56, 189, 248, 0.32);
				border-radius: 999px;
				color: #bae6fd;
				background: rgba(56, 189, 248, 0.12);
				font-family: Consolas, monospace;
				font-size: 0.78rem;
				font-weight: 800;
			}

			.visit-head h2 {
				font-size: 1rem;
			}

			.visit-grid {
				display: grid;
				grid-template-columns: repeat(3, minmax(0, 1fr));
				gap: 1px;
				background: rgba(83, 250, 172, 0.12);
			}

			.info-block {
				display: grid;
				gap: 10px;
				align-content: start;
				padding: 14px;
				background: rgba(4, 10, 18, 0.82);
			}

			.info-block h3 {
				margin: 0;
				color: var(--accent);
				font-size: 0.78rem;
				text-transform: uppercase;
			}

			.map-block {
				position: relative;
				min-height: 230px;
				overflow: hidden;
				background:
					linear-gradient(rgba(83, 250, 172, 0.08) 1px, transparent 1px),
					linear-gradient(90deg, rgba(83, 250, 172, 0.08) 1px, transparent 1px),
					radial-gradient(circle at 50% 46%, rgba(83, 250, 172, 0.18), transparent 34%),
					rgba(5, 18, 19, 0.95);
				background-size: 28px 28px, 28px 28px, auto, auto;
			}

			.map-block::before,
			.map-block::after {
				position: absolute;
				inset: 32px;
				border: 1px solid rgba(83, 250, 172, 0.16);
				border-radius: 50%;
				content: '';
			}

			.map-block::after {
				inset: 64px;
				border-color: rgba(56, 189, 248, 0.18);
			}

			.map-content {
				position: relative;
				z-index: 1;
				display: grid;
				min-height: 100%;
				align-content: center;
				justify-items: center;
				gap: 10px;
				text-align: center;
			}

			.map-pin {
				width: 16px;
				height: 16px;
				border-radius: 50%;
				background: var(--accent);
				box-shadow: 0 0 0 9px rgba(83, 250, 172, 0.11), 0 0 30px rgba(83, 250, 172, 0.82);
			}

			.map-source {
				color: var(--muted);
				font-size: 0.78rem;
				font-weight: 800;
				text-transform: uppercase;
			}

			.map-coords {
				color: #e9fff6;
				font-family: Consolas, monospace;
				font-size: 0.92rem;
				overflow-wrap: anywhere;
			}

			.map-link {
				display: inline-flex;
				align-items: center;
				min-height: 38px;
				padding: 0 12px;
				border: 1px solid var(--line-strong);
				border-radius: 8px;
				color: #03120b;
				background: linear-gradient(135deg, var(--accent), var(--accent-2));
				font-size: 0.86rem;
				font-weight: 900;
				text-decoration: none;
			}

			.map-empty {
				color: var(--muted);
				font-weight: 800;
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
				color: #f7fffb;
			}

			code {
				font-family: Consolas, monospace;
				color: #93c5fd;
			}

			.empty {
				padding: 22px;
				border: 1px dashed var(--line);
				border-radius: 8px;
				color: var(--muted);
				background: var(--panel);
				text-align: center;
			}

			@keyframes scan {
				from {
					transform: translateY(-100%);
				}

				to {
					transform: translateY(100%);
				}
			}

			@media (prefers-reduced-motion: reduce) {
				body::before {
					animation: none;
				}
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
					<p>Lista privada com sessão, IP, localização aproximada, localização autorizada e dispositivo.</p>
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
				<div class="summary-card"><span>IDs prováveis</span><strong id="uniquePeople">0</strong></div>
				<div class="summary-card"><span>Cidades</span><strong id="uniqueCities">0</strong></div>
				<div class="summary-card"><span>Abertos agora</span><strong id="openVisits">0</strong></div>
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

			function parseUtcDate(value) {
				if (!value) {
					return null;
				}

				const text = String(value);
				const normalized = /Z$|[+-][0-9]{2}:?[0-9]{2}$/.test(text) ? text : text.replace(' ', 'T') + 'Z';
				const date = new Date(normalized);
				return Number.isNaN(date.getTime()) ? null : date;
			}

			function brDate(value) {
				const date = parseUtcDate(value);
				if (!date) {
					return '-';
				}

				return new Intl.DateTimeFormat('pt-BR', {
					timeZone: 'America/Sao_Paulo',
					dateStyle: 'short',
					timeStyle: 'medium'
				}).format(date);
			}

			function formatDuration(seconds) {
				const total = Number(seconds || 0);
				if (!Number.isFinite(total) || total <= 0) {
					return 'menos de 1s';
				}

				const hours = Math.floor(total / 3600);
				const minutes = Math.floor((total % 3600) / 60);
				const secs = Math.floor(total % 60);
				const parts = [];

				if (hours) {
					parts.push(hours + 'h');
				}

				if (minutes || hours) {
					parts.push(minutes + 'min');
				}

				parts.push(secs + 's');
				return parts.join(' ');
			}

			function sessionStatus(visit) {
				const lastSeen = parseUtcDate(visit.last_seen_at);
				const closed = visit.closed_at || visit.is_open === 0 || visit.is_open === '0';

				if (closed) {
					return { label: 'Fechado', className: 'closed' };
				}

				if (lastSeen && Date.now() - lastSeen.getTime() <= 45000) {
					return { label: 'Aberto agora', className: 'open' };
				}

				return { label: 'Sem sinal recente', className: 'stale' };
			}

			function permissionLabel(value) {
				return {
					granted: 'Permitida',
					denied: 'Negada',
					dismissed: 'Dispensada',
					prompt: 'Aguardando permissão',
					unavailable: 'Indisponível no momento',
					unsupported: 'Não suportada'
				}[value] || 'Não solicitada';
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

			function coordinatesForMap(visit) {
				if (visit.precise_latitude && visit.precise_longitude) {
					return {
						source: 'Localização autorizada',
						latitude: visit.precise_latitude,
						longitude: visit.precise_longitude
					};
				}

				if (visit.latitude && visit.longitude) {
					return {
						source: 'Localização por IP',
						latitude: visit.latitude,
						longitude: visit.longitude
					};
				}

				return null;
			}

			function renderMap(visit) {
				const coords = coordinatesForMap(visit);
				if (!coords) {
					return '<section class="info-block map-block"><div class="map-content"><span class="map-empty">Sem coordenadas disponíveis</span></div></section>';
				}

				const text = coords.latitude + ', ' + coords.longitude;
				const href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(text);
				return '<section class="info-block map-block">'
					+ '<div class="map-content">'
						+ '<span class="map-pin"></span>'
						+ '<span class="map-source">' + escapeHtml(coords.source) + '</span>'
						+ '<strong class="map-coords">' + escapeHtml(text) + '</strong>'
						+ '<a class="map-link" href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer">Abrir no Google Maps</a>'
					+ '</div>'
				+ '</section>';
			}

			function renderVisit(visit) {
				const status = sessionStatus(visit);
				const preciseCoords = visit.precise_latitude && visit.precise_longitude
					? visit.precise_latitude + ', ' + visit.precise_longitude
					: null;
				const probableId = value(visit.probable_person_id, 'MP-pendente');

				return '<article class="visit-card">'
					+ '<div class="visit-head">'
						+ '<div><h2>#' + escapeHtml(visit.id) + ' - ' + escapeHtml(value(visit.path, '/')) + '</h2><p>' + escapeHtml(brDate(visit.created_at)) + ' - horário de Brasília</p></div>'
						+ '<div class="visit-meta">'
							+ '<span class="identity-chip">' + escapeHtml(probableId) + '</span>'
							+ '<span class="badge ' + status.className + '">' + escapeHtml(status.label) + '</span>'
						+ '</div>'
					+ '</div>'
					+ '<div class="visit-grid">'
						+ renderMap(visit)
						+ '<section class="info-block"><h3>Acesso</h3>'
							+ field('Página', visit.path)
							+ field('Origem', visit.referrer)
							+ field('Protocolo', visit.http_protocol)
						+ '</section>'
						+ '<section class="info-block"><h3>Sessão</h3>'
							+ field('Status', status.label)
							+ field('Tempo no site', formatDuration(visit.duration_seconds))
							+ field('Aberto em', brDate(visit.created_at))
							+ field('Último sinal', brDate(visit.last_seen_at))
							+ field('Fechado em', brDate(visit.closed_at))
							+ field('Sessão', visit.session_id, true)
						+ '</section>'
						+ '<section class="info-block"><h3>Localização por IP</h3>'
							+ field('Cidade', visit.city)
							+ field('Estado/região', visit.region)
							+ field('País', visit.country)
							+ field('Coordenadas', visit.latitude && visit.longitude ? visit.latitude + ', ' + visit.longitude : null, true)
							+ field('Fuso por IP', visit.timezone)
						+ '</section>'
						+ '<section class="info-block"><h3>Localização autorizada</h3>'
							+ field('Permissão', permissionLabel(visit.location_permission))
							+ field('Coordenadas', preciseCoords, true)
							+ field('Precisão', visit.precise_accuracy ? Math.round(Number(visit.precise_accuracy)) + ' m' : null)
							+ field('Altitude', visit.precise_altitude ? visit.precise_altitude + ' m' : null)
							+ field('Direção/velocidade', visit.precise_heading || visit.precise_speed ? value(visit.precise_heading) + ' / ' + value(visit.precise_speed) : null)
						+ '</section>'
						+ '<section class="info-block"><h3>IP e rede</h3>'
							+ field('IP completo', visit.ip, true)
							+ field('IP mascarado', visit.ip_masked, true)
							+ field('ASN', visit.asn)
							+ field('Provedor/rede', visit.as_organization)
						+ '</section>'
						+ '<section class="info-block"><h3>Dispositivo</h3>'
							+ field('Tipo', visit.device_type)
							+ field('Modelo provável', visit.device_model)
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
				const peopleSet = new Set(visits.map(function(visit) { return visit.probable_person_id; }).filter(Boolean));
				const citySet = new Set(visits.map(function(visit) { return locationTitle(visit); }).filter(function(item) { return item !== 'Localização não informada'; }));
				const openCount = visits.filter(function(visit) { return sessionStatus(visit).className === 'open'; }).length;
				const mobileCount = visits.filter(function(visit) { return visit.device_type === 'Celular'; }).length;

				document.querySelector('#totalVisits').textContent = String(visits.length);
				document.querySelector('#uniqueIps').textContent = String(ipSet.size);
				document.querySelector('#uniquePeople').textContent = String(peopleSet.size);
				document.querySelector('#uniqueCities').textContent = String(citySet.size);
				document.querySelector('#openVisits').textContent = String(openCount);
				document.querySelector('#mobileVisits').textContent = String(mobileCount);
				summary.hidden = false;
			}

			async function loadVisits(silent) {
				const password = token.value.trim();
				if (!password) {
					statusEl.textContent = 'Digite a senha primeiro.';
					return;
				}

				if (!silent) {
					statusEl.textContent = 'Carregando...';
				}

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

			window.setInterval(function() {
				if (!token.value.trim() || document.hidden) {
					return;
				}

				loadVisits(true).catch(function() {});
			}, 30000);
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
