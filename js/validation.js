// DiaMetrics — validation.js
'use strict';

// ── Primitive validators ──────────────────────────────────────────────
const V = {
  required(v)       { return v !== null && v !== undefined && String(v).trim() !== ''; },
  number(v)         { return !isNaN(v) && v !== ''; },
  range(v, min, max){ const n = +v; return n >= min && n <= max; },
  minLen(v, n)      { return String(v).trim().length >= n; },
  maxLen(v, n)      { return String(v).trim().length <= n; },
  date(v)           { return /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)); },
  time(v)           { return /^\d{2}:\d{2}$/.test(v); },
  email(v)          { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); },
  noXSS(v)          { return !/<script|on\w+\s*=/i.test(v); },
  positive(v)       { return +v > 0; },
  notFuture(v)      { return new Date(v + 'T00:00:00') <= new Date(); },
};

// ── Field error helpers ───────────────────────────────────────────────
function fieldError(id, msg) {
  const el = $(id);
  if (el) el.classList.add('field-err-input');
  const errEl = $(id + '-err');
  if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
}
function clearFieldError(id) {
  const el = $(id);
  if (el) el.classList.remove('field-err-input');
  const errEl = $(id + '-err');
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
}
function clearAllErrors(formId) {
  const form = $(formId);
  if (!form) return;
  form.querySelectorAll('.field-err-input').forEach(e => e.classList.remove('field-err-input'));
  form.querySelectorAll('.field-err').forEach(e => { e.textContent=''; e.style.display='none'; });
}

/** validateRules([{id, rules:[{check, msg}]}]) — returns true if all pass */
function validateRules(rules) {
  let ok = true;
  rules.forEach(({ id, rules: rrs }) => {
    clearFieldError(id);
    for (const { check, msg } of rrs) {
      if (!check) { fieldError(id, msg); ok=false; break; }
    }
  });
  return ok;
}

// Auto-clear error on input
document.addEventListener('input', e => {
  if (e.target.id) clearFieldError(e.target.id);
});

// ── Domain validators ─────────────────────────────────────────────────
const Validate = {
  glucoseLog(d) {
    const s = typeof DB !== 'undefined' ? DB.go('settings') : {};
    const isMmol = s.glucUnit === 'mmol/L';
    const [minV, maxV] = isMmol ? [1.1, 38.9] : [20, 700];
    const unitLabel = s.glucUnit || 'mg/dL';
    return validateRules([
      { id:'gl-date',  rules:[
        { check: V.required(d.date),         msg:'Date is required' },
        { check: V.date(d.date),             msg:'Invalid date' },
        { check: V.notFuture(d.date),        msg:'Date cannot be in the future' },
      ]},
      { id:'gl-time',  rules:[
        { check: V.required(d.time),         msg:'Time is required' },
      ]},
      { id:'gl-value', rules:[
        { check: V.required(d.value),        msg:'Glucose value is required' },
        { check: V.number(d.value),          msg:'Must be a number' },
        { check: V.range(d.value, minV, maxV), msg:`Value must be ${minV}–${maxV} ${unitLabel}` },
      ]},
      { id:'gl-type',  rules:[
        { check: V.required(d.type),         msg:'Reading type is required' },
      ]},
    ]);
  },

  weightLog(d) {
    const s = typeof DB !== 'undefined' ? DB.go('settings') : {};
    const isLbs = s.weightUnit === 'lbs';
    const [minW, maxW] = isLbs ? [44, 1100] : [20, 500];
    const wUnit = s.weightUnit || 'kg';
    return validateRules([
      { id:'wl-date',   rules:[
        { check: V.required(d.date) && V.date(d.date), msg:'Valid date required' },
        { check: !d.date || V.notFuture(d.date),       msg:'Date cannot be in the future' },
      ]},
      { id:'wl-value',  rules:[
        { check: V.required(d.value),        msg:'Weight is required' },
        { check: V.range(d.value, minW, maxW), msg:`Weight must be ${minW}–${maxW} ${wUnit}` },
      ]},
    ]);
  },

  mealLog(d) {
    const validMeals = typeof C !== 'undefined' ? C.MEALS : [];
    return validateRules([
      { id:'ml-date',  rules:[
        { check: V.required(d.date) && V.date(d.date), msg:'Valid date required' },
        { check: !d.date || V.notFuture(d.date),       msg:'Date cannot be in the future' },
      ]},
      { id:'ml-meal',  rules:[
        { check: V.required(d.mealType),               msg:'Meal type is required' },
        { check: !validMeals.length || validMeals.includes(d.mealType), msg:'Invalid meal type' },
      ]},
      { id:'ml-food',  rules:[
        { check: V.required(d.description), msg:'Food description is required' },
        { check: V.maxLen(d.description, 500), msg:'Too long (max 500 chars)' },
        { check: V.noXSS(d.description),    msg:'Invalid characters' },
      ]},
    ]);
  },

  exerciseLog(d) {
    return validateRules([
      { id:'ex-date',  rules:[
        { check: V.required(d.date) && V.date(d.date), msg:'Valid date required' },
        { check: !d.date || V.notFuture(d.date),       msg:'Date cannot be in the future' },
      ]},
      { id:'ex-type',  rules:[{ check: V.required(d.type), msg:'Exercise type is required' }]},
      { id:'ex-dur',   rules:[
        { check: V.required(d.duration),     msg:'Duration is required' },
        { check: V.range(d.duration, 1, 600),msg:'Duration must be 1–600 min' },
      ]},
    ]);
  },

  insulinLog(d) {
    return validateRules([
      { id:'in-date',  rules:[
        { check: V.required(d.date) && V.date(d.date), msg:'Valid date required' },
        { check: !d.date || V.notFuture(d.date),       msg:'Date cannot be in the future' },
      ]},
      { id:'in-time',  rules:[{ check: V.required(d.time) && V.time(d.time), msg:'Time is required' }]},
      { id:'in-type',  rules:[{ check: V.required(d.insulinType), msg:'Insulin type is required' }]},
      { id:'in-units', rules:[
        { check: V.required(d.units),        msg:'Units are required' },
        { check: V.range(d.units, 0.5, 200), msg:'Units must be 0.5–200' },
      ]},
    ]);
  },

  sleepLog(d) {
    return validateRules([
      { id:'sl-date',  rules:[
        { check: V.required(d.date) && V.date(d.date), msg:'Valid date required' },
        { check: !d.date || V.notFuture(d.date),       msg:'Date cannot be in the future' },
      ]},
      { id:'sl-hours', rules:[
        { check: V.required(d.hours),        msg:'Sleep hours required' },
        { check: V.range(d.hours, 0, 24),    msg:'Hours must be 0–24' },
      ]},
      { id:'sl-stress',rules:[
        { check: V.required(d.stress),       msg:'Stress level required' },
        { check: V.range(d.stress, 1, 10),   msg:'Stress must be 1–10' },
      ]},
    ]);
  },

  labResult(d) {
    return validateRules([
      { id:'lr-date',  rules:[{ check: V.required(d.date) && V.date(d.date), msg:'Valid date required' }]},
      { id:'lr-test',  rules:[{ check: V.required(d.test), msg:'Test name is required' }]},
      { id:'lr-value', rules:[
        { check: V.required(d.value),        msg:'Value is required' },
        { check: V.number(d.value),          msg:'Must be a number' },
        { check: V.positive(d.value),        msg:'Must be positive' },
      ]},
    ]);
  },

  medication(d) {
    return validateRules([
      { id:'med-name', rules:[
        { check: V.required(d.name),         msg:'Medication name is required' },
        { check: V.maxLen(d.name, 100),      msg:'Too long' },
        { check: V.noXSS(d.name),           msg:'Invalid characters' },
      ]},
      { id:'med-dose', rules:[
        { check: V.required(d.dosage),       msg:'Dosage is required' },
      ]},
      { id:'med-freq', rules:[
        { check: V.required(d.frequency),   msg:'Frequency is required' },
      ]},
      { id:'med-start',rules:[
        { check: V.required(d.startDate) && V.date(d.startDate), msg:'Valid start date required' },
      ]},
    ]);
  },

  goal(d) {
    return validateRules([
      { id:'goal-type',   rules:[{ check: V.required(d.type),   msg:'Goal type is required' }]},
      { id:'goal-target', rules:[
        { check: V.required(d.target),       msg:'Target value is required' },
        { check: V.number(d.target),         msg:'Must be a number' },
        { check: V.positive(d.target),       msg:'Must be positive' },
      ]},
      { id:'goal-by',     rules:[{ check: V.required(d.by) && V.date(d.by), msg:'Valid target date required' }]},
    ]);
  },

  profile(d) {
    return validateRules([
      { id:'pf-name',   rules:[
        { check: V.required(d.name),         msg:'Name is required' },
        { check: V.maxLen(d.name, 80),       msg:'Too long' },
        { check: V.noXSS(d.name),           msg:'Invalid characters' },
      ]},
      { id:'pf-label',  rules:[
        { check: V.required(d.label),        msg:'Profile label is required' },
      ]},
    ]);
  },
};
