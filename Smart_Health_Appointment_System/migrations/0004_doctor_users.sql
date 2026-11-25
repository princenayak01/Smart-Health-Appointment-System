CREATE TABLE doctor_users (
  user_id TEXT PRIMARY KEY,
  doctor_id BIGINT NOT NULL REFERENCES doctors(id),
  created_at TIMESTAMP NOT NULL DEFAULT now()
)