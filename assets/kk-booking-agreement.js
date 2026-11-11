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

  // Version-bound, first-party functional storage. No names, phone or LINE IDs.
  function hasSeenCurrentTermsPrompt() {
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

  check.addEventListener('change', function () {
    confirm.disabled = !check.checked;
  });

  // Explicit first-entry confirmation only. Never open LINE automatically.
  confirm.addEventListener('click', function () {
    if (!check.checked || confirm.disabled || gate.hidden) return;
    rememberCurrentTermsPrompt();
    closeAgreement();
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
})();
