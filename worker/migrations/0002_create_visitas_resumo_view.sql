CREATE VIEW IF NOT EXISTS visitas_resumo AS
SELECT
	id AS registro,
	created_at AS data_hora,
	ip AS ip_completo,
	ip_masked AS ip_mascarado,
	path AS pagina,
	country AS pais,
	referrer AS origem,
	user_agent AS navegador_dispositivo,
	colo AS datacenter_cloudflare,
	ip_hash AS identificador_privado
FROM visits;
