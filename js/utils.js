// DiaMetrics — utils.js
'use strict';

// ── DOM shortcut ─────────────────────────────────────────────────────
function $(id) { return document.getElementById(id); }
function $q(sel, el) { return (el || document).querySelector(sel); }
function $qa(sel, el) { return [...(el || document).querySelectorAll(sel)]; }

// ── Date helpers ──────────────────────────────────────────────────────
const D = {
  today()      { return new Date().toISOString().slice(0,10); },
  now()        { return new Date().toISOString(); },
  fmt(iso)     { if (!iso) return '—'; return new Date(iso + (iso.length===10?'T00:00:00':'')).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }); },
  fmtTime(iso) { if (!iso) return '—'; return new Date(iso).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }); },
  fmtDT(iso)   { if (!iso) return '—'; return D.fmt(iso) + ' ' + D.fmtTime(iso); },
  daysAgo(n)   { const d = new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); },
  addDays(iso, n) { const d = new Date(iso+'T00:00:00'); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); },
  diffDays(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); },
  monthLabel(iso) { return new Date(iso+'T00:00:00').toLocaleDateString('en-IN', { month:'short', year:'numeric' }); },
  weekday(iso) { return new Date(iso+'T00:00:00').toLocaleDateString('en-IN', { weekday:'short' }); },
  last(n) {
    const dates = [];
    for (let i = n-1; i >= 0; i--) dates.push(D.daysAgo(i));
    return dates;
  },
  isoWeek(iso) {
    const d = new Date(iso+'T00:00:00');
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() + 3 - (d.getDay()+6)%7);
    const w = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d-w)/86400000 - 3 + (w.getDay()+6)%7) / 7);
  },
};

// ── Unit converters ───────────────────────────────────────────────────
const Units = {
  // Glucose
  toMmol(mg)  { return +(mg / C.GLUCOSE.MMOL_FACTOR).toFixed(1); },
  toMg(mmol)  { return Math.round(mmol * C.GLUCOSE.MMOL_FACTOR); },
  gluc(mg, prefs) {
    if (!prefs || prefs.glucUnit === 'mg/dL') return mg + ' mg/dL';
    return Units.toMmol(mg) + ' mmol/L';
  },

  // Weight
  kgToLbs(kg) { return +(kg * C.WEIGHT.LBS_FACTOR).toFixed(1); },
  lbsToKg(lbs){ return +(lbs / C.WEIGHT.LBS_FACTOR).toFixed(1); },
  wt(kg, prefs) {
    if (!prefs || prefs.weightUnit === 'kg') return kg + ' kg';
    return Units.kgToLbs(kg) + ' lbs';
  },

  // Height
  cmToFtIn(cm) {
    const totalIn = cm / C.HEIGHT.IN_FACTOR;
    const ft = Math.floor(totalIn / 12);
    const inch = Math.round(totalIn % 12);
    return ft + "'" + inch + '"';
  },
  ht(cm, prefs) {
    if (!prefs || prefs.heightUnit === 'cm') return cm + ' cm';
    return Units.cmToFtIn(cm);
  },
};

// ── Health calculations ───────────────────────────────────────────────
const Calc = {
  bmi(weightKg, heightCm) {
    const h = heightCm / 100;
    return +(weightKg / (h * h)).toFixed(1);
  },
  bmiLabel(bmi) {
    if (bmi < C.BMI.UNDERWEIGHT) return { label: 'Underweight', cls: 'warn' };
    if (bmi <= C.BMI.NORMAL)     return { label: 'Normal',      cls: 'ok'   };
    if (bmi <= C.BMI.OVERWEIGHT) return { label: 'Overweight',  cls: 'warn' };
    return                              { label: 'Obese',        cls: 'err'  };
  },
  glucLabel(mg) {
    if (mg < C.GLUCOSE.HYPO)         return { label: 'Hypo',     cls: 'err'  };
    if (mg <= C.GLUCOSE.NORMAL_HIGH) return { label: 'Normal',   cls: 'ok'   };
    if (mg <= C.GLUCOSE.HIGH)        return { label: 'Elevated', cls: 'warn' };
    return                                  { label: 'High',     cls: 'err'  };
  },
  glucColor(mg) {
    if (mg < C.GLUCOSE.HYPO)         return '#ef4444';
    if (mg <= C.GLUCOSE.NORMAL_HIGH) return '#10b981';
    if (mg <= C.GLUCOSE.HIGH)        return '#f59e0b';
    return '#ef4444';
  },
  a1cFromAvg(avgMg) { return +((avgMg + 46.7) / 28.7).toFixed(1); },
  avgFromA1c(a1c)   { return Math.round(a1c * 28.7 - 46.7); },
  timeInRange(logs) {
    if (!logs.length) return 0;
    const inRange = logs.filter(l => l.value >= C.GLUCOSE.NORMAL_LOW && l.value <= C.GLUCOSE.NORMAL_HIGH).length;
    return Math.round((inRange / logs.length) * 100);
  },
  stdDev(logs) {
    if (!logs.length) return 0;
    const vals = logs.map(l => l.value);
    const mean = vals.reduce((a,b) => a+b, 0) / vals.length;
    const variance = vals.reduce((s,v) => s + Math.pow(v-mean,2), 0) / vals.length;
    return +Math.sqrt(variance).toFixed(1);
  },
  movingAvg(values, window = 7) {
    return values.map((_, i) => {
      const slice = values.slice(Math.max(0, i - window + 1), i + 1).filter(v => v != null && v > 0);
      return slice.length ? Math.round(slice.reduce((a, b) => a + b, 0) / slice.length) : null;
    });
  },
  cv(logs) {
    if (!logs.length) return 0;
    const mean = avg(logs.map(l => l.value));
    if (!mean) return 0;
    return +(this.stdDev(logs) / mean * 100).toFixed(1);
  },
  loggingStreak(glucLogs) {
    let streak = 0;
    for (let i = 0; i < 90; i++) {
      if (glucLogs.some(l => l.date === D.daysAgo(i))) streak++;
      else break;
    }
    return streak;
  },
  linearTrend(points) {
    // returns {slope, intercept, predict(x)}
    const n = points.length;
    if (n < 2) return { slope: 0, intercept: points[0] || 0, predict: () => points[0] || 0 };
    const sumX  = points.reduce((s,_,i) => s+i, 0);
    const sumY  = points.reduce((s,v) => s+v, 0);
    const sumXY = points.reduce((s,v,i) => s+i*v, 0);
    const sumX2 = points.reduce((s,_,i) => s+i*i, 0);
    const slope = (n*sumXY - sumX*sumY) / (n*sumX2 - sumX*sumX);
    const intercept = (sumY - slope*sumX) / n;
    return { slope, intercept, predict: x => Math.round(slope*x + intercept) };
  },
};

// ── Number / string helpers ───────────────────────────────────────────
function avg(arr) {
  if (!arr.length) return null;
  return Math.round(arr.reduce((a,b) => a+b, 0) / arr.length);
}
function pct(num, den) {
  if (!den) return 0;
  return Math.round((num/den)*100);
}
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
function esc(s) { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

// ── Skeleton loader ───────────────────────────────────────────────────
function skeleton(rows, cols) {
  return Array(rows).fill('').map(() =>
    '<tr>' + Array(cols).fill('<td><div class="skel"></div></td>').join('') + '</tr>'
  ).join('');
}

// ── Empty state ───────────────────────────────────────────────────────
function emptyState(icon, title, sub, action='') {
  return `<div class="empty-state">
    <div class="empty-icon">${icon}</div>
    <div class="empty-title">${esc(title)}</div>
    <div class="empty-sub">${esc(sub)}</div>
    ${action}
  </div>`;
}

// ── Download helpers ──────────────────────────────────────────────────
function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  _dl(blob, filename || 'export.json');
}
function downloadCSV(rows, filename) {
  const csv = rows.map(r => r.map(c => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  _dl(blob, filename || 'export.csv');
}
function _dl(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── SHA-256 (async) ─────────────────────────��─────────────────────────
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// ── Lab range helper ──────────────────────────────────────────────────
function labStatus(name, value) {
  const r = C.LAB_RANGES[name];
  if (!r) return { label: '—', cls: '' };
  // Special case: HDL — higher is better
  if (name === 'HDL Cholesterol') {
    if (value >= r.normal[0]) return { label: 'Normal', cls: 'ok' };
    if (value >= r.pre[0])    return { label: 'Borderline', cls: 'warn' };
    return { label: 'Low', cls: 'err' };
  }
  // eGFR — higher is better
  if (name === 'eGFR') {
    if (value >= r.normal[0]) return { label: 'Normal', cls: 'ok' };
    if (value >= r.pre[0])    return { label: 'Borderline', cls: 'warn' };
    return { label: 'Low', cls: 'err' };
  }
  if (value <= r.normal[1])  return { label: 'Normal',     cls: 'ok'   };
  if (value <= r.pre[1])     return { label: 'Borderline', cls: 'warn' };
  return                            { label: 'High',        cls: 'err'  };
}

// ── Action icon buttons ───────────────────────────────────────────────
const ICONS = {
  view: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  edit: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  del:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
};

function dateRangeFilter(data, fromId, toId) {
  const from = $(fromId)?.value || '';
  const to   = $(toId)?.value   || '';
  if (from) data = data.filter(r => r.date >= from);
  if (to)   data = data.filter(r => r.date <= to);
  return data;
}

function actionBtns(id, viewFn, editFn, delFn) {
  const v = viewFn ? `<button class="btn-icon btn-icon-view" onclick="${viewFn}(${id})" title="View">${ICONS.view}</button>` : '';
  const e = editFn ? `<button class="btn-icon btn-icon-edit" onclick="${editFn}(${id})" title="Edit">${ICONS.edit}</button>` : '';
  const d = delFn  ? `<button class="btn-icon btn-icon-del"  onclick="${delFn}(${id})"  title="Delete">${ICONS.del}</button>`  : '';
  return v + e + d;
}
