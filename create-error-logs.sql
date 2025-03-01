CREATE TABLE IF NOT EXISTS error_logs (
  id SERIAL PRIMARY KEY,
  message TEXT NOT NULL,
  code TEXT,
  severity TEXT NOT NULL,
  path TEXT,
  user_id INTEGER REFERENCES users(id),
  details TEXT,
  ai_analysis TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);