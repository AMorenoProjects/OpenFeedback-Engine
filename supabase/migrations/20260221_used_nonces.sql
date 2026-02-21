-- 20260221_used_nonces.sql
-- Table for tracking used nonces to prevent replay attacks

CREATE TABLE used_nonces (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    nonce TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, nonce)
);

-- Enable RLS to prevent public access. 
-- Only the Service Role (used by Edge Functions) should be able to write/read.
ALTER TABLE used_nonces ENABLE ROW LEVEL SECURITY;

-- Note: We do not add any RLS policies.
-- By default, enabling RLS without policies denies access to 'anon' and 'authenticated'.
-- The 'service_role' (used by Edge Functions) bypasses RLS automatically.
