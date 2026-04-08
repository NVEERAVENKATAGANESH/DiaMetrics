// DiaMetrics — constants.js
'use strict';

const C = {
  APP: 'DiaMetrics',
  VERSION: 'dm_v1',
  MIGRATION: 'dm_mg1',

  // Glucose ranges (mg/dL)
  GLUCOSE: {
    HYPO:        70,   // below = hypoglycemia
    NORMAL_LOW:  70,
    NORMAL_HIGH: 140,
    HIGH:        180,
    VERY_HIGH:   250,
    UNITS: { MG: 'mg/dL', MMOL: 'mmol/L' },
    // mg/dL → mmol/L: divide by 18.0182
    MMOL_FACTOR: 18.0182,
  },

  // HbA1c (%)
  A1C: {
    NORMAL:  5.7,
    PRE:     6.4,
    DIABETIC: 6.5,
    TARGET:  7.0,  // ADA target for most diabetics
  },

  // Blood Pressure (mmHg)
  BP: {
    SYSTOLIC:  { NORMAL: 120, HIGH: 130, CRISIS: 180 },
    DIASTOLIC: { NORMAL: 80,  HIGH: 80,  CRISIS: 120 },
  },

  // BMI categories
  BMI: {
    UNDERWEIGHT: 18.5,
    NORMAL:      24.9,
    OVERWEIGHT:  29.9,
    // >= 30 = Obese
  },

  // Weight units
  WEIGHT: { KG: 'kg', LBS: 'lbs', LBS_FACTOR: 2.20462 },

  // Height units
  HEIGHT: { CM: 'cm', FT: 'ft/in', CM_FACTOR: 30.48, IN_FACTOR: 2.54 },

  // Glucose reading types
  READING_TYPES: ['Fasting', 'Pre-Meal', 'Post-Meal', 'Bedtime', 'Random'],

  // Meal types
  MEALS: ['Breakfast', 'Lunch', 'Dinner', 'Snack'],

  // Exercise types
  EXERCISE_TYPES: ['Walking', 'Running', 'Cycling', 'Swimming', 'Yoga', 'Gym / Weights', 'Sports', 'Other'],

  // Intensity levels
  INTENSITY: ['Light', 'Moderate', 'Vigorous'],

  // Insulin types
  INSULIN_TYPES: ['Rapid-acting', 'Short-acting', 'Intermediate-acting', 'Long-acting', 'Pre-mixed'],

  // Injection sites
  INJECTION_SITES: ['Abdomen', 'Left Thigh', 'Right Thigh', 'Left Arm', 'Right Arm', 'Left Buttock', 'Right Buttock'],

  // Symptom tags
  SYMPTOMS: ['Fatigue', 'Thirst', 'Blurred Vision', 'Dizziness', 'Headache', 'Frequent Urination', 'Nausea', 'Sweating', 'Tingling', 'Numbness'],

  // Medication frequency options
  FREQ: ['Once daily', 'Twice daily', 'Three times daily', 'With meals', 'As needed', 'Weekly'],

  // Lab test names (includes BP as separate systolic/diastolic)
  LAB_TESTS: ['HbA1c', 'Fasting Glucose', 'Cholesterol (Total)', 'LDL Cholesterol', 'HDL Cholesterol', 'Triglycerides', 'eGFR', 'Creatinine', 'Urine Albumin', 'Systolic BP', 'Diastolic BP'],

  // Lab reference ranges
  LAB_RANGES: {
    'HbA1c':             { unit: '%',        normal: [0, 5.7],    pre: [5.7, 6.4],  high: [6.4, 999]  },
    'Fasting Glucose':   { unit: 'mg/dL',    normal: [70, 100],   pre: [100, 125],  high: [125, 999]  },
    'Systolic BP':       { unit: 'mmHg',     normal: [0, 120],    pre: [120, 129],  high: [129, 999]  },
    'Diastolic BP':      { unit: 'mmHg',     normal: [0, 80],     pre: [80, 89],    high: [89, 999]   },
    'Cholesterol (Total)':{ unit: 'mg/dL',   normal: [0, 200],    pre: [200, 239],  high: [239, 999]  },
    'LDL Cholesterol':   { unit: 'mg/dL',    normal: [0, 100],    pre: [100, 129],  high: [129, 999]  },
    'HDL Cholesterol':   { unit: 'mg/dL',    normal: [60, 999],   pre: [40, 60],    high: [0, 40]     },
    'Triglycerides':     { unit: 'mg/dL',    normal: [0, 150],    pre: [150, 199],  high: [199, 999]  },
    'eGFR':              { unit: 'mL/min',   normal: [60, 999],   pre: [45, 60],    high: [0, 45]     },
    'Creatinine':        { unit: 'mg/dL',    normal: [0.6, 1.2],  pre: [1.2, 1.5],  high: [1.5, 999]  },
    'Urine Albumin':     { unit: 'mg/g',     normal: [0, 30],     pre: [30, 300],   high: [300, 999]  },
  },

  // Achievement badge definitions
  BADGES: [
    { id: 'first_log',      label: 'First Log',         desc: 'Logged your first glucose reading',     icon: '📝' },
    { id: 'streak_7',       label: '7-Day Streak',      desc: 'Logged every day for 7 days',           icon: '🔥' },
    { id: 'streak_30',      label: '30-Day Streak',     desc: 'Logged every day for 30 days',          icon: '🏅' },
    { id: 'streak_90',      label: '90-Day Champion',   desc: 'Logged every day for 90 days',          icon: '🏆' },
    { id: 'in_range_7',     label: 'On Target',         desc: 'Stayed in range 7 days in a row',       icon: '🎯' },
    { id: 'first_a1c',      label: 'A1c Logged',        desc: 'Logged your first HbA1c result',        icon: '🧪' },
    { id: 'first_exercise', label: 'Active',            desc: 'Logged your first exercise session',    icon: '🏃' },
    { id: 'first_meal',     label: 'Meal Tracker',      desc: 'Logged your first meal',                icon: '🍽️' },
    { id: 'goal_hit',       label: 'Goal Achiever',     desc: 'Hit a personal health goal',            icon: '✅' },
    { id: 'weight_down',    label: 'Weight Progress',   desc: 'Lost weight since first log',           icon: '⚖️' },
    { id: 'meds_7',         label: 'Med Adherent',      desc: '7-day medication adherence ≥ 90%',      icon: '💊' },
    { id: 'low_a1c',        label: 'A1c Champion',      desc: 'HbA1c below 7.0% logged',               icon: '🌟' },
  ],

  // Notification types
  NOTIF_TAGS: {
    glucose:    { color: '#ef4444', label: 'Glucose' },
    medication: { color: '#8b5cf6', label: 'Medication' },
    lab:        { color: '#3b82f6', label: 'Lab Result' },
    goal:       { color: '#10b981', label: 'Goal' },
    reminder:   { color: '#f59e0b', label: 'Reminder' },
    achievement:{ color: '#f97316', label: 'Achievement' },
  },

  // Page size for pagination
  PAGE_SIZE: 10,

  // Session timeout (ms)
  SESSION_TIMEOUT: 30 * 60 * 1000,
  SESSION_WARN:    60 * 1000,

  // Inactivity events
  ACTIVITY_EVENTS: ['mousemove', 'keydown', 'click', 'touchstart'],

  // Demo credentials
  DEMO: {
    user:  { username: 'demo',       password: 'demo123'   },
    admin: { username: 'diadmin',    password: 'admin123'  },
  },
};
