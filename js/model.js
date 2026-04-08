// DiaMetrics — model.js  (risk scoring, HbA1c estimator, trend prediction)
'use strict';

const Model = {
  // ── Risk score (0–100) using logistic-regression-style weights ──────
  riskScore(profile, recentLogs, labs) {
    let score = 0;

    // Age factor
    const age = _age(profile.dob);
    if (age !== null) {
      if (age > 65) score += 15;
      else if (age > 45) score += 8;
    }

    // BMI factor
    const bmi = Calc.bmi(profile.weightKg || 70, profile.heightCm || 170);
    if (bmi >= 30) score += 20;
    else if (bmi >= 25) score += 10;

    // Average glucose
    const vals = recentLogs.map(l => l.value);
    if (vals.length) {
      const avgG = avg(vals);
      if (avgG > 200) score += 25;
      else if (avgG > 140) score += 15;
      else if (avgG > 120) score += 8;
    }

    // Glucose variability
    const sd = Calc.stdDev(recentLogs);
    if (sd > 60) score += 10;
    else if (sd > 40) score += 5;

    // Time in range
    const tir = Calc.timeInRange(recentLogs);
    if (tir < 50) score += 10;
    else if (tir < 70) score += 5;

    // Medical history flags
    if (profile.familyDiabetes)   score += 10;
    if (profile.hypertension)     score += 8;

    // Latest HbA1c
    const pid = profile.id;
    const labData = (labs || DB.g('labResults').filter(l => l.profileId === pid))
                    .filter(l => l.test === 'HbA1c')
                    .sort((a,b) => b.date.localeCompare(a.date));
    if (labData.length) {
      const a1c = labData[0].value;
      if (a1c >= C.A1C.DIABETIC) score += 15;
      else if (a1c >= C.A1C.PRE) score += 8;
    }

    return Math.min(100, Math.round(score));
  },

  riskLabel(score) {
    if (score < 25) return { label: 'Low',      cls: 'ok',   color: '#10b981' };
    if (score < 50) return { label: 'Moderate', cls: 'warn', color: '#f59e0b' };
    if (score < 75) return { label: 'High',     cls: 'err',  color: '#f97316' };
    return                 { label: 'Critical', cls: 'err',  color: '#ef4444' };
  },

  // ── Estimated HbA1c from recent glucose logs ─────────────────────
  estimatedA1c(logs30) {
    if (!logs30.length) return null;
    const avgG = avg(logs30.map(l => l.value));
    return Calc.a1cFromAvg(avgG);
  },

  // ── 7-day glucose trend forecast ─────────────────────────────────
  forecast(logs, days = 7) {
    const sorted = [...logs].sort((a,b) => a.date.localeCompare(b.date));
    const vals   = sorted.map(l => l.value);
    const trend  = Calc.linearTrend(vals);
    const result = [];
    for (let i = 1; i <= days; i++) {
      result.push({ day: D.addDays(D.today(), i), predicted: trend.predict(vals.length + i - 1) });
    }
    return result;
  },

  // ── Target weight for healthy BMI (22.5) ─────────────────────────
  targetWeight(heightCm) {
    const h = heightCm / 100;
    return +(22.5 * h * h).toFixed(1);
  },

  // ── Anomaly detection: flag readings > 2 SD from mean ────────────
  anomalies(logs) {
    if (logs.length < 5) return [];
    const vals  = logs.map(l => l.value);
    const mean  = avg(vals);
    const sd    = Calc.stdDev(logs);
    return logs.filter(l => Math.abs(l.value - mean) > 2 * sd);
  },

  // ── Correlation: returns pearson r ─────────────────────────────
  correlation(xArr, yArr) {
    const n = Math.min(xArr.length, yArr.length);
    if (n < 3) return 0;
    const xa = xArr.slice(0, n), ya = yArr.slice(0, n);
    const mx = avg(xa), my = avg(ya);
    const num = xa.reduce((s,x,i) => s + (x-mx)*(ya[i]-my), 0);
    const dx  = Math.sqrt(xa.reduce((s,x) => s+(x-mx)**2, 0));
    const dy  = Math.sqrt(ya.reduce((s,y) => s+(y-my)**2, 0));
    if (!dx || !dy) return 0;
    return +(num / (dx * dy)).toFixed(2);
  },
};

function _age(dob) {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}
