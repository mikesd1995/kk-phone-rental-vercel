'use strict';
// First-visit website Terms UX; never interrupt an already-accepted LINE booking.
// A browser flag is NOT an authenticated LINE identity or a durable consent receipt.
(function () {
  var gate = document.getElementById('kk-booking-agreement');
  var dialog = document.getElementById('kk-booking-agreement-dialog');
  var check = document.getElementById('kk-booking-terms-check');
  var confirm = document.getElementById('kk-booking-terms-continue');
  if (!gate || !dialog || !check || !confirm) return;

  var termsVersion = 'KK-TERMS-2026-11-06';
  var promptKey = 'kk_booking_terms_prompt_version';
  var cookieMaxAgeSeconds = 60 * 60 * 24 * 180;
  var confirmedInPage = false;
  var lastFocused = null;
  var previousOverflow = '';
  // OFF by default. Enabling requires deployed/verified API, LINE provider,
  // private acceptance store and server release gates at the same exact SHA.
  var identityEnabled = Boolean(window.KK_CONFIG && window.KK_CONFIG.customerLoginEnabled === true);
  var identityState = identityEnabled ? 'loading' : 'disabled';
  var remoteAccepted = false;
  var csrf = '';
  var originalConfirmText = confirm.textContent;
  var statusNote = typeof document.querySelector === 'function' ?
    document.querySelector('.kk-booking-agreement-note') : null;
  var originalNote = statusNote ? statusNote.textContent : '';

  // Version-bound, first-party functional storage. No names, phone or LINE IDs.
  function hasSeenCurrentTermsPrompt() {
    // Never mistake a browser cookie for a verified person when auth is ON.
    if (identityEnabled) return remoteAccepted;
    if (confirmedInPage) return true;
    try {
      if (window.localStorage.getItem(promptKey) === termsVersion) return true;
    } catch (_error) { /* Try the functional cookie. */ }
    try {
      return String(document.cookie || '').split(';').some(function (part) {
        var pair = part.trim().split('=');
        return pair.length === 2 &&
          pair[0] === promptKey && decodeURIComponent(pair[1]) === termsVersion;
      });
    } catch (_error) { return false; }
  }

  function rememberCurrentTermsPrompt() {
    confirmedInPage = true;
    try { window.localStorage.setItem(promptKey, termsVersion); }
    catch (_error) { /* Cookie fallback below. */ }
    try {
      document.cookie = promptKey + '=' + encodeURIComponent(termsVersion) +
        '; Path=/; Max-Age=' + cookieMaxAgeSeconds + '; SameSite=Lax; Secure';
    } catch (_error) { /* Current page only when storage is unavailable. */ }
  }

  function openAgreement() {
    if (!gate.hidden || hasSeenCurrentTermsPrompt()) return;
    lastFocused = document.activeElement;
    check.checked = false;
    confirm.disabled = true;
    previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    gate.hidden = false;
    check.focus();
  }

  function closeAgreement() {
    gate.hidden = true;
    check.checked = false;
    confirm.disabled = true;
    document.documentElement.style.overflow = previousOverflow;
    var focusTarget = lastFocused;
    lastFocused = null;
    if (focusTarget && document.contains(focusTarget) && typeof focusTarget.focus === 'function') {
      focusTarget.focus({ preventScroll: true });
    }
  }

  function updateIdentityUi() {
    if (!identityEnabled) {
      confirm.textContent = originalConfirmText;
      if (statusNote) statusNote.textContent = originalNote;
    } else if (identityState === 'guest') {
      confirm.textContent = 'เชื่อม LINE เพื่อบันทึกการยอมรับ';
      if (statusNote) statusNote.textContent =
        'ต้องเชื่อมบัญชี LINE เพื่อบันทึกหลักฐานการยอมรับไว้หลังบ้าน หลังเข้าสู่ระบบกรุณากดยืนยันอีกครั้ง';
    } else if (identityState === 'unavailable') {
      confirm.textContent = 'ลองเชื่อม LINE อีกครั้ง';
      if (statusNote) statusNote.textContent =
        'ระบบบันทึกการยอมรับชั่วคราวไม่พร้อม ยังไม่บันทึกข้อมูล กรุณาลองใหม่';
    } else {
      confirm.textContent = originalConfirmText;
      if (statusNote) statusNote.textContent =
        'ระบบบันทึกการยอมรับฉบับปัจจุบันหลังบ้านเฉพาะ LINE ที่ยืนยันตัวตนแล้ว ไม่ใส่ข้อความเงื่อนไขใน LINE จอง';
    }
    confirm.disabled = !check.checked || identityState === 'loading' || identityState === 'saving';
  }
  check.addEventListener('change', updateIdentityUi);

  async function loadVerifiedIdentity() {
    if (!identityEnabled) return;
    identityState = 'loading';
    updateIdentityUi();
    try {
      var response = await window.fetch('/api/kk-customer-auth?action=session', {
        method: 'GET', credentials: 'same-origin', cache: 'no-store',
        headers: { Accept: 'application/json' }
      });
      // Do NOT fall back to localStorage when the verified backend was enabled.
      if (!response.ok) throw new Error('SESSION_NOT_VERIFIED');
      var session = await response.json();
      if (!session || session.terms_version !== termsVersion) throw new Error('TERMS_VERSION_MISMATCH');
      csrf = '';
      if (session.authenticated === true) {
        if (session.skip_agreement === true) {
          remoteAccepted = true;
          rememberCurrentTermsPrompt();
          closeAgreement();
          return;
        }
        csrf = typeof session.csrf === 'string' ? session.csrf : '';
        if (!csrf) throw new Error('CSRF_UNAVAILABLE');
        identityState = 'authenticated';
      } else if (session.authenticated === false && session.skip_agreement === false) {
        identityState = 'guest';
      } else {
        throw new Error('INVALID_SESSION_STATE');
      }
    } catch (_) {
      identityState = 'unavailable';
    }
    updateIdentityUi();
    openAgreement();
  }

  // Only an authenticated, affirmative POST with a verified DB readback counts.
  // A login redirect does NOT record acceptance or reuse an unchecked browser flag.
  confirm.addEventListener('click', async function () {
    if (!check.checked || confirm.disabled || gate.hidden) return;
    if (!identityEnabled) {
      rememberCurrentTermsPrompt();
      closeAgreement();
      return;
    }
    if (identityState === 'unavailable') {
      await loadVerifiedIdentity();
      return;
    }
    if (identityState === 'guest') {
      window.location.assign('/api/kk-customer-auth?action=start');
      return;
    }
    if (identityState !== 'authenticated' || !csrf) return;
    identityState = 'saving';
    updateIdentityUi();
    try {
      var response = await window.fetch('/api/kk-customer-auth?action=accept', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-KK-CSRF': csrf },
        body: JSON.stringify({ accept: true, terms_version: termsVersion })
      });
      if (!response.ok) throw new Error('ACCEPTANCE_WRITE_FAILED');
      var receipt = await response.json();
      if (!receipt || receipt.status !== 'ACCEPTED' || receipt.skip_agreement !== true ||
          receipt.terms_version !== termsVersion) throw new Error('ACCEPTANCE_READBACK_REQUIRED');
      remoteAccepted = true;
      rememberCurrentTermsPrompt();
      closeAgreement();
    } catch (_) {
      // No cookie and no LINE booking when the private acceptance write failed.
      identityState = 'unavailable';
      updateIdentityUi();
    }
  });

  // A synthetic/programmatic click cannot skip an unanswered first-visit gate.
  // After the first confirmation, LINE links work natively with no checkout popup.
  document.addEventListener('click', function (event) {
    var link = event.target && event.target.closest &&
      event.target.closest('a.book-pill, a.waitlist-line-btn, a.sticky-line, a.line-btn');
    if (!link || hasSeenCurrentTermsPrompt()) return;
    try {
      var url = new URL(link.href, location.href);
      if (url.protocol !== 'https:' || url.hostname !== 'line.me') return;
    } catch (_error) { return; }
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!gate.hidden) check.focus();
    else openAgreement();
  }, true);

  // Keep focus in the mandatory first-visit dialog, including Escape and Tab.
  document.addEventListener('keydown', function (event) {
    if (gate.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (event.key !== 'Tab') return;
    event.stopImmediatePropagation();
    var focusable = Array.prototype.slice.call(
      dialog.querySelectorAll('a[href], input:not([disabled]), button:not([disabled])')
    ).filter(function (el) { return el.getClientRects().length > 0; });
    if (!focusable.length) { event.preventDefault(); return; }
    var first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }, true);

  // Defer executes after HTML parsing, before the customer can reach checkout.
  openAgreement();
  if (identityEnabled) loadVerifiedIdentity();
})();
