const $ = id => document.getElementById(id);
const example = {
  challenge: 'Choose one recurring decision. Write down what the team can decide on its own and when it should check in.',
  reflection: 'I expected I would need to approve the decision. Once the boundary was clear, the team moved ahead and knew when to check in.',
  assigned: false,
  shared: false
};
let state;
let storageKey;
let view = 'coach';
let completed = false;

async function request(path, body) {
  const options = {credentials:'same-origin'};
  if (body !== undefined) {
    options.method = 'POST';
    options.headers = {'Content-Type':'application/json'};
    options.body = JSON.stringify(body);
  }
  const response = await fetch('/coach-demo/'+path, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The demo could not open.');
  return result;
}

function save() {
  try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch {}
}

function render() {
  const coach = view === 'coach';
  $('coach-panel').hidden = !coach;
  $('client-panel').hidden = coach;
  $('coach-view').setAttribute('aria-pressed', coach);
  $('client-view').setAttribute('aria-pressed', !coach);
  $('client-view').disabled = !state.assigned;
  $('try-client').hidden = !state.assigned;
  $('return-to-coach').hidden = !state.shared;
  $('assigned-challenge').textContent = state.challenge;
  $('coach-reflection').textContent = state.shared ? state.reflection : 'Jordan hasn’t shared a reflection yet.';
  $('complete-message').hidden = !state.shared || !coach;
}

async function show(next) {
  view = next;
  $('feedback').textContent = '';
  render();
  if (view === 'coach' && state.shared && !completed) {
    try {
      await request('complete', {});
      completed = true;
    } catch (error) {
      $('feedback').textContent = error.message;
      $('complete-message').hidden = true;
    }
  }
}

async function start(invite) {
  try {
    const session = invite ? await request('redeem', {token:invite}) : await request('session');
    if (invite) history.replaceState(null, '', location.pathname);
    $('start-demo').hidden = true;
    storageKey = 'ci-coach-demo:'+session.workspace;
    state = {...example};
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (saved && typeof saved.challenge === 'string' && typeof saved.reflection === 'string') {
        state = {...example, ...saved};
      }
    } catch {}
    $('challenge').value = state.challenge;
    $('reflection').value = state.reflection;
    $('workspace').hidden = false;
    $('access-message').hidden = true;
    await show('coach');
  } catch (error) {
    $('access-message').textContent = error.message || 'The demo could not open. Try the invitation link again.';
  }
}

$('coach-view').addEventListener('click', () => show('coach'));
$('client-view').addEventListener('click', () => show('client'));
$('try-client').addEventListener('click', () => show('client'));
$('return-to-coach').addEventListener('click', () => show('coach'));
$('challenge-form').addEventListener('submit', event => {
  event.preventDefault();
  const draft = $('challenge').value.trim();
  if (!draft) return;
  state.challenge = draft;
  state.assigned = true;
  save();
  render();
  $('feedback').textContent = 'Challenge assigned. Try the fictional client view.';
});
$('reflection-form').addEventListener('submit', event => {
  event.preventDefault();
  const reflection = $('reflection').value.trim();
  if (!reflection) return;
  state.reflection = reflection;
  state.shared = event.submitter?.id === 'share-reflection';
  save();
  render();
  $('feedback').textContent = state.shared ? 'Reflection shared. Return to coach view to see it.' : 'Reflection saved privately.';
});
const invitation = location.hash.slice(1);
if (invitation) {
  $('access-message').textContent = 'Try a coaching challenge with a fictional client in about five minutes.';
  $('start-demo').hidden = false;
  $('start-demo').addEventListener('click', async () => {
    $('start-demo').disabled = true;
    await start(invitation);
    $('start-demo').disabled = false;
  });
} else {
  start();
}
