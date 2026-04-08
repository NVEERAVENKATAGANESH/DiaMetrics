// DiaMetrics — dashboard.js
'use strict';

function rDashboard() {
  const pid     = State.activeProfile;
  const prefs   = DB.go('settings');
  const profile = DB.g('profiles').find(p => p.id === pid);

  // ── Stats ─────────────────────────────────────────────────────────
  const glucLogs = DB.g('glucoseLogs').filter(l => l.profileId === pid);
  const recent30 = glucLogs.filter(l => l.date >= D.daysAgo(30)).sort((a,b) => b.date.localeCompare(a.date));
  const recent7  = glucLogs.filter(l => l.date >= D.daysAgo(7));
  const today    = glucLogs.filter(l => l.date === D.today());

  const avgG   = recent30.length ? avg(recent30.map(l=>l.value)) : null;
  const tir    = Calc.timeInRange(recent30);
  const estA1c = Model.estimatedA1c(recent30);
  const lastG  = recent30[0];

  const wtLogs = DB.g('weightLogs').filter(l => l.profileId === pid).sort((a,b)=>b.date.localeCompare(a.date));
  const lastWt = wtLogs[0];
  const bmi    = profile && lastWt ? Calc.bmi(lastWt.value, profile.heightCm) : null;

  // ── Streak ────────────────────────────────────────────────────────
  const streak = Calc.loggingStreak(glucLogs);

  // ── Risk ──────────────────────────────────────────────────────────
  const labLogs   = DB.forProfile('labResults');
  const risk      = profile ? Model.riskScore(profile, recent30, labLogs) : 0;
  const riskInf   = Model.riskLabel(risk);

  // ── Render stat cards ─────────────────────────────────────────────
  const lastGLabel = lastG ? Calc.glucLabel(lastG.value) : null;

  // Trend arrow from 7-day linear slope
  let trendArrow = '';
  if (recent7.length >= 3) {
    const sorted7 = [...recent7].sort((a,b) => a.date.localeCompare(b.date));
    const trend7  = Calc.linearTrend(sorted7.map(l => l.value));
    if      (trend7.slope >  1.5) trendArrow = ' ↑';
    else if (trend7.slope < -1.5) trendArrow = ' ↓';
    else                          trendArrow = ' →';
  }

  _statCard('dash-last-g',
    lastG ? Units.gluc(lastG.value, prefs) + trendArrow : '—',
    lastG ? `${lastG.type} · ${D.fmt(lastG.date)}` : 'No readings yet',
    lastG ? lastGLabel.cls : '');

  _statCard('dash-avg-g',
    avgG ? Units.gluc(avgG, prefs) : '—',
    '30-day average', '');

  _statCard('dash-tir',
    recent30.length ? tir + '%' : '—',
    'Time in range (30d)', tir >= 70 ? 'ok' : tir >= 50 ? 'warn' : 'err');

  _statCard('dash-a1c',
    estA1c ? estA1c + '%' : '—',
    'Estimated HbA1c', estA1c ? (estA1c < 7 ? 'ok' : estA1c < 8 ? 'warn' : 'err') : '');

  _statCard('dash-streak',
    streak + ' days',
    'Logging streak', streak >= 7 ? 'ok' : '');

  _statCard('dash-risk',
    risk + ' / 100',
    'Risk score · ' + riskInf.label,
    riskInf.cls);

  if (bmi) {
    const bmiInf = Calc.bmiLabel(bmi);
    _statCard('dash-bmi', String(bmi), 'BMI · ' + bmiInf.label, bmiInf.cls);
  }

  // ── Today's readings mini-table ───────────────────────────────────
  const todayEl = $('dash-today');
  if (todayEl) {
    if (!today.length) {
      todayEl.innerHTML = `<div class="dash-empty-row">No readings logged today</div>`;
    } else {
      todayEl.innerHTML = `
        <table class="tbl">
          <thead><tr><th>Time</th><th>Type</th><th>Value</th><th>Status</th></tr></thead>
          <tbody>
            ${today.sort((a,b)=>a.time.localeCompare(b.time)).map(l => {
              const s = Calc.glucLabel(l.value);
              return `<tr>
                <td>${l.time}</td>
                <td>${esc(l.type)}</td>
                <td>${Units.gluc(l.value, prefs)}</td>
                <td><span class="badge badge-${s.cls}">${s.label}</span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>`;
    }
  }

  // ── 14-day glucose chart ──────────────────────────────────────────
  const last14 = D.last(14);
  const glucByDay = last14.map(d => {
    const readings = glucLogs.filter(l => l.date === d);
    return readings.length ? avg(readings.map(l=>l.value)) : null;
  });
  Charts.glucLine('dash-gluc-chart', last14.map(d => D.weekday(d)), glucByDay.map(v=>v||0));

  // ── Medications due today ─────────────────────────────────────────
  const medsEl = $('dash-meds');
  if (medsEl) {
    const meds    = DB.g('medications').filter(m => m.profileId === pid && m.active);
    const doses   = DB.g('medDoses').filter(d => d.profileId === pid && d.date === D.today());
    if (!meds.length) {
      medsEl.innerHTML = `<div class="dash-empty-row">No medications added</div>`;
    } else {
      medsEl.innerHTML = meds.map(m => {
        const dose  = doses.find(d => d.medicationId === m.id);
        const taken = dose?.taken;
        return `<div class="med-row">
          <div class="med-row-info">
            <span class="med-name">${esc(m.name)} <small>${esc(m.dosage)}</small></span>
            <span class="med-freq muted">${esc(m.frequency)}${m.timeOfDay ? ' · ' + esc(m.timeOfDay) : ''}</span>
          </div>
          <div class="med-row-actions">
            <button class="btn btn-sm ${taken?'btn-g':'btn-p'}" onclick="toggleDose(${m.id})" title="${taken?'Mark as not taken':'Mark as taken'}">
              ${taken ? '✓ Taken' : 'Mark Taken'}
            </button>
            <button class="btn-icon btn-icon-edit" onclick="openEditMed(${m.id})" title="Edit medication">${ICONS.edit}</button>
            <button class="btn-icon btn-icon-del"  onclick="deleteMed(${m.id})" title="Delete medication">${ICONS.del}</button>
          </div>
        </div>`;
      }).join('');
    }
  }

  // ── Anomaly alerts ────────────────────────────────────────────────
  const alertsEl = $('dash-alerts');
  if (alertsEl) {
    const anomalies = Model.anomalies(recent30);
    const highCount = today.filter(l => l.value > C.GLUCOSE.HIGH).length;
    const alerts = [];
    if (highCount) alerts.push({ cls:'err', msg:`${highCount} reading(s) above ${C.GLUCOSE.HIGH} mg/dL today` });
    if (today.some(l => l.value < C.GLUCOSE.HYPO)) alerts.push({ cls:'err', msg:'Hypoglycemia detected today — readings below 70 mg/dL' });
    if (anomalies.length) alerts.push({ cls:'warn', msg:`${anomalies.length} anomalous reading(s) detected in last 30 days` });

    // Refill reminders
    const meds = DB.g('medications').filter(m => m.profileId === pid && m.active && m.refillDate);
    meds.forEach(m => {
      const days = D.diffDays(D.today(), m.refillDate);
      if (days <= 7 && days >= 0) alerts.push({ cls:'warn', msg:`Refill ${m.name} in ${days} day(s)` });
    });

    alertsEl.innerHTML = alerts.length
      ? alerts.map(a => `<div class="alert-row alert-${a.cls}">⚠️ ${esc(a.msg)}</div>`).join('')
      : `<div class="dash-empty-row">No alerts — everything looks good</div>`;
  }

  // ── Recent achievements ───────────────────────────────────────────
  const achEl = $('dash-achievements');
  if (achEl) {
    const earned = DB.g('achievements').filter(a => a.profileId === pid)
                    .sort((a,b) => b.earnedAt.localeCompare(a.earnedAt)).slice(0,4);
    achEl.innerHTML = earned.length
      ? earned.map(a => {
          const b = C.BADGES.find(x => x.id === a.badgeId);
          return b ? `<div class="badge-chip" title="${esc(b.desc)}">${b.icon} ${esc(b.label)}</div>` : '';
        }).join('')
      : '<div class="dash-empty-row">No badges yet — start logging!</div>';
  }
}

// Toggle medication dose taken
function toggleDose(medId) {
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
  rDashboard();
}
