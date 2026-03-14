-- Create a separate schema for extensions to resolve Supabase Security Advisor warning
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move pg_trgm extension to the extensions schema
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- Ensure the public users (authenticator, etc) can access the extensions schema
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- NOTE: You may need to update your SEARCH PATH in Supabase Project Settings 
-- if your functions suddenly can't find 'trgm' operators, but usually 
-- including 'extensions' in the search path is the default.
