-- Additive institutional pilot schema. Existing coach/client accounts remain unchanged.
CREATE TABLE IF NOT EXISTS organizations (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 3 AND 120),
 created_by TEXT NOT NULL REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS organization_members (
 organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK(role IN ('admin','professional')),
 joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(organization_id,user_id)
);
CREATE TABLE IF NOT EXISTS organization_invitations (
 token_hash TEXT PRIMARY KEY,
 organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 invited_by TEXT NOT NULL REFERENCES users(id),
 recipient_email TEXT NOT NULL,
 expires_at BIGINT NOT NULL,
 accepted_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_expiry ON organization_invitations(expires_at);
