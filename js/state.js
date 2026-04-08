// DiaMetrics — state.js
'use strict';

const State = (() => {
  let _user    = null;
  let _page    = 'landing';
  let _charts  = {};
  let _sort    = {};
  let _pagn    = {};
  let _theme   = localStorage.getItem('dm_theme') || 'light';
  let _timer   = null;
  let _warnTimer = null;
  let _profile = null; // active profile id (for multi-profile)

  return {
    get user()    { return _user; },
    set user(v)   { _user = v; },

    get page()    { return _page; },
    set page(v)   { _page = v; },

    get theme()   { return _theme; },

    get sessionTimer()  { return _timer; },
    set sessionTimer(v) { _timer = v; },

    get warnTimer()     { return _warnTimer; },
    set warnTimer(v)    { _warnTimer = v; },

    get activeProfile() { return _profile; },
    set activeProfile(v){ _profile = v; },

    /* ── Charts ────────────────────────────────────── */
    getChart(id)       { return _charts[id]; },
    setChart(id, ch)   { _charts[id] = ch; },
    destroyChart(id) {
      if (_charts[id]) {
        try { _charts[id].destroy(); } catch(e) {}
        delete _charts[id];
      }
    },
    destroyAll() {
      Object.keys(_charts).forEach(id => this.destroyChart(id));
    },

    /* ── Sort ──────────────────────────────────────── */
    getSort(tid) { return _sort[tid] || { key: null, dir: 'asc' }; },
    setSort(tid, key) {
      const s = this.getSort(tid);
      _sort[tid] = { key, dir: (s.key === key && s.dir === 'asc') ? 'desc' : 'asc' };
    },

    /* ── Pagination ────────────────────────────────── */
    getPage(tid)     { return _pagn[tid] || { page: 1, size: C.PAGE_SIZE }; },
    setPage(tid, pg) {
      const p = this.getPage(tid);
      _pagn[tid] = { page: pg, size: p.size };
    },
    resetPage(tid)   { delete _pagn[tid]; },

    /* ── Theme ─────────────────────────────────────── */
    setTheme(t) {
      _theme = t;
      localStorage.setItem('dm_theme', t);
      document.documentElement.setAttribute('data-theme', t);
      const s = JSON.parse(localStorage.getItem('dm_settings') || '{}');
      s.theme = t;
      localStorage.setItem('dm_settings', JSON.stringify(s));
      const btn = document.getElementById('theme-toggle');
      if (btn) btn.title = t === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
    },
    applyTheme() {
      document.documentElement.setAttribute('data-theme', _theme);
    },

    /* ── Reset on logout ───────────────────────────── */
    reset() {
      _user    = null;
      _page    = 'landing';
      _profile = null;
      _sort    = {};
      _pagn    = {};
      this.destroyAll();
      if (_timer)     { clearTimeout(_timer);     _timer = null; }
      if (_warnTimer) { clearTimeout(_warnTimer); _warnTimer = null; }
    },
  };
})();
