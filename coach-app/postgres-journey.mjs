export const perspectives = [
  { id: 'dreamer', name: 'Dreamer', question: 'What possibilities have not yet been imagined?' },
  { id: 'observer', name: 'Observer', question: 'What do you notice, and what is assumption rather than evidence?' },
  { id: 'alchemist', name: 'Alchemist', question: 'What could change if you challenged an assumption?' },
  { id: 'visionary', name: 'Visionary', question: 'What future is worth moving toward?' }
];

const isPerspective = value => perspectives.some(perspective => perspective.id === value);

function field(body, key, max, optional = false) {
  const value = body[key];
  if (optional && (value === undefined || value === '')) return '';
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    const error = new Error('Check the required fields and their maximum lengths.');
    error.invalidJourneyInput = true;
    throw error;
  }
  return value.trim();
}

export function createPostgresJourney({ db, q, all, run, hex, active, audit, input, reply }) {
  const deny = res => reply(res, 403, { error: 'This learning record is private or unavailable.' });
  const invalid = res => reply(res, 400, { error: 'Check the required fields and their maximum lengths.' });
  const create = (res, id) => reply(res, 201, { id });
  const transaction = async work => db.transaction(work);

  const latestProfile = async (clientId) => await q(
    'SELECT id,primary_mode AS "primary",secondary_mode AS secondary,summary,created_at AS createdAt FROM journey_profiles WHERE client_id=? ORDER BY created_at DESC, id DESC LIMIT 1', clientId
  ) ?? null;
  const goalRows = async (where, ...params) => await all(`
    SELECT g.id,g.client_id AS clientId,u.email AS clientEmail,v.title,v.motivation,v.uncertainty,v.status,v.created_at AS updatedAt
    FROM journey_goals g JOIN users u ON u.id=g.client_id
    JOIN journey_goal_revisions v ON v.id=(SELECT id FROM journey_goal_revisions WHERE goal_id=g.id ORDER BY created_at DESC, id DESC LIMIT 1)
    WHERE ${where} ORDER BY v.created_at DESC, v.id DESC`, ...params);

  async function goalDetails(goal) {
    return {
      goal,
      revisions: await all('SELECT title,motivation,uncertainty,status,created_at AS createdAt FROM journey_goal_revisions WHERE goal_id=? ORDER BY created_at, id', goal.id),
      explorations: await all('SELECT id,perspective,note,created_at AS createdAt FROM journey_explorations WHERE goal_id=? ORDER BY created_at, id', goal.id),
      challenges: await all(`
        SELECT c.id,c.text,c.coach_id<>c.client_id AS fromCoach,c.created_at AS createdAt
        FROM challenges c JOIN journey_challenge_links j ON j.challenge_id=c.id WHERE j.goal_id=? ORDER BY c.created_at, c.id`, goal.id),
      experiments: await all(`
        SELECT e.id,e.challenge_id AS challengeId,e.possibility,e.action,e.notice,e.created_at AS createdAt
        FROM journey_experiments e JOIN journey_challenge_links j ON j.challenge_id=e.challenge_id WHERE j.goal_id=? ORDER BY e.created_at, e.id`, goal.id),
      reflections: await all(`
        SELECT r.id,r.challenge_id AS challengeId,l.experiment_id AS experimentId,r.text,r.created_at AS createdAt
        FROM reflections r JOIN journey_reflection_links l ON l.reflection_id=r.id
        JOIN journey_challenge_links j ON j.challenge_id=r.challenge_id WHERE j.goal_id=? ORDER BY r.created_at, r.id`, goal.id),
      learning: await all(`
        SELECT n.id,n.reflection_id AS reflectionId,n.changed,n.next_move AS nextMove,n.created_at AS createdAt
        FROM journey_learning n JOIN reflections r ON r.id=n.reflection_id
        JOIN journey_challenge_links j ON j.challenge_id=r.challenge_id WHERE j.goal_id=? ORDER BY n.created_at, n.id`, goal.id)
    };
  }

  async function appendRevision(goalId, body) {
    const title = field(body, 'title', 160);
    const motivation = field(body, 'motivation', 1000);
    const uncertainty = field(body, 'uncertainty', 1000, true);
    const status = body.status ?? 'active';
    if (!['active', 'paused', 'complete'].includes(status)) return false;
    await run('INSERT INTO journey_goal_revisions(id,goal_id,title,motivation,uncertainty,status) VALUES (?,?,?,?,?,?)',
      hex(), goalId, title, motivation, uncertainty, status);
    return true;
  }

  async function clearShares(coachId, clientId) {
    await run('DELETE FROM journey_profile_shares WHERE coach_id=? AND client_id=?', coachId, clientId);
    await run('DELETE FROM journey_goal_shares WHERE coach_id=? AND goal_id IN (SELECT id FROM journey_goals WHERE client_id=?)',
      coachId, clientId);
  }

  async function revoke(coachId, clientId) {
    await transaction(async () => {
      await run('UPDATE relationships SET revoked_at=CURRENT_TIMESTAMP WHERE coach_id=? AND client_id=? AND revoked_at IS NULL', coachId, clientId);
      await clearShares(coachId, clientId);
      await audit(clientId, 'relationship_revoked', 'relationship', coachId);
    });
  }

  async function route(req, res, path, method, actor) {
    try {
      return await handle(req, res, path, method, actor);
    } catch (error) {
      if (error.invalidJourneyInput) return invalid(res);
      throw error;
    }
  }

  async function handle(req, res, path, method, actor) {
    const isClient = actor.role === 'client';
    const isCoach = actor.role === 'coach';
    const body = method === 'POST' ? await input(req) : {};
    if (!body || typeof body !== 'object' || Array.isArray(body)) return invalid(res);

    if (path === '/api/journey' && method === 'GET') {
      if (isClient) {
        return reply(res, 200, {
          profile: await latestProfile(actor.id),
          goals: await goalRows('g.client_id=?', actor.id),
          coaches: await all(`
            SELECT u.id,u.email FROM relationships r JOIN users u ON u.id=r.coach_id
            WHERE r.client_id=? AND r.revoked_at IS NULL`, actor.id),
          goalShares: await all(`
            SELECT s.goal_id AS goalId,s.coach_id AS coachId FROM journey_goal_shares s
            JOIN journey_goals g ON g.id=s.goal_id JOIN relationships r ON r.coach_id=s.coach_id AND r.client_id=g.client_id
            WHERE g.client_id=? AND r.revoked_at IS NULL`, actor.id),
          profileShares: await all(`
            SELECT s.coach_id AS coachId FROM journey_profile_shares s
            JOIN relationships r ON r.coach_id=s.coach_id AND r.client_id=s.client_id
            WHERE s.client_id=? AND r.revoked_at IS NULL`, actor.id)
        });
      }
      return reply(res, 200, {
        goals: await goalRows(`EXISTS (SELECT 1 FROM journey_goal_shares s JOIN relationships r
          ON r.coach_id=s.coach_id AND r.client_id=g.client_id WHERE s.goal_id=g.id AND s.coach_id=? AND r.revoked_at IS NULL)`, actor.id),
        profiles: await all(`
          SELECT u.id AS clientId,u.email FROM journey_profile_shares s JOIN users u ON u.id=s.client_id
          JOIN relationships r ON r.coach_id=s.coach_id AND r.client_id=s.client_id
          WHERE s.coach_id=? AND r.revoked_at IS NULL`, actor.id)
      });
    }

    if (path === '/api/journey/profile' && method === 'POST' && isClient) {
      const { primary, secondary } = body;
      if (!isPerspective(primary) || (secondary && (!isPerspective(secondary) || secondary === primary))) return invalid(res);
      const id = hex();
      await run('INSERT INTO journey_profiles(id,client_id,primary_mode,secondary_mode,summary) VALUES (?,?,?,?,?)',
        id, actor.id, primary, secondary || null, field(body, 'summary', 4000));
      return create(res, id);
    }

    const profileMatch = /^\/api\/journey\/profiles\/([a-f0-9]{48})$/.exec(path);
    if (profileMatch && method === 'GET') {
      const clientId = profileMatch[1];
      const permitted = isCoach && await active(actor.id, clientId)
        && await q('SELECT 1 FROM journey_profile_shares WHERE client_id=? AND coach_id=?', clientId, actor.id);
      if (clientId !== actor.id && !permitted) return deny(res);
      return reply(res, 200, { profile: await latestProfile(clientId) });
    }

    if (path === '/api/journey/goals' && method === 'POST' && isClient) {
      const id = hex();
      await transaction(async () => {
        await run('INSERT INTO journey_goals(id,client_id) VALUES (?,?)', id, actor.id);
        await appendRevision(id, { ...body, status: 'active' });
      });
      return create(res, id);
    }

    if (path === '/api/journey/shares' && method === 'POST' && isClient) {
      const { coachId, goalId, shared } = body;
      if (typeof coachId !== 'string' || typeof shared !== 'boolean') return invalid(res);
      if (!await active(coachId, actor.id)) return deny(res);
      const forProfile = body.scope === 'profile';
      if (!forProfile && body.scope !== 'goal') return invalid(res);
      if (!forProfile && (typeof goalId !== 'string' || !await q('SELECT 1 FROM journey_goals WHERE id=? AND client_id=?', goalId, actor.id))) return deny(res);
      if (forProfile && shared && !await latestProfile(actor.id)) return invalid(res);
      const table = forProfile ? 'journey_profile_shares' : 'journey_goal_shares';
      const subject = forProfile ? 'client_id' : 'goal_id';
      const id = forProfile ? actor.id : goalId;
      await transaction(async () => {
        if (shared) await run(`INSERT INTO ${table}(${subject},coach_id) VALUES (?,?) ON CONFLICT DO NOTHING`, id, coachId);
        else await run(`DELETE FROM ${table} WHERE ${subject}=? AND coach_id=?`, id, coachId);
        await audit(actor.id, shared ? 'journey_access_granted' : 'journey_access_revoked', forProfile ? 'profile' : 'goal', id);
      });
      return reply(res, 200, { ok: true });
    }

    const match = /^\/api\/journey\/goals\/([a-f0-9]{48})(?:\/(revision|explorations|challenges|experiments|reflections|learning))?$/.exec(path);
    if (!match) return deny(res);

    const [, goalId, operation] = match;
    const [goal] = await goalRows('g.id=?', goalId);
    if (!goal) return deny(res);
    const owner = isClient && goal.clientId === actor.id;
    const sharedCoach = isCoach && await active(actor.id, goal.clientId)
      && await q('SELECT 1 FROM journey_goal_shares WHERE goal_id=? AND coach_id=?', goalId, actor.id);
    if (method === 'GET' && !operation && (owner || sharedCoach)) return reply(res, 200, await goalDetails(goal));
    if (method !== 'POST' || (!owner && !(sharedCoach && operation === 'challenges'))) return deny(res);

    const id = hex();
    switch (operation) {
      case 'revision':
        return await appendRevision(goalId, body) ? reply(res, 200, { ok: true }) : invalid(res);
      case 'explorations':
        if (!isPerspective(body.perspective)) return invalid(res);
        await run('INSERT INTO journey_explorations(id,goal_id,perspective,note) VALUES (?,?,?,?)',
          id, goalId, body.perspective, field(body, 'note', 2000));
        break;
      case 'challenges': {
        const text = field(body, 'text', 2000);
        await transaction(async () => {
          await run('INSERT INTO challenges(id,coach_id,client_id,text) VALUES (?,?,?,?)', id, actor.id, goal.clientId, text);
          await run('INSERT INTO journey_challenge_links(challenge_id,goal_id) VALUES (?,?)', id, goalId);
          await audit(actor.id, owner ? 'challenge_created' : 'challenge_assigned', 'challenge', id);
        });
        break;
      }
      case 'experiments':
        if (typeof body.challengeId !== 'string' || !await q('SELECT 1 FROM journey_challenge_links WHERE challenge_id=? AND goal_id=?', body.challengeId, goalId)) return deny(res);
        await run('INSERT INTO journey_experiments(id,challenge_id,possibility,action,notice) VALUES (?,?,?,?,?)',
          id, body.challengeId, field(body, 'possibility', 1000), field(body, 'action', 1000), field(body, 'notice', 1000));
        break;
      case 'reflections': {
        const experiment = typeof body.experimentId === 'string' && await q(`
          SELECT e.challenge_id FROM journey_experiments e JOIN journey_challenge_links j ON j.challenge_id=e.challenge_id
          WHERE e.id=? AND j.goal_id=?`, body.experimentId, goalId);
        if (!experiment) return deny(res);
        const text = field(body, 'text', 4000);
        await transaction(async () => {
          await run('INSERT INTO reflections(id,challenge_id,client_id,text) VALUES (?,?,?,?)', id, experiment.challenge_id, actor.id, text);
          await run('INSERT INTO journey_reflection_links(reflection_id,experiment_id) VALUES (?,?)', id, body.experimentId);
          await audit(actor.id, 'reflection_submitted', 'reflection', id);
        });
        break;
      }
      case 'learning':
        if (typeof body.reflectionId !== 'string' || !await q(`
          SELECT 1 FROM journey_reflection_links l JOIN reflections r ON r.id=l.reflection_id
          JOIN journey_challenge_links j ON j.challenge_id=r.challenge_id WHERE r.id=? AND j.goal_id=?`, body.reflectionId, goalId)) return deny(res);
        await run('INSERT INTO journey_learning(id,reflection_id,changed,next_move) VALUES (?,?,?,?)',
          id, body.reflectionId, field(body, 'changed', 2000), field(body, 'nextMove', 1000));
        break;
      default:
        return deny(res);
    }
    return create(res, id);
  }

  return { route, revoke };
}
