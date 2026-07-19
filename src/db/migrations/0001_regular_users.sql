ALTER TABLE users ADD COLUMN password_hash text;
ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
CREATE INDEX users_email_idx ON users (email);
