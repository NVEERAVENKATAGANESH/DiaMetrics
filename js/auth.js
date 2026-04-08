// DiaMetrics — auth.js
'use strict';

const Auth = (() => {
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_MS   = 15 * 60 * 1000;
  let _bc = null;

  // ── Helpers ─────────────────────────────────────────────────────
  function _hash(u, p) { return sha256(u.toLowerCase() + ':' + p); }

  function _lockKey(u)  { return 'dm_lock_' + u.toLowerCase(); }
  function _getLock(u)  {
    const raw = localStorage.getItem(_lockKey(u));
    return raw ? JSON.parse(raw) : { attempts: 0, until: 0 };
  }
  function _setLock(u, lock) { localStorage.setItem(_lockKey(u), JSON.stringify(lock)); }
  function _clearLock(u)     { localStorage.removeItem(_lockKey(u)); }

  function _startBC() {
    if (!window.BroadcastChannel) return;
    _bc = new BroadcastChannel('dm_session');
    _bc.onmessage = e => { if (e.data === 'logout') _onForcedLogout(); };
  }

  function _onForcedLogout() {
    State.reset();
    go('landing');
    toast('Logged out from another tab', false);
  }

  // ── Session inactivity ───────────────────────────────────────────
  function _resetTimer() {
    clearTimeout(State.sessionTimer);
    clearTimeout(State.warnTimer);
    State.warnTimer = setTimeout(() => {
      toast('Session expiring in 60 seconds due to inactivity', false);
    }, C.SESSION_TIMEOUT - C.SESSION_WARN);
    State.sessionTimer = setTimeout(() => Auth.logout('timeout'), C.SESSION_TIMEOUT);
  }

  function _bindActivity() {
    C.ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, _resetTimer, { passive: true }));
  }
  function _unbindActivity() {
    C.ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, _resetTimer));
  }

  // ── Login ────────────────────────────────────────────────────────
  async function doLogin() {
    const loginBtn = document.querySelector('#m-login .btn-p');
    if (loginBtn) { loginBtn.disabled = true; loginBtn.textContent = 'Logging in…'; }
    try {
      clearAllErrors('login-form');
      const un = ($('login-user')?.value || '').trim().toLowerCase();
      const pw = $('login-pass')?.value || '';
      if (!un || !pw) { toast('Enter username and password', false); return; }

      const lock = _getLock(un);
      if (lock.until > Date.now()) {
        const mins = Math.ceil((lock.until - Date.now()) / 60000);
        toast(`Account locked. Try again in ${mins} min.`, false);
        return;
      }

      const users = DB.gAll('users');
      const hash  = await _hash(un, pw);
      const user  = users.find(u => u.username.toLowerCase() === un && u.passwordHash === hash);

      if (!user) {
        lock.attempts++;
        if (lock.attempts >= MAX_ATTEMPTS) {
          lock.until = Date.now() + LOCKOUT_MS;
          lock.attempts = 0;
          _setLock(un, lock);
          toast('Too many failed attempts. Locked for 15 min.', false);
        } else {
          _setLock(un, lock);
          toast(`Invalid credentials. ${MAX_ATTEMPTS - lock.attempts} attempts left.`, false);
        }
        return;
      }

      _clearLock(un);
      _beginSession(user);
    } finally {
      if (loginBtn) { loginBtn.disabled = false; loginBtn.textContent = 'Log In'; }
    }
  }

  function _beginSession(user) {
    State.user = user;
    // Set first profile as active
    const profiles = DB.gAll('profiles').filter(p => p.userId === user.id);
    if (profiles.length) State.activeProfile = profiles[0].id;

    // Persist session
    localStorage.setItem('dm_session', JSON.stringify({ uid: user.id, ts: Date.now() }));

    _startBC();
    _bindActivity();
    _resetTimer();

    closeM('m-login');
    if ($('login-pass')) $('login-pass').value = '';

    go('dashboard');
    toast('Welcome back, ' + (user.displayName || user.username) + '!', true);
    Notifs.updateBadge();
  }

  // ── Restore session ──────────────────────────────────────────────
  function tryRestoreSession() {
    const raw = localStorage.getItem('dm_session');
    if (!raw) return false;
    const sess = JSON.parse(raw);
    if (Date.now() - sess.ts > C.SESSION_TIMEOUT) {
      localStorage.removeItem('dm_session');
      return false;
    }
    const users = DB.gAll('users');
    const user  = users.find(u => u.id === sess.uid);
    if (!user) return false;
    _beginSession(user);
    return true;
  }

  // ── Signup ───────────────────────────────────────────────────────
  async function doSignup() {
    const signupBtn = document.querySelector('#m-signup .btn-p');
    if (signupBtn) { signupBtn.disabled = true; signupBtn.textContent = 'Creating…'; }
    try {
      clearAllErrors('signup-form');
      const fn = ($('su-fn')?.value || '').trim();
      const un = ($('su-un')?.value || '').trim().toLowerCase();
      const em = ($('su-em')?.value || '').trim().toLowerCase();
      const pw = $('su-pw')?.value || '';
      const p2 = $('su-p2')?.value || '';

      let ok = true;
      if (!fn) { fieldError('su-fn', 'Full name is required'); ok=false; }
      if (!un || un.length < 3) { fieldError('su-un', 'Username must be 3+ characters'); ok=false; }
      if (!em || !em.includes('@')) { fieldError('su-em', 'Valid email required'); ok=false; }
      if (!pw || pw.length < 6) { fieldError('su-pw', 'Password must be 6+ characters'); ok=false; }
      if (pw !== p2) { fieldError('su-p2', 'Passwords do not match'); ok=false; }
      if (!ok) return;

      const users = DB.gAll('users');
      if (users.find(u => u.username.toLowerCase() === un)) {
        fieldError('su-un', 'Username already taken'); return;
      }
      if (users.find(u => u.email === em)) {
        fieldError('su-em', 'Email already registered'); return;
      }

      const hash = await _hash(un, pw);
      const uid  = DB.nextId('users');
      const user = {
        id: uid, username: un, email: em, displayName: fn,
        passwordHash: hash, role: 'user', createdAt: D.now(),
      };
      const allUsers = DB.gAll('users');
      allUsers.push(user);
      DB.s('users', allUsers);

      const pid = DB.nextId('profiles');
      const profile = {
        id: pid, userId: uid, label: 'Me', name: fn,
        dob: '', gender: '', heightCm: 0, weightKg: 0,
        isDefault: true, createdAt: D.now(),
      };
      const allProfiles = DB.gAll('profiles');
      allProfiles.push(profile);
      DB.s('profiles', allProfiles);

      closeM('m-signup');
      if ($('su-pw')) $('su-pw').value = '';
      if ($('su-p2')) $('su-p2').value = '';
      _beginSession(user);
      toast('Account created! Welcome to DiaMetrics.', true);
    } finally {
      if (signupBtn) { signupBtn.disabled = false; signupBtn.textContent = 'Create Account'; }
    }
  }

  // ── Change password ──────────────────────────────────────────────
  async function changePassword() {
    const oldPw = ($('cp-old')?.value || '');
    const newPw = ($('cp-new')?.value || '');
    const con   = ($('cp-con')?.value || '');
    clearAllErrors('cp-form');
    let ok = true;
    if (!oldPw)           { fieldError('cp-old', 'Enter current password'); ok=false; }
    if (newPw.length < 6) { fieldError('cp-new', 'Password must be 6+ characters'); ok=false; }
    if (newPw !== con)    { fieldError('cp-con', 'Passwords do not match'); ok=false; }
    if (!ok) return;

    const u = State.user;
    const oldHash = await _hash(u.username, oldPw);
    if (oldHash !== u.passwordHash) { fieldError('cp-old', 'Current password incorrect'); return; }

    const newHash = await _hash(u.username, newPw);
    DB.update('users', arr => {
      const idx = arr.findIndex(x => x.id === u.id);
      if (idx !== -1) arr[idx].passwordHash = newHash;
      return arr;
    });
    State.user.passwordHash = newHash;
    closeM('m-change-pw');
    toast('Password changed', true);
  }

  // ── Logout ───────────────────────────────────────────────────────
  function logout(reason) {
    localStorage.removeItem('dm_session');
    _unbindActivity();
    if (_bc) { _bc.postMessage('logout'); _bc.close(); _bc = null; }
    State.reset();
    go('landing');
    if (reason === 'timeout') toast('Session expired due to inactivity', false);
    else toast('Logged out', true);
  }

  return { doLogin, doSignup, tryRestoreSession, changePassword, logout };
})();

// Global shortcuts for HTML onclick
function doLogin()      { Auth.doLogin(); }
function doSignup()     { Auth.doSignup(); }
function changePassword(){ Auth.changePassword(); }
function logout()       { Auth.logout(); }

// One-click demo login
function demoLogin() {
  const inp = $('login-user');
  const pw  = $('login-pass');
  if (inp) inp.value = 'demo';
  if (pw)  pw.value  = 'demo123';
  openM('m-login');
  // Small delay so modal is visible, then auto-submit
  setTimeout(() => Auth.doLogin(), 200);
}
