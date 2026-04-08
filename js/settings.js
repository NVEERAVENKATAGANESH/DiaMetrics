// DiaMetrics — settings.js
'use strict';

function rSettings() {
  const s = DB.go('settings');
  // Update reminder button state
  const notifBtn = $('set-notif-btn');
  if (notifBtn) {
    const granted = window.Notification?.permission === 'granted';
    notifBtn.textContent = granted ? '✅ Reminders On' : 'Enable Reminders';
    notifBtn.className   = 'btn btn-sm ' + (granted ? 'btn-g' : 'btn-p');
  }
  _setVal('set-gluc-unit',    s.glucUnit    || 'mg/dL');
  _setVal('set-weight-unit',  s.weightUnit  || 'kg');
  _setVal('set-height-unit',  s.heightUnit  || 'cm');
  _setVal('set-theme',        s.theme       || 'light');
  _setVal('set-gluc-low',     s.glucLow     || C.GLUCOSE.NORMAL_LOW);
  _setVal('set-gluc-high',    s.glucHigh    || C.GLUCOSE.NORMAL_HIGH);
  _setVal('set-period-name',  s.periodName  || 'Tracking Period');
  _setVal('set-period-start', s.periodStart || '');
  _setVal('set-period-end',   s.periodEnd   || '');

  const u = State.user;
  if ($('set-username'))    $('set-username').textContent    = u?.username    || '—';
  if ($('set-displayname')) $('set-displayname').textContent = u?.displayName || '—';
  if ($('set-email'))       $('set-email').textContent       = u?.email       || '—';

  const usedEl = $('set-storage');
  if (usedEl) usedEl.textContent = DB.usedKB() + ' KB used';
}

function _setVal(id, val) {
  const el = $(id);
  if (!el) return;
  el.value = val;
}

function saveSettings() {
  const s = {
    glucUnit:    $('set-gluc-unit')?.value   || 'mg/dL',
    weightUnit:  $('set-weight-unit')?.value || 'kg',
    heightUnit:  $('set-height-unit')?.value || 'cm',
    theme:       $('set-theme')?.value       || 'light',
    glucLow:     +($('set-gluc-low')?.value  || C.GLUCOSE.NORMAL_LOW),
    glucHigh:    +($('set-gluc-high')?.value || C.GLUCOSE.NORMAL_HIGH),
    periodName:  $('set-period-name')?.value || 'Tracking Period',
    periodStart: $('set-period-start')?.value || '',
    periodEnd:   $('set-period-end')?.value   || '',
  };

  // Validate glucose targets
  if (s.glucLow >= s.glucHigh) {
    toast('Low threshold must be less than high threshold', false); return;
  }

  DB.so('settings', s);
  State.setTheme(s.theme);
  // Restart reminders with updated medication schedule
  if (typeof Reminders !== 'undefined') Reminders.scheduleDaily();
  toast('Settings saved', true);
  rSettings();
}

async function toggleReminders() {
  if (!('Notification' in window)) { toast('Browser notifications not supported', false); return; }
  if (Notification.permission === 'granted') {
    toast('Reminders are on. To disable, change your browser notification settings for this page.', false);
    return;
  }
  const granted = await Reminders.requestPermission();
  if (granted) {
    Reminders.scheduleDaily();
    toast('Reminders enabled!', true);
  } else {
    toast('Permission denied — check browser settings', false);
  }
  rSettings();
}

function resetSettings() {
  confirmDlg('Reset all settings to defaults?', () => {
    DB.so('settings', {});
    State.setTheme('light');
    rSettings();
    toast('Settings reset', true);
  });
}

// ── Reset demo data ───────────────────────────────────────────────────
function resetDemoData() {
  confirmDlg('Re-seed demo data? This will refresh all demo records.', async () => {
    // Remove seeded flag and re-seed
    localStorage.removeItem('dm_' + C.VERSION);
    await seed();
    toast('Demo data refreshed', true);
  });
}

// ── Delete account ────────────────────────────────────────────────────
function deleteAccount() {
  confirmDlg('Delete your account and ALL data? This cannot be undone.', () => {
    DB.clearAll();
    Auth.logout();
    toast('Account deleted', false);
  }, true, 'Delete Everything');
}

// ── Clear profile data ────────────────────────────────────────────────
function clearProfileData() {
  const pid = State.activeProfile;
  if (!pid) { toast('No profile selected', false); return; }
  confirmDlg('Clear all health logs for this profile? Medications and goals will remain.', () => {
    ['glucoseLogs','weightLogs','mealLogs','exerciseLogs','insulinLogs','sleepLogs','labResults','notes','achievements'].forEach(key => {
      DB.update(key, arr => arr.filter(r => r.profileId !== pid));
    });
    toast('Profile data cleared', false);
  }, true, 'Clear Data');
}
