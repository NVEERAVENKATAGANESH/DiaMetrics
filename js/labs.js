// DiaMetrics — labs.js  (lab results tracker)
'use strict';

function rLabs() {
  const tbody = $('lr-tbody');
  if (!tbody) return;
  tbody.innerHTML = skeleton(4, 5);
  requestAnimationFrame(() => {
    let data = DB.g('labResults').filter(l => l.profileId === State.activeProfile);
    data = [...data].sort((a,b) => b.date.localeCompare(a.date));

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="5">${emptyState('🧪','No lab results','Add your blood test results to track trends.','<button class="btn btn-p" onclick="openAddLab()" style="margin-top:12px">+ Add Lab Result</button>')}</td></tr>`;
      return;
    }

    paginate(data, 'lr-tbody', sliced => {
      tbody.innerHTML = sliced.map(l => {
        const s = labStatus(l.test, l.value);
        const r = C.LAB_RANGES[l.test];
        return `<tr id="lrr-${l.id}">
          <td>${D.fmt(l.date)}</td>
          <td>${esc(l.test)}</td>
          <td><strong>${l.value}</strong> ${r ? r.unit : ''}</td>
          <td><span class="badge badge-${s.cls}">${s.label}</span></td>
          <td class="tbl-actions">
            ${actionBtns(l.id,'viewLabDetail','openEditLab','deleteLab')}
          </td>
        </tr>`;
      }).join('');
      makeSortable('lr-table', rLabs);
    });

    // ── HbA1c trend chart ───────────────────────────────────────
    _renderLabChart('HbA1c', 'lr-a1c-chart', P.purple);
    _renderLabChart('Fasting Glucose', 'lr-fg-chart', P.blue);
    _renderLabChart('Cholesterol (Total)', 'lr-chol-chart', P.amber);
    _renderLabChart('eGFR', 'lr-egfr-chart', P.teal);
  });
}

function _renderLabChart(testName, canvasId, color) {
  const data = DB.g('labResults')
    .filter(l => l.profileId === State.activeProfile && l.test === testName)
    .sort((a,b) => a.date.localeCompare(b.date));
  if (data.length < 2) return;
  Charts.line(canvasId,
    data.map(l => D.fmt(l.date)),
    [{ label: testName, data: data.map(l => l.value), borderColor: color, fill: false }],
    { plugins: { legend: { display: false } } }
  );
}

function openAddLab() {
  $('lr-id').value    = 0;
  $('lr-date').value  = D.today();
  $('lr-test').value  = '';
  $('lr-value').value = '';
  $('lr-notes').value = '';
  _updateLabUnit();
  clearAllErrors('lr-form');
  openM('m-lab');
}

function openEditLab(id) {
  const l = DB.g('labResults').find(x => x.id === id);
  if (!l) return;
  $('lr-id').value    = id;
  $('lr-date').value  = l.date;
  $('lr-test').value  = l.test;
  $('lr-value').value = l.value;
  $('lr-notes').value = l.notes || '';
  _updateLabUnit();
  clearAllErrors('lr-form');
  openM('m-lab');
}

function _updateLabUnit() {
  const test = $('lr-test')?.value;
  const unitEl = $('lr-unit');
  if (!unitEl) return;
  const r = C.LAB_RANGES[test];
  unitEl.textContent = r ? r.unit : '';
  const diastolicGroup = $('lr-diastolic-group');
  if (diastolicGroup) {
    diastolicGroup.style.display = test === 'Systolic BP' ? 'block' : 'none';
  }
}

function saveLab() {
  const d = {
    date:  $('lr-date')?.value  || '',
    test:  $('lr-test')?.value  || '',
    value: +($('lr-value')?.value || 0),
    notes: ($('lr-notes')?.value || '').trim(),
  };
  if (!Validate.labResult(d)) return;

  const id    = +($('lr-id')?.value || 0);
  const pid   = State.activeProfile;
  const isAdd = !id;

  if (isAdd) {
    const all = DB.gAll('labResults');
    const rec = { id: DB.nid(all), profileId: pid, ...d };
    all.push(rec);
    DB.s('labResults', all);
    DB.audit('create', 'labResults', rec.id, `${d.test} = ${d.value} on ${d.date}`);
    // Auto-save diastolic BP if systolic was entered
    if (d.test === 'Systolic BP' && $('lr-diastolic')?.value) {
      const dVal = +$('lr-diastolic').value;
      if (dVal > 0) {
        const all2 = DB.gAll('labResults');
        const rec2 = { id: DB.nid(all2), profileId: pid, date: d.date,
                       test: 'Diastolic BP', value: dVal, notes: d.notes };
        all2.push(rec2);
        DB.s('labResults', all2);
      }
    }
    clearDraft('m-lab');
    closeM('m-lab');
    rLabs();
    flashRow('lrr-' + rec.id);
    toast('Lab result saved', true);
    if (d.test === 'HbA1c') _checkBadge('first_a1c');
    if (d.test === 'HbA1c' && d.value < C.A1C.TARGET) _checkBadge('low_a1c');
  } else {
    const snap = DB.gAll('labResults');
    DB.update('labResults', arr => arr.map(r => r.id === id ? { ...r, ...d } : r));
    DB.audit('update', 'labResults', id, `${d.test} updated to ${d.value}`);
    closeM('m-lab');
    rLabs();
    toastUndo('Lab result updated', () => {
      DB.s('labResults', snap);
      rLabs();
    });
  }
}

function deleteLab(id) {
  confirmDlg('Delete this lab result?', () => {
    const snap = DB.gAll('labResults');
    DB.audit('delete', 'labResults', id, `Lab result id=${id} deleted`);
    fadeDeleteRow('lrr-' + id, () => {
      DB.update('labResults', arr => arr.filter(r => r.id !== id));
      rLabs();
      toastUndo('Lab result deleted', () => {
        DB.s('labResults', snap);
        rLabs();
      });
    });
  }, true, 'Delete');
}

function viewLabDetail(id) {
  const l = DB.g('labResults').find(x => x.id === id);
  if (!l) return;
  const r = C.LAB_RANGES[l.test];
  const s = labStatus(l.test, l.value);
  openViewModal('Lab Result Detail', [
    ['Date',       D.fmt(l.date)],
    ['Test',       l.test],
    ['Value',      l.value + (r ? ' ' + r.unit : '')],
    ['Status',     `<span class="badge badge-${s.cls}">${s.label}</span>`],
    ['Normal Range', r ? `${r.normal[0]} – ${r.normal[1] < 999 ? r.normal[1] : '∞'} ${r.unit}` : '—'],
    ['Notes',      l.notes || '—'],
  ]);
}

// Badge checks delegate to logs.js _checkBadge (loaded first, full implementation)
