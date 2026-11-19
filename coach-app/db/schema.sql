PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,role TEXT NOT NULL CHECK(role IN ('coach','client')),password_salt TEXT NOT NULL,password_hash TEXT NOT NULL,verified_at TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS invitations (token_hash TEXT PRIMARY KEY,coach_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,recipient_email TEXT NOT NULL,expires_at INTEGER NOT NULL,accepted_at TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS relationships (coach_id TEXT NOT NULL REFERENCES users(id),client_id TEXT NOT NULL REFERENCES users(id),consented_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,revoked_at TEXT,PRIMARY KEY(coach_id,client_id));
CREATE TABLE IF NOT EXISTS challenges (id TEXT PRIMARY KEY,coach_id TEXT NOT NULL REFERENCES users(id),client_id TEXT NOT NULL REFERENCES users(id),text TEXT NOT NULL CHECK(length(text) BETWEEN 1 AND 2000),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS reflections (id TEXT PRIMARY KEY,challenge_id TEXT NOT NULL REFERENCES challenges(id),client_id TEXT NOT NULL REFERENCES users(id),text TEXT NOT NULL CHECK(length(text) BETWEEN 1 AND 4000),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY,actor_id TEXT REFERENCES users(id),event_type TEXT NOT NULL,resource_type TEXT NOT NULL,resource_id TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_challenges_client ON challenges(client_id);
CREATE INDEX IF NOT EXISTS idx_reflections_challenge ON reflections(challenge_id);
CREATE INDEX IF NOT EXISTS idx_invitations_expiry ON invitations(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

-- Private journey tables extend the existing accounts, challenges, and reflections.
CREATE TABLE IF NOT EXISTS journey_profiles (
  id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES users(id),
  primary_mode TEXT NOT NULL, secondary_mode TEXT, summary TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS journey_profiles_owner ON journey_profiles(client_id);
CREATE TABLE IF NOT EXISTS journey_goals (
  id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS journey_goals_owner ON journey_goals(client_id);
CREATE TABLE IF NOT EXISTS journey_goal_revisions (
  id TEXT PRIMARY KEY, goal_id TEXT NOT NULL REFERENCES journey_goals(id),
  title TEXT NOT NULL, motivation TEXT NOT NULL, uncertainty TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active','paused','complete')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS journey_goal_revisions_goal ON journey_goal_revisions(goal_id);
CREATE TABLE IF NOT EXISTS journey_profile_shares (
  client_id TEXT NOT NULL REFERENCES users(id), coach_id TEXT NOT NULL REFERENCES users(id),
  PRIMARY KEY (client_id,coach_id)
);
CREATE TABLE IF NOT EXISTS journey_goal_shares (
  goal_id TEXT NOT NULL REFERENCES journey_goals(id), coach_id TEXT NOT NULL REFERENCES users(id),
  PRIMARY KEY (goal_id,coach_id)
);
CREATE TABLE IF NOT EXISTS journey_explorations (
  id TEXT PRIMARY KEY, goal_id TEXT NOT NULL REFERENCES journey_goals(id),
  perspective TEXT NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS journey_challenge_links (
  challenge_id TEXT PRIMARY KEY REFERENCES challenges(id), goal_id TEXT NOT NULL REFERENCES journey_goals(id)
);
CREATE TABLE IF NOT EXISTS journey_experiments (
  id TEXT PRIMARY KEY, challenge_id TEXT NOT NULL REFERENCES journey_challenge_links(challenge_id),
  possibility TEXT NOT NULL, action TEXT NOT NULL, notice TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS journey_reflection_links (
  reflection_id TEXT PRIMARY KEY REFERENCES reflections(id), experiment_id TEXT NOT NULL REFERENCES journey_experiments(id)
);
CREATE TABLE IF NOT EXISTS journey_learning (
  id TEXT PRIMARY KEY, reflection_id TEXT NOT NULL REFERENCES journey_reflection_links(reflection_id),
  changed TEXT NOT NULL, next_move TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
