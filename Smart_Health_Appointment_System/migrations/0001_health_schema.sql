CREATE TABLE doctors (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  experience_years INTEGER NOT NULL DEFAULT 0,
  availability TEXT NOT NULL DEFAULT 'Mon-Fri, 10:00 AM - 5:00 PM',
  created_at TIMESTAMP NOT NULL DEFAULT now()
)