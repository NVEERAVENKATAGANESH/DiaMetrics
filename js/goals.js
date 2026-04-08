// DiaMetrics — goals.js  (goals, streaks, achievements)
'use strict';

// ══════════════════════════════════════════════════════════════
// GOALS
// ══════════════════════════════════════════════════════════════
function rGoals() {
  const pid   = State.activeProfile;
  const goals = DB.g('goals').filter(g => g.profileId === pid);
  const cont  = $('goals-list');
  if (!cont) return;

  // Auto-refresh current values
  _refreshGoalCurrents(pid, goals);

  if (!goals.length) {
    cont.innerHTML = emptyState('🎯','No goals set','Set personal health targets to track your progress.','<button class="btn btn-p" onclick="openAddGoal()" style="margin-top:12px">+ Set a Goal</button>');
    return;
  }

  cont.innerHTML = goals.map(g => {
    const pct      = g.target ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
    const daysLeft = D.diffDays(D.today(), g.by);
    const overdue  = daysLeft < 0 && !g.achieved;
    // For goals where lower = better (glucose, HbA1c, weight, cholesterol)
    const lowerBetter = ['HbA1c','Fasting Glucose','Weight','LDL Cholesterol','Triglycerides'].includes(g.type);
    const progress    = lowerBetter
      ? Math.min(100, Math.round(Math.max(0, (1 - (g.current - g.target) / Math.max(g.current, g.target)) * 100)))
      : pct;

    return `
    <div class="goal-card ${g.achieved?'goal-achieved':''}" id="goalc-${g.id}">
      <div class="goal-header">
        <div class="goal-title">
          ${g.achieved ? '✅ ' : '🎯 '}
          <strong>${esc(g.type)}</strong>
          ${g.achieved ? '<span class="badge badge-ok">Achieved!</span>' : ''}
          ${overdue    ? '<span class="badge badge-err">Overdue</span>'  : ''}
        </div>
        <div class="goal-actions">
          ${actionBtns(g.id,'viewGoal','openEditGoal','deleteGoal')}
        </div>
      </div>
      <div class="goal-body">
        <div class="goal-values">
          <span>Current: <strong>${g.current} ${g.unit}</strong></span>
          <span>Target: <strong>${g.target} ${g.unit}</strong></span>
          <span>By: ${D.fmt(g.by)} ${!g.achieved ? `(${Math.abs(daysLeft)}d ${daysLeft>=0?'left':'ago'})` : ''}</span>
        </div>
        <div class="goal-progress-wrap">
          <div class="goal-progress-bar">
            <div class="goal-progress-fill" style="width:${progress}%;background:${g.achieved?'#10b981':progress>=75?'#10b981':progress>=40?'#f59e0b':'#ef4444'}"></div>
          </div>
          <span class="goal-pct">${progress}%</span>
        </div>
        ${g.notes ? `<div class="goal-notes muted">${esc(g.notes)}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

function _refreshGoalCurrents(pid, goals) {
  const glucLogs  = DB.g('glucoseLogs').filter(l => l.profileId === pid && l.date >= D.daysAgo(30));
  const wtLogs    = DB.g('weightLogs').filter(l => l.profileId === pid).sort((a,b)=>b.date.localeCompare(a.date));
  const labLogs   = DB.g('labResults').filter(l => l.profileId === pid);
  const exLogs    = DB.g('exerciseLogs').filter(l => l.profileId === pid && l.date >= D.daysAgo(7));

  const getLatestLab = name => labLogs.filter(l=>l.test===name).sort((a,b)=>b.date.localeCompare(a.date))[0]?.value;

  goals.forEach(g => {
    let cur = g.current;
    if (g.type === 'HbA1c')          cur = glucLogs.length ? Model.estimatedA1c(glucLogs) : getLatestLab('HbA1c') || g.current;
    else if (g.type === 'Fasting Glucose') {
      const fg = glucLogs.filter(l => l.type === 'Fasting');
      cur = fg.length ? avg(fg.map(l=>l.value)) : g.current;
    }
    else if (g.type === 'Weight')    cur = wtLogs[0]?.value || g.current;
    else if (g.type === 'Steps') {
      const stepLogs = exLogs.filter(l => l.steps);
      cur = stepLogs.length ? Math.round(avg(stepLogs.map(l=>l.steps))) : g.current;
    }
    else if (g.type === 'LDL Cholesterol') cur = getLatestLab('LDL Cholesterol') || g.current;
    else if (g.type === 'Triglycerides')   cur = getLatestLab('Triglycerides') || g.current;

    if (cur !== g.current) {
      DB.update('goals', arr => arr.map(x => x.id === g.id ? { ...x, current: cur } : x));
      g.current = cur;
    }

    // Check achievement
    if (!g.achieved) {
      const lowerBetter = ['HbA1c','Fasting Glucose','Weight','LDL Cholesterol','Triglycerides'].includes(g.type);
      const hit = lowerBetter ? cur <= g.target : cur >= g.target;
      if (hit) {
        DB.update('goals', arr => arr.map(x => x.id === g.id ? { ...x, achieved: true } : x));
        successPopup('🎯 Goal Achieved!', g.type + ' target hit: ' + g.target + ' ' + g.unit, 'achievement');
        _checkBadge('goal_hit');
        Notifs.add(State.user.id, 'Goal Achieved: ' + g.type, 'You hit your target of ' + g.target + ' ' + g.unit, 'goal');
      }
    }
  });
}

function openAddGoal() {
  $('goal-id').value     = 0;
  $('goal-type').value   = '';
  $('goal-target').value = '';
  $('goal-unit').value   = '';
  $('goal-by').value     = '';
  $('goal-notes').value  = '';
  clearAllErrors('goal-form');
  openM('m-goal');
}

function openEditGoal(id) {
  const g = DB.g('goals').find(x => x.id === id);
  if (!g) return;
  $('goal-id').value     = id;
  $('goal-type').value   = g.type;
  $('goal-target').value = g.target;
  $('goal-unit').value   = g.unit;
  $('goal-by').value     = g.by;
  $('goal-notes').value  = g.notes || '';
  clearAllErrors('goal-form');
  openM('m-goal');
}

// Auto-fill unit when type changes
function onGoalTypeChange() {
  const type = $('goal-type')?.value;
  const unitEl = $('goal-unit');
  if (!unitEl) return;
  const unitMap = {
    'HbA1c':'%', 'Fasting Glucose':'mg/dL', 'Post-Meal Glucose':'mg/dL',
    'Weight':'kg', 'Steps':'steps', 'LDL Cholesterol':'mg/dL', 'Triglycerides':'mg/dL',
    'BMI':'kg/m²', 'Blood Pressure':'mmHg',
  };
  unitEl.value = unitMap[type] || '';
}

function saveGoal() {
  const d = {
    type:   $('goal-type')?.value   || '',
    target: +($('goal-target')?.value || 0),
    unit:   ($('goal-unit')?.value   || '').trim(),
    by:     $('goal-by')?.value      || '',
    notes:  ($('goal-notes')?.value  || '').trim(),
  };
  if (!Validate.goal(d)) return;

  const id    = +($('goal-id')?.value || 0);
  const pid   = State.activeProfile;
  const isAdd = !id;

  if (isAdd) {
    const all = DB.gAll('goals');
    const rec = { id: DB.nid(all), profileId: pid, ...d, current: d.target, achieved: false, createdAt: D.now() };
    all.push(rec);
    DB.s('goals', all);
    DB.audit('create', 'goals', rec.id, `Set ${d.type} goal: target ${d.target} ${d.unit} by ${d.by}`);
    clearDraft('m-goal');
    closeM('m-goal');
    rGoals();
    toast('Goal set!', true);
  } else {
    const snap = DB.gAll('goals');
    DB.update('goals', arr => arr.map(r => r.id === id ? { ...r, ...d } : r));
    DB.audit('update', 'goals', id, `Updated ${d.type} goal target to ${d.target} ${d.unit}`);
    closeM('m-goal');
    rGoals();
    toastUndo('Goal updated', () => {
      DB.s('goals', snap);
      rGoals();
    });
  }
}

function deleteGoal(id) {
  confirmDlg('Delete this goal?', () => {
    const snap = DB.gAll('goals');
    const g = snap.find(r => r.id === id);
    DB.audit('delete', 'goals', id, `Deleted ${g?.type || ''} goal`);
    fadeDeleteRow('goalc-' + id, () => {
      DB.update('goals', arr => arr.filter(r => r.id !== id));
      rGoals();
      toastUndo('Goal deleted', () => {
        DB.s('goals', snap);
        rGoals();
      });
    });
  }, true, 'Delete');
}

// ══════════════════════════════════════════════════════════════
// ACHIEVEMENTS
// ══════════════════════════════════════════════════════════════
function _badgeProgress(badgeId) {
  const logs = DB.forProfile('glucoseLogs');

  if (badgeId === 'streak_7' || badgeId === 'streak_30' || badgeId === 'streak_90') {
    const target = badgeId === 'streak_7' ? 7 : badgeId === 'streak_30' ? 30 : 90;
    let streak = 0;
    for (let i = 0; i < target; i++) {
      if (logs.some(l => l.date === D.daysAgo(i))) streak++; else break;
    }
    return `${streak} / ${target} days`;
  }
  if (badgeId === 'in_range_7') {
    let s = 0;
    for (let i = 0; i < 7; i++) {
      const d = logs.filter(l => l.date === D.daysAgo(i));
      if (d.length && d.every(l => l.value >= C.GLUCOSE.NORMAL_LOW && l.value <= C.GLUCOSE.NORMAL_HIGH)) s++;
      else if (d.length) break;
    }
    return `${s} / 7 days in range`;
  }
  if (badgeId === 'meds_7') {
    const doses = DB.forProfile('medDoses');
    const meds  = DB.forProfile('medications').filter(m => m.active);
    if (!meds.length) return 'No active medications';
    let taken = 0;
    for (let i = 0; i < 7; i++) {
      const d = D.daysAgo(i);
      const dayDoses = doses.filter(x => x.date === d);
      if (dayDoses.length) taken += dayDoses.filter(x => x.taken).length / dayDoses.length;
    }
    return `${Math.round((taken / 7) * 100)}% adherence (need 90%)`;
  }
  return null;
}

function rAchievements() {
  const pid    = State.activeProfile;
  const earned = DB.g('achievements').filter(a => a.profileId === pid);
  const cont   = $('ach-grid');
  if (!cont) return;

  cont.innerHTML = C.BADGES.map(b => {
    const got  = earned.find(a => a.badgeId === b.id);
    const prog = got ? null : _badgeProgress(b.id);
    return `
    <div class="badge-card ${got?'badge-earned':'badge-locked'}">
      <div class="badge-icon">${b.icon}</div>
      <div class="badge-label">${esc(b.label)}</div>
      <div class="badge-desc">${esc(b.desc)}</div>
      ${got
        ? `<div class="badge-date">${D.fmt(got.earnedAt)}</div>`
        : `<div class="badge-date muted">${prog ? esc(prog) : 'Not earned yet'}</div>`}
    </div>`;
  }).join('');

  // Stats
  const earnedEl = $('ach-earned');
  if (earnedEl) earnedEl.textContent = earned.length + ' / ' + C.BADGES.length;
}


function viewGoal(id) {
  const g = DB.g('goals').find(x => x.id === id);
  if (!g) return;
  const daysLeft = D.diffDays(D.today(), g.by);
  const pct = g.target ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
  openViewModal('🎯 Goal Detail', [
    ['Type',      g.type],
    ['Current',   g.current + ' ' + g.unit],
    ['Target',    g.target + ' ' + g.unit],
    ['Progress',  `<div style="display:flex;align-items:center;gap:8px"><div style="flex:1;height:8px;background:var(--border);border-radius:4px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${g.achieved?'#10b981':'#3b82f6'};border-radius:4px"></div></div><span>${pct}%</span></div>`],
    ['Due By',    D.fmt(g.by) + (daysLeft >= 0 ? ` (${daysLeft}d left)` : ` (${Math.abs(daysLeft)}d overdue)`)],
    ['Status',    g.achieved ? '<span class="badge badge-ok">✅ Achieved</span>' : '<span class="badge badge-warn">In Progress</span>'],
    ['Notes',     g.notes || '—'],
  ]);
}
