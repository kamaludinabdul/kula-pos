-- Reset password for super admin user
-- NOTE: This requires the pgcrypto extension to be enabled.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE auth.users
SET encrypted_password = crypt('admin123', gen_salt('bf'))
WHERE email = 'admin@kula.id';
