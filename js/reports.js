// DiaMetrics — reports.js  (PDF, CSV, JSON export)
'use strict';

// ── Render reports page ───────────────────────────────────────────────
function rReports() {
  const pid    = State.activeProfile;
  const prof   = DB.g('profiles').find(p => p.id === pid);
  const el     = $('rep-profile-name');
  if (el && prof) el.textContent = prof.name;
  const usedEl = $('rep-storage');
  if (usedEl) usedEl.textContent = DB.usedKB() + ' KB';

  const statsEl = $('rep-stats');
  if (!statsEl) return;
  const logs   = DB.forProfile('glucoseLogs');
  const recent = logs.filter(l => l.date >= D.daysAgo(29));
  const labs   = DB.forProfile('labResults').sort((a,b) => b.date.localeCompare(a.date));
  const meds   = DB.forProfile('medications').filter(m => m.active);
  const tir    = Calc.timeInRange(recent);
  const estA1c = Model.estimatedA1c(recent);
  const latestA1c = labs.find(l => l.test === 'HbA1c');

  statsEl.innerHTML = `
    <div class="stats-grid" style="margin-bottom:0">
      <div class="stat-card"><div class="stat-value">${recent.length}</div><div class="stat-label">Readings (30d)</div></div>
      <div class="stat-card"><div class="stat-value stat-${tir>=70?'ok':tir>=50?'warn':'err'}">${tir}%</div><div class="stat-label">Time in Range</div></div>
      <div class="stat-card"><div class="stat-value">${estA1c ? estA1c+'%' : '—'}</div><div class="stat-label">Est. HbA1c</div></div>
      <div class="stat-card"><div class="stat-value">${latestA1c ? latestA1c.value+'%' : '—'}</div><div class="stat-label">Last Lab HbA1c</div></div>
      <div class="stat-card"><div class="stat-value">${meds.length}</div><div class="stat-label">Active Medications</div></div>
      <div class="stat-card"><div class="stat-value">${labs.length}</div><div class="stat-label">Total Lab Results</div></div>
    </div>`;
}

// ── PDF Health Summary ────────────────────────────────────────────────
function generatePDF(period = 30) {
  const pid    = State.activeProfile;
  const prof   = DB.g('profiles').find(p => p.id === pid);
  if (!prof) { toast('No profile selected', false); return; }

  if (typeof jspdf === 'undefined' && typeof window.jsPDF === 'undefined') {
    toast('PDF library not loaded', false); return;
  }
  const { jsPDF } = window.jspdf || window;
  const doc  = new jsPDF();
  const pw   = doc.internal.pageSize.getWidth();
  let   y    = 20;

  // ── Header ──────────────────────────────────────────────────────
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, pw, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20); doc.setFont('helvetica','bold');
  doc.text('DiaMetrics Health Report', 14, 18);
  doc.setFontSize(9); doc.setFont('helvetica','normal');
  doc.text(`Generated: ${D.fmtDT(D.now())} · Period: last ${period} days`, pw - 14, 18, { align:'right' });

  y = 40;
  doc.setTextColor(31, 41, 55);

  // ── Patient info ─────────────────────────────────────────────────
  doc.setFontSize(13); doc.setFont('helvetica','bold');
  doc.text('Patient Information', 14, y); y += 7;
  doc.setFontSize(10); doc.setFont('helvetica','normal');
  doc.setDrawColor(229, 231, 235);
  doc.rect(14, y, pw - 28, 28);
  const age = prof.dob ? Math.floor((Date.now()-new Date(prof.dob))/(365.25*24*3600*1000)) : '—';
  const bmi = prof.heightCm && prof.weightKg ? Calc.bmi(prof.weightKg, prof.heightCm) : '—';

  [
    ['Name', prof.name],              ['Date of Birth', D.fmt(prof.dob)],
    ['Gender', prof.gender || '—'],   ['Age', age],
    ['Height', prof.heightCm ? prof.heightCm + ' cm' : '—'],
    ['Weight', prof.weightKg ? prof.weightKg + ' kg' : '—'],
    ['BMI', String(bmi)],             ['Physician', prof.doctor || '—'],
  ].forEach(([k, v], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    doc.setFont('helvetica','bold'); doc.text(k + ':', 18 + col * 90, y + 8 + row * 7);
    doc.setFont('helvetica','normal'); doc.text(String(v), 55 + col * 90, y + 8 + row * 7);
  });
  y += 36;

  // ── Glucose Summary ──────────────────────────────────────────────
  const since    = D.daysAgo(period - 1);
  const glucLogs = DB.g('glucoseLogs').filter(l => l.profileId === pid && l.date >= since);
  const vals     = glucLogs.map(l => l.value);

  doc.setFontSize(13); doc.setFont('helvetica','bold');
  doc.text('Glucose Summary', 14, y); y += 7;
  doc.setFontSize(10); doc.setFont('helvetica','normal');

  if (vals.length) {
    const avgG  = avg(vals);
    const minG  = Math.min(...vals);
    const maxG  = Math.max(...vals);
    const tir   = Calc.timeInRange(glucLogs);
    const sd    = Calc.stdDev(glucLogs);
    const estA1c= Model.estimatedA1c(glucLogs);

    const stats = [
      ['Average Glucose', avgG + ' mg/dL'],
      ['Min / Max',       minG + ' / ' + maxG + ' mg/dL'],
      ['Std Deviation',   sd + ' mg/dL'],
      ['Time In Range',   tir + '% (target ≥ 70%)'],
      ['Total Readings',  String(vals.length)],
      ['Est. HbA1c',      estA1c ? estA1c + '%' : '—'],
    ];
    stats.forEach(([k, v]) => {
      doc.setFont('helvetica','bold'); doc.text(k + ':', 14, y);
      doc.setFont('helvetica','normal'); doc.text(v, 80, y);
      y += 6;
    });
  } else {
    doc.text('No glucose readings in this period.', 14, y); y += 6;
  }
  y += 4;

  // ── Latest Lab Results ───────────────────────────────────────────
  const labs = DB.g('labResults').filter(l => l.profileId === pid)
                .sort((a,b) => b.date.localeCompare(a.date));
  const latestLabs = {};
  labs.forEach(l => { if (!latestLabs[l.test]) latestLabs[l.test] = l; });
  const labEntries = Object.values(latestLabs);

  if (labEntries.length) {
    doc.setFontSize(13); doc.setFont('helvetica','bold');
    doc.text('Latest Lab Results', 14, y); y += 7;
    doc.setFontSize(9);

    // Table header
    doc.setFillColor(243, 244, 246);
    doc.rect(14, y, pw - 28, 7, 'F');
    doc.setFont('helvetica','bold');
    ['Test', 'Date', 'Value', 'Status'].forEach((h, i) => {
      doc.text(h, [14, 80, 130, 165][i], y + 5);
    });
    y += 9;

    labEntries.forEach(l => {
      const s = labStatus(l.test, l.value);
      const r = C.LAB_RANGES[l.test];
      doc.setFont('helvetica','normal');
      doc.text(l.test.slice(0, 22), 14, y);
      doc.text(D.fmt(l.date), 80, y);
      doc.text(l.value + (r ? ' ' + r.unit : ''), 130, y);
      doc.setTextColor(s.cls === 'ok' ? 16 : s.cls === 'warn' ? 180 : 220,
                       s.cls === 'ok' ? 185 : s.cls === 'warn' ? 120 : 38,
                       s.cls === 'ok' ? 129 : s.cls === 'warn' ? 0   : 38);
      doc.text(s.label, 165, y);
      doc.setTextColor(31, 41, 55);
      y += 6;
      if (y > 270) { doc.addPage(); y = 20; }
    });
    y += 4;
  }

  // ── Medications ──────────────────────────────────────────────────
  const meds = DB.g('medications').filter(m => m.profileId === pid && m.active);
  if (meds.length) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(13); doc.setFont('helvetica','bold');
    doc.text('Current Medications', 14, y); y += 7;
    doc.setFontSize(10); doc.setFont('helvetica','normal');
    meds.forEach(m => {
      doc.text(`• ${m.name} ${m.dosage} — ${m.frequency}`, 14, y); y += 6;
    });
    y += 4;
  }

  // ── Footer ───────────────────────────────────────────────────────
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(156, 163, 175);
    doc.text('DiaMetrics · For personal health tracking only · Not a medical diagnosis', pw / 2, 287, { align:'center' });
    doc.text(`Page ${i} of ${pages}`, pw - 14, 287, { align:'right' });
  }

  const fname = `DiaMetrics_Report_${prof.name.replace(/\s+/g,'_')}_${D.today()}.pdf`;
  doc.save(fname);
  toast('PDF downloaded', true);
}

// ── CSV exports ───────────────────────────────────────────────────────
function exportCSV(type) {
  const pid  = State.activeProfile;
  const prof = DB.g('profiles').find(p => p.id === pid);
  const name = prof?.name.replace(/\s+/g,'_') || 'profile';

  const exporters = {
    glucose() {
      const rows = [['Date','Time','Type','Value (mg/dL)','Notes']];
      DB.g('glucoseLogs').filter(l=>l.profileId===pid).sort((a,b)=>a.date.localeCompare(b.date))
        .forEach(l => rows.push([l.date, l.time, l.type, l.value, l.notes||'']));
      downloadCSV(rows, `glucose_${name}_${D.today()}.csv`);
    },
    weight() {
      const rows = [['Date','Weight (kg)','Notes']];
      DB.g('weightLogs').filter(l=>l.profileId===pid).sort((a,b)=>a.date.localeCompare(b.date))
        .forEach(l => rows.push([l.date, l.value, l.notes||'']));
      downloadCSV(rows, `weight_${name}_${D.today()}.csv`);
    },
    labs() {
      const rows = [['Date','Test','Value','Unit','Notes']];
      DB.g('labResults').filter(l=>l.profileId===pid).sort((a,b)=>a.date.localeCompare(b.date))
        .forEach(l => {
          const r = C.LAB_RANGES[l.test];
          rows.push([l.date, l.test, l.value, r?r.unit:'', l.notes||'']);
        });
      downloadCSV(rows, `labs_${name}_${D.today()}.csv`);
    },
    meals() {
      const rows = [['Date','Meal','Description','Carbs (g)','Calories (kcal)','Notes']];
      DB.g('mealLogs').filter(l=>l.profileId===pid).sort((a,b)=>a.date.localeCompare(b.date))
        .forEach(l => rows.push([l.date, l.mealType, l.description, l.carbsG||'', l.caloriesKcal||'', l.notes||'']));
      downloadCSV(rows, `meals_${name}_${D.today()}.csv`);
    },
    exercise() {
      const rows = [['Date','Type','Duration (min)','Intensity','Steps','Notes']];
      DB.g('exerciseLogs').filter(l=>l.profileId===pid).sort((a,b)=>a.date.localeCompare(b.date))
        .forEach(l => rows.push([l.date, l.type, l.duration, l.intensity, l.steps||'', l.notes||'']));
      downloadCSV(rows, `exercise_${name}_${D.today()}.csv`);
    },
    insulin() {
      const rows = [['Date','Time','Insulin Type','Units','Site','Notes']];
      DB.forProfile('insulinLogs').sort((a,b) => a.date.localeCompare(b.date))
        .forEach(l => rows.push([l.date, l.time, l.insulinType, l.units, l.site||'', l.notes||'']));
      downloadCSV(rows, `insulin_${name}_${D.today()}.csv`);
    },
    sleep() {
      const rows = [['Date','Hours','Quality (1-5)','Stress (1-10)','Notes']];
      DB.forProfile('sleepLogs').sort((a,b) => a.date.localeCompare(b.date))
        .forEach(l => rows.push([l.date, l.hours, l.quality, l.stress, l.notes||'']));
      downloadCSV(rows, `sleep_${name}_${D.today()}.csv`);
    },
  };

  if (exporters[type]) { exporters[type](); toast('CSV exported', true); }
}

// ── Full JSON backup ──────────────────────────────────────────────────
function exportBackup() {
  const data = DB.exportAll();
  downloadJSON(data, `diametrics_backup_${D.today()}.json`);
  toast('Backup downloaded', true);
}

function importBackup() {
  const file = $('import-file')?.files?.[0];
  if (!file) { toast('Select a backup file', false); return; }
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data._version) throw new Error('Invalid');
      confirmDlg('This will merge the backup data. Existing demo records are preserved. Continue?', () => {
        DB.importAll(data);
        toast('Backup restored successfully', true);
      });
    } catch {
      toast('Invalid backup file', false);
    }
  };
  reader.readAsText(file);
}

// ── Share via email (mailto) ──────────────────────────────────────────
function shareByEmail(period = 30) {
  const pid    = State.activeProfile;
  const prof   = DB.g('profiles').find(p => p.id === pid);
  const since  = D.daysAgo(period - 1);
  const logs   = DB.g('glucoseLogs').filter(l => l.profileId === pid && l.date >= since);
  const vals   = logs.map(l => l.value);
  const tir    = Calc.timeInRange(logs);
  const estA1c = Model.estimatedA1c(logs);

  // Lab results — most recent of each test
  const labs   = DB.g('labResults').filter(l => l.profileId === pid);
  const labMap = {};
  labs.forEach(l => { if (!labMap[l.test] || l.date > labMap[l.test].date) labMap[l.test] = l; });
  const labLines = Object.values(labMap).map(l => {
    const r = C.LAB_RANGES?.[l.test];
    return `  ${l.test}: ${l.value}${r ? ' ' + r.unit : ''} (${D.fmt(l.date)})`;
  });

  // Active medications
  const meds = DB.g('medications').filter(m => m.profileId === pid && m.active);
  const medLines = meds.map(m => `  ${m.name} — ${m.dosage}, ${m.frequency}`);

  const subject = encodeURIComponent(`DiaMetrics Health Summary — ${prof?.name || 'Patient'}`);
  const body    = encodeURIComponent(
    `DiaMetrics Health Summary\n` +
    `Patient: ${prof?.name || '—'}\n` +
    `Period: Last ${period} days (${D.fmt(since)} to ${D.fmt(D.today())})\n\n` +
    `Glucose Summary:\n` +
    `  Average: ${vals.length ? avg(vals) : '—'} mg/dL\n` +
    `  Time in Range: ${tir}%\n` +
    `  Est. HbA1c: ${estA1c ? estA1c + '%' : '—'}\n` +
    `  Total readings: ${vals.length}\n\n` +
    (labLines.length ? `Recent Lab Results:\n${labLines.join('\n')}\n\n` : '') +
    (medLines.length ? `Active Medications:\n${medLines.join('\n')}\n\n` : '') +
    `Generated by DiaMetrics\n`
  );
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}
