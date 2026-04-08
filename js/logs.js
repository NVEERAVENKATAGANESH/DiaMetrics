// DiaMetrics — logs.js  (glucose, weight, meal, exercise, insulin, sleep)
'use strict';

const pid = () => {
  const p = State.activeProfile;
  if (!p) {
    const profiles = DB.g('profiles').filter(x => x.userId === State.user?.id);
    if (profiles[0]) { State.activeProfile = profiles[0].id; return profiles[0].id; }
  }
  return p;
};
const prefs = () => DB.go('settings');

// ══════════════════════════════════════════════════════════════
// GLUCOSE LOGS
// ══════════════════════════════════════════════════════════════
function rGlucoseLogs() {
  const tbody = $('gl-tbody');
  if (!tbody) return;
  tbody.innerHTML = skeleton(4, 6);
  requestAnimationFrame(() => {
    let data = DB.g('glucoseLogs').filter(l => l.profileId === pid());
    data = dateRangeFilter(data, 'gl-from', 'gl-to');

    // ── 14-day trend chart ─────────────────────────────────────────
    const last14  = D.last(14);
    const dailyG  = last14.map(d => {
      const r = data.filter(l => l.date === d);
      return r.length ? avg(r.map(l=>l.value)) : null;
    });
    Charts.glucLine('gl-trend-chart', last14.map(d => D.weekday(d)+' '+d.slice(5)), dailyG.map(v=>v||0));

    data = _applySort(data, 'gl-table', 'date', 'desc');

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="6">${emptyState('🩸','No glucose logs','Log your first reading to get started.')}</td></tr>`;
      return;
    }
    paginate(data, 'gl-tbody', sliced => {
      tbody.innerHTML = sliced.map(l => {
        const s = Calc.glucLabel(l.value);
        return `<tr id="glr-${l.id}">
          <td>${D.fmt(l.date)}</td>
          <td>${l.time}</td>
          <td>${esc(l.type)}</td>
          <td><strong>${Units.gluc(l.value, prefs())}</strong></td>
          <td><span class="badge badge-${s.cls}">${s.label}</span></td>
          <td class="tbl-actions">${actionBtns(l.id,'viewGlucose','openEditGlucose','deleteGlucose')}</td>
        </tr>`;
      }).join('');
      makeSortable('gl-table', rGlucoseLogs);
    });
  });
}

function openAddGlucose() {
  $('gl-id').value    = 0;
  $('gl-date').value  = D.today();
  $('gl-time').value  = new Date().toTimeString().slice(0,5);
  $('gl-value').value = '';
  $('gl-type').value  = 'Fasting';
  $('gl-notes').value = '';
  const s = DB.go('settings');
  const glucInput = $('gl-value');
  if (glucInput) {
    const lbl = glucInput.closest('.form-group')?.querySelector('label');
    if (lbl) lbl.textContent = `Glucose Value (${s.glucUnit || 'mg/dL'})`;
  }
  clearAllErrors('gl-form');
  openM('m-glucose');
}

function openEditGlucose(id) {
  const l = DB.g('glucoseLogs').find(x => x.id === id);
  if (!l) return;
  $('gl-id').value    = id;
  $('gl-date').value  = l.date;
  $('gl-time').value  = l.time;
  $('gl-value').value = l.value;
  $('gl-type').value  = l.type;
  $('gl-notes').value = l.notes || '';
  const s = DB.go('settings');
  const glucInput = $('gl-value');
  if (glucInput) {
    const lbl = glucInput.closest('.form-group')?.querySelector('label');
    if (lbl) lbl.textContent = `Glucose Value (${s.glucUnit || 'mg/dL'})`;
  }
  clearAllErrors('gl-form');
  openM('m-glucose');
}

function saveGlucose() {
  const d = {
    date:  $('gl-date')?.value  || '',
    time:  $('gl-time')?.value  || '',
    value: +($('gl-value')?.value || 0),
    type:  $('gl-type')?.value  || '',
    notes: ($('gl-notes')?.value || '').trim(),
  };
  const s = DB.go('settings');
  if (s.glucUnit === 'mmol/L' && d.value < 50) {
    d.value = Units.toMg(d.value);
  }
  if (!Validate.glucoseLog(d)) return;
  const id = +($('gl-id')?.value || 0);
  _saveLog('glucoseLogs', id, { ...d, profileId: pid() }, 'm-glucose', rGlucoseLogs, 'glr-');

  // Check achievements
  _checkGlucoseAchievements();
  Notifs.updateBadge();
}

function deleteGlucose(id) {
  _deleteLog('glucoseLogs', id, 'glr-', rGlucoseLogs, 'Glucose log deleted');
}

// ══════════════════════════════════════════════════════════════
// WEIGHT LOGS
// ══════════════════════════════════════════════════════════════
function rWeightLogs() {
  const tbody = $('wl-tbody');
  if (!tbody) return;
  tbody.innerHTML = skeleton(4, 4);
  requestAnimationFrame(() => {
    let data = DB.g('weightLogs').filter(l => l.profileId === pid());
    data = dateRangeFilter(data, 'wl-from', 'wl-to');
    data = _applySort(data, 'wl-table', 'date', 'desc');
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="4">${emptyState('⚖️','No weight logs','Start tracking your weight.')}</td></tr>`;
      return;
    }
    paginate(data, 'wl-tbody', sliced => {
      tbody.innerHTML = sliced.map(l => `
        <tr id="wlr-${l.id}">
          <td>${D.fmt(l.date)}</td>
          <td>${Units.wt(l.value, prefs())}</td>
          <td>${l.notes ? esc(l.notes) : '—'}</td>
          <td class="tbl-actions">${actionBtns(l.id,'viewWeight','openEditWeight','deleteWeight')}</td>
        </tr>`).join('');
      makeSortable('wl-table', rWeightLogs);
    });

    // Weight chart
    const sorted = [...data].sort((a,b) => a.date.localeCompare(b.date)).slice(-20);
    Charts.line('wl-chart', sorted.map(l => D.fmt(l.date)), [{ label:'Weight (kg)', data: sorted.map(l=>l.value) }]);
  });
}

function openAddWeight() {
  $('wl-id').value    = 0;
  $('wl-date').value  = D.today();
  $('wl-value').value = '';
  $('wl-notes').value = '';
  const wUnit = DB.go('settings').weightUnit || 'kg';
  const wLbl = $('wl-value')?.closest('.form-group')?.querySelector('label');
  if (wLbl) wLbl.textContent = `Weight (${wUnit})`;
  clearAllErrors('wl-form');
  openM('m-weight');
}

function openEditWeight(id) {
  const l = DB.g('weightLogs').find(x => x.id === id);
  if (!l) return;
  $('wl-id').value    = id;
  $('wl-date').value  = l.date;
  $('wl-value').value = l.value;
  $('wl-notes').value = l.notes || '';
  const wUnit = DB.go('settings').weightUnit || 'kg';
  const wLbl = $('wl-value')?.closest('.form-group')?.querySelector('label');
  if (wLbl) wLbl.textContent = `Weight (${wUnit})`;
  clearAllErrors('wl-form');
  openM('m-weight');
}

function saveWeight() {
  const d = {
    date:  $('wl-date')?.value  || '',
    value: +($('wl-value')?.value || 0),
    notes: ($('wl-notes')?.value || '').trim(),
  };
  const s = DB.go('settings');
  if (s.weightUnit === 'lbs') d.value = +Units.lbsToKg(d.value);
  if (!Validate.weightLog(d)) return;
  const id = +($('wl-id')?.value || 0);
  _saveLog('weightLogs', id, { ...d, profileId: pid() }, 'm-weight', rWeightLogs, 'wlr-');
}

function deleteWeight(id) { _deleteLog('weightLogs', id, 'wlr-', rWeightLogs, 'Weight log deleted'); }

// ══════════════════════════════════════════════════════════════
// MEAL LOGS
// ══════════════════════════════════════════════════════════════
function rMealLogs() {
  const tbody = $('ml-tbody');
  if (!tbody) return;
  tbody.innerHTML = skeleton(4, 6);
  requestAnimationFrame(() => {
    let data = DB.g('mealLogs').filter(l => l.profileId === pid());
    data = dateRangeFilter(data, 'ml-from', 'ml-to');
    data = _applySort(data, 'ml-table', 'date', 'desc');
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="6">${emptyState('🍽️','No meal logs','Log your meals to track nutrition.')}</td></tr>`;
      return;
    }
    paginate(data, 'ml-tbody', sliced => {
      tbody.innerHTML = sliced.map(l => `
        <tr id="mlr-${l.id}">
          <td>${D.fmt(l.date)}</td>
          <td>${esc(l.mealType)}</td>
          <td>${esc(l.description)}</td>
          <td>${l.carbsG ? l.carbsG + 'g' : '—'}</td>
          <td>${l.caloriesKcal ? l.caloriesKcal + ' kcal' : '—'}</td>
          <td class="tbl-actions">${actionBtns(l.id,'viewMeal','openEditMeal','deleteMeal')}</td>
        </tr>`).join('');
      makeSortable('ml-table', rMealLogs);
    });

    // ── Meal pattern analysis (which meal type spikes glucose most) ─
    _renderMealPatternAnalysis(data);
  });
}

function _renderMealPatternAnalysis(mealLogs) {
  const glucLogs = DB.g('glucoseLogs').filter(l => l.profileId === pid());
  const mealEl   = $('ml-pattern');
  if (!mealEl) return;

  // For each meal type, find post-meal readings within 2 hours of the meal date
  const mealAvgGluc = {};
  C.MEALS.forEach(mealType => {
    const days = mealLogs.filter(l => l.mealType === mealType).map(l => l.date);
    const postReadings = glucLogs.filter(l => l.type === 'Post-Meal' && days.includes(l.date));
    mealAvgGluc[mealType] = postReadings.length ? avg(postReadings.map(l=>l.value)) : null;
  });

  const validTypes = C.MEALS.filter(t => mealAvgGluc[t] !== null);
  if (validTypes.length < 2) {
    mealEl.innerHTML = '<p class="muted">Log meals + post-meal glucose readings to see pattern analysis.</p>';
    return;
  }

  // Sort by avg glucose descending
  validTypes.sort((a, b) => mealAvgGluc[b] - mealAvgGluc[a]);
  const worst = validTypes[0];

  Charts.bar('ml-pattern-chart', validTypes,
    [{ label: 'Avg Post-Meal Glucose (mg/dL)',
       data: validTypes.map(t => mealAvgGluc[t]),
       backgroundColor: validTypes.map(t => mealAvgGluc[t] > C.GLUCOSE.NORMAL_HIGH ? P.red+'bb' : P.green+'bb'),
    }],
    { plugins: { legend: { display: false } },
      scales: { y: { suggestedMin: 80, suggestedMax: 200 } } }
  );

  mealEl.innerHTML = `<p style="font-size:.85rem;color:var(--text2);margin-top:8px">
    ⚠️ <strong>${esc(worst)}</strong> causes the highest avg post-meal glucose
    (${mealAvgGluc[worst]} mg/dL). Consider smaller portions or lower-carb options.
  </p>`;
}

function openAddMeal() {
  $('ml-id').value       = 0;
  $('ml-date').value     = D.today();
  $('ml-meal').value     = '';
  $('ml-food').value     = '';
  $('ml-carbs').value    = '';
  $('ml-cals').value     = '';
  $('ml-notes').value    = '';
  clearAllErrors('ml-form');
  openM('m-meal');
}

function openEditMeal(id) {
  const l = DB.g('mealLogs').find(x => x.id === id);
  if (!l) return;
  $('ml-id').value       = id;
  $('ml-date').value     = l.date;
  $('ml-meal').value     = l.mealType;
  $('ml-food').value     = l.description;
  $('ml-carbs').value    = l.carbsG || '';
  $('ml-cals').value     = l.caloriesKcal || '';
  $('ml-notes').value    = l.notes || '';
  clearAllErrors('ml-form');
  openM('m-meal');
}

function saveMeal() {
  const d = {
    date:         $('ml-date')?.value || '',
    mealType:     $('ml-meal')?.value || '',
    description:  ($('ml-food')?.value || '').trim(),
    carbsG:       $('ml-carbs')?.value ? +$('ml-carbs').value : null,
    caloriesKcal: $('ml-cals')?.value  ? +$('ml-cals').value  : null,
    notes:        ($('ml-notes')?.value || '').trim(),
    tags:         [],
  };
  if (!Validate.mealLog(d)) return;
  const id = +($('ml-id')?.value || 0);
  _saveLog('mealLogs', id, { ...d, profileId: pid() }, 'm-meal', rMealLogs, 'mlr-');
  _checkBadge('first_meal');
}

function deleteMeal(id) { _deleteLog('mealLogs', id, 'mlr-', rMealLogs, 'Meal log deleted'); }

// ══════════════════════════════════════════════════════════════
// EXERCISE LOGS
// ══════════════════════════════════════════════════════════════
function rExerciseLogs() {
  const tbody = $('ex-tbody');
  if (!tbody) return;
  tbody.innerHTML = skeleton(4, 6);
  requestAnimationFrame(() => {
    let data = DB.g('exerciseLogs').filter(l => l.profileId === pid());
    data = dateRangeFilter(data, 'ex-from', 'ex-to');
    data = _applySort(data, 'ex-table', 'date', 'desc');
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="6">${emptyState('🏃','No exercise logs','Log your workouts to track activity.')}</td></tr>`;
      return;
    }
    paginate(data, 'ex-tbody', sliced => {
      tbody.innerHTML = sliced.map(l => `
        <tr id="exr-${l.id}">
          <td>${D.fmt(l.date)}</td>
          <td>${esc(l.type)}</td>
          <td>${l.duration} min</td>
          <td>${esc(l.intensity)}</td>
          <td>${l.steps ? l.steps.toLocaleString() : '—'}</td>
          <td class="tbl-actions">${actionBtns(l.id,'viewExercise','openEditExercise','deleteExercise')}</td>
        </tr>`).join('');
      makeSortable('ex-table', rExerciseLogs);
    });

    // ── Exercise vs Next-day Glucose correlation chart ─────────────
    _renderExerciseGlucoseChart(data);

    // ── Weekly activity summary ────────────────────────────────────
    _renderWeeklyActivity(data);
  });
}

function _renderExerciseGlucoseChart(exLogs) {
  const glucLogs = DB.g('glucoseLogs').filter(l => l.profileId === pid());
  const points   = [];
  exLogs.forEach(e => {
    const nextDay = D.addDays(e.date, 1);
    const nextG   = glucLogs.filter(l => l.date === nextDay);
    if (nextG.length) points.push({ x: e.duration, y: avg(nextG.map(l=>l.value)), label: e.type });
  });
  if (points.length < 3) return;
  Charts.scatter('ex-corr-chart', [{
    label: 'Exercise Duration vs Next-Day Avg Glucose',
    data: points.map(p => ({ x: p.x, y: p.y })),
    backgroundColor: P.green + 'aa',
    pointRadius: 6,
  }], {
    scales: {
      x: { title: { display: true, text: 'Exercise Duration (min)' } },
      y: { title: { display: true, text: 'Next-Day Avg Glucose (mg/dL)' } },
    },
    plugins: { legend: { display: false } },
  });
}

function _renderWeeklyActivity(exLogs) {
  const weeks = 8;
  const labels = [], durations = [], stepCounts = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const start = D.daysAgo(w * 7 + 6);
    const end   = D.daysAgo(w * 7);
    const wLogs = exLogs.filter(l => l.date >= start && l.date <= end);
    labels.push('W-' + (w === 0 ? 'This' : w));
    durations.push(wLogs.reduce((s, l) => s + l.duration, 0));
    stepCounts.push(wLogs.reduce((s, l) => s + (l.steps || 0), 0));
  }
  Charts.bar('ex-weekly-chart', labels, [
    { label: 'Total Duration (min)', data: durations },
  ], { plugins: { legend: { display: false } } });
}

function openAddExercise() {
  $('ex-id').value    = 0;
  $('ex-date').value  = D.today();
  $('ex-type').value  = '';
  $('ex-dur').value   = '';
  $('ex-int').value   = '';
  $('ex-steps').value = '';
  $('ex-notes').value = '';
  clearAllErrors('ex-form');
  openM('m-exercise');
}

function openEditExercise(id) {
  const l = DB.g('exerciseLogs').find(x => x.id === id);
  if (!l) return;
  $('ex-id').value    = id;
  $('ex-date').value  = l.date;
  $('ex-type').value  = l.type;
  $('ex-dur').value   = l.duration;
  $('ex-int').value   = l.intensity;
  $('ex-steps').value = l.steps || '';
  $('ex-notes').value = l.notes || '';
  clearAllErrors('ex-form');
  openM('m-exercise');
}

function saveExercise() {
  const d = {
    date:      $('ex-date')?.value || '',
    type:      $('ex-type')?.value || '',
    duration:  +($('ex-dur')?.value  || 0),
    intensity: $('ex-int')?.value   || '',
    steps:     $('ex-steps')?.value ? +$('ex-steps').value : null,
    notes:     ($('ex-notes')?.value || '').trim(),
  };
  if (!Validate.exerciseLog(d)) return;
  const id = +($('ex-id')?.value || 0);
  _saveLog('exerciseLogs', id, { ...d, profileId: pid() }, 'm-exercise', rExerciseLogs, 'exr-');
  _checkBadge('first_exercise');
}

function deleteExercise(id) { _deleteLog('exerciseLogs', id, 'exr-', rExerciseLogs, 'Exercise log deleted'); }

// ══════════════════════════════════════════════════════════════
// INSULIN LOGS
// ══════════════════════════════════════════════════════════════
function rInsulinLogs() {
  const tbody = $('in-tbody');
  if (!tbody) return;
  tbody.innerHTML = skeleton(4, 6);
  requestAnimationFrame(() => {
    let data = DB.g('insulinLogs').filter(l => l.profileId === pid());
    data = dateRangeFilter(data, 'in-from', 'in-to');
    data = _applySort(data, 'in-table', 'date', 'desc');
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="6">${emptyState('💉','No insulin logs','Track your insulin doses here.')}</td></tr>`;
      return;
    }
    paginate(data, 'in-tbody', sliced => {
      tbody.innerHTML = sliced.map(l => `
        <tr id="inr-${l.id}">
          <td>${D.fmt(l.date)}</td>
          <td>${l.time}</td>
          <td>${esc(l.insulinType)}</td>
          <td>${l.units} U</td>
          <td>${esc(l.site || '—')}</td>
          <td class="tbl-actions">${actionBtns(l.id,'viewInsulin','openEditInsulin','deleteInsulin')}</td>
        </tr>`).join('');
      makeSortable('in-table', rInsulinLogs);
    });

    // ── Dose vs Glucose Response chart ────────────────────────────
    _renderInsulinGlucoseChart(data);
  });
}

function _renderInsulinGlucoseChart(insulinLogs) {
  const glucLogs = DB.g('glucoseLogs').filter(l => l.profileId === pid());
  // For each day, plot total rapid-acting units vs avg post-meal glucose that day
  const byDate = {};
  insulinLogs.forEach(l => {
    if (!byDate[l.date]) byDate[l.date] = { units: 0 };
    if (l.insulinType === 'Rapid-acting' || l.insulinType === 'Short-acting') byDate[l.date].units += l.units;
  });
  const dates   = Object.keys(byDate).sort().slice(-20);
  const units   = dates.map(d => byDate[d].units);
  const postG   = dates.map(d => {
    const r = glucLogs.filter(l => l.date === d && l.type === 'Post-Meal');
    return r.length ? avg(r.map(l=>l.value)) : null;
  });
  if (dates.length < 3) return;
  const labels = dates.map(d => D.fmt(d));
  Charts.line('in-response-chart', labels, [
    { label: 'Rapid Insulin (units)', data: units, borderColor: P.purple, fill: false, yAxisID: 'y1' },
    { label: 'Post-Meal Glucose',     data: postG, borderColor: P.red,    fill: false, yAxisID: 'y' },
  ], {
    scales: {
      y:  { position: 'left',  title: { display: true, text: 'Glucose (mg/dL)' } },
      y1: { position: 'right', title: { display: true, text: 'Insulin (units)' }, grid: { drawOnChartArea: false } },
    },
  });
}

function openAddInsulin() {
  $('in-id').value    = 0;
  $('in-date').value  = D.today();
  $('in-time').value  = new Date().toTimeString().slice(0,5);
  $('in-type').value  = '';
  $('in-units').value = '';
  $('in-site').value  = '';
  $('in-notes').value = '';
  clearAllErrors('in-form');
  openM('m-insulin');
}

function openEditInsulin(id) {
  const l = DB.g('insulinLogs').find(x => x.id === id);
  if (!l) return;
  $('in-id').value    = id;
  $('in-date').value  = l.date;
  $('in-time').value  = l.time;
  $('in-type').value  = l.insulinType;
  $('in-units').value = l.units;
  $('in-site').value  = l.site || '';
  $('in-notes').value = l.notes || '';
  clearAllErrors('in-form');
  openM('m-insulin');
}

function saveInsulin() {
  const d = {
    date:        $('in-date')?.value || '',
    time:        $('in-time')?.value || '',
    insulinType: $('in-type')?.value || '',
    units:       +($('in-units')?.value || 0),
    site:        $('in-site')?.value  || '',
    notes:       ($('in-notes')?.value || '').trim(),
  };
  if (!Validate.insulinLog(d)) return;
  const id = +($('in-id')?.value || 0);
  _saveLog('insulinLogs', id, { ...d, profileId: pid() }, 'm-insulin', rInsulinLogs, 'inr-');
}

function deleteInsulin(id) { _deleteLog('insulinLogs', id, 'inr-', rInsulinLogs, 'Insulin log deleted'); }

// ══════════════════════════════════════════════════════════════
// SLEEP / STRESS LOGS
// ══════════════════════════════════════════════════════════════
function rSleepLogs() {
  const tbody = $('sl-tbody');
  if (!tbody) return;
  tbody.innerHTML = skeleton(4, 5);
  requestAnimationFrame(() => {
    let data = DB.g('sleepLogs').filter(l => l.profileId === pid());
    data = dateRangeFilter(data, 'sl-from', 'sl-to');
    data = _applySort(data, 'sl-table', 'date', 'desc');

    // ── Sleep hours vs next-day avg glucose chart ──────────────────
    _renderSleepGlucoseChart(data);

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="5">${emptyState('😴','No sleep logs','Track sleep and stress levels.')}</td></tr>`;
      return;
    }
    paginate(data, 'sl-tbody', sliced => {
      tbody.innerHTML = sliced.map(l => {
        const qual = ['','⭐','⭐⭐','⭐⭐⭐','⭐⭐⭐⭐','⭐⭐⭐⭐⭐'][l.quality] || '—';
        return `<tr id="slr-${l.id}">
          <td>${D.fmt(l.date)}</td>
          <td>${l.hours}h</td>
          <td>${qual}</td>
          <td>${l.stress}/10</td>
          <td class="tbl-actions">${actionBtns(l.id,'viewSleep','openEditSleep','deleteSleep')}</td>
        </tr>`;
      }).join('');
      makeSortable('sl-table', rSleepLogs);
    });
  });
}

function openAddSleep() {
  $('sl-id').value     = 0;
  $('sl-date').value   = D.today();
  $('sl-hours').value  = '';
  $('sl-qual').value   = '';
  $('sl-stress').value = '';
  $('sl-notes').value  = '';
  clearAllErrors('sl-form');
  openM('m-sleep');
}

function openEditSleep(id) {
  const l = DB.g('sleepLogs').find(x => x.id === id);
  if (!l) return;
  $('sl-id').value     = id;
  $('sl-date').value   = l.date;
  $('sl-hours').value  = l.hours;
  $('sl-qual').value   = l.quality;
  $('sl-stress').value = l.stress;
  $('sl-notes').value  = l.notes || '';
  clearAllErrors('sl-form');
  openM('m-sleep');
}

function saveSleep() {
  const d = {
    date:    $('sl-date')?.value   || '',
    hours:   +($('sl-hours')?.value  || 0),
    quality: +($('sl-qual')?.value   || 0),
    stress:  +($('sl-stress')?.value || 0),
    notes:   ($('sl-notes')?.value  || '').trim(),
  };
  if (!Validate.sleepLog(d)) return;
  const id = +($('sl-id')?.value || 0);
  _saveLog('sleepLogs', id, { ...d, profileId: pid() }, 'm-sleep', rSleepLogs, 'slr-');
}

function deleteSleep(id) { _deleteLog('sleepLogs', id, 'slr-', rSleepLogs, 'Sleep log deleted'); }

function _renderSleepGlucoseChart(sleepData) {
  const glucLogs = DB.g('glucoseLogs').filter(l => l.profileId === pid());
  const sorted   = [...sleepData].sort((a,b) => a.date.localeCompare(b.date)).slice(-30);
  const labels   = sorted.map(s => D.fmt(s.date));
  const sleepHrs = sorted.map(s => s.hours);
  const nextGluc = sorted.map(s => {
    const nextDay = D.addDays(s.date, 1);
    const r = glucLogs.filter(l => l.date === nextDay);
    return r.length ? avg(r.map(l=>l.value)) : null;
  });
  if (sorted.length < 3) return;
  Charts.line('sl-corr-chart', labels, [
    { label: 'Sleep Hours',          data: sleepHrs, borderColor: P.purple, fill: false, yAxisID: 'y1' },
    { label: 'Next-Day Avg Glucose', data: nextGluc, borderColor: P.blue,   fill: false, yAxisID: 'y'  },
  ], {
    scales: {
      y:  { position: 'left',  title: { display: true, text: 'Glucose (mg/dL)' } },
      y1: { position: 'right', title: { display: true, text: 'Sleep (hours)' }, grid: { drawOnChartArea: false } },
    },
  });
}

// ══════════════════════════════════════════════════════════════
// NOTES / SYMPTOM JOURNAL
// ══════════════════════════════════════════════════════════════
function rNotes() {
  const cont = $('notes-list');
  if (!cont) return;

  // ── Symptom frequency chart ──────────────────────────────────────
  _renderSymptomFrequency();

  let data = DB.g('notes').filter(n => n.profileId === pid())
               .sort((a,b) => b.date.localeCompare(a.date));

  const q = ($('notes-search')?.value || '').trim().toLowerCase();
  if (q) data = data.filter(n => n.text.toLowerCase().includes(q) || (n.symptoms||[]).some(s=>s.toLowerCase().includes(q)));

  if (!data.length) {
    cont.innerHTML = emptyState('📝','No journal entries','Write about how you\'re feeling each day.');
    return;
  }
  cont.innerHTML = data.slice(0, 20).map(n => `
    <div class="note-card" id="note-${n.id}">
      <div class="note-header">
        <span class="note-date">${D.fmt(n.date)}</span>
        <div class="note-actions">
          ${actionBtns(n.id,'viewNote','openEditNote','deleteNote')}
        </div>
      </div>
      <div class="note-text">${esc(n.text)}</div>
      ${n.symptoms?.length ? `<div class="note-symptoms">${n.symptoms.map(s=>`<span class="symptom-tag">${esc(s)}</span>`).join('')}</div>` : ''}
    </div>`).join('');
}

function openAddNote() {
  $('nt-id').value       = 0;
  $('nt-date').value     = D.today();
  $('nt-text').value     = '';
  $qa('.symptom-cb').forEach(cb => { cb.checked = false; });
  clearAllErrors('nt-form');
  openM('m-note');
}

function openEditNote(id) {
  const n = DB.g('notes').find(x => x.id === id);
  if (!n) return;
  $('nt-id').value   = id;
  $('nt-date').value = n.date;
  $('nt-text').value = n.text;
  $qa('.symptom-cb').forEach(cb => { cb.checked = (n.symptoms||[]).includes(cb.value); });
  clearAllErrors('nt-form');
  openM('m-note');
}

function saveNote() {
  const text = ($('nt-text')?.value || '').trim();
  const date = $('nt-date')?.value || '';
  if (!text) { fieldError('nt-text', 'Please write something'); return; }
  if (!date || !V.date(date)) { fieldError('nt-date', 'Valid date required'); return; }
  const symptoms = $qa('.symptom-cb').filter(cb=>cb.checked).map(cb=>cb.value);
  const id = +($('nt-id')?.value || 0);
  _saveLog('notes', id, { date, text, symptoms, profileId: pid() }, 'm-note', rNotes, 'note-');
}

function deleteNote(id) { _deleteLog('notes', id, 'note-', rNotes, 'Note deleted'); }

function _renderSymptomFrequency() {
  const el = $('symptom-freq-chart');
  if (!el) return;
  const notes = DB.g('notes').filter(n => n.profileId === pid());
  const counts = {};
  notes.forEach(n => (n.symptoms || []).forEach(s => { counts[s] = (counts[s] || 0) + 1; }));
  const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,8);
  if (!sorted.length) return;
  Charts.bar('symptom-freq-chart',
    sorted.map(([s]) => s),
    [{ label: 'Frequency', data: sorted.map(([,c]) => c),
       backgroundColor: P.red + 'aa' }],
    { plugins: { legend: { display: false } },
      scales: { y: { ticks: { stepSize: 1 } } } }
  );
}

// ══════════════════════════════════════════════════════════════
// SHARED HELPERS
// ══════════════════════════════════════════════════════════════
function _saveLog(key, id, data, modalId, renderFn, rowPrefix) {
  const isAdd = !id;
  if (isAdd) {
    const all = DB.gAll(key);
    const rec = { id: DB.nid(all), ...data };
    all.push(rec);
    DB.s(key, all);
    DB.audit('create', key, rec.id, `Added ${key.replace('Logs','').replace('s','')} on ${rec.date || ''}`);
    clearDraft(modalId);
    closeM(modalId);
    renderFn();
    toast('Saved', true);
    requestAnimationFrame(() => flashRow(rowPrefix + rec.id));
    _checkBadge('first_log');
  } else {
    const snap = DB.gAll(key);
    DB.update(key, arr => arr.map(r => r.id === id ? { ...r, ...data } : r));
    DB.audit('update', key, id, `Updated ${key.replace('Logs','').replace('s','')} id=${id}`);
    closeM(modalId);
    renderFn();
    toastUndo('Updated', () => {
      DB.s(key, snap);
      renderFn();
    });
  }
}

function _deleteLog(key, id, rowPrefix, renderFn, msg) {
  confirmDlg('Delete this entry?', () => {
    const snap = DB.gAll(key);
    DB.audit('delete', key, id, `Deleted ${key.replace('Logs','').replace('s','')} id=${id}`);
    fadeDeleteRow(rowPrefix + id, () => {
      DB.update(key, arr => arr.filter(r => r.id !== id));
      renderFn();
      toastUndo(msg, () => {
        DB.s(key, snap);
        renderFn();
      });
    });
  }, true, 'Delete');
}

function _applySort(data, tableId, defaultKey, defaultDir) {
  const { key, dir } = State.getSort(tableId);
  const k = key || defaultKey;
  const d = key ? dir : defaultDir;
  return [...data].sort((a,b) => {
    const av = a[k], bv = b[k];
    if (av === undefined) return 1;
    if (bv === undefined) return -1;
    const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return d === 'asc' ? cmp : -cmp;
  });
}

// ══════════════════════════════════════════════════════════════
// ACHIEVEMENT CHECKS
// ══════════════════════════════════════════════════════════════
function _checkBadge(badgeId) {
  const p = pid();
  const already = DB.g('achievements').find(a => a.profileId === p && a.badgeId === badgeId);
  if (already) return;
  const all = DB.gAll('achievements');
  all.push({ id: DB.nid(all), profileId: p, badgeId, earnedAt: D.now() });
  DB.s('achievements', all);
  const b = C.BADGES.find(x => x.id === badgeId);
  if (b) successPopup(b.icon + ' ' + b.label, b.desc, 'achievement');
  Notifs.add(State.user.id, 'Badge Earned: ' + b?.label, b?.desc || '', 'achievement');
}

function _checkGlucoseAchievements() {
  const p    = pid();
  const logs = DB.g('glucoseLogs').filter(l => l.profileId === p);
  if (logs.length >= 1) _checkBadge('first_log');

  // Streak check
  let streak = 0;
  for (let i = 0; i < 90; i++) {
    if (logs.some(l => l.date === D.daysAgo(i))) streak++;
    else break;
  }
  if (streak >= 7)  _checkBadge('streak_7');
  if (streak >= 30) _checkBadge('streak_30');
  if (streak >= 90) _checkBadge('streak_90');

  // In-range 7 consecutive days
  let inRangeStreak = 0;
  for (let i = 0; i < 30; i++) {
    const dayLogs = logs.filter(l => l.date === D.daysAgo(i));
    if (dayLogs.length && dayLogs.every(l => l.value >= C.GLUCOSE.NORMAL_LOW && l.value <= C.GLUCOSE.NORMAL_HIGH)) {
      inRangeStreak++;
    } else if (dayLogs.length) {
      break; // out of range day breaks streak
    }
  }
  if (inRangeStreak >= 7) _checkBadge('in_range_7');

  // Weight down badge
  const wtLogs = DB.g('weightLogs').filter(l => l.profileId === p).sort((a,b) => a.date.localeCompare(b.date));
  if (wtLogs.length >= 2 && wtLogs[wtLogs.length-1].value < wtLogs[0].value) _checkBadge('weight_down');
}

// ══════════════════════════════════════════════════════════════
// VIEW MODALS (👁️ preview)
// ══════════════════════════════════════════════════════════════
function viewGlucose(id) {
  const l = DB.g('glucoseLogs').find(x => x.id === id);
  if (!l) return;
  const s = Calc.glucLabel(l.value);
  openViewModal('🩸 Glucose Reading', [
    ['Date',    D.fmt(l.date)],
    ['Time',    l.time],
    ['Type',    l.type],
    ['Value',   `<strong style="color:${Calc.glucColor(l.value)}">${Units.gluc(l.value, prefs())}</strong>`],
    ['Status',  `<span class="badge badge-${s.cls}">${s.label}</span>`],
    ['Notes',   l.notes || '—'],
  ]);
}

function viewWeight(id) {
  const l = DB.g('weightLogs').find(x => x.id === id);
  if (!l) return;
  openViewModal('⚖️ Weight Entry', [
    ['Date',       D.fmt(l.date)],
    ['Weight (kg)', l.value + ' kg'],
    ['Weight (lbs)', Units.wt(l.value, { weightUnit: 'lbs' })],
    ['Notes',      l.notes || '—'],
  ]);
}

function viewMeal(id) {
  const l = DB.g('mealLogs').find(x => x.id === id);
  if (!l) return;
  openViewModal('🍽️ Meal Log', [
    ['Date',        D.fmt(l.date)],
    ['Meal Type',   l.mealType],
    ['Description', l.description],
    ['Carbs',       l.carbsG ? l.carbsG + ' g' : '—'],
    ['Calories',    l.caloriesKcal ? l.caloriesKcal + ' kcal' : '—'],
    ['Notes',       l.notes || '—'],
  ]);
}

function viewExercise(id) {
  const l = DB.g('exerciseLogs').find(x => x.id === id);
  if (!l) return;
  openViewModal('🏃 Exercise Log', [
    ['Date',      D.fmt(l.date)],
    ['Type',      l.type],
    ['Duration',  l.duration + ' min'],
    ['Intensity', l.intensity],
    ['Steps',     l.steps ? l.steps.toLocaleString() : '—'],
    ['Notes',     l.notes || '—'],
  ]);
}

function viewInsulin(id) {
  const l = DB.g('insulinLogs').find(x => x.id === id);
  if (!l) return;
  openViewModal('💉 Insulin Log', [
    ['Date',         D.fmt(l.date)],
    ['Time',         l.time],
    ['Insulin Type', l.insulinType],
    ['Units',        l.units + ' U'],
    ['Site',         l.site || '—'],
    ['Notes',        l.notes || '—'],
  ]);
}

function viewSleep(id) {
  const l = DB.g('sleepLogs').find(x => x.id === id);
  if (!l) return;
  const qual = ['','⭐','⭐⭐','⭐⭐⭐','⭐⭐⭐⭐','⭐⭐⭐⭐⭐'][l.quality] || '—';
  openViewModal('😴 Sleep & Stress Log', [
    ['Date',          D.fmt(l.date)],
    ['Sleep Hours',   l.hours + ' h'],
    ['Quality',       qual],
    ['Stress Level',  l.stress + ' / 10'],
    ['Notes',         l.notes || '—'],
  ]);
}

function viewNote(id) {
  const n = DB.g('notes').find(x => x.id === id);
  if (!n) return;
  const sympHtml = n.symptoms?.length
    ? n.symptoms.map(s => `<span class="symptom-tag">${esc(s)}</span>`).join(' ')
    : '—';
  openViewModal('📝 Journal Entry', [
    ['Date',     D.fmt(n.date)],
    ['Entry',    esc(n.text)],
    ['Symptoms', sympHtml],
  ]);
}
