(() => {
  const workspace = $('journeyWorkspace');
  const profileSection = $('journeyProfiles');
  const goalsSection = $('journeyGoals');
  const detailSection = $('journeyDetail');
  let actor, overview, modes, selectedGoal, generation = 0, detailRequest = 0;

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function button(text, action) {
    const node = element('button', text);
    node.type = 'button';
    node.addEventListener('click', async () => {
      node.disabled = true;
      try { await action(); } finally { node.disabled = false; }
    });
    return node;
  }
  function link(text, href) {
    const node = element('a', text);
    node.href = href;
    node.target = '_blank';
    node.rel = 'noopener noreferrer';
    return node;
  }
  const modeOptions = () => modes.map(({ id, name }) => [id, name]);
  const modeName = id => modes.find(mode => mode.id === id)?.name ?? '';
  const statusOptions = [['active','Active'],['paused','Paused'],['complete','Complete']];

  async function api(path, method = 'GET', data) {
    const view = generation;
    const result = await call(path, method, data, false);
    if (view !== generation || !actor) return;
    if (!result || result._status >= 400) {
      if (result?._status === 401) {
        clear();
        $('identity').textContent = result.error;
        return;
      }
      if (result?._status === 403) {
        detailRequest++;
        detailSection.replaceChildren();
        detailSection.hidden = true;
        selectedGoal = undefined;
      }
      $('journeyStatus').textContent = result?.error || 'Could not reach Coach Studio. Try again.';
      return;
    }
    return result;
  }

  function makeForm(title, fields, label, onSave) {
    const form = element('form');
    const area = element('fieldset');
    const controls = {};
    area.append(element('legend', title));
    for (const [name, caption, length, options, initialValue, optional] of fields) {
      const field = element('label', caption);
      const control = element(options ? 'select' : length > 200 ? 'textarea' : 'input');
      control.name = name;
      control.required = !optional;
      if (options) {
        for (const [value, description] of options) {
          const option = element('option', description);
          option.value = value;
          control.append(option);
        }
      } else {
        control.maxLength = length;
      }
      if (initialValue !== undefined) control.value = initialValue;
      controls[name] = control;
      field.append(control);
      area.append(field);
    }
    const submit = element('button', label);
    submit.type = 'submit';
    const feedback = element('p', '', 'status-line');
    feedback.role = 'status';
    area.append(submit, feedback);
    form.append(area);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      submit.disabled = true;
      feedback.textContent = 'Saving…';
      $('journeyStatus').textContent = '';
      try {
        const result = await onSave(Object.fromEntries(new FormData(form)), controls);
        if (form.isConnected) feedback.textContent = result ? 'Saved.' : $('journeyStatus').textContent;
      } finally {
        submit.disabled = false;
      }
    });
    return { form, controls, area };
  }

  function sharingRow(coach, scope, isShared, goalId) {
    const row = element('div', '', 'share-row');
    row.append(element('span', coach.email), button(isShared ? 'Stop sharing' : 'Share', async () => {
      const result = await api('journey/shares', 'POST', { scope, goalId, coachId: coach.id, shared: !isShared });
      if (result) await refresh(goalId ?? selectedGoal);
    }));
    return row;
  }

  function showProfile(profile, target) {
    if (!profile) {
      target.append(element('p', 'A profile summary has not been added yet.'));
      return;
    }
    const names = [modeName(profile.primary), modeName(profile.secondary)].filter(Boolean);
    target.append(element('p', 'Reported starting perspectives: ' + names.join(' and '), 'muted'),
      element('p', profile.summary, 'profile-text'));
  }

  function renderOverview() {
    profileSection.replaceChildren(element('h2', 'Creative Intelligence Profile'));
    goalsSection.replaceChildren(element('h2', actor.role === 'client' ? 'Your goals' : 'Shared client goals'));
    if (actor.role === 'client') {
      profileSection.append(
        element('p', 'Use your existing CI Profile to reflect on your strengths and choose a starting perspective. Every goal can be explored through all four perspectives.'),
        link('Open the existing free profile quiz', 'https://creativeintelligence.world/free-creative-profile.html'),
        document.createTextNode(' · '), link('Learn about the full profile', 'https://creativeintelligence.world/profile.html'));
      showProfile(overview.profile, profileSection);
      const profileFields = [
        ['primary', 'Primary perspective from your profile', 0, modeOptions(), overview.profile?.primary],
        ['secondary', 'Secondary perspective (optional)', 0, [['','None'], ...modeOptions()], overview.profile?.secondary ?? '', true],
        ['summary', 'Summary from your existing profile', 4000, null, overview.profile?.summary]
      ];
      profileSection.append(makeForm('Bring in your profile result', profileFields, 'Save profile summary', async fields => {
        const result = await api('journey/profile', 'POST', fields);
        if (result) await refresh(selectedGoal);
        return result;
      }).form);
      if (overview.profile && overview.coaches.length) {
        profileSection.append(element('h3', 'Profile sharing'),
          element('p', 'A coach you choose can see your current profile summary and later updates while sharing is on.'));
        for (const coach of overview.coaches) {
          profileSection.append(sharingRow(coach, 'profile', overview.profileShares.some(share => share.coachId === coach.id)));
        }
      }
      if (overview.coaches.length) {
        profileSection.append(element('h3','Coach connections'));
        for (const coach of overview.coaches) {
          const row = element('div', '', 'share-row');
          row.append(element('span', coach.email), button('Revoke coach access', async () => {
            const result = await api('relationships/revoke', 'POST', { coachId: coach.id });
            if (result) await refresh(selectedGoal);
          }));
          profileSection.append(row);
        }
      }
      goalsSection.append(makeForm('Identify a goal', goalFields(), 'Create goal', async fields => {
        const result = await api('journey/goals', 'POST', fields);
        if (result) {
          await refresh(result.id);
          if (!detailSection.hidden) detailSection.scrollIntoView({ block: 'start' });
        }
        return result;
      }).form);
    } else {
      profileSection.append(button('Refresh shared access', () => refresh(selectedGoal)));
      if (!overview.profiles.length) profileSection.append(element('p','Profiles appear here after a client shares one with you.'));
      for (const client of overview.profiles) {
        const card = element('article', '', 'journey-card');
        const output = element('div');
        card.append(element('h3', client.email), button('Open shared profile', async () => {
          output.replaceChildren();
          const result = await api('journey/profiles/' + client.clientId);
          if (result && output.isConnected) showProfile(result.profile, output);
        }), output);
        profileSection.append(card);
      }
    }
    if (!overview.goals.length) {
      goalsSection.append(element('p', actor.role === 'coach' ? 'Client goals appear here after a client shares them with you.' : 'Your goals are private until you share them.'));
    }
    const cards = element('div', '', 'journey-grid');
    for (const goal of overview.goals) {
      const card = element('article', '', 'journey-card');
      card.append(element('h3', goal.title), element('p', (actor.role === 'coach' ? goal.clientEmail + ' · ' : '') + goal.status),
        button('Open goal', () => openGoal(goal.id, true)));
      cards.append(card);
    }
    goalsSection.append(cards);
  }

  function goalFields(goal = {}) {
    return [
      ['title','Goal',160,null,goal.title],
      ['motivation','Why does this matter?',1000,null,goal.motivation],
      ['uncertainty','What are you uncertain about? (optional)',1000,null,goal.uncertainty,true]
    ];
  }

  function listRecords(parent, title, records, render) {
    const group = element('div', '', 'journey-stack');
    group.append(element('h3', title));
    for (const record of records) {
      const card = element('article', '', 'journey-card');
      for (const [label,text] of render(record)) {
        if (text) card.append(element('h4',label),element('p',text));
      }
      group.append(card);
    }
    parent.append(group);
    return group;
  }

  function renderGoal(data) {
    const { goal, revisions, explorations, challenges, experiments, reflections, learning } = data;
    const client = actor.role === 'client';
    const path = 'journey/goals/' + goal.id + '/';
    const add = operation => async fields => {
      const result = await api(path + operation, 'POST', fields);
      if (result) await refresh(goal.id);
      return result;
    };
    detailSection.hidden = false;
    detailSection.replaceChildren(element('h2', goal.title), element('p', goal.motivation),
      element('p', goal.uncertainty, 'muted'));
    detailSection.classList.add('journey-stack');
    const milestones = [
      [explorations.length,'perspective notes'],[challenges.length,'challenges'],[experiments.length,'experiments'],
      [reflections.length,'reflections'],[learning.length,'learning notes']
    ];
    detailSection.append(element('p', [goal.status, ...milestones.map(([count,label]) => count + ' ' + label)].join(' · '), 'muted'));
    if (client) {
      detailSection.append(makeForm('Refine your goal', [...goalFields(goal),['status','Progress',0,statusOptions,goal.status]],
        'Save goal revision', add('revision')).form);
      if (overview.coaches.length) {
        detailSection.append(element('h3','Goal sharing'),
          element('p','Sharing this goal lets your chosen coach see this goal’s history and future activity, and assign a challenge.'));
        for (const coach of overview.coaches) {
          detailSection.append(sharingRow(coach, 'goal', overview.goalShares.some(share => share.goalId === goal.id && share.coachId === coach.id), goal.id));
        }
      }
    }
    if (revisions.length > 1) {
      const history = element('details');
      history.append(element('summary','Goal revision history'));
      listRecords(history, 'Goal revisions', revisions, r => [[r.title, r.motivation], ['Uncertainty',r.uncertainty], ['Progress',r.status]]);
      detailSection.append(history);
    }
    const exploration = listRecords(detailSection, 'Perspectives', explorations, r => [[modeName(r.perspective),r.note]]);
    if (client) {
      const { form, controls, area } = makeForm('Explore a perspective',
        [['perspective','Perspective',0,modeOptions()],['note','What do you notice from this perspective?',2000]], 'Save perspective note', add('explorations'));
      const prompt = element('p', modes[0].question, 'muted');
      controls.perspective.addEventListener('change', () => {
        prompt.textContent = modes.find(mode => mode.id === controls.perspective.value).question;
      });
      area.insertBefore(prompt, area.children[2]);
      exploration.append(form);
    }
    const challenge = listRecords(detailSection, 'Challenges', challenges, c => [[c.fromCoach ? 'Coach-assigned challenge' : 'Self-directed challenge',c.text]]);
    const challengeForm = makeForm(client ? 'Create a challenge' : 'Suggest the next challenge',
      [['text','Challenge',2000]], client ? 'Save challenge' : 'Assign challenge', add('challenges'));
    if (!client) {
      const draftMode = element('select');
      draftMode.setAttribute('aria-label','Perspective for draft');
      for (const [value,label] of modeOptions()) {
        const option = element('option',label);
        option.value = value;
        draftMode.append(option);
      }
      const draftButton = button('Draft from perspective', async () => {
        const result = await api('challenge-drafts','POST',{ focus:goal.title, perspective:draftMode.value });
        if (result && challengeForm.form.isConnected) challengeForm.controls.text.value = result.draft;
      });
      challengeForm.area.insertBefore(draftMode,challengeForm.area.children[1]);
      challengeForm.area.insertBefore(draftButton,challengeForm.area.children[2]);
    }
    challenge.append(challengeForm.form);
    const experiment = listRecords(detailSection, 'Experiments', experiments, e => [
      ['Possibility',e.possibility],['Small action',e.action],['What to notice',e.notice],
      ['Progress',reflections.some(r => r.experimentId === e.id) ? 'Reflected on' : 'Planned']
    ]);
    if (client && challenges.length) {
      experiment.append(makeForm('Plan a small experiment', [
        ['challengeId','Challenge',0,challenges.map(c => [c.id,c.text.slice(0,120)])],
        ['possibility','What possibility are you exploring?',1000], ['action','What small action will you take?',1000],
        ['notice','What will you pay attention to?',1000]
      ],'Save experiment',add('experiments')).form);
    }
    const reflection = listRecords(detailSection, 'Reflections', reflections, r => [['Reflection',r.text]]);
    if (client && experiments.length) {
      reflection.append(makeForm('Reflect on an experiment', [
        ['experimentId','Experiment',0,experiments.map(e => [e.id,e.action.slice(0,120)])],
        ['text','What did you expect, what happened, and what surprised you?',4000]
      ],'Save reflection',add('reflections')).form);
    }
    const outcome = listRecords(detailSection, 'Learning', learning, l => [['What changed in your thinking?',l.changed],['Next move',l.nextMove]]);
    if (client && reflections.length) {
      outcome.append(makeForm('Capture what you learned', [
        ['reflectionId','Reflection',0,reflections.map(r => [r.id,r.text.slice(0,120)])],
        ['changed','What changed in your thinking?',2000], ['nextMove','What do you choose to try next?',1000]
      ],'Save learning',add('learning')).form);
    }
  }

  async function openGoal(goalId, moveToGoal = false) {
    const request = ++detailRequest;
    detailSection.replaceChildren();
    detailSection.hidden = true;
    selectedGoal = goalId;
    const result = await api('journey/goals/' + goalId);
    if (result && detailRequest === request && selectedGoal === goalId) {
      renderGoal(result);
      if (moveToGoal) detailSection.scrollIntoView({ block: 'start' });
    }
  }

  async function refresh(goalId) {
    const data = await api('journey');
    if (!data) return;
    overview = data;
    renderOverview();
    if (goalId && data.goals.some(goal => goal.id === goalId)) await openGoal(goalId);
    else {
      selectedGoal = undefined;
      detailSection.replaceChildren();
      detailSection.hidden = true;
    }
  }

  function clear() {
    generation++;
    detailRequest++;
    workspace.hidden = true;
    profileSection.replaceChildren();
    goalsSection.replaceChildren();
    detailSection.replaceChildren();
    detailSection.hidden = true;
    $('journeyStatus').textContent = '';
    $('invitationStatus').textContent = '';
    actor = overview = modes = selectedGoal = undefined;
  }

  document.addEventListener('coach-view-cleared', clear);
  document.addEventListener('coach-identity', async event => {
    clear();
    actor = event.detail;
    const isClient = actor.role === 'client';
    $('journeyHeading').textContent = isClient ? 'Become Your Own Coach' : 'Coach Studio';
    $('journeyIntro').textContent = isClient ? 'Explore a goal, run a small experiment, and decide what to learn or share.' : 'Review what clients have shared and propose a challenge they can explore.';
    $('inviteCoach').hidden = isClient;
    $('inviteClient').hidden = !isClient;
    workspace.hidden = false;
    const result = await api('perspectives');
    if (!result) return;
    modes = result.perspectives;
    await refresh();
  });

  $('invite').addEventListener('click', async () => {
    const status = $('invitationStatus');
    status.textContent = '';
    const result = await api('invitations','POST',{ email: $('clientEmail').value.trim() });
    if (result) status.textContent = 'Invitation token: ' + result.invitationToken;
    else if (actor) status.textContent = $('journeyStatus').textContent;
  });
  $('accept').addEventListener('click', async () => {
    const status = $('invitationStatus');
    status.textContent = '';
    const result = await api('invitations/accept','POST',{ token: $('token').value.trim() });
    if (result) {
      $('token').value = '';
      status.textContent = 'Invitation accepted. Choose what to share below.';
      await refresh(selectedGoal);
    } else if (actor) {
      status.textContent = $('journeyStatus').textContent;
    }
  });
})();
