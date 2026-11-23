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

-- Institutional participant enrollment is separate from private coach relationships.
-- Only the participant can approve their own organization enrollment.
CREATE TABLE IF NOT EXISTS organization_participants (
 organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 participant_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 professional_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 consented_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 revoked_at TIMESTAMPTZ,
 PRIMARY KEY(organization_id,participant_id),
 FOREIGN KEY(organization_id,professional_id) REFERENCES organization_members(organization_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_organization_participants_professional ON organization_participants(organization_id,professional_id) WHERE revoked_at IS NULL;
CREATE TABLE IF NOT EXISTS organization_participant_invitations (
 token_hash TEXT PRIMARY KEY,
 organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 professional_id TEXT NOT NULL REFERENCES users(id),
 recipient_email TEXT NOT NULL,
 expires_at BIGINT NOT NULL,
 accepted_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(organization_id,professional_id) REFERENCES organization_members(organization_id,user_id)
);

-- Participant-owned institutional learning notes. Enrollment alone never shares content.
CREATE TABLE IF NOT EXISTS organization_learning_notes (
 id TEXT PRIMARY KEY,
 organization_id TEXT NOT NULL,
 participant_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 perspective TEXT NOT NULL CHECK(perspective IN ('observer','dreamer','alchemist','visionary')),
 goal TEXT NOT NULL CHECK(length(goal) BETWEEN 1 AND 500),
 next_action TEXT NOT NULL CHECK(length(next_action) BETWEEN 1 AND 500),
 reflection TEXT NOT NULL DEFAULT '' CHECK(length(reflection)<=2000),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(organization_id,participant_id) REFERENCES organization_participants(organization_id,participant_id)
);
CREATE INDEX IF NOT EXISTS idx_organization_learning_notes_owner ON organization_learning_notes(participant_id,organization_id,created_at);
