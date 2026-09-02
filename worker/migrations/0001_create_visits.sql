CREATE TABLE IF NOT EXISTS visits (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	ip TEXT NOT NULL,
	ip_masked TEXT NOT NULL,
	ip_hash TEXT NOT NULL,
	path TEXT NOT NULL,
	referrer TEXT,
	user_agent TEXT,
	country TEXT,
	colo TEXT
);

CREATE INDEX IF NOT EXISTS visits_created_at_idx ON visits (created_at DESC);
CREATE INDEX IF NOT EXISTS visits_ip_hash_idx ON visits (ip_hash);
CREATE INDEX IF NOT EXISTS visits_path_idx ON visits (path);
