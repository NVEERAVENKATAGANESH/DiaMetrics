// DiaMetrics — analytics.js
'use strict';

function rAnalytics() {
  const pid    = State.activeProfile;
  const prefs  = DB.go('settings');
  const glucLogs = DB.g('glucoseLogs').filter(l => l.profileId === pid);

  // ── Period selector ──────────────────────────────────────────────
  const fromCustom = $('an-from')?.value || '';
  const toCustom   = $('an-to')?.value   || '';
  const period = +($('an-period')?.value || '30');

  let logs;
  if (fromCustom || toCustom) {
    logs = glucLogs.filter(l =>
      (!fromCustom || l.date >= fromCustom) &&
      (!toCustom   || l.date <= toCustom)
    );
  } else {
    const since = D.daysAgo(period - 1);
    logs = glucLogs.filter(l => l.date >= since);
  }
  const days = period;

  // ── Summary stats ────────────────────────────────────────────────
  const vals   = logs.map(l => l.value);
  const avgG   = vals.length ? avg(vals) : null;
  const minG   = vals.length ? Math.min(...vals) : null;
  const maxG   = vals.length ? Math.max(...vals) : null;
  const sd     = Calc.stdDev(logs);
  const tir    = Calc.timeInRange(logs);
  const tirHigh  = logs.filter(l => l.value > C.GLUCOSE.NORMAL_HIGH && l.value <= C.GLUCOSE.HIGH).length;
  const tirVHigh = logs.filter(l => l.value > C.GLUCOSE.HIGH).length;
  const tirLow   = logs.filter(l => l.value < C.GLUCOSE.HYPO).length;
  const estA1c   = Model.estimatedA1c(logs);

  _statCard('an-avg',    avgG ? Units.gluc(avgG, prefs) : '—',          'Average Glucose', '');
  _statCard('an-min',    minG ? Units.gluc(minG, prefs) : '—',          'Lowest Reading',  minG < C.GLUCOSE.HYPO ? 'err' : 'ok');
  _statCard('an-max',    maxG ? Units.gluc(maxG, prefs) : '—',          'Highest Reading', maxG > C.GLUCOSE.HIGH ? 'err' : 'ok');
  const cv = Calc.cv(logs);
  _statCard('an-sd',     sd ? sd + ' mg/dL' : '—',                      'Std Deviation',   sd > 50 ? 'err' : sd > 30 ? 'warn' : 'ok');
  _statCard('an-cv',     cv ? cv + '%' : '—',                           'Coeff. of Variation (CV)', cv > 36 ? 'err' : cv > 26 ? 'warn' : 'ok');
  _statCard('an-tir',    tir + '%',                                       'Time In Range',   tir >= 70 ? 'ok' : tir >= 50 ? 'warn' : 'err');
  _statCard('an-a1c',    estA1c ? estA1c + '%' : '—',                   'Est. HbA1c',      estA1c ? (estA1c < 7 ? 'ok' : estA1c < 8 ? 'warn' : 'err') : '');
  _statCard('an-count',  logs.length + ' readings',                      `In last ${days} days`, '');

  // ── Time-in-range doughnut ───────────────────────────────────────
  const inRange = logs.filter(l => l.value >= C.GLUCOSE.NORMAL_LOW && l.value <= C.GLUCOSE.NORMAL_HIGH).length;
  Charts.doughnut('an-tir-chart',
    ['In Range', 'High', 'Very High', 'Low'],
    [inRange, tirHigh, tirVHigh, tirLow],
    ['#10b981','#f59e0b','#ef4444','#f43f5e']
  );

  // ── Daily avg over period ────────────────────────────────────────
  const periodDates = D.last(Math.min(days, 30));
  const dailyAvgs   = periodDates.map(d => {
    const dr = glucLogs.filter(l => l.date === d);
    return dr.length ? avg(dr.map(l=>l.value)) : null;
  });
  const movAvg = Calc.movingAvg(dailyAvgs);
  Charts.line('an-daily-chart',
    periodDates.map(d => D.weekday(d) + ' ' + d.slice(5)),
    [
      { label: 'Daily Avg (mg/dL)', data: dailyAvgs.map(v=>v||0),
        borderColor: P.blue, backgroundColor: P.blue+'22', fill:true },
      { label: '7-day Moving Avg', data: movAvg.map(v=>v||null),
        borderColor: P.purple, borderDash:[5,3], pointRadius:0, fill:false },
    ],
    { plugins:{ legend:{display:true} } }
  );

  // ── By reading type (bar) ────────────────────────────────────────
  const byType = {};
  C.READING_TYPES.forEach(t => {
    const tr = logs.filter(l => l.type === t);
    if (tr.length) byType[t] = avg(tr.map(l=>l.value));
  });
  const typeKeys = Object.keys(byType);
  if (typeKeys.length) {
    Charts.bar('an-type-chart', typeKeys,
      [{ label:'Avg Glucose', data: typeKeys.map(t=>byType[t]),
         backgroundColor: typeKeys.map(t=>byType[t]>C.GLUCOSE.NORMAL_HIGH?P.amber+'bb':P.green+'bb') }],
      { plugins:{ legend:{display:false} } }
    );
  }

  // ── Heatmap: glucose by hour ─────────────────────────────────────
  const heatData = [];
  logs.forEach(l => {
    const hour = +l.time.split(':')[0];
    const dow  = new Date(l.date + 'T00:00:00').getDay();
    heatData.push({ hour, dow, value: l.value });
  });
  Charts.heatmap('an-heat-canvas', heatData);

  // ── Correlations ─────────────────────────────────────────────────
  _renderCorrelations(pid, logs);

  // ── 7-day forecast ───────────────────────────────────────────────
  _renderForecast(logs);

  // ── Anomalies ────────────────────────────────────────────────────
  _renderAnomalies(logs, prefs);
}

function _renderCorrelations(pid, glucLogs) {
  const corrEl = $('an-correlations');
  if (!corrEl) return;

  const sleepLogs = DB.g('sleepLogs').filter(l => l.profileId === pid);
  const exLogs    = DB.g('exerciseLogs').filter(l => l.profileId === pid);

  const correlations = [];

  // Sleep hours vs next-day avg glucose
  const sleepX = [], glucNextY = [];
  sleepLogs.forEach(s => {
    const nextDay = D.addDays(s.date, 1);
    const nextG   = glucLogs.filter(l => l.date === nextDay);
    if (nextG.length) { sleepX.push(s.hours); glucNextY.push(avg(nextG.map(l=>l.value))); }
  });
  if (sleepX.length >= 3) {
    const r = Model.correlation(sleepX, glucNextY);
    correlations.push({ label:'Sleep hrs vs Next-day glucose', r, interpretation: _corrInterpret(r) });
  }

  // Stress vs same-day avg glucose
  const stressX = [], glucSameY = [];
  sleepLogs.forEach(s => {
    const sameDay = glucLogs.filter(l => l.date === s.date);
    if (sameDay.length) { stressX.push(s.stress); glucSameY.push(avg(sameDay.map(l=>l.value))); }
  });
  if (stressX.length >= 3) {
    const r = Model.correlation(stressX, glucSameY);
    correlations.push({ label:'Stress level vs Same-day glucose', r, interpretation: _corrInterpret(r) });
  }

  // Exercise duration vs next-day avg glucose
  const exX = [], glucExY = [];
  exLogs.forEach(e => {
    const nextDay = D.addDays(e.date, 1);
    const nextG   = glucLogs.filter(l => l.date === nextDay);
    if (nextG.length) { exX.push(e.duration); glucExY.push(avg(nextG.map(l=>l.value))); }
  });
  if (exX.length >= 3) {
    const r = Model.correlation(exX, glucExY);
    correlations.push({ label:'Exercise duration vs Next-day glucose', r, interpretation: _corrInterpret(r) });
  }

  // Meal carbs vs post-meal glucose (same day)
  const mealLogs = DB.g('mealLogs').filter(l => l.profileId === pid);
  const carbX = [], postMealY = [];
  mealLogs.forEach(m => {
    if (!m.carbsG) return;
    const postMeal = glucLogs.filter(l => l.date === m.date && l.type === 'Post-Meal');
    if (postMeal.length) { carbX.push(m.carbsG); postMealY.push(avg(postMeal.map(l=>l.value))); }
  });
  if (carbX.length >= 3) {
    const r = Model.correlation(carbX, postMealY);
    correlations.push({ label:'Meal carbs (g) vs Post-meal glucose', r, interpretation: _corrInterpret(r) });
  }

  if (!correlations.length) {
    corrEl.innerHTML = '<p class="muted">Log more data to see correlations (min. 3 matched days needed).</p>';
    return;
  }

  corrEl.innerHTML = correlations.map(c => `
    <div class="corr-row">
      <div class="corr-label">${esc(c.label)}</div>
      <div class="corr-bar-wrap">
        <div class="corr-bar">
          <div class="corr-fill" style="width:${Math.abs(c.r)*100}%;background:${c.r<-0.3?P.green:c.r>0.3?P.red:P.amber}"></div>
        </div>
        <span class="corr-r">r = ${c.r}</span>
      </div>
      <div class="corr-interp muted">${esc(c.interpretation)}</div>
    </div>`).join('');
}

function _corrInterpret(r) {
  const abs = Math.abs(r);
  const dir = r > 0 ? 'positive' : 'negative';
  if (abs < 0.2) return 'No meaningful correlation';
  if (abs < 0.4) return `Weak ${dir} correlation`;
  if (abs < 0.7) return `Moderate ${dir} correlation`;
  return `Strong ${dir} correlation`;
}

function _renderForecast(logs) {
  const el = $('an-forecast');
  if (!el) return;
  if (logs.length < 5) {
    el.innerHTML = '<p class="muted" style="padding:16px">Log at least 5 readings for a forecast.</p>';
    return;
  }
  el.innerHTML = '<div class="chart-wrap"><canvas id="an-forecast-chart"></canvas></div>';
  const forecast = Model.forecast(logs, 7);
  const recent3  = [...logs].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3);
  Charts.line('an-forecast-chart',
    [...recent3.reverse().map(l=>D.fmt(l.date)), ...forecast.map(f=>D.fmt(f.day))],
    [
      { label:'Recent',             data:[...recent3.map(l=>l.value), ...Array(7).fill(null)], borderColor:P.blue,   fill:false },
      { label:'Forecast (estimated)', data:[...Array(recent3.length).fill(null), ...forecast.map(f=>f.predicted)], borderColor:P.purple, borderDash:[6,4], pointStyle:'circle', pointRadius:3, fill:false },
    ]
  );
  el.innerHTML += `<p class="muted" style="font-size:.78rem;padding:6px 12px 10px">
    Forecast is a linear trend estimate only — not a medical prediction.
    Actual glucose depends on many factors. Consult your healthcare provider.
  </p>`;
}

function _renderAnomalies(logs, prefs) {
  const el = $('an-anomalies');
  if (!el) return;
  const anomalies = Model.anomalies(logs);
  if (!anomalies.length) { el.innerHTML='<p class="muted">No anomalous readings detected.</p>'; return; }
  el.innerHTML = `<table class="tbl"><thead><tr><th>Date</th><th>Time</th><th>Type</th><th>Value</th></tr></thead><tbody>
    ${anomalies.slice(0,10).map(l=>`<tr>
      <td>${D.fmt(l.date)}</td><td>${l.time}</td><td>${esc(l.type)}</td>
      <td><strong style="color:${Calc.glucColor(l.value)}">${Units.gluc(l.value, prefs)}</strong></td>
    </tr>`).join('')}
  </tbody></table>`;
}

// ── Export chart as PNG ───────────────────────────────────────────────
function exportChartPNG(canvasId, filename) {
  const canvas = $(canvasId);
  if (!canvas) { toast('Chart not found', false); return; }
  const link = document.createElement('a');
  link.download = (filename || canvasId) + '_' + D.today() + '.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
  toast('Chart exported as PNG', true);
}

// ── Audit log page ────────────────────────────────────────────────────
function rAuditLog() {
  const tbody = $('audit-tbody');
  if (!tbody) return;
  const uid  = State.user?.id;
  const entries = DB.gAll('audit').filter(a => a.uid === uid)
                   .sort((a,b) => b.ts.localeCompare(a.ts)).slice(0, 200);
  if (!entries.length) {
    tbody.innerHTML = `<tr><td colspan="4">${emptyState('📋','No audit entries yet','Actions will be logged here.')}</td></tr>`;
    return;
  }
  paginate(entries, 'audit-tbody', sliced => {
    tbody.innerHTML = sliced.map(e => `<tr>
      <td>${D.fmtDT(e.ts)}</td>
      <td><span class="badge badge-muted">${esc(e.action)}</span></td>
      <td>${esc(e.entity)}</td>
      <td>${esc(e.summary || '—')}</td>
    </tr>`).join('');
  });
}
