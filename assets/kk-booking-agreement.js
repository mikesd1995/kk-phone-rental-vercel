'use strict';
// The browser remembers only that the customer dismissed this versioned UX prompt.
// This is NOT durable Terms evidence: only the customer-sent, signature-verified
// LINE message can confirm the actual booking acknowledgement.
(function () {
  var gate = document.getElementById('kk-booking-agreement');
  var dialog = document.getElementById('kk-booking-agreement-dialog');
  var check = document.getElementById('kk-booking-terms-check');
  var confirm = document.getElementById('kk-booking-terms-continue');
  var cancel = document.getElementById('kk-booking-terms-cancel');
  if (!gate || !dialog || !check || !confirm || !cancel) return;

  var bookingSelector = 'a.book-pill, a.waitlist-line-btn, a.sticky-line, a.line-btn';
  var termsVersion = 'KK-TERMS-2026-11-06';
  var promptKey = 'kk_booking_terms_prompt_version';

  // UI convenience only. Do not store identity, booking data, proof or secrets.
  // Private mode/storage-disabled browsers correctly fall back to the checkbox.
  function hasSeenCurrentTermsPrompt() {
    try { return window.localStorage.getItem(promptKey) === termsVersion; }
    catch (_error) { return false; }
  }

  function rememberCurrentTermsPrompt() {
    try { window.localStorage.setItem(promptKey, termsVersion); }
    catch (_error) { /* No persistence: continue the safe existing LINE flow. */ }
  }
  var pending = null;
  var approved = null;
  var lastFocused = null;
  var previousOverflow = '';

  function isLineBooking(link) {
    try {
      var url = new URL(link.href, location.href);
      return url.protocol === 'https:' && url.hostname === 'line.me';
    } catch (_error) { return false; }
  }

  function openAgreement(link) {
    if (!gate.hidden) return;
    pending = link;
    lastFocused = document.activeElement;
    check.checked = false;
    confirm.disabled = true;
    previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    gate.hidden = false;
    check.focus();
  }

  function closeAgreement() {
    if (gate.hidden) return;
    gate.hidden = true;
    check.checked = false;
    confirm.disabled = true;
    pending = null;
    document.documentElement.style.overflow = previousOverflow;
    var focusTarget = lastFocused;
    lastFocused = null;
    if (focusTarget && document.contains(focusTarget) && typeof focusTarget.focus === 'function') {
      focusTarget.focus({ preventScroll: true });
    }
  }

  // Capture before the existing modal analytics and browser navigation.
  document.addEventListener('click', function (event) {
    var link = event.target && event.target.closest && event.target.closest(bookingSelector);
    if (!link || !isLineBooking(link)) return;
    if (approved === link || hasSeenCurrentTermsPrompt()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openAgreement(link);
  }, true);

  check.addEventListener('change', function () {
    confirm.disabled = !check.checked;
  });

  cancel.addEventListener('click', closeAgreement);
  gate.addEventListener('click', function (event) {
    if (event.target === gate) closeAgreement();
  });

  confirm.addEventListener('click', function () {
    if (!check.checked || confirm.disabled || !pending || !isLineBooking(pending)) return;
    var link = pending;
    // Remember only this prompt dismissal, after an explicit unchecked-by-default
    // customer action. LINE's actual sent text remains the evidence source.
    rememberCurrentTermsPrompt();
    closeAgreement();
    // Replay only the approved existing link; preserves the original URL,
    // LINE message and click analytics without passing private data here.
    approved = link;
    try { link.click(); }
    finally { approved = null; }
  });

  // While open, Escape closes only this dialog and Tab remains inside it.
  document.addEventListener('keydown', function (event) {
    if (gate.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeAgreement();
      return;
    }
    if (event.key !== 'Tab') return;
    // Prevent the underlying package modal from stealing the focus trap.
    event.stopImmediatePropagation();
    var focusable = Array.prototype.slice.call(dialog.querySelectorAll('a[href], input:not([disabled]), button:not([disabled])'))
      .filter(function (el) { return el.getClientRects().length > 0; });
    if (!focusable.length) { event.preventDefault(); return; }
    var first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }, true);
})();
