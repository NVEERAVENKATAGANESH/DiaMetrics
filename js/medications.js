// DiaMetrics — medications.js
'use strict';

function rMedications() {
  const cont = $('med-list');
  if (!cont) return;
  const pid  = State.activeProfile;
  const meds = DB.g('medications').filter(m => m.profileId === pid);

  if (!meds.length) {
    cont.innerHTML = emptyState('💊','No medications','Add your medications and supplements to track adherence.','<button class="btn btn-p" onclick="openAddMed()" style="margin-top:12px">+ Add Medication</button>');
    return;
  }

  const today = D.today();
  const doses = DB.g('medDoses').filter(d => d.profileId === pid && d.date === today);

  cont.innerHTML = meds.map(m => {
    const dose    = doses.find(d => d.medicationId === m.id);
    const taken   = dose?.taken;
    const refDays = m.refillDate ? D.diffDays(today, m.refillDate) : null;
    const refWarn = refDays !== null && refDays <= 7 && refDays >= 0;
    const adherence = _adherence(m.id, pid);

    return `
    <div class="med-card ${m.active ? '' : 'med-inactive'}" id="medc-${m.id}">
      <div class="med-card-header">
        <div class="med-card-name">
          <strong>${esc(m.name)}</strong>
          <span class="med-dose-badge">${esc(m.dosage)}</span>
          ${!m.active ? '<span class="badge badge-warn">Inactive</span>' : ''}
        </div>
        <div class="med-card-actions">
          ${actionBtns(m.id,'viewMed','openEditMed','deleteMed')}
        </div>
      </div>
      <div class="med-card-body">
        <div class="med-info-row">
          <span>📅 ${esc(m.frequency)}</span>
          <span>⏰ ${esc(m.timeOfDay || '—')}</span>
          <span>📆 Started ${D.fmt(m.startDate)}</span>
          ${refWarn ? `<span class="refill-warn">⚠️ Refill in ${refDays}d</span>` : ''}
        </div>
        ${m.notes ? `<div class="med-notes">${esc(m.notes)}</div>` : ''}
        <div class="med-footer">
          <div class="adherence-bar-wrap">
            <span>7-day adherence</span>
            <div class="adherence-bar"><div class="adherence-fill" style="width:${adherence}%;background:${adherence>=80?'#10b981':adherence>=60?'#f59e0b':'#ef4444'}"></div></div>
            <span>${adherence}%</span>
          </div>
          ${m.active ? `
          <button class="btn btn-sm ${taken?'btn-g':'btn-p'}" onclick="toggleMedDose(${m.id})">
            ${taken ? '✓ Taken today' : 'Mark as Taken'}
          </button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');

  // Adherence chart (last 7 days)
  _renderAdherenceChart();
}

function _adherence(medId, pid) {
  const days   = 7;
  let taken    = 0;
  for (let i = 0; i < days; i++) {
    const date = D.daysAgo(i);
    const dose = DB.g('medDoses').find(d => d.profileId === pid && d.medicationId === medId && d.date === date);
    if (dose?.taken) taken++;
  }
  return Math.round((taken / days) * 100);
}

function _renderAdherenceChart() {
  const pid  = State.activeProfile;
  const meds = DB.g('medications').filter(m => m.profileId === pid && m.active);
  if (!meds.length) return;

  const labels  = meds.map(m => m.name.length > 12 ? m.name.slice(0,12)+'…' : m.name);
  const values  = meds.map(m => _adherence(m.id, pid));
  const colors  = values.map(v => v >= 80 ? '#10b981' : v >= 60 ? '#f59e0b' : '#ef4444');

  Charts.bar('med-adh-chart', labels,
    [{ label:'Adherence %', data: values, backgroundColor: colors, borderColor: colors, borderWidth:0 }],
    { scales: { y: { min:0, max:100 } }, plugins: { legend:{display:false} } }
  );
}

function toggleMedDose(medId) {
  const pid  = State.activeProfile;
  const date = D.today();
  const all  = DB.gAll('medDoses');
  const idx  = all.findIndex(d => d.profileId === pid && d.medicationId === medId && d.date === date);
  if (idx === -1) {
    all.push({ id: DB.nid(all), profileId: pid, medicationId: medId, date, taken: true });
  } else {
    all[idx].taken = !all[idx].taken;
  }
  DB.s('medDoses', all);
  rMedications();

  // Check meds_7 badge
  const taken7 = (() => {
    let total = 0, days = 0;
    for (let i = 0; i < 7; i++) {
      const d = D.daysAgo(i);
      const doses = DB.g('medDoses').filter(x => x.profileId === pid && x.date === d);
      if (doses.length) { days++; total += doses.filter(x=>x.taken).length / doses.length; }
    }
    return days > 0 ? total / days : 0;
  })();
  if (taken7 >= 0.9) _checkBadge('meds_7');
}

function openAddMed() {
  $('med-id').value     = 0;
  $('med-name').value   = '';
  $('med-dose').value   = '';
  $('med-freq').value   = '';
  $('med-tod').value    = '';
  $('med-start').value  = D.today();
  $('med-refill').value = '';
  $('med-active').checked = true;
  $('med-notes').value  = '';
  clearAllErrors('med-form');
  openM('m-medication');
}

function openEditMed(id) {
  const m = DB.g('medications').find(x => x.id === id);
  if (!m) return;
  $('med-id').value     = id;
  $('med-name').value   = m.name;
  $('med-dose').value   = m.dosage;
  $('med-freq').value   = m.frequency;
  $('med-tod').value    = m.timeOfDay || '';
  $('med-start').value  = m.startDate;
  $('med-refill').value = m.refillDate || '';
  $('med-active').checked = !!m.active;
  $('med-notes').value  = m.notes || '';
  clearAllErrors('med-form');
  openM('m-medication');
}

function saveMed() {
  const d = {
    name:       ($('med-name')?.value   || '').trim(),
    dosage:     ($('med-dose')?.value   || '').trim(),
    frequency:  $('med-freq')?.value    || '',
    timeOfDay:  ($('med-tod')?.value    || '').trim(),
    startDate:  $('med-start')?.value   || '',
    refillDate: $('med-refill')?.value  || '',
    active:     !!$('med-active')?.checked,
    notes:      ($('med-notes')?.value  || '').trim(),
  };
  if (!Validate.medication(d)) return;

  const id    = +($('med-id')?.value || 0);
  const pid   = State.activeProfile;
  const isAdd = !id;

  if (isAdd) {
    const all = DB.gAll('medications');
    const rec = { id: DB.nid(all), profileId: pid, ...d };
    all.push(rec);
    DB.s('medications', all);
    DB.audit('create', 'medications', rec.id, `Added ${d.name} ${d.dosage}`);
    clearDraft('m-medication');
    closeM('m-medication');
    rMedications();
    toast('Medication added', true);
    if (typeof Reminders !== 'undefined') Reminders.scheduleDaily();
  } else {
    const snap = DB.gAll('medications');
    DB.update('medications', arr => arr.map(r => r.id === id ? { ...r, ...d } : r));
    DB.audit('update', 'medications', id, `Updated ${d.name}`);
    closeM('m-medication');
    rMedications();
    if (State.page === 'dashboard') rDashboard();
    toastUndo('Medication updated', () => {
      DB.s('medications', snap);
      rMedications();
      if (State.page === 'dashboard') rDashboard();
    });
  }
}

function deleteMed(id) {
  confirmDlg('Delete this medication?', () => {
    const snap = DB.gAll('medications');
    const m = snap.find(r => r.id === id);
    DB.audit('delete', 'medications', id, `Deleted ${m?.name || 'medication'}`);
    fadeDeleteRow('medc-' + id, () => {
      DB.update('medications', arr => arr.filter(r => r.id !== id));
      rMedications();
      if (State.page === 'dashboard') rDashboard();
      toastUndo('Medication deleted', () => {
        DB.s('medications', snap);
        rMedications();
        if (State.page === 'dashboard') rDashboard();
      });
    });
  }, true, 'Delete');
}

function viewMed(id) {
  const m = DB.g('medications').find(x => x.id === id);
  if (!m) return;
  const adherence = _adherence(m.id, State.activeProfile);
  openViewModal('💊 Medication Detail', [
    ['Name',        m.name],
    ['Dosage',      m.dosage],
    ['Frequency',   m.frequency],
    ['Time of Day', m.timeOfDay || '—'],
    ['Start Date',  D.fmt(m.startDate)],
    ['Refill Date', m.refillDate ? D.fmt(m.refillDate) : '—'],
    ['Status',      m.active ? '<span class="badge badge-ok">Active</span>' : '<span class="badge badge-warn">Inactive</span>'],
    ['7-Day Adherence', adherence + '%'],
    ['Notes',       m.notes || '—'],
  ]);
}
