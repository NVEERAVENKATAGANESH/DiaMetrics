// DiaMetrics — ui.js
'use strict';

// ── Modal ─────────────────────────────────────────────────────────────
function openM(id) {
  const bg = $(id);
  if (!bg) return;
  bg.style.display = 'flex';
  bg.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => bg.classList.add('open'));

  // Focus trap
  const focusable = bg.querySelectorAll('input,select,textarea,button,[tabindex]');
  if (focusable.length) focusable[0].focus();

  // Auto-restore draft if in add-mode (hidden id = 0 or empty)
  const hidId = bg.querySelector('input[type=hidden]');
  if (hidId && (!hidId.value || hidId.value === '0')) restoreDraft(id);

  // Start autosave
  autosaveDraft(id);

  // Close on backdrop click
  bg.onclick = e => { if (e.target === bg) closeM(id); };

  // Esc to close + Tab focus trap
  bg._escHandler = e => {
    if (e.key === 'Escape') { closeM(id); return; }
    if (e.key === 'Tab') {
      const focusEls = [...bg.querySelectorAll('input,select,textarea,button,[tabindex]:not([tabindex="-1"])')].filter(el => !el.disabled);
      if (!focusEls.length) return;
      const first = focusEls[0], last = focusEls[focusEls.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  document.addEventListener('keydown', bg._escHandler);
}

function closeM(id) {
  const bg = $(id);
  if (!bg) return;
  bg.classList.remove('open');
  bg.setAttribute('aria-hidden', 'true');
  setTimeout(() => { bg.style.display = 'none'; }, 200);
  bg.querySelectorAll('.field-err-input').forEach(e => e.classList.remove('field-err-input'));
  bg.querySelectorAll('.field-err').forEach(e => { e.textContent=''; e.style.display='none'; });
  if (bg._escHandler) document.removeEventListener('keydown', bg._escHandler);
  if (bg._draftTimer) { clearInterval(bg._draftTimer); bg._draftTimer = null; }
}

// ── Confirm dialog ────────────────────────────────────────────────────
function confirmDlg(msg, onConfirm, danger = false, btnLabel = 'Confirm') {
  const existing = $('m-confirm');
  if (existing) existing.remove();

  const div = document.createElement('div');
  div.id = 'm-confirm';
  div.className = 'mbg open';
  div.style.display = 'flex';
  div.innerHTML = `
    <div class="modal modal-sm">
      <div class="mhdr"><h2>${esc(btnLabel)}</h2></div>
      <div class="mbody"><p>${esc(msg)}</p></div>
      <div class="mftr">
        <button class="btn btn-g" id="conf-cancel">Cancel</button>
        <button class="btn ${danger?'btn-d':'btn-p'}" id="conf-ok">${esc(btnLabel)}</button>
      </div>
    </div>`;
  document.body.appendChild(div);
  $('conf-cancel').onclick = () => div.remove();
  $('conf-ok').onclick = () => { div.remove(); onConfirm(); };
  $('conf-cancel').focus();
  div.onclick = e => { if (e.target === div) div.remove(); };
}

// ── View modal ────────────────────────────────────────────────────────
function openViewModal(title, rows) {
  const existing = $('m-view');
  if (existing) existing.remove();
  const div = document.createElement('div');
  div.id = 'm-view';
  div.className = 'mbg open';
  div.style.display = 'flex';
  div.innerHTML = `
    <div class="modal">
      <div class="mhdr">
        <h2>${esc(title)}</h2>
        <button class="mx" onclick="$('m-view').remove()">×</button>
      </div>
      <div class="mbody">
        <dl class="detail-grid">
          ${rows.map(([k,v]) => `<dt>${esc(k)}</dt><dd>${v ?? '—'}</dd>`).join('')}
        </dl>
      </div>
    </div>`;
  document.body.appendChild(div);
  div.onclick = e => { if (e.target === div) div.remove(); };
}

// ── Success / Error Popup (centered animated card) ────────────────────
let _popupTimer = null;

function _getPopupEl() {
  let el = $('dm-success-overlay');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'dm-success-overlay';
  el.className = 'dm-success-overlay';
  el.onclick = () => _closePopup();
  el.innerHTML = `
    <div class="dm-success-box" onclick="event.stopPropagation()">
      <div class="dm-success-icon">
        <svg viewBox="0 0 24 24">
          <polyline class="dm-s-check" id="dm-s-check" points="4,12 9,17 20,6"/>
          <line class="dm-s-cross1" id="dm-s-cross1" x1="5" y1="5" x2="19" y2="19" style="display:none"/>
          <line class="dm-s-cross2" id="dm-s-cross2" x1="19" y1="5" x2="5" y2="19"  style="display:none"/>
        </svg>
      </div>
      <div class="dm-s-msg" id="dm-s-msg"></div>
      <div class="dm-s-sub" id="dm-s-sub"></div>
      <button id="dm-s-undo" class="dm-s-undo-btn" onclick="doUndo()" style="display:none">Undo</button>
    </div>`;
  document.body.appendChild(el);
  return el;
}

function _closePopup() {
  clearTimeout(_popupTimer);
  const el = $('dm-success-overlay');
  if (el) el.classList.remove('sp-show');
}

function successPopup(msg, sub = '', type = 'ok') {
  const overlay = _getPopupEl();
  const check  = $('dm-s-check');
  const cross1 = $('dm-s-cross1');
  const cross2 = $('dm-s-cross2');
  const isErr  = type === 'err';

  if (check)  check.style.display  = isErr ? 'none' : '';
  if (cross1) cross1.style.display = isErr ? '' : 'none';
  if (cross2) cross2.style.display = isErr ? '' : 'none';

  overlay.className = 'dm-success-overlay' + (type === 'err' ? ' sp-err' : type === 'achievement' ? ' sp-achievement' : '');
  $('dm-s-msg').textContent = msg;
  $('dm-s-sub').textContent = sub || '';
  const undoBtn = $('dm-s-undo');
  if (undoBtn) undoBtn.style.display = 'none';

  clearTimeout(_popupTimer);
  overlay.classList.remove('sp-show');
  void overlay.offsetWidth;
  overlay.classList.add('sp-show');

  const dur = type === 'err' ? 3000 : 2200;
  _popupTimer = setTimeout(_closePopup, dur);
}

// ── Toast: all messages go through the centered popup ────────────────
function toast(msg, ok = true) {
  successPopup(msg, '', ok ? 'ok' : 'err');
}

// ── Toast Undo — uses the same centered popup with an Undo button ─────
let _undoData = null;
function toastUndo(msg, undoFn) {
  _undoData = undoFn;
  const overlay = _getPopupEl();
  const undoBtn = $('dm-s-undo');
  if (undoBtn) undoBtn.style.display = '';

  const check  = $('dm-s-check');
  const cross1 = $('dm-s-cross1');
  const cross2 = $('dm-s-cross2');
  if (check)  check.style.display = '';
  if (cross1) cross1.style.display = 'none';
  if (cross2) cross2.style.display = 'none';

  overlay.className = 'dm-success-overlay';
  $('dm-s-msg').textContent = msg;
  $('dm-s-sub').textContent = '';

  clearTimeout(_popupTimer);
  overlay.classList.remove('sp-show');
  void overlay.offsetWidth;
  overlay.classList.add('sp-show');

  _popupTimer = setTimeout(() => {
    _closePopup();
    _undoData = null;
    if (undoBtn) undoBtn.style.display = 'none';
  }, 5000);
}

function doUndo() {
  if (_undoData) { _undoData(); _undoData = null; }
  _closePopup();
  const undoBtn = $('dm-s-undo');
  if (undoBtn) undoBtn.style.display = 'none';
}

// ── Pagination ────────────────────────────────────────────────────────
function paginate(data, tableId, renderFn) {
  const st = State.getPage(tableId);
  const total = data.length;
  const pages  = Math.max(1, Math.ceil(total / st.size));
  const pg     = Math.min(st.page, pages);
  State.setPage(tableId, pg);
  const sliced = data.slice((pg-1)*st.size, pg*st.size);
  renderFn(sliced);
  _renderPagination(tableId, pg, pages, total, st.size);
}

function goPg(tableId, pg) {
  State.setPage(tableId, pg);
  // Trigger re-render by dispatching custom event
  document.dispatchEvent(new CustomEvent('dm-paginate', { detail: { tableId, pg } }));
}

function _renderPagination(tableId, pg, pages, total, size) {
  const el = $(tableId + '-pager');
  if (!el) return;
  if (pages <= 1) { el.innerHTML = ''; return; }
  const nums = _pageNums(pg, pages);
  el.innerHTML = `
    <div class="pager">
      <span class="pager-info">Showing ${(pg-1)*size+1}–${Math.min(pg*size,total)} of ${total}</span>
      <div class="pager-btns">
        <button class="pgb" ${pg===1?'disabled':''} onclick="goPg('${tableId}',${pg-1})">‹</button>
        ${nums.map(n => n === '…'
          ? '<span class="pgdot">…</span>'
          : `<button class="pgb ${n===pg?'pgb-active':''}" onclick="goPg('${tableId}',${n})">${n}</button>`
        ).join('')}
        <button class="pgb" ${pg===pages?'disabled':''} onclick="goPg('${tableId}',${pg+1})">›</button>
      </div>
    </div>`;
}

function _pageNums(cur, total) {
  if (total <= 7) return Array.from({length:total},(_,i)=>i+1);
  const show = new Set([1, total, cur, cur-1, cur+1].filter(n=>n>=1&&n<=total));
  const sorted = [...show].sort((a,b)=>a-b);
  const result = [];
  sorted.forEach((n,i) => {
    if (i > 0 && n - sorted[i-1] > 1) result.push('…');
    result.push(n);
  });
  return result;
}

// ── Sortable tables ───────────────────────────────────────────────────
function makeSortable(tableId, renderFn) {
  const tbl = $(tableId);
  if (!tbl) return;
  tbl.querySelectorAll('th[data-sort]').forEach(th => {
    th.style.cursor = 'pointer';
    th.onclick = () => {
      State.setSort(tableId, th.dataset.sort);
      State.resetPage(tableId);
      renderFn();
      _updateSortIndicators(tableId);
    };
  });
  _updateSortIndicators(tableId);
}

function _updateSortIndicators(tableId) {
  const tbl = $(tableId);
  if (!tbl) return;
  const { key, dir } = State.getSort(tableId);
  tbl.querySelectorAll('th[data-sort]').forEach(th => {
    th.classList.remove('sort-asc','sort-desc');
    if (th.dataset.sort === key) th.classList.add('sort-'+dir);
  });
}

// ── Row flash & delete ────────────────────────────────────────────────
function flashRow(rowId) {
  const el = $(rowId);
  if (!el) return;
  el.classList.add('row-flash');
  setTimeout(() => el.classList.remove('row-flash'), 1200);
}

function fadeDeleteRow(rowId, cb) {
  const el = $(rowId);
  if (!el) { cb?.(); return; }
  el.classList.add('row-delete');
  setTimeout(() => { el.remove(); cb?.(); }, 350);
}

// ── Draft autosave ────────────────────────────────────────────────────
function autosaveDraft(modalId) {
  const bg = $(modalId);
  if (!bg) return;
  if (bg._draftTimer) clearInterval(bg._draftTimer);
  bg._draftTimer = setInterval(() => {
    const hidId = bg.querySelector('input[type=hidden]');
    if (hidId && hidId.value && hidId.value !== '0') return; // Edit mode — don't overwrite
    const data = {};
    bg.querySelectorAll('input,select,textarea').forEach(el => {
      if (el.name || el.id) data[el.id || el.name] = el.type==='checkbox'?el.checked:el.value;
    });
    sessionStorage.setItem('draft_' + modalId, JSON.stringify(data));
  }, 400);
}

function restoreDraft(modalId) {
  const raw = sessionStorage.getItem('draft_' + modalId);
  if (!raw) return;
  const data = JSON.parse(raw);
  Object.entries(data).forEach(([id, val]) => {
    const el = $(id);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = val;
    else el.value = val;
  });
}

function clearDraft(modalId) {
  sessionStorage.removeItem('draft_' + modalId);
}

// ── Notifications panel ───────────────────────────────────────────────
const Notifs = {
  open: false,

  toggle() {
    this.open = !this.open;
    const panel = $('notif-panel');
    if (panel) panel.classList.toggle('open', this.open);
    if (this.open) { this.render(); Notifs._bindClose(); }
    else this._unbindClose();
  },

  _bindClose() {
    this._closer = e => {
      const panel = $('notif-panel');
      const btn   = $('notif-btn');
      if (panel && !panel.contains(e.target) && e.target !== btn) {
        Notifs.open = false;
        panel.classList.remove('open');
        Notifs._unbindClose();
      }
    };
    document.addEventListener('mousedown', this._closer);
  },
  _unbindClose() {
    if (this._closer) document.removeEventListener('mousedown', this._closer);
  },

  render() {
    const panel = $('notif-panel');
    if (!panel) return;
    const uid  = State.user?.id;
    const all  = DB.g('notifications').filter(n => n.uid === uid)
                  .sort((a,b) => b.ts.localeCompare(a.ts)).slice(0, 30);
    if (!all.length) {
      panel.innerHTML = '<div class="notif-empty">No notifications</div>';
      return;
    }
    panel.innerHTML = `
      <div class="notif-hdr">
        <span>Notifications</span>
        <button class="notif-read-all" onclick="Notifs.markAllRead()">Mark all read</button>
      </div>
      ${all.map(n => `
        <div class="notif-item ${n.read?'':'notif-unread'}" id="notif-${n.id}">
          <span class="notif-dot" style="background:${C.NOTIF_TAGS[n.tag]?.color||'#6b7280'}"></span>
          <div class="notif-body" onclick="Notifs.read(${n.id})">
            <div class="notif-title">${esc(n.title)}</div>
            <div class="notif-sub">${esc(n.body)}</div>
            <div class="notif-time">${D.fmtDT(n.ts)}</div>
          </div>
          <button class="notif-del" onclick="Notifs.delete(${n.id})" title="Delete">×</button>
        </div>`).join('')}`;
  },

  add(uid, title, body, tag) {
    const notifs = DB.gAll('notifications');
    notifs.push({ id: DB.nid(notifs), uid, title, body, tag, read: false, ts: D.now() });
    DB.s('notifications', notifs);
    this.updateBadge();
  },

  read(id) {
    DB.update('notifications', arr => {
      const n = arr.find(x => x.id === id);
      if (n) n.read = true;
      return arr;
    });
    this.render();
    this.updateBadge();
  },

  delete(id) {
    const uid = State.user?.id;
    DB.update('notifications', arr => arr.filter(n => !(n.uid === uid && n.id === id)));
    this.render();
    this.updateBadge();
  },

  markAllRead() {
    const uid = State.user?.id;
    DB.update('notifications', arr => {
      arr.filter(n => n.uid === uid).forEach(n => n.read = true);
      return arr;
    });
    this.render();
    this.updateBadge();
  },

  updateBadge() {
    const el  = $('notif-count');
    if (!el) return;
    const uid = State.user?.id;
    const cnt = DB.g('notifications').filter(n => n.uid === uid && !n.read).length;
    el.textContent = cnt > 9 ? '9+' : (cnt || '');
    el.style.display = cnt ? 'flex' : 'none';
  },
};

// ── Scroll to top ─────────────────────────────────────────────────────
// ── Browser Notification API + Scheduled Reminders ───────────────────
const Reminders = {
  _timers: [],

  async requestPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    const res = await Notification.requestPermission();
    return res === 'granted';
  },

  // Push a native browser notification
  async push(title, body, tag = 'diametrics') {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') {
      await this.requestPermission();
    }
    if (Notification.permission === 'granted') {
      new Notification(title, { body, tag, icon: '' });
    }
    // Also add to in-app panel
    if (State.user) Notifs.add(State.user.id, title, body, 'reminder');
  },

  // Schedule all reminders for current day based on active medications
  scheduleDaily() {
    this.clearAll();
    if (!State.user || !State.activeProfile) return;
    const pid  = State.activeProfile;
    const meds = DB.g('medications').filter(m => m.profileId === pid && m.active);
    const now  = new Date();

    meds.forEach(m => {
      if (!m.timeOfDay) return;
      const times = m.timeOfDay.split(',').map(t => t.trim());
      const timeMap = { Morning:'08:00', Afternoon:'13:00', Evening:'18:00', Night:'21:00' };
      times.forEach(t => {
        const hhmm = timeMap[t] || null;
        if (!hhmm) return;
        const [hh, mm] = hhmm.split(':').map(Number);
        const remind = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0);
        const delay  = remind - now;
        if (delay > 0) {
          const tid = setTimeout(() => {
            this.push(`💊 Medication Reminder`, `Time to take ${m.name} ${m.dosage} (${t})`, 'medication');
          }, delay);
          this._timers.push(tid);
        }
      });
    });

    // Daily glucose check reminder at 7am, 1pm, 9pm
    [7, 13, 21].forEach(hour => {
      const t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0);
      const delay = t - now;
      if (delay > 0) {
        const tid = setTimeout(() => {
          const pid = State.activeProfile;
          const logs = DB.g('glucoseLogs').filter(l => l.profileId === pid && l.date === D.today());
          if (logs.length === 0 || (hour === 21 && logs.length < 2)) {
            this.push('🩸 Glucose Check', "Don't forget to log your glucose reading.", 'glucose');
          }
        }, delay);
        this._timers.push(tid);
      }
    });
  },

  clearAll() {
    this._timers.forEach(id => clearTimeout(id));
    this._timers = [];
  },
};

function initThemeToggle() {
  const btn = $('theme-toggle');
  if (!btn) return;
  function updateIcon() {
    const dark = State.theme === 'dark';
    btn.innerHTML = dark
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
    btn.title = dark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
  }
  // Remove inline onclick — handled here
  btn.removeAttribute('onclick');
  btn.addEventListener('click', () => {
    State.setTheme(State.theme === 'dark' ? 'light' : 'dark');
    updateIcon();
  });
  updateIcon();
}

function initScrollTop() {
  const btn = $('scroll-top');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.style.display = window.scrollY > 300 ? 'flex' : 'none';
  }, { passive: true });
  btn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── User menu dropdown ────────────────────────────────────────────────
function toggleUserMenu() {
  const menu = $('tn-user-menu');
  if (!menu) return;
  const isOpen = menu.classList.toggle('open');
  if (isOpen) {
    // Close desktop nav dropdowns
    $qa('.tn-group.open').forEach(g => g.classList.remove('open'));
    // Close on outside click
    const closer = e => {
      const wrap = $('tn-user-menu')?.closest('.tn-user-wrap');
      if (wrap && !wrap.contains(e.target)) {
        menu.classList.remove('open');
        document.removeEventListener('mousedown', closer);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', closer), 0);
  }
}

/// ── Top navbar: dropdowns + mobile drawer ─────────────────────────────
function initSidebar() {
  // Desktop dropdown groups — toggle open on click
  $qa('.tn-group').forEach(group => {
    const btn = group.querySelector('.tn-has-drop');
    if (!btn) return;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = group.classList.contains('open');
      $qa('.tn-group.open').forEach(g => g.classList.remove('open'));
      $('tn-user-menu')?.classList.remove('open');
      if (!isOpen) {
        group.classList.add('open');
        // Position dropdown using fixed coords to escape overflow:auto clipping
        const dd = group.querySelector('.tn-dropdown');
        if (dd) {
          const rect = group.getBoundingClientRect();
          dd.style.top  = rect.bottom + 'px';
          dd.style.left = rect.left + 'px';
        }
      }
    });
    // Prevent clicks inside the dropdown from closing it
    group.addEventListener('click', e => e.stopPropagation());
  });

  // Close dropdowns when clicking anywhere outside
  document.addEventListener('click', () => {
    $qa('.tn-group.open').forEach(g => g.classList.remove('open'));
    $('tn-user-menu')?.classList.remove('open');
  });
}

function closeMobDrawer() {
  $('mob-drawer')?.classList.remove('open');
  $('mob-overlay')?.classList.remove('open');
  $('hamburger')?.classList.remove('open');
  if ($('hamburger')) $('hamburger').setAttribute('aria-expanded', 'false');
}

function initMobileNav() {
  const ham = $('hamburger');
  const drawer = $('mob-drawer');
  const ov  = $('mob-overlay');
  if (!ham) return;

  ham.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = drawer?.classList.toggle('open');
    ov?.classList.toggle('open', isOpen);
    ham.classList.toggle('open', isOpen);
    ham.setAttribute('aria-expanded', String(isOpen));
    // Close desktop dropdowns if open
    $qa('.tn-group.open').forEach(g => g.classList.remove('open'));
  });

  // Close drawer on nav-link click
  $qa('#mob-drawer .nav-link').forEach(link => {
    link.addEventListener('click', closeMobDrawer);
  });

  // Close drawer on resize to desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) closeMobDrawer();
  });
}
