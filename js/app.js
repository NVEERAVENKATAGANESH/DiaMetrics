// DiaMetrics — app.js  (router, init, landing)
'use strict';

// ── Page registry ─────────────────────────────────────────────────────
const PAGES = {
  landing:     { auth: false, render: rLanding   },
  dashboard:   { auth: true,  render: rDashboard  },
  glucose:     { auth: true,  render: rGlucoseLogs},
  weight:      { auth: true,  render: rWeightLogs },
  meals:       { auth: true,  render: rMealLogs   },
  exercise:    { auth: true,  render: rExerciseLogs},
  insulin:     { auth: true,  render: rInsulinLogs },
  sleep:       { auth: true,  render: rSleepLogs  },
  notes:       { auth: true,  render: rNotes      },
  labs:        { auth: true,  render: rLabs       },
  medications: { auth: true,  render: rMedications},
  analytics:   { auth: true,  render: rAnalytics  },
  goals:       { auth: true,  render: rGoals      },
  achievements:{ auth: true,  render: rAchievements},
  calendar:    { auth: true,  render: rCalendar   },
  reports:     { auth: true,  render: rReports    },
  profiles:    { auth: true,  render: rProfiles   },
  auditlog:    { auth: true,  render: rAuditLog   },
  settings:    { auth: true,  render: rSettings   },
};

// ── Router ────────────────────────────────────────────────────────────
function go(pageId) {
  const page = PAGES[pageId];
  if (!page) { console.warn('Unknown page:', pageId); return; }

  if (page.auth && !State.user) {
    openM('m-login');
    return;
  }

  State.page = pageId;

  // Hide all sections
  $qa('.page-section').forEach(s => s.style.display = 'none');

  // Show landing or app shell
  if (pageId === 'landing') {
    $('landing-view')   && ($('landing-view').style.display   = 'block');
    $('app-shell')      && ($('app-shell').style.display      = 'none');
    return;
  }

  $('landing-view') && ($('landing-view').style.display = 'none');
  $('app-shell')    && ($('app-shell').style.display    = 'flex');

  const section = $('page-' + pageId);
  if (section) section.style.display = 'block';

  // Update nav active state — nav-links (dropdown items, mobile) + direct tn-tab buttons
  $qa('.nav-link, .tn-tab[data-page]').forEach(a => {
    a.classList.toggle('nav-active', a.dataset.page === pageId);
  });

  // Highlight active group in desktop nav
  const PAGE_GROUP = {
    dashboard:'Overview', calendar:'Overview', analytics:'Overview',
    glucose:'Logs', weight:'Logs', meals:'Logs', exercise:'Logs',
    insulin:'Logs', sleep:'Logs', notes:'Logs',
    labs:'Health', medications:'Health', goals:'Health', achievements:'Health',
    reports:'Reports', auditlog:'Reports',
  };
  const activeGroup = PAGE_GROUP[pageId] || '';
  $qa('.tn-group').forEach(g => {
    const btn = g.querySelector('.tn-has-drop');
    const label = btn?.firstChild?.textContent?.trim() || '';
    g.classList.toggle('active-group', label === activeGroup);
  });

  // Render with skeleton → real content
  try {
    page.render();
  } catch(e) {
    console.error('Page render error:', e);
    const sec = $('page-' + pageId);
    if (sec) sec.innerHTML = `<div class="error-boundary">Something went wrong loading this page.<br><small>${esc(e.message)}</small></div>`;
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
  // Close mobile drawer
  if (typeof closeMobDrawer === 'function') closeMobDrawer();
}

// ── Landing page ──────────────────────────────────────────────────────
function rLanding() {
  try {
    const demoUser = DB.gAll('users').find(u => u._demo);
    const demoProf = DB.gAll('profiles').find(p => p._demo && p.userId === demoUser?.id);
    if (!demoProf) return;
    const logs = DB.gAll('glucoseLogs').filter(l => l._demo && l.profileId === demoProf.id
                  && l.date >= D.daysAgo(29));
    if (!logs.length) return;
    const tir    = Calc.timeInRange(logs);
    const estA1c = Model.estimatedA1c(logs);
    const avgG   = avg(logs.map(l => l.value));
    const streak = Calc.loggingStreak(logs);
    const tirEl    = $('lp-tir');
    const a1cEl    = $('lp-a1c');
    const avgEl    = $('lp-avg');
    const streakEl = $('lp-streak');
    if (tirEl)    tirEl.textContent    = tir + '%';
    if (a1cEl)    a1cEl.textContent    = estA1c ? estA1c + '%' : '—';
    if (avgEl)    avgEl.textContent    = avgG || '—';
    if (streakEl) streakEl.textContent = streak + 'd';
  } catch(e) { /* static fallback values remain */ }
}

// ── Init ──────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  // Apply theme immediately
  State.applyTheme();

  // Seed demo data
  await seed();

  // Wire nav links
  $qa('[data-page]').forEach(el => {
    el.addEventListener('click', () => go(el.dataset.page));
  });

  // Try restore session
  const restored = Auth.tryRestoreSession();
  if (!restored) go('landing');

  // Schedule daily reminders after login (permission requested only from Settings)
  if (restored) {
    Reminders.scheduleDaily();
  }

  // UI helpers
  initScrollTop();
  initThemeToggle();
  initSidebar();
  initMobileNav();

  // Pagination re-render dispatcher
  document.addEventListener('dm-paginate', e => {
    const pageId = State.page;
    const def    = PAGES[pageId];
    if (def?.render) def.render();
  });

  // Profile switcher in topbar
  _bindProfileSwitcher();
});

// ── Profile switcher (topbar) ─────────────────────────────────────────
function _bindProfileSwitcher() {
  const sel = $('topbar-profile');
  if (!sel) return;
  sel.addEventListener('change', () => {
    State.activeProfile = +sel.value;
    go(State.page === 'landing' ? 'dashboard' : State.page);
  });
}

function _renderProfileSwitcher() {
  const sel = $('topbar-profile');
  if (!sel || !State.user) return;
  const profiles = DB.g('profiles').filter(p => p.userId === State.user.id);
  sel.innerHTML = profiles.map(p =>
    `<option value="${p.id}" ${p.id === State.activeProfile ? 'selected' : ''}>${esc(p.label)} — ${esc(p.name)}</option>`
  ).join('');
  sel.style.display = profiles.length > 1 ? 'inline-block' : 'none';
}

// ── Topbar user name ──────────────────────────────────────────────────
function _updateTopbar() {
  const u = State.user;
  const nameEl = $('topbar-name');
  if (nameEl && u) nameEl.textContent = u.displayName || u.username;
  const avatarEl = $('tn-avatar');
  if (avatarEl && u) avatarEl.textContent = (u.displayName || u.username || '?')[0].toUpperCase();
  _renderProfileSwitcher();
  Notifs.updateBadge();
}

// Hook into go() to update topbar
;(function() {
  const orig = window.go;
  window.go = function(id) {
    orig(id);
    if (State.user) _updateTopbar();
  };
})();

// ── Reusable stat card helper (used by dashboard & analytics) ─────────
function _statCard(id, value, label, cls) {
  const el = $(id);
  if (!el) return;
  el.innerHTML = `
    <div class="stat-value ${cls ? 'stat-' + cls : ''}">${value}</div>
    <div class="stat-label">${esc(label)}</div>`;
}
