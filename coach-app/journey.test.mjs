import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPersistentServer } from './persistent-server.mjs';

test('private Creative Intelligence journey keeps ownership, consent, history and legacy records', async t => {
  const root = await mkdtemp(join(tmpdir(), 'ci-private-journey-'));
  const dbPath = join(root, 'journey.sqlite');
  let server;
  let base;
  async function start() {
    server = createPersistentServer(dbPath);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = 'http://127.0.0.1:' + server.address().port;
  }
  async function stop() {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
  }
  t.after(async () => {
    await stop();
    await rm(root, { recursive: true, force: true });
  });
  await start();

  async function api(path, expected, account, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (account?.cookie) headers.cookie = account.cookie;
    const response = await fetch(base + '/api/' + path, {
      method: body === undefined ? 'GET' : 'POST', headers, body: JSON.stringify(body)
    });
    const data = await response.json();
    assert.equal(response.status, expected, path + ': ' + JSON.stringify(data));
    return { ...data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  async function account(name, role) {
    const details = { email: name + '@example.test', role, password: 'fictional journey password' };
    await api('register', 201, null, details);
    const { cookie } = await api('login', 200, null, details);
    return { ...details, cookie, id: (await api('me', 200, { cookie })).id };
  }

  const client = await account('client', 'client');
  const coach = await account('coach', 'coach');
  const other = await account('other', 'coach');
  const unrelatedClient = await account('other-client', 'client');
  const profile = { primary: 'observer', secondary: 'dreamer', summary: 'Fictional imported profile summary.' };
  const goal = { title: 'Make room to sketch', motivation: 'Notice what helps me begin', uncertainty: 'Timing' };
  await api('journey', 401);
  await api('journey/profile', 403, coach, profile);
  await api('journey/profile', 400, client, { ...profile, primary: 'invented-type' });
  await api('journey/profile', 201, client, profile);
  const state = await api('journey', 200, client);
  assert.equal(state.profile.summary, profile.summary);
  assert.deepEqual(state.coaches, []);
  await api('journey/profiles/' + client.id, 403, unrelatedClient);
  await api('journey/profiles/' + client.id, 403, coach);
  assert.equal((await api('journey/profiles/' + client.id, 200, client)).profile.primary, 'observer');

  await api('journey/goals', 400, client, { title: '', motivation: '' });
  assert.deepEqual((await api('journey', 200, client)).goals, []);
  const { id } = await api('journey/goals', 201, client, goal);
  const { id: privateId } = await api('journey/goals', 201, client, { ...goal, title: 'A private goal' });
  const path = 'journey/goals/' + id;
  const privatePath = 'journey/goals/' + privateId;
  await api(path + '/revision', 403, unrelatedClient, { ...goal, status: 'paused' });
  await api(path + '/revision', 200, client, { ...goal, title: 'Sketch before breakfast', status: 'active' });
  const modes = (await api('perspectives', 200, client)).perspectives;
  assert.deepEqual(modes.map(mode => mode.id), ['dreamer', 'observer', 'alchemist', 'visionary']);
  for (const mode of modes) {
    await api(path + '/explorations', 201, client, { perspective: mode.id, note: mode.question });
  }

  const profileShare = { scope: 'profile', shared: true, coachId: coach.id };
  const goalShare = { scope: 'goal', shared: true, coachId: coach.id, goalId: id };
  await api('journey/shares', 403, client, goalShare);
  async function connect() {
    const invite = await api('invitations', 201, coach, { email: client.email });
    await api('invitations/accept', 403, unrelatedClient, { token: invite.invitationToken });
    await api('invitations/accept', 200, client, { token: invite.invitationToken });
  }
  await connect();
  await api(path, 403, coach);
  await api('journey/profiles/' + client.id, 403, coach);
  await api('journey/shares', 403, unrelatedClient, goalShare);

  // The older coach workflow remains available and independent.
  const { id: legacyId } = await api('challenges', 201, coach, { clientId: client.id, text: 'Legacy challenge' });
  await api('challenges/' + legacyId + '/reflections', 201, client, { text: 'Legacy reflection' });
  const { id: selfChallenge } = await api(path + '/challenges', 201, client, { text: 'Begin with one line.' });
  await api(path + '/challenges', 403, coach, { text: 'Cannot assign without a grant.' });
  await api('journey/shares', 200, client, profileShare);
  assert.equal((await api('journey/profiles/' + client.id, 200, coach)).profile.summary, profile.summary);
  await api(path, 403, coach);
  await api('journey/shares', 200, client, goalShare);
  assert.deepEqual((await api('journey', 200, coach)).goals.map(g => g.id), [id]);
  await api(privatePath, 403, coach);
  await api(path, 403, other);
  await api('journey/profiles/' + client.id, 403, other);
  await api(path + '/revision', 403, coach, { ...goal, status: 'complete' });
  const { draft } = await api('challenge-drafts', 200, coach, { focus: goal.title, perspective: 'observer' });
  const { id: coachedChallenge } = await api(path + '/challenges', 201, coach, { text: draft });
  assert.match(draft, /What do you notice/);
  assert.deepEqual((await api('challenges', 200, coach)).challenges.map(c => c.id), [legacyId]);

  const experimentInput = { challengeId: selfChallenge, possibility: 'A short start helps', action: 'Sketch for ten minutes', notice: 'How easily I begin' };
  await api(privatePath + '/experiments', 403, client, experimentInput);
  await api(path + '/experiments', 403, coach, experimentInput);
  const { id: experimentId } = await api(path + '/experiments', 201, client, experimentInput);
  const { id: reflectionId } = await api(path + '/reflections', 201, client, { experimentId, text: 'One line made starting easier.' });
  await api(path + '/learning', 201, client, { reflectionId, changed: 'I can begin without a finished idea', nextMove: 'Repeat tomorrow' });
  await api(path + '/revision', 200, client, { ...goal, title: 'A sketching habit', status: 'complete' });
  await api('challenges/' + coachedChallenge + '/reflections', 403, client, { text: 'Must use the linked journey' });

  await stop();
  await start();
  const review = await api(path, 200, coach);
  assert.equal(review.goal.status, 'complete');
  assert.deepEqual(review.revisions.map(r => r.title), [goal.title, 'Sketch before breakfast', 'A sketching habit']);
  assert.equal(review.explorations.length, 4);
  assert.deepEqual(review.challenges.map(c => c.id), [selfChallenge, coachedChallenge]);
  assert.deepEqual(review.reflections.map(r => r.experimentId), [experimentId]);
  assert.deepEqual(review.learning.map(r => r.reflectionId), [reflectionId]);
  assert.deepEqual((await api('reflections', 200, coach)).reflections.map(r => r.text), ['Legacy reflection']);
  await api('journey/shares', 200, client, { ...goalShare, shared: false });
  await api(path, 403, coach);
  assert.equal((await api('journey/profiles/' + client.id, 200, coach)).profile.summary, profile.summary);
  await api('journey/shares', 200, client, goalShare);
  await api('relationships/revoke', 200, client, { coachId: coach.id });
  await api(path, 403, coach);
  await api(path + '/challenges', 403, coach, { text: 'Cannot assign after revocation' });
  await api('journey/profiles/' + client.id, 403, coach);
  assert.deepEqual((await api('reflections', 200, coach)).reflections, []);
  await connect();
  await api(path, 403, coach);
  await api('journey/profiles/' + client.id, 403, coach);
  assert.equal((await api(path, 200, client)).learning.length, 1);
});
