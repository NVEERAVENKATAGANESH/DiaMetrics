// DiaMetrics — profile.js  (patient profiles, multi-profile, BMI)
'use strict';

// ── Render profiles page ───────────────────────────────────────────────
function rProfiles() {
  const uid      = State.user.id;
  const profiles = DB.g('profiles').filter(p => p.userId === uid);
  const cont     = $('profiles-list');
  if (!cont) return;

  if (!profiles.length) {
    cont.innerHTML = emptyState('👤', 'No profiles yet', 'Add a profile to start tracking.');
    return;
  }

  const active = profiles.find(p => p.id === State.activeProfile) || profiles[0];
  const others = profiles.filter(p => p.id !== active.id);

  cont.innerHTML = _renderActiveProfile(active) +
    (others.length ? `<div class="prof-page-section-title">Other Profiles</div>
      <div class="prof-other-grid">${others.map(_renderOtherCard).join('')}</div>` : '');

  // Activate first tab
  _profPageTab('overview');
}

function _profStats(p) {
  const pid     = p.id;
  const logs30  = DB.g('glucoseLogs').filter(l => l.profileId === pid && l.date >= D.daysAgo(29));
  const allLogs = DB.g('glucoseLogs').filter(l => l.profileId === pid);
  const vals    = logs30.map(l => l.value);
  const tir     = Calc.timeInRange(logs30);
  const avgG    = avg(vals);
  const estA1c  = Model.estimatedA1c(logs30);
  const wLogs   = DB.g('weightLogs').filter(l => l.profileId === pid).sort((a,b) => b.date.localeCompare(a.date));
  const lastW   = wLogs[0]?.value;
  const bmi     = (p.heightCm && lastW) ? Calc.bmi(lastW, p.heightCm) : (p.heightCm && p.weightKg ? Calc.bmi(p.weightKg, p.heightCm) : null);
  const bmiInf  = bmi ? Calc.bmiLabel(bmi) : null;
  const meds    = DB.g('medications').filter(m => m.profileId === pid && m.active);
  const goals   = DB.g('goals').filter(g => g.profileId === pid);
  const doneG   = goals.filter(g => g.achieved).length;
  return { logs30, allLogs, vals, tir, avgG, estA1c, bmi, bmiInf, meds, goals, doneG };
}

function _renderActiveProfile(p) {
  const age    = p.dob ? Math.floor((Date.now() - new Date(p.dob)) / (365.25*24*3600*1000)) : null;
  const s      = _profStats(p);
  const tirCls = s.tir >= 70 ? 'ok' : s.tir >= 50 ? 'warn' : 'err';

  const avatar = p.photo
    ? `<img src="${p.photo}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : `<span style="font-size:2rem;font-weight:700;color:#fff">${(p.name||'?')[0].toUpperCase()}</span>`;

  const hero = `
    <div class="prof-page-hero">
      <div class="prof-page-avatar">${avatar}</div>
      <div class="prof-page-hero-info">
        <div class="prof-page-name">${esc(p.name)} <span class="badge badge-p" style="font-size:.7rem;vertical-align:middle">Active</span></div>
        <div class="prof-page-meta">
          ${p.label ? `<span>${esc(p.label)}</span>` : ''}
          ${p.gender ? `<span>${esc(p.gender)}</span>` : ''}
          ${age !== null ? `<span>Age ${age}</span>` : ''}
          ${p.dob ? `<span>Born ${D.fmt(p.dob)}</span>` : ''}
        </div>
        ${p.doctor ? `<div class="prof-page-doctor">👨‍⚕️ ${esc(p.doctor)}${p.doctorPhone ? ' · ' + esc(p.doctorPhone) : ''}</div>` : ''}
      </div>
      <div class="prof-page-hero-actions">
        <button class="btn btn-p" onclick="openEditProfile(${p.id})">${ICONS.edit} Edit Profile</button>
        <button class="btn btn-g" onclick="setProfilePIN(${p.id})">${p.pinHash ? '🔒 Change PIN' : '🔓 Set PIN'}</button>
        ${!p.isDefault ? `<button class="btn btn-danger btn-sm" onclick="deleteProfile(${p.id})" title="Delete profile">${ICONS.del}</button>` : ''}
      </div>
    </div>`;

  const statsRow = `
    <div class="stats-grid" style="margin-bottom:0">
      <div class="stat-card"><div class="stat-value stat-${tirCls}">${s.tir}%</div><div class="stat-label">Time in Range (30d)</div></div>
      <div class="stat-card"><div class="stat-value">${s.avgG ?? '—'}</div><div class="stat-label">Avg Glucose (30d)</div></div>
      <div class="stat-card"><div class="stat-value">${s.estA1c ? s.estA1c + '%' : '—'}</div><div class="stat-label">Est. HbA1c</div></div>
      <div class="stat-card"><div class="stat-value ${s.bmiInf ? 'stat-' + s.bmiInf.cls : ''}">${s.bmi ?? '—'}</div><div class="stat-label">BMI${s.bmiInf ? ' · ' + s.bmiInf.label : ''}</div></div>
      <div class="stat-card"><div class="stat-value">${s.meds.length}</div><div class="stat-label">Active Medications</div></div>
      <div class="stat-card"><div class="stat-value">${s.doneG}/${s.goals.length}</div><div class="stat-label">Goals Achieved</div></div>
    </div>`;

  const tabs = `
    <div class="prof-page-tabs">
      <button class="prof-page-tab on" id="pptab-overview"  onclick="_profPageTab('overview')">Overview</button>
      <button class="prof-page-tab"    id="pptab-health"    onclick="_profPageTab('health')">Health Details</button>
      <button class="prof-page-tab"    id="pptab-history"   onclick="_profPageTab('history')">Medical History</button>
      <button class="prof-page-tab"    id="pptab-security"  onclick="_profPageTab('security')">Security &amp; Settings</button>
    </div>`;

  // Overview pane
  const overviewPane = `<div class="prof-page-pane" id="pppane-overview">
    <div class="prof-detail-grid">
      ${_profField('Height', p.heightCm ? p.heightCm + ' cm' : '—')}
      ${_profField('Weight', p.weightKg ? p.weightKg + ' kg' : '—')}
      ${_profField('BMI', s.bmi ? s.bmi + (s.bmiInf ? ' (' + s.bmiInf.label + ')' : '') : '—')}
      ${_profField('Date of Birth', p.dob ? D.fmt(p.dob) : '—')}
      ${_profField('Gender', p.gender || '—')}
      ${_profField('Age', age !== null ? age + ' years' : '—')}
      ${_profField('Physician', p.doctor || '—')}
      ${_profField('Physician Phone', p.doctorPhone || '—')}
      ${_profField('Total Readings', s.allLogs.length + ' all time')}
      ${_profField('Readings (30d)', s.vals.length)}
    </div>
  </div>`;

  // Health details pane
  const labs = DB.g('labResults').filter(l => l.profileId === p.id).sort((a,b) => b.date.localeCompare(a.date));
  const latestLabs = {};
  labs.forEach(l => { if (!latestLabs[l.test]) latestLabs[l.test] = l; });
  const labRows = Object.values(latestLabs).slice(0, 6).map(l => {
    const s2 = labStatus(l.test, l.value);
    return `<div class="prof-detail-field">
      <div class="prof-detail-label">${esc(l.test)}</div>
      <div class="prof-detail-value"><span class="badge badge-${s2.cls}">${l.value}</span> <span style="color:var(--text2);font-size:.8rem">${D.fmt(l.date)}</span></div>
    </div>`;
  }).join('') || `<div style="color:var(--text2);font-size:.88rem;padding:8px 0">No lab results recorded yet.</div>`;

  const medRows = s.meds.map(m =>
    `<div class="prof-detail-field">
      <div class="prof-detail-label">${esc(m.name)} <span style="color:var(--text2);font-size:.78rem">${esc(m.dosage)}</span></div>
      <div class="prof-detail-value" style="color:var(--text2);font-size:.82rem">${esc(m.frequency)}</div>
    </div>`
  ).join('') || `<div style="color:var(--text2);font-size:.88rem;padding:8px 0">No active medications.</div>`;

  const healthPane = `<div class="prof-page-pane" id="pppane-health" style="display:none">
    <div class="prof-detail-section-title">Latest Lab Results</div>
    <div class="prof-detail-grid">${labRows}</div>
    <div class="prof-detail-section-title" style="margin-top:20px">Active Medications</div>
    <div class="prof-detail-grid">${medRows}</div>
  </div>`;

  // Medical history pane
  const historyPane = `<div class="prof-page-pane" id="pppane-history" style="display:none">
    <div class="prof-detail-grid">
      ${_profCheckField('Family history of diabetes', p.familyDiabetes)}
      ${_profCheckField('Hypertension', p.hypertension)}
      ${_profCheckField('Gestational diabetes history', p.gestationalDiabetes)}
    </div>
    <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn btn-sm btn-g" onclick="go('glucose')">View Glucose Logs</button>
      <button class="btn btn-sm btn-g" onclick="go('medications')">View Medications</button>
      <button class="btn btn-sm btn-g" onclick="go('labs')">View Lab Results</button>
      <button class="btn btn-sm btn-g" onclick="go('reports')">Download Report</button>
    </div>
  </div>`;

  const securityPane = `<div class="prof-page-pane" id="pppane-security" style="display:none">
    <div class="prof-detail-grid" style="margin-bottom:20px">
      ${_profField('Username', State.user?.username || '—')}
      ${_profField('Display Name', State.user?.displayName || State.user?.username || '—')}
      ${_profField('Profile PIN', p.pinHash ? 'Set ✓' : 'Not set')}
      ${_profField('Session', 'Stored locally on this device')}
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;max-width:340px">
      <button class="btn btn-p" onclick="openM('m-change-pw')" style="justify-content:center">🔒 Change Password</button>
      <button class="btn btn-g" onclick="setProfilePIN(${p.id})" style="justify-content:center">${p.pinHash ? '🔒 Change / Remove PIN' : '🔓 Set Profile PIN'}</button>
      <button class="btn btn-g" onclick="go('settings')" style="justify-content:center">⚙️ App Settings</button>
      <button class="btn btn-g" onclick="go('auditlog')" style="justify-content:center">📋 Audit Log</button>
      <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:4px">
        <button class="btn btn-danger" onclick="confirmDlg('Sign out of DiaMetrics?', logout, false, 'Sign Out')" style="width:100%;justify-content:center">🚪 Sign Out</button>
      </div>
    </div>
  </div>`;

  return `<div class="prof-page-card">
    ${hero}
    <div style="padding:20px 24px 4px">${statsRow}</div>
    <div style="padding:0 24px">${tabs}</div>
    <div style="padding:0 24px 24px">${overviewPane}${healthPane}${historyPane}${securityPane}</div>
  </div>`;
}

function _profField(label, value) {
  return `<div class="prof-detail-field">
    <div class="prof-detail-label">${label}</div>
    <div class="prof-detail-value">${esc(String(value))}</div>
  </div>`;
}

function _profCheckField(label, checked) {
  const icon = checked
    ? `<span style="color:var(--green);font-weight:600">✓ Yes</span>`
    : `<span style="color:var(--text3)">✗ No</span>`;
  return `<div class="prof-detail-field">
    <div class="prof-detail-label">${label}</div>
    <div class="prof-detail-value">${icon}</div>
  </div>`;
}

function _profPageTab(name) {
  document.querySelectorAll('.prof-page-tab').forEach(t => t.classList.remove('on'));
  document.querySelectorAll('.prof-page-pane').forEach(p => p.style.display = 'none');
  const tab  = $('pptab-' + name);
  const pane = $('pppane-' + name);
  if (tab)  tab.classList.add('on');
  if (pane) pane.style.display = '';
}

function _renderOtherCard(p) {
  const age    = p.dob ? Math.floor((Date.now() - new Date(p.dob)) / (365.25*24*3600*1000)) : '—';
  const s      = _profStats(p);
  const tirCls = s.tir >= 70 ? 'ok' : s.tir >= 50 ? 'warn' : 'err';
  const avatar = p.photo
    ? `<img src="${p.photo}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : `<span style="font-size:1.2rem;font-weight:700;color:#fff">${(p.name||'?')[0].toUpperCase()}</span>`;

  return `<div class="prof-other-card">
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
      <div class="prof-other-avatar">${avatar}</div>
      <div>
        <div style="font-weight:600;font-size:.95rem">${esc(p.name)}</div>
        <div style="font-size:.8rem;color:var(--text2)">${esc(p.label||'')} · Age ${age}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
      <div class="stat-card" style="padding:10px 12px">
        <div class="stat-value stat-${tirCls}" style="font-size:1.2rem">${s.tir}%</div>
        <div class="stat-label" style="font-size:.72rem">Time in Range</div>
      </div>
      <div class="stat-card" style="padding:10px 12px">
        <div class="stat-value" style="font-size:1.2rem">${s.avgG ?? '—'}</div>
        <div class="stat-label" style="font-size:.72rem">Avg Glucose</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-sm btn-p" onclick="switchProfile(${p.id})" style="flex:1">Switch to</button>
      <button class="btn-icon btn-icon-edit" onclick="openEditProfile(${p.id})" title="Edit">${ICONS.edit}</button>
      ${!p.isDefault ? `<button class="btn-icon btn-icon-del" onclick="deleteProfile(${p.id})" title="Delete">${ICONS.del}</button>` : ''}
    </div>
  </div>`;
}

// ── Switch active profile (PIN-aware) ────────────────────────────────
function switchProfile(pid) {
  const p = DB.g('profiles').find(x => x.id === pid);
  if (!p) return;
  if (p.pinHash) {
    _promptPIN(pid);
  } else {
    _activateProfile(pid);
  }
}

function _activateProfile(pid) {
  const exists = DB.g('profiles').find(p => p.id === pid);
  if (!exists) { toast('Profile not found', false); return; }
  State.activeProfile = pid;
  rProfiles();
  if (typeof rDashboard === 'function') rDashboard();
  toast('Switched profile', true);
}

// PIN prompt dialog
function _promptPIN(pid) {
  const existing = $('m-pin-prompt');
  if (existing) existing.remove();
  const div = document.createElement('div');
  div.id = 'm-pin-prompt';
  div.className = 'mbg open';
  div.style.display = 'flex';
  div.innerHTML = `
    <div class="modal modal-sm">
      <div class="mhdr"><h2>🔒 Profile PIN</h2></div>
      <div class="mbody">
        <p style="margin-bottom:12px;color:var(--text2);font-size:.88rem">This profile is PIN-protected. Enter the 4-digit PIN to switch.</p>
        <input type="password" id="pin-entry" maxlength="4" inputmode="numeric" pattern="[0-9]*"
               placeholder="••••" style="font-size:1.5rem;letter-spacing:8px;text-align:center" autofocus>
        <div id="pin-err" class="field-err" style="text-align:center"></div>
      </div>
      <div class="mftr">
        <button class="btn btn-g" onclick="$('m-pin-prompt').remove()">Cancel</button>
        <button class="btn btn-p" onclick="_verifyPIN(${pid})">Unlock</button>
      </div>
    </div>`;
  document.body.appendChild(div);
  setTimeout(() => $('pin-entry')?.focus(), 50);
  $('pin-entry').onkeydown = e => { if (e.key === 'Enter') _verifyPIN(pid); };
}

async function _verifyPIN(pid) {
  const entered = $('pin-entry')?.value || '';
  if (!/^\d{4}$/.test(entered)) { $('pin-err').textContent = 'Enter a 4-digit PIN'; $('pin-err').style.display='block'; return; }
  const p = DB.g('profiles').find(x => x.id === pid);
  const hash = await sha256('pin:' + pid + ':' + entered);
  if (hash !== p.pinHash) {
    $('pin-err').textContent = 'Incorrect PIN'; $('pin-err').style.display='block';
    $('pin-entry').value = '';
    return;
  }
  $('m-pin-prompt').remove();
  _activateProfile(pid);
}

// Set / remove profile PIN
async function setProfilePIN(pid) {
  const pin1 = prompt('Set a 4-digit PIN for this profile (leave blank to remove PIN):');
  if (pin1 === null) return;
  if (pin1 === '') {
    DB.update('profiles', arr => arr.map(p => p.id === pid ? { ...p, pinHash: null } : p));
    rProfiles();
    toast('PIN removed', true);
    return;
  }
  if (!/^\d{4}$/.test(pin1)) { toast('PIN must be exactly 4 digits', false); return; }
  const pin2 = prompt('Confirm PIN:');
  if (pin1 !== pin2) { toast('PINs do not match', false); return; }
  const hash = await sha256('pin:' + pid + ':' + pin1);
  DB.update('profiles', arr => arr.map(p => p.id === pid ? { ...p, pinHash: hash } : p));
  rProfiles();
  toast('PIN set', true);
}

// ── Open add/edit profile modal ───────────────────────────────────────
function openAddProfile() {
  $('pf-id').value    = 0;
  $('pf-name').value  = '';
  $('pf-label').value = '';
  $('pf-dob').value   = '';
  $('pf-gender').value= '';
  $('pf-height').value= '';
  $('pf-weight').value= '';
  $('pf-doctor').value= '';
  $('pf-docph').value = '';
  $('pf-fam-diab').checked  = false;
  $('pf-hyper').checked     = false;
  $('pf-gest').checked      = false;
  // Reset photo
  if ($('pf-photo-preview')) { $('pf-photo-preview').src = ''; $('pf-photo-preview').style.display = 'none'; }
  if ($('pf-photo-data'))    $('pf-photo-data').value = '';
  if ($('pf-photo-inp'))     $('pf-photo-inp').value  = '';
  clearAllErrors('pf-form');
  openM('m-profile');
}

function openEditProfile(pid) {
  const p = DB.g('profiles').find(x => x.id === pid);
  if (!p) return;
  $('pf-id').value     = pid;
  $('pf-name').value   = p.name    || '';
  $('pf-label').value  = p.label   || '';
  $('pf-dob').value    = p.dob     || '';
  $('pf-gender').value = p.gender  || '';
  $('pf-height').value = p.heightCm|| '';
  $('pf-weight').value = p.weightKg|| '';
  $('pf-doctor').value = p.doctor  || '';
  $('pf-docph').value  = p.doctorPhone || '';
  $('pf-fam-diab').checked = !!p.familyDiabetes;
  $('pf-hyper').checked    = !!p.hypertension;
  $('pf-gest').checked     = !!p.gestationalDiabetes;
  // Pre-fill photo
  if ($('pf-photo-preview')) {
    if (p.photo) { $('pf-photo-preview').src = p.photo; $('pf-photo-preview').style.display = 'block'; }
    else         { $('pf-photo-preview').src = ''; $('pf-photo-preview').style.display = 'none'; }
  }
  if ($('pf-photo-data')) $('pf-photo-data').value = p.photo || '';
  if ($('pf-photo-inp'))  $('pf-photo-inp').value  = '';
  clearAllErrors('pf-form');
  openM('m-profile');
}

function saveProfile() {
  const d = {
    name:    ($('pf-name')?.value   || '').trim(),
    label:   ($('pf-label')?.value  || '').trim(),
    dob:     $('pf-dob')?.value     || '',
    gender:  $('pf-gender')?.value  || '',
    heightCm:+($('pf-height')?.value|| 0),
    weightKg:+($('pf-weight')?.value|| 0),
    doctor:  ($('pf-doctor')?.value || '').trim(),
    doctorPhone: ($('pf-docph')?.value || '').trim(),
    familyDiabetes:     !!$('pf-fam-diab')?.checked,
    hypertension:       !!$('pf-hyper')?.checked,
    gestationalDiabetes:!!$('pf-gest')?.checked,
    photo:   $('pf-photo-data')?.value || '',
  };
  if (!Validate.profile(d)) return;

  const pid  = +($('pf-id')?.value || 0);
  const uid  = State.user.id;
  const isAdd = !pid;

  if (isAdd) {
    const all = DB.gAll('profiles');
    const np  = { id: DB.nid(all), userId: uid, ...d, isDefault: false, createdAt: D.now() };
    all.push(np);
    DB.s('profiles', all);
    clearDraft('m-profile');
    closeM('m-profile');
    rProfiles();
    toast('Profile added', true);
  } else {
    const old = DB.gAll('profiles').map(p => p.id === pid ? { ...p, ...d } : p);
    DB.s('profiles', old);
    closeM('m-profile');
    rProfiles();
    toast('Profile updated', true);
  }
}

function deleteProfile(pid) {
  confirmDlg('Delete this profile? All associated logs will remain but be unlinked.', () => {
    const snap = DB.gAll('profiles');
    DB.update('profiles', arr => arr.filter(p => p.id !== pid));
    if (State.activeProfile === pid) {
      const remaining = DB.g('profiles').filter(p => p.userId === State.user.id);
      State.activeProfile = remaining[0]?.id || null;
    }
    rProfiles();
    toastUndo('Profile deleted', () => {
      DB.s('profiles', snap);
      rProfiles();
    });
  }, true, 'Delete');
}

// ── Profile photo upload (base64) ─────────────────────────────────────
function uploadProfilePhoto() {
  const file = $('pf-photo-inp')?.files?.[0];
  if (!file) return;
  if (file.size > 200 * 1024) { toast('Photo must be under 200 KB', false); return; }
  const reader = new FileReader();
  reader.onload = e => {
    const preview = $('pf-photo-preview');
    if (preview) { preview.src = e.target.result; preview.style.display = 'block'; }
    $('pf-photo-data') && ($('pf-photo-data').value = e.target.result);
  };
  reader.readAsDataURL(file);
}
