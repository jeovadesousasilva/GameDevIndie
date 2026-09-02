DROP VIEW IF EXISTS visitas_resumo;

ALTER TABLE visits ADD COLUMN session_id TEXT;
ALTER TABLE visits ADD COLUMN last_seen_at TEXT;
ALTER TABLE visits ADD COLUMN closed_at TEXT;
ALTER TABLE visits ADD COLUMN duration_seconds INTEGER DEFAULT 0;
ALTER TABLE visits ADD COLUMN is_open INTEGER DEFAULT 1;
ALTER TABLE visits ADD COLUMN location_permission TEXT;
ALTER TABLE visits ADD COLUMN precise_latitude TEXT;
ALTER TABLE visits ADD COLUMN precise_longitude TEXT;
ALTER TABLE visits ADD COLUMN precise_accuracy REAL;
ALTER TABLE visits ADD COLUMN precise_altitude TEXT;
ALTER TABLE visits ADD COLUMN precise_heading TEXT;
ALTER TABLE visits ADD COLUMN precise_speed TEXT;

CREATE INDEX IF NOT EXISTS visits_session_id_idx ON visits (session_id);
CREATE INDEX IF NOT EXISTS visits_last_seen_at_idx ON visits (last_seen_at DESC);

CREATE VIEW visitas_resumo AS
SELECT
	id AS registro,
	created_at AS data_hora_utc,
	session_id AS sessao,
	is_open AS esta_aberto,
	last_seen_at AS ultimo_sinal_utc,
	closed_at AS fechado_em_utc,
	duration_seconds AS duracao_segundos,
	ip AS ip_completo,
	ip_masked AS ip_mascarado,
	path AS pagina,
	country AS pais,
	region AS estado_regiao,
	region_code AS codigo_regiao,
	city AS cidade_aproximada_por_ip,
	postal_code AS cep_aproximado_por_ip,
	latitude AS latitude_aproximada_por_ip,
	longitude AS longitude_aproximada_por_ip,
	timezone AS fuso_horario_por_ip,
	location_permission AS permissao_localizacao_exata,
	precise_latitude AS latitude_autorizada,
	precise_longitude AS longitude_autorizada,
    precise_accuracy AS precisao_metros,
    precise_altitude AS altitude_autorizada,
    precise_heading AS direcao_autorizada,
    precise_speed AS velocidade_autorizada,
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
