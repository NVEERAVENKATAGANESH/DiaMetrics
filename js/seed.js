// DiaMetrics — seed.js  (demo data — ONLY visible to demo users)
'use strict';

async function seed() {
  if (DB.seeded()) return;

  const _d = true; // _demo flag

  // ── Users ──────────────────────────────────────────────────────
  // demo / demo123 → sha256('demo:demo123')
  // diadmin / admin123 → sha256('diadmin:admin123')
  const demoHash  = await sha256('demo:demo123');
  const adminHash = await sha256('diadmin:admin123');

  const users = [
    { id:1, username:'demo',    email:'demo@diametrics.app',   displayName:'Prabhas U',      passwordHash: demoHash,  role:'user',  _demo:_d, createdAt:'2025-10-01T08:00:00Z' },
    { id:2, username:'diadmin', email:'admin@diametrics.app',  displayName:'Raashi Khanna',  passwordHash: adminHash, role:'admin', _demo:_d, createdAt:'2025-09-01T08:00:00Z' },
  ];

  // ── Profiles ────────────────────────────────────────────────────
  const profiles = [
    { id:1, userId:1, label:'Me',    name:'Prabhas U',     dob:'1985-06-15', gender:'Male',   heightCm:175, weightKg:82,
      familyDiabetes:true, hypertension:false, gestationalDiabetes:false,
      doctor:'NTR', doctorPhone:'+91-9876543210', isDefault:true, _demo:_d, createdAt:'2025-10-01T08:00:00Z' },
    { id:2, userId:1, label:'Mom',   name:'Raashi Khanna', dob:'1958-03-22', gender:'Female', heightCm:158, weightKg:68,
      familyDiabetes:true, hypertension:true, gestationalDiabetes:false,
      doctor:'Yash', doctorPhone:'+91-9876543210', isDefault:false, _demo:_d, createdAt:'2025-10-05T08:00:00Z' },
  ];

  // ── Generate 90-day glucose logs for profile 1 ─────────────────
  const glucoseLogs = [];
  let gid = 1;
  for (let i = 89; i >= 0; i--) {
    const date = D.daysAgo(i);
    // 2–3 readings per day
    const readings = [
      { type:'Fasting',   hour:'07:00', base: 110, noise: 25 },
      { type:'Post-Meal', hour:'13:30', base: 145, noise: 40 },
      { type:'Bedtime',   hour:'21:00', base: 125, noise: 30 },
    ];
    readings.forEach(r => {
      if (Math.random() > 0.15) { // 85% chance per reading
        const value = Math.round(r.base + (Math.random()-0.5)*r.noise*2);
        glucoseLogs.push({ id:gid++, profileId:1, date, time:r.hour, value, type:r.type, notes:'', _demo:_d });
      }
    });
  }

  // ── Weight logs (weekly) ────────────────────────────────────────
  const weightLogs = [];
  let wid = 1;
  let wt = 82.5;
  for (let i = 12; i >= 0; i--) {
    const date = D.daysAgo(i * 7);
    wt = +(wt - (Math.random()*0.4)).toFixed(1); // slow downward trend
    weightLogs.push({ id:wid++, profileId:1, date, value: Math.max(78, wt), notes:'', _demo:_d });
  }

  // ── Meal logs ───────────────────────────────────────────────────
  const mealLogs = [];
  let mid = 1;
  const mealSamples = [
    { mealType:'Breakfast', description:'Oats with skim milk, banana',        carbsG:55, caloriesKcal:320 },
    { mealType:'Breakfast', description:'2 eggs, whole wheat toast, OJ',       carbsG:40, caloriesKcal:380 },
    { mealType:'Lunch',     description:'Brown rice, dal, sabzi, curd',        carbsG:70, caloriesKcal:520 },
    { mealType:'Lunch',     description:'Chapati x3, chicken curry, salad',    carbsG:60, caloriesKcal:580 },
    { mealType:'Dinner',    description:'Khichdi, stir-fried vegetables',      carbsG:50, caloriesKcal:440 },
    { mealType:'Dinner',    description:'Grilled fish, quinoa, greens',        carbsG:35, caloriesKcal:420 },
    { mealType:'Snack',     description:'Apple, handful of almonds',           carbsG:25, caloriesKcal:180 },
    { mealType:'Snack',     description:'Roasted chana, green tea',            carbsG:20, caloriesKcal:140 },
  ];
  for (let i = 29; i >= 0; i--) {
    const date = D.daysAgo(i);
    [0,1,2].forEach(m => {
      const s = mealSamples[Math.floor(Math.random()*mealSamples.length)];
      mealLogs.push({ id:mid++, profileId:1, date, ...s, tags:[], notes:'', _demo:_d });
    });
  }

  // ── Exercise logs ───────────────────────────────────────────────
  const exerciseLogs = [];
  let eid = 1;
  const exTypes = ['Walking','Cycling','Yoga','Running'];
  for (let i = 30; i >= 0; i--) {
    if (Math.random() > 0.35) { // 65% days have exercise
      const date = D.daysAgo(i);
      exerciseLogs.push({
        id: eid++, profileId:1, date,
        type: exTypes[Math.floor(Math.random()*exTypes.length)],
        duration: 20 + Math.round(Math.random()*40),
        intensity: ['Light','Moderate','Vigorous'][Math.floor(Math.random()*3)],
        steps: Math.round(3000 + Math.random()*7000),
        notes:'', _demo:_d,
      });
    }
  }

  // ── Insulin logs ────────────────────────────────────────────────
  const insulinLogs = [];
  let iid = 1;
  for (let i = 30; i >= 0; i--) {
    const date = D.daysAgo(i);
    insulinLogs.push({ id:iid++, profileId:1, date, time:'07:30', insulinType:'Long-acting', units:20, site:'Abdomen', notes:'', _demo:_d });
    if (Math.random() > 0.4) {
      insulinLogs.push({ id:iid++, profileId:1, date, time:'13:00', insulinType:'Rapid-acting', units:6, site:'Left Thigh', notes:'', _demo:_d });
    }
  }

  // ── Sleep logs ──────────────────────────────────────────────────
  const sleepLogs = [];
  let slid = 1;
  for (let i = 30; i >= 0; i--) {
    const date = D.daysAgo(i);
    sleepLogs.push({
      id: slid++, profileId:1, date,
      hours: +(6 + Math.random()*2.5).toFixed(1),
      quality: Math.ceil(Math.random()*5),
      stress: Math.ceil(Math.random()*7),
      notes:'', _demo:_d,
    });
  }

  // ── Lab results ─────────────────────────────────────────────────
  const labResults = [
    { id:1,  profileId:1, date:'2025-10-01', test:'HbA1c',             value:7.8, notes:'Baseline',          _demo:_d },
    { id:2,  profileId:1, date:'2025-10-01', test:'Fasting Glucose',    value:138, notes:'Fasting baseline',   _demo:_d },
    { id:3,  profileId:1, date:'2025-10-01', test:'Cholesterol (Total)', value:210, notes:'',                  _demo:_d },
    { id:4,  profileId:1, date:'2025-10-01', test:'LDL Cholesterol',     value:128, notes:'',                  _demo:_d },
    { id:5,  profileId:1, date:'2025-10-01', test:'HDL Cholesterol',     value:45,  notes:'',                  _demo:_d },
    { id:6,  profileId:1, date:'2025-10-01', test:'Triglycerides',       value:175, notes:'',                  _demo:_d },
    { id:7,  profileId:1, date:'2025-10-01', test:'eGFR',               value:78,  notes:'',                  _demo:_d },
    { id:8,  profileId:1, date:'2025-10-01', test:'Creatinine',          value:1.0, notes:'',                  _demo:_d },
    { id:9,  profileId:1, date:'2026-01-05', test:'HbA1c',             value:7.2, notes:'After 3 months',     _demo:_d },
    { id:10, profileId:1, date:'2026-01-05', test:'Fasting Glucose',    value:118, notes:'Improved',           _demo:_d },
    { id:11, profileId:1, date:'2026-01-05', test:'Cholesterol (Total)', value:198, notes:'',                  _demo:_d },
    { id:12, profileId:1, date:'2026-01-05', test:'LDL Cholesterol',     value:112, notes:'',                  _demo:_d },
    { id:13, profileId:1, date:'2026-03-01', test:'HbA1c',             value:6.9, notes:'Latest',             _demo:_d },
    { id:14, profileId:1, date:'2026-03-01', test:'Triglycerides',       value:152, notes:'',                  _demo:_d },
  ];

  // ── Medications ─────────────────────────────────────────────────
  const medications = [
    { id:1, profileId:1, name:'Metformin',    dosage:'500mg',  frequency:'Twice daily',  timeOfDay:'Morning,Evening', startDate:'2025-10-01', refillDate:'2026-04-01', active:true, notes:'Take with food', _demo:_d },
    { id:2, profileId:1, name:'Glimepiride',  dosage:'2mg',    frequency:'Once daily',   timeOfDay:'Morning',        startDate:'2025-10-01', refillDate:'2026-04-01', active:true, notes:'', _demo:_d },
    { id:3, profileId:1, name:'Atorvastatin', dosage:'20mg',   frequency:'Once daily',   timeOfDay:'Night',          startDate:'2025-10-01', refillDate:'2026-04-01', active:true, notes:'For cholesterol', _demo:_d },
    { id:4, profileId:1, name:'Aspirin',      dosage:'75mg',   frequency:'Once daily',   timeOfDay:'Morning',        startDate:'2025-10-01', refillDate:'2026-04-01', active:true, notes:'', _demo:_d },
  ];

  // ── Medication doses (last 7 days) ──────────────────────────────
  const medDoses = [];
  let did = 1;
  for (let i = 6; i >= 0; i--) {
    const date = D.daysAgo(i);
    medications.slice(0,4).forEach(m => {
      medDoses.push({ id:did++, profileId:1, medicationId:m.id, date, taken: Math.random()>0.1, _demo:_d });
    });
  }

  // ── Goals ───────────────────────────────────────────────────────
  const goals = [
    { id:1, profileId:1, type:'HbA1c',          target:6.5, current:6.9, unit:'%',     by:'2026-06-30', achieved:false, notes:'',          _demo:_d, createdAt:'2026-01-01T00:00:00Z' },
    { id:2, profileId:1, type:'Fasting Glucose', target:100, current:118, unit:'mg/dL', by:'2026-06-30', achieved:false, notes:'',          _demo:_d, createdAt:'2026-01-01T00:00:00Z' },
    { id:3, profileId:1, type:'Weight',          target:76,  current:80,  unit:'kg',    by:'2026-06-30', achieved:false, notes:'Lose 4 kg', _demo:_d, createdAt:'2026-01-01T00:00:00Z' },
    { id:4, profileId:1, type:'Steps',           target:8000,current:6500,unit:'steps', by:'2026-04-30', achieved:false, notes:'',          _demo:_d, createdAt:'2026-02-01T00:00:00Z' },
  ];

  // ── Achievements ────────────────────────────────────────────────
  const achievements = [
    { id:1, profileId:1, badgeId:'first_log',  earnedAt:'2025-10-01T09:00:00Z', _demo:_d },
    { id:2, profileId:1, badgeId:'first_a1c',  earnedAt:'2025-10-01T09:05:00Z', _demo:_d },
    { id:3, profileId:1, badgeId:'streak_7',   earnedAt:'2025-10-08T09:00:00Z', _demo:_d },
    { id:4, profileId:1, badgeId:'first_exercise', earnedAt:'2025-10-02T09:00:00Z', _demo:_d },
    { id:5, profileId:1, badgeId:'first_meal', earnedAt:'2025-10-01T12:00:00Z', _demo:_d },
  ];

  // ── Notes / journal ─────────────────────────────────────────────
  const notes = [
    { id:1, profileId:1, date:'2025-10-01', text:'Starting my health tracking journey. Doctor recommended logging everything carefully.', symptoms:['Fatigue','Thirst'], _demo:_d },
    { id:2, profileId:1, date:'2025-11-15', text:'Feeling much better after cutting down on rice portions. Glucose spikes are lower.', symptoms:[], _demo:_d },
    { id:3, profileId:1, date:'2026-01-05', text:'HbA1c down to 7.2! Doctor is happy with progress. Continuing current medication.', symptoms:[], _demo:_d },
    { id:4, profileId:1, date:'2026-02-14', text:'Started 30-min morning walk daily. Noticing better post-meal readings.', symptoms:[], _demo:_d },
    { id:5, profileId:1, date:'2026-03-01', text:'HbA1c now 6.9! Getting closer to the 6.5 target.', symptoms:[], _demo:_d },
  ];

  // ── Notifications ───────────────────────────────────────────────
  const notifications = [
    { id:1, uid:1, title:'HbA1c Improved!',   body:'Your HbA1c dropped from 7.8% to 7.2% — great progress!', tag:'lab',         read:false, ts:'2026-01-05T10:00:00Z', _demo:_d },
    { id:2, uid:1, title:'7-Day Streak!',     body:'You logged glucose every day for 7 days. Badge earned.',  tag:'achievement', read:false, ts:'2025-10-08T09:00:00Z', _demo:_d },
    { id:3, uid:1, title:'Medication Reminder',body:'Time to take your Metformin (Evening dose).',            tag:'medication',  read:true,  ts:'2026-03-30T18:00:00Z', _demo:_d },
    { id:4, uid:1, title:'Lab Result Due',    body:'Your 3-month HbA1c check is coming up this week.',        tag:'reminder',    read:true,  ts:'2026-03-25T09:00:00Z', _demo:_d },
    { id:5, uid:1, title:'Goal Progress',     body:'You are 80% toward your HbA1c goal of 6.5%!',            tag:'goal',        read:false, ts:'2026-03-15T08:00:00Z', _demo:_d },
  ];

  // ── Write all to storage ─────────────────────────────────────────
  const store = (k, v) => localStorage.setItem('dm_' + k, JSON.stringify(v));
  store('users',        users);
  store('profiles',     profiles);
  store('glucoseLogs',  glucoseLogs);
  store('weightLogs',   weightLogs);
  store('mealLogs',     mealLogs);
  store('exerciseLogs', exerciseLogs);
  store('insulinLogs',  insulinLogs);
  store('sleepLogs',    sleepLogs);
  store('labResults',   labResults);
  store('medications',  medications);
  store('medDoses',     medDoses);
  store('goals',        goals);
  store('achievements', achievements);
  store('notes',        notes);
  store('notifications',notifications);

  if (!localStorage.getItem('dm_settings')) {
    localStorage.setItem('dm_settings', JSON.stringify({
      glucUnit:    'mg/dL',
      weightUnit:  'kg',
      heightUnit:  'cm',
      theme:       'light',
      glucLow:     70,
      glucHigh:    140,
      periodName:  'Tracking Period',
      periodStart: '',
      periodEnd:   '',
    }));
  }

  DB.markSeeded();
  console.log('[DiaMetrics] Demo data seeded.');
}
