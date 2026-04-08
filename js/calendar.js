// DiaMetrics — calendar.js  (month view glucose heatmap)
'use strict';

let _calYear  = new Date().getFullYear();
let _calMonth = new Date().getMonth(); // 0-indexed

function rCalendar() {
  const pid = State.activeProfile;
  _renderCalHeader();
  _renderCalGrid(pid);
}

function _renderCalHeader() {
  const el = $('cal-month-label');
  if (el) {
    const d = new Date(_calYear, _calMonth, 1);
    el.textContent = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }
}

function calPrev() { _calMonth--; if (_calMonth < 0) { _calMonth = 11; _calYear--; } rCalendar(); }
function calNext() { _calMonth++; if (_calMonth > 11) { _calMonth = 0; _calYear++; } rCalendar(); }
function calToday() { _calYear = new Date().getFullYear(); _calMonth = new Date().getMonth(); rCalendar(); }

function _renderCalGrid(pid) {
  const grid = $('cal-grid');
  if (!grid) return;

  const glucLogs = DB.g('glucoseLogs').filter(l => l.profileId === pid);
  const mealLogs = DB.g('mealLogs').filter(l => l.profileId === pid);
  const exLogs   = DB.g('exerciseLogs').filter(l => l.profileId === pid);
  const medDoses = DB.g('medDoses').filter(l => l.profileId === pid);
  const meds     = DB.g('medications').filter(m => m.profileId === pid && m.active);

  const firstDay   = new Date(_calYear, _calMonth, 1).getDay();
  const daysInMonth = new Date(_calYear, _calMonth + 1, 0).getDate();
  const today       = D.today();

  let html = '';

  // Day-of-week headers
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => {
    html += `<div class="cal-dow">${d}</div>`;
  });

  // Empty cells before month start
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="cal-cell cal-empty"></div>';
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date   = `${_calYear}-${String(_calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const dayLogs = glucLogs.filter(l => l.date === date);
    const avgG    = dayLogs.length ? avg(dayLogs.map(l=>l.value)) : null;
    const color   = avgG ? Calc.glucColor(avgG) : null;
    const isToday = date === today;

    const hasMeal = mealLogs.some(l => l.date === date);
    const hasEx   = exLogs.some(l => l.date === date);
    const medTaken = meds.length ? medDoses.filter(d => d.date === date && d.taken).length : 0;
    const medTotal = meds.length;
    const medAdh   = medTotal ? medTaken / medTotal : null;

    html += `
    <div class="cal-cell ${isToday?'cal-today':''}" onclick="openCalDay('${date}')">
      <div class="cal-day-num ${isToday?'cal-today-num':''}">${day}</div>
      ${avgG ? `<div class="cal-gluc-dot" style="background:${color}" title="${avgG} mg/dL">${avgG}</div>` : ''}
      <div class="cal-icons">
        ${hasMeal ? '<span title="Meal logged">🍽️</span>' : ''}
        ${hasEx   ? '<span title="Exercise logged">🏃</span>' : ''}
        ${medAdh !== null && medAdh < 1 ? '<span title="Missed medication">💊</span>' : ''}
      </div>
    </div>`;
  }

  grid.innerHTML = html;
}

function openCalDay(date) {
  const pid      = State.activeProfile;
  const glucLogs = DB.g('glucoseLogs').filter(l => l.profileId === pid && l.date === date);
  const mealLogs = DB.g('mealLogs').filter(l => l.profileId === pid && l.date === date);
  const exLogs   = DB.g('exerciseLogs').filter(l => l.profileId === pid && l.date === date);
  const notes    = DB.g('notes').filter(n => n.profileId === pid && n.date === date);
  const medDoses   = DB.g('medDoses').filter(d => d.profileId === pid && d.date === date);
  const meds       = DB.g('medications').filter(m => m.profileId === pid && m.active);
  const insulinLogs = DB.g('insulinLogs').filter(l => l.profileId === pid && l.date === date);

  const existing = $('m-cal-day');
  if (existing) existing.remove();

  const div = document.createElement('div');
  div.id = 'm-cal-day';
  div.className = 'mbg open';
  div.style.display = 'flex';

  let body = `<h3 class="cal-day-title">${D.fmt(date)}</h3>`;

  body += `<div class="cal-day-section"><strong>🩸 Glucose Readings</strong>`;
  if (glucLogs.length) {
    body += `<table class="tbl"><thead><tr><th>Time</th><th>Type</th><th>Value</th><th>Status</th></tr></thead><tbody>
      ${glucLogs.sort((a,b)=>a.time.localeCompare(b.time)).map(l=>{
        const s=Calc.glucLabel(l.value);
        return `<tr><td>${l.time}</td><td>${esc(l.type)}</td><td>${l.value} mg/dL</td><td><span class="badge badge-${s.cls}">${s.label}</span></td></tr>`;
      }).join('')}
    </tbody></table>`;
  } else body += `<p class="muted">No readings</p>`;
  body += '</div>';

  if (mealLogs.length) {
    body += `<div class="cal-day-section"><strong>🍽️ Meals</strong><ul>
      ${mealLogs.map(m=>`<li>${esc(m.mealType)}: ${esc(m.description)}${m.carbsG?` (${m.carbsG}g carbs)`:''}</li>`).join('')}
    </ul></div>`;
  }

  if (exLogs.length) {
    body += `<div class="cal-day-section"><strong>🏃 Exercise</strong><ul>
      ${exLogs.map(e=>`<li>${esc(e.type)} — ${e.duration} min (${esc(e.intensity)})${e.steps?` · ${e.steps.toLocaleString()} steps`:''}</li>`).join('')}
    </ul></div>`;
  }

  if (insulinLogs.length) {
    body += `<div class="cal-day-section"><strong>💉 Insulin</strong><ul>
      ${insulinLogs.sort((a,b)=>a.time.localeCompare(b.time)).map(l=>`<li>${l.time} — ${esc(l.insulinType)}: ${l.units} units${l.notes?` (${esc(l.notes)})`:''}</li>`).join('')}
    </ul></div>`;
  }

  if (meds.length) {
    body += `<div class="cal-day-section"><strong>💊 Medications</strong><ul>
      ${meds.map(m=>{
        const dose = medDoses.find(d=>d.medicationId===m.id);
        return `<li>${esc(m.name)} ${m.dosage} — ${dose?.taken ? '✅ Taken' : '❌ Missed'}</li>`;
      }).join('')}
    </ul></div>`;
  }

  if (notes.length) {
    body += `<div class="cal-day-section"><strong>📝 Notes</strong>
      ${notes.map(n=>`<p>${esc(n.text)}</p>${n.symptoms?.length?`<div>${n.symptoms.map(s=>`<span class="symptom-tag">${esc(s)}</span>`).join('')}</div>`:''}`).join('')}
    </div>`;
  }

  div.innerHTML = `
    <div class="modal">
      <div class="mhdr">
        <h2>Day Detail</h2>
        <button class="mx" onclick="$('m-cal-day').remove()">×</button>
      </div>
      <div class="mbody">${body}</div>
      <div class="mftr" style="flex-wrap:wrap;gap:6px">
        <button class="btn btn-p btn-sm" onclick="openAddGlucose();$('gl-date')&&($('gl-date').value='${date}');$('m-cal-day').remove()">🩸 Glucose</button>
        <button class="btn btn-g btn-sm" onclick="openAddMeal();$('ml-date')&&($('ml-date').value='${date}');$('m-cal-day').remove()">🍽️ Meal</button>
        <button class="btn btn-g btn-sm" onclick="openAddExercise();$('ex-date')&&($('ex-date').value='${date}');$('m-cal-day').remove()">🏃 Exercise</button>
        <button class="btn btn-g btn-sm" onclick="openAddSleep();$('sl-date')&&($('sl-date').value='${date}');$('m-cal-day').remove()">😴 Sleep</button>
        <button class="btn btn-g btn-sm" onclick="openAddInsulin();$('in-date')&&($('in-date').value='${date}');$('m-cal-day').remove()">💉 Insulin</button>
        <button class="btn btn-g btn-sm" onclick="openAddNote();$('nt-date')&&($('nt-date').value='${date}');$('m-cal-day').remove()">📝 Note</button>
        <button class="btn btn-outline-p btn-sm" onclick="$('m-cal-day').remove()">Close</button>
      </div>
    </div>`;
  document.body.appendChild(div);
  div.onclick = e => { if (e.target === div) div.remove(); };
}
