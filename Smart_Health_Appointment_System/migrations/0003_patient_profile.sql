CREATE TABLE patient_profiles (
  user_id TEXT PRIMARY KEY,
  phone TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
)