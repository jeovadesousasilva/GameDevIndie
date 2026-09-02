DROP VIEW IF EXISTS visitas_resumo;

ALTER TABLE visits ADD COLUMN city TEXT;
ALTER TABLE visits ADD COLUMN region TEXT;
ALTER TABLE visits ADD COLUMN region_code TEXT;
ALTER TABLE visits ADD COLUMN postal_code TEXT;
ALTER TABLE visits ADD COLUMN continent TEXT;
ALTER TABLE visits ADD COLUMN latitude TEXT;
ALTER TABLE visits ADD COLUMN longitude TEXT;
ALTER TABLE visits ADD COLUMN timezone TEXT;
ALTER TABLE visits ADD COLUMN asn INTEGER;
ALTER TABLE visits ADD COLUMN as_organization TEXT;
ALTER TABLE visits ADD COLUMN http_protocol TEXT;
ALTER TABLE visits ADD COLUMN device_type TEXT;
ALTER TABLE visits ADD COLUMN browser_name TEXT;
ALTER TABLE visits ADD COLUMN os_name TEXT;
ALTER TABLE visits ADD COLUMN browser_language TEXT;
ALTER TABLE visits ADD COLUMN browser_timezone TEXT;
ALTER TABLE visits ADD COLUMN screen_width INTEGER;
ALTER TABLE visits ADD COLUMN screen_height INTEGER;
ALTER TABLE visits ADD COLUMN viewport_width INTEGER;
ALTER TABLE visits ADD COLUMN viewport_height INTEGER;
ALTER TABLE visits ADD COLUMN pixel_ratio REAL;

CREATE VIEW visitas_resumo AS
SELECT
	id AS registro,
	created_at AS data_hora,
	ip AS ip_completo,
	ip_masked AS ip_mascarado,
	path AS pagina,
	country AS pais,
	region AS estado_regiao,
	region_code AS codigo_regiao,
	city AS cidade_aproximada,
	postal_code AS cep_aproximado,
	latitude AS latitude_aproximada,
	longitude AS longitude_aproximada,
	timezone AS fuso_horario_por_ip,
	continent AS continente,
	device_type AS tipo_dispositivo,
	os_name AS sistema_operacional,
	browser_name AS navegador,
	browser_language AS idioma_navegador,
	browser_timezone AS fuso_horario_navegador,
	screen_width AS largura_tela,
	screen_height AS altura_tela,
	viewport_width AS largura_janela,
	viewport_height AS altura_janela,
	pixel_ratio AS densidade_tela,
	asn AS rede_asn,
	as_organization AS provedor_rede,
	http_protocol AS protocolo_http,
	referrer AS origem,
	user_agent AS user_agent,
	colo AS datacenter_cloudflare,
	ip_hash AS identificador_privado
FROM visits;
