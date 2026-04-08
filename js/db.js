// DiaMetrics — db.js
'use strict';

const DB = (() => {
  const PFX = 'dm_';

  // ── Low-level helpers ─────────────────────────────────────────────
  function _key(k)  { return PFX + k; }
  function _raw(k)  { return localStorage.getItem(_key(k)); }
  function _set(k, v) {
    try {
      localStorage.setItem(_key(k), JSON.stringify(v));
    } catch(e) {
      if (e.name === 'QuotaExceededError') {
        _warnQuota();
      }
      throw e;
    }
  }

  function _warnQuota() {
    const used = _storageUsed();
    if (window.toast) toast(`Storage full (${used} KB used). Export a backup and clear old data.`, false);
    else alert('Storage quota exceeded. Please export a backup.');
  }

  // ── Filtering: demo records hidden from non-demo users ────────────
  function _isDemo() {
    const u = State.user;
    return u && (u._demo === true);
  }

  function _filter(arr) {
    if (_isDemo()) return arr;
    return arr.filter(r => !r._demo);
  }

  // ── Public API ────────────────────────────────────────────────────
  return {
    /** Get array for current profile (or user) */
    g(key) {
      const raw = _raw(key);
      const arr = raw ? JSON.parse(raw) : [];
      return _filter(arr);
    },

    /** Get raw array (unfiltered — used internally, seed, export) */
    gAll(key) {
      const raw = _raw(key);
      return raw ? JSON.parse(raw) : [];
    },

    /** Set array (merges demo records back in) */
    s(key, arr) {
      const demos = this.gAll(key).filter(r => r._demo);
      _set(key, [...demos, ...arr.filter(r => !r._demo)]);
    },

    /** Get object (settings, not array) */
    go(key, def = {}) {
      const raw = _raw(key);
      return raw ? JSON.parse(raw) : def;
    },

    /** Set object */
    so(key, obj) {
      _set(key, obj);
    },

    /** Transactional update: fn receives clone, returns modified */
    update(key, fn) {
      const arr = this.g(key);
      const updated = fn([...arr]);
      this.s(key, updated);
    },

    /** Write an audit log entry (action, entity, id, summary) */
    audit(action, entity, entityId, summary) {
      try {
        const all = this.gAll('audit');
        const uid = (typeof State !== 'undefined' && State.user) ? State.user.id : null;
        all.push({ id: this.nid(all), uid, action, entity, entityId, summary, ts: new Date().toISOString() });
        // Keep last 500 audit entries
        const trimmed = all.slice(-500);
        _set('audit', trimmed);
      } catch(e) { /* audit failure must never break main operation */ }
    },

    /** Next ID for an array */
    nid(arr) {
      if (!arr.length) return 1;
      return Math.max(...arr.map(r => r.id || 0)) + 1;
    },

    /** Next ID from stored key */
    nextId(key) {
      return this.nid(this.gAll(key));
    },

    // ── Profile-scoped helpers ──────────────────────────────────────
    /** Get records belonging to active profile (or user) */
    forProfile(key) {
      const pid = State.activeProfile;
      return this.g(key).filter(r => r.profileId === pid);
    },

    // ── Export / Import ─────────────────────────────────────────────
    exportAll() {
      const keys = ['users', 'profiles', 'glucoseLogs', 'weightLogs', 'mealLogs',
                    'exerciseLogs', 'insulinLogs', 'sleepLogs', 'medications',
                    'medDoses', 'labResults', 'goals', 'achievements', 'notes',
                    'notifications', 'audit', 'settings'];
      const data = { _version: 1, _exported: new Date().toISOString() };
      keys.forEach(k => { data[k] = this.gAll(k); });
      return data;
    },

    importAll(data) {
      if (!data || !data._version) throw new Error('Invalid backup file');
      const keys = Object.keys(data).filter(k => !k.startsWith('_'));
      keys.forEach(k => { _set(k, data[k]); });
    },

    // ── Storage usage ───────────────────────────────────────────────
    usedKB() { return _storageUsed(); },

    // ── Clear ────────────────────────────────────────────────────────
    clearAll() {
      Object.keys(localStorage)
        .filter(k => k.startsWith(PFX))
        .forEach(k => localStorage.removeItem(k));
    },

    // ── Version flag ─────────────────────────────────────────────────
    seeded()    { return !!localStorage.getItem(_key(C.VERSION)); },
    markSeeded(){ localStorage.setItem(_key(C.VERSION), '1'); },
  };

  function _storageUsed() {
    let total = 0;
    Object.keys(localStorage).filter(k => k.startsWith(PFX))
      .forEach(k => { total += (localStorage.getItem(k) || '').length; });
    return Math.round(total / 1024);
  }
})();
