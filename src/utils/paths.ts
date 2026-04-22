const baseUrl = import.meta.env.BASE_URL;

export function withBase(path = '') {
	return `${baseUrl}${path.replace(/^\/+/, '')}`;
}
