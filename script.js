/**
 * KK Frontend v11 — compatible with Backend v10 / Backend v9 structure
 * Reads sheet: 08_Web_Ready
 *
 * Changes from v10:
 * - Removed <form> dependency; submit handled via button click (matches index.html v11)
 * - Added retry logic (1 retry) on network failure before showing error
 * - safeUrl: reject non-http/https protocols (was https-only before; now explicit)
 * - Phone validation: accept 9-12 digits (unchanged) but also strip leading +66
 * - waitlist button shown for show_full events too (previously only phone_only / lens_only)
 * - lensLabel: added ZEISS_3_2X alias for future lens groups
 * - escapeHTML: moved to top-level constant (micro-perf, same logic)
 * - Minor: closeBookingModal resets selectedBooking before hiding modal
 */
(() => {
  "use strict";

  const DEFAULT_CONFIG = {
    SHEET_ID: "12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU",
    WEB_READY_SHEET: "08_Web_Ready",
    LINE_ADD_FRIEND_URL: "https://line.me/R/ti/p/%40827blnmo",
    LINE_MESSAGE_URL: "https://line.me/R/oaMessage/%40827blnmo/?",
    X_URL: "https://x.com/KK_PhoneRental",
    CACHE_BUST: true,
    HIDE_PAST_EVENTS: true,
    REQUEST_TIMEOUT_MS: 10000,
    TIMEZONE: "Asia/Bangkok"
  };

  const CONFIG = { ...DEFAULT_CONFIG, ...(window.KK_CONFIG || {}) };
  const $ = (id) => document.getElementById(id);

  const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const escapeHTML = (str) => String(str ?? "").replace(/[&<>"']/g, s => HTML_ESCAPES[s]);

  let allEvents = [];
  let selectedBooking = null;

  // ─── Init ─────────────────────────────────────────────────────────────────

  function init() {
    applyConfigLinks();

    const searchInput = $("searchInput");
    const statusFilter = $("statusFilter");
    const grid = $("eventsGrid");
    const submitBtn = $("bookingSubmitBtn");

    if (searchInput) searchInput.addEventListener("input", render);
    if (statusFilter) statusFilter.addEventListener("change", render);
    if (grid) {
      grid.addEventListener("click", (event) => {
        const button = event.target.closest("[data-booking-event]");
        if (!button) return;
        openBookingModal(button.dataset.bookingEvent, button.dataset.package);
      });
    }
    if (submitBtn) submitBtn.addEventListener("click", handleBookingSubmit);

    document.querySelectorAll("[data-close-booking]").forEach((el) => {
      el.addEventListener("click", closeBookingModal);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeBookingModal();
    });

    showMessage("กำลังเช็กคิวให้น้า...", false);
    loadEvents();
  }

  function applyConfigLinks() {
    const lineMain = $("lineMain");
    const xLink = $("xLink");
    if (lineMain) lineMain.href = safeUrl(CONFIG.LINE_ADD_FRIEND_URL, DEFAULT_CONFIG.LINE_ADD_FRIEND_URL);
    if (xLink) xLink.href = safeUrl(CONFIG.X_URL, DEFAULT_CONFIG.X_URL);
  }

  // ─── Data helpers ─────────────────────────────────────────────────────────

  function normalizeKey(key) {
    return String(key || "").trim().replace(/\s+/g, "_");
  }

  function normalizeAction(value) {
    const v = String(value || "").trim().toLowerCase();
    const map = {
      open: "show", show: "show",
      phone_only: "show_phone_only", show_phone_only: "show_phone_only",
      lens_only: "show_lens_only", show_lens_only: "show_lens_only",
      full: "show_full", show_full: "show_full",
      hide: "hide", hidden: "hide", closed: "hide"
    };
    return map[v] || "";
  }

  function parseCSV(text) {
    const rows = [];
    let row = [], cell = "", quote = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i], n = text[i + 1];
      if (quote && c === '"' && n === '"') { cell += '"'; i++; continue; }
      if (c === '"') { quote = !quote; continue; }
      if (!quote && c === ",") { row.push(cell); cell = ""; continue; }
      if (!quote && (c === "\n" || c === "\r")) {
        if (c === "\r" && n === "\n") i++;
        row.push(cell); rows.push(row); row = []; cell = "";
        continue;
      }
      cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(v => String(v).trim() !== ""));
  }

  function rowsToObjects(rows) {
    if (!rows.length) return [];
    const headers = rows[0].map(normalizeKey);
    return rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { if (h) obj[h] = row[i] ?? ""; });
      return obj;
    });
  }

  // ─── Network ──────────────────────────────────────────────────────────────

  async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeout = Number(CONFIG.REQUEST_TIMEOUT_MS) || DEFAULT_CONFIG.REQUEST_TIMEOUT_MS;
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchJSON(url) {
    const res = await fetchWithTimeout(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`OpenSheet error ${res.status}`);
    return res.json();
  }

  async function fetchText(url) {
    const res = await fetchWithTimeout(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Google CSV error ${res.status}`);
    return res.text();
  }

  async function fetchFromOpenSheet() {
    const bust = CONFIG.CACHE_BUST ? `?t=${Date.now()}` : "";
    const url = `https://opensheet.elk.sh/${encodeURIComponent(CONFIG.SHEET_ID)}/${encodeURIComponent(CONFIG.WEB_READY_SHEET)}${bust}`;
    return fetchJSON(url);
  }

  async function fetchFromGVizCSV() {
    const bust = CONFIG.CACHE_BUST ? `&t=${Date.now()}` : "";
    const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(CONFIG.SHEET_ID)}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(CONFIG.WEB_READY_SHEET)}${bust}`;
    const text = await fetchText(url);
    return rowsToObjects(parseCSV(text));
  }

  // ─── Load events (with 1 retry) ───────────────────────────────────────────

  async function loadEvents(attempt = 0) {
    try {
      let rows;
      try {
        rows = await fetchFromOpenSheet();
      } catch (e) {
        console.warn("OpenSheet failed, fallback to Google CSV", e);
        rows = await fetchFromGVizCSV();
      }

      const today = todayISO();
      allEvents = rows
        .map(cleanEvent)
        .filter(e => e.event_id)
        .filter(e => e.action_for_web !== "hide")
        .filter(e => !CONFIG.HIDE_PAST_EVENTS || e.event_date_iso >= today || e.event_date_iso === "9999-12-31")
        .sort((a, b) => a.event_date_iso.localeCompare(b.event_date_iso) || a.event_name.localeCompare(b.event_name, "th"));

      updateLastUpdated(allEvents);
      render();
    } catch (err) {
      console.error(err);
      // Retry once after 3 seconds on network error
      if (attempt === 0) {
        console.warn("Retrying in 3s...");
        setTimeout(() => loadEvents(1), 3000);
        return;
      }
      showMessage("โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชอีกครั้ง หรือสอบถามผ่าน LINE OA", true);
    }
  }

  // ─── Clean / normalise event row ──────────────────────────────────────────

  function cleanEvent(row) {
    const eventDate = row.event_date || row.event_date_text || "";
    const eventDateText = row.event_date_text || formatDateText(eventDate);
    const phoneCount = toNumber(row.available_phone_count);
    const lensCount = toNumber(row.available_lens_count);
    const showLens = toBool(row.show_lens_option);
    const phoneOnlyAvailable = readBool(row.phone_only_available, phoneCount > 0);
    const phoneLensAvailable = readBool(row.phone_lens_available, showLens && phoneCount > 0 && lensCount > 0);
    const lensOnlyAvailable = readBool(row.lens_only_available, showLens && lensCount > 0);
    const inferredAction = inferAction(phoneOnlyAvailable, phoneLensAvailable, lensOnlyAvailable, showLens);
    const action = normalizeAction(row.action_for_web) || inferredAction;
    const status = String(row.booking_status_for_web || "").trim() || inferStatus(phoneOnlyAvailable, phoneLensAvailable, lensOnlyAvailable, showLens);

    return {
      event_id: String(row.event_id || "").trim(),
      event_name: String(row.event_name || "").trim(),
      event_date: eventDate,
      event_date_text: eventDateText,
      event_date_iso: toISODate(eventDate, eventDateText),
      venue: String(row.venue || "").trim(),
      poster_image_url: String(row.poster_image_url || "").trim(),
      header_image_url: String(row.header_image_url || "").trim(),
      phone_model_display: String(row.phone_model_display || "").trim(),
      allowed_lens_group: String(row.allowed_lens_group || "").trim(),
      lens_model_display: String(row.lens_model_display || "").trim(),
      phone_price: toNumber(row.phone_price),
      lens_price: toNumber(row.lens_price),
      bundle_price: toNumber(row.bundle_price),
      show_lens_option: showLens,
      available_phone_count: phoneCount,
      available_lens_count: lensCount,
      booking_status_for_web: status,
      action_for_web: action,
      line_message_template: String(row.line_message_template || "").trim(),
      last_updated: row.last_updated || "",
      phone_only_available: phoneOnlyAvailable,
      phone_lens_available: phoneLensAvailable,
      lens_only_available: lensOnlyAvailable,
      web_note: String(row.web_note || "").trim()
    };
  }

  // ─── Type coercions ───────────────────────────────────────────────────────

  function toBool(value) {
    const v = String(value ?? "").trim().toLowerCase();
    return value === true || ["true", "yes", "y", "1", "ใช่", "จริง", "เปิด", "available"].includes(v);
  }

  function readBool(value, fallback) {
    const raw = String(value ?? "").trim().toLowerCase();
    if (raw === "") return fallback;
    if (["true", "yes", "y", "1", "ใช่", "จริง", "เปิด", "available"].includes(raw) || value === true) return true;
    if (["false", "no", "n", "0", "ไม่", "เท็จ", "ปิด", "unavailable"].includes(raw) || value === false) return false;
    return fallback;
  }

  function toNumber(value) {
    const clean = String(value || "0").replace(/,/g, "").replace(/[^0-9.-]/g, "");
    const n = Number(clean || 0);
    return Number.isFinite(n) ? n : 0;
  }

  // ─── Date helpers ─────────────────────────────────────────────────────────

  function normalizeYear(yearText) {
    const year = Number(yearText);
    if (!Number.isFinite(year)) return "";
    const christianYear = year > 2400 ? year - 543 : year;
    return String(christianYear).padStart(4, "0");
  }

  function validDateParts(year, month, day) {
    const y = Number(year), m = Number(month), d = Number(day);
    if (!y || m < 1 || m > 12 || d < 1 || d > 31) return false;
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  }

  function toISODate(value, fallbackText) {
    let v = value;
    if (!v && fallbackText) v = fallbackText;
    if (!v) return "9999-12-31";

    if (typeof v === "number" || /^\d+(\.\d+)?$/.test(String(v).trim())) {
      const serial = Number(v);
      if (serial > 20000 && serial < 80000) {
        const date = new Date(Date.UTC(1899, 11, 30 + Math.floor(serial)));
        return date.toISOString().slice(0, 10);
      }
    }

    const s = String(v).trim();
    const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      const y = normalizeYear(isoMatch[1]), m = isoMatch[2].padStart(2, "0"), d = isoMatch[3].padStart(2, "0");
      return validDateParts(y, m, d) ? `${y}-${m}-${d}` : "9999-12-31";
    }

    const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) {
      const y = normalizeYear(dmy[3]), m = dmy[2].padStart(2, "0"), d = dmy[1].padStart(2, "0");
      return validDateParts(y, m, d) ? `${y}-${m}-${d}` : "9999-12-31";
    }

    const ymd = s.match(/^(\d{4})[\/](\d{1,2})[\/](\d{1,2})$/);
    if (ymd) {
      const y = normalizeYear(ymd[1]), m = ymd[2].padStart(2, "0"), d = ymd[3].padStart(2, "0");
      return validDateParts(y, m, d) ? `${y}-${m}-${d}` : "9999-12-31";
    }

    const parsed = new Date(s);
    return Number.isNaN(parsed.getTime()) ? "9999-12-31" : parsed.toISOString().slice(0, 10);
  }

  function formatDateText(value) {
    const iso = toISODate(value);
    if (iso === "9999-12-31") return value || "-";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }

  // ─── Status / action inference ────────────────────────────────────────────

  function inferStatus(phoneOnly, bundle, lensOnly, showLens) {
    if (bundle) return "เปิดจอง";
    if (showLens && phoneOnly && !lensOnly) return "เหลือเครื่องอย่างเดียว";
    if (phoneOnly) return "เปิดจอง";
    if (showLens && lensOnly) return "เหลือ Lens อย่างเดียว";
    return "เต็มแล้ว";
  }

  function inferAction(phoneOnly, bundle, lensOnly, showLens) {
    if (bundle) return "show";
    if (phoneOnly) return showLens ? "show_phone_only" : "show";
    if (showLens && lensOnly) return "show_lens_only";
    return "show_full";
  }

  // ─── Time helpers ─────────────────────────────────────────────────────────

  function todayISO() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: CONFIG.TIMEZONE || DEFAULT_CONFIG.TIMEZONE,
      year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date());
    const data = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return `${data.year}-${data.month}-${data.day}`;
  }

  function updateLastUpdated(events) {
    const dates = events
      .map(e => toISODate(e.last_updated))
      .filter(d => d !== "9999-12-31")
      .sort();
    const latest = dates.at(-1);
    const target = $("lastUpdated");
    if (target) target.textContent = `อัปเดตล่าสุด: ${latest ? formatDateText(latest) : "-"}`;
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  function render() {
    const searchInput = $("searchInput");
    const statusFilter = $("statusFilter");
    const q = (searchInput?.value || "").trim().toLowerCase();
    const filter = statusFilter?.value || "all";

    const events = allEvents.filter(e => {
      const text = `${e.event_name} ${e.venue} ${e.phone_model_display} ${lensLabel(e)}`.toLowerCase();
      const matchText = !q || text.includes(q);
      const matchFilter =
        filter === "all" ||
        (filter === "open" && e.action_for_web === "show") ||
        (filter === "phone_only" && e.action_for_web === "show_phone_only") ||
        (filter === "lens_only" && e.action_for_web === "show_lens_only") ||
        (filter === "full" && e.action_for_web === "show_full");
      return matchText && matchFilter;
    });

    const grid = $("eventsGrid");
    if (!grid) return;
    grid.innerHTML = "";
    const box = $("messageBox");
    if (box) box.hidden = true;

    if (!events.length) {
      showMessage("ยังไม่มีงานที่ตรงกับตัวกรองตอนนี้ ทัก LINE OA มาสอบถามได้เลยน้า", false);
      return;
    }

    const fragment = document.createDocumentFragment();
    events.forEach(e => fragment.appendChild(eventCard(e)));
    grid.appendChild(fragment);
  }

  // ─── Card builder ─────────────────────────────────────────────────────────

  function eventCard(e) {
    const card = document.createElement("article");
    card.className = "event-card";

    const poster = document.createElement("div");
    poster.className = "poster";
    const posterUrl = safeImageUrl(e.poster_image_url);
    if (posterUrl) {
      const img = document.createElement("img");
      img.src = posterUrl;
      img.alt = `โปสเตอร์งาน ${escapeHTML(e.event_name)}`;
      img.loading = "lazy";
      img.decoding = "async";
      img.width = 600;
      img.height = 190;
      img.addEventListener("error", () => img.classList.add("is-broken"));
      poster.appendChild(img);
    }

    const posterTitle = document.createElement("div");
    posterTitle.className = "poster-title";
    posterTitle.textContent = e.event_name || "KK Phone Rental";
    poster.appendChild(posterTitle);

    const body = document.createElement("div");
    body.className = "card-body";

    const remainingLens = e.show_lens_option ? ` / Lens ${e.available_lens_count}` : "";
    const modelText = e.show_lens_option
      ? `${e.phone_model_display || "-"} / ${lensLabel(e)}`
      : (e.phone_model_display || "-");

    body.innerHTML = `
      ${statusBadge(e)}
      <div class="meta">
        <div class="meta-item"><span class="meta-label">วันที่</span><span class="meta-value">${escapeHTML(e.event_date_text || "-")}</span></div>
        <div class="meta-item"><span class="meta-label">สถานที่</span><span class="meta-value">${escapeHTML(e.venue || "-")}</span></div>
        <div class="meta-item"><span class="meta-label">รุ่น/อุปกรณ์</span><span class="meta-value">${escapeHTML(modelText)}</span></div>
        <div class="meta-item"><span class="meta-label">คงเหลือ</span><span class="meta-value">เครื่อง ${e.available_phone_count}${escapeHTML(remainingLens)}</span></div>
      </div>
      ${priceHTML(e)}
      ${e.web_note ? `<div class="note">${escapeHTML(e.web_note)}</div>` : ""}
      <div class="card-actions">${buttonHTML(e)}</div>
    `;

    card.appendChild(poster);
    card.appendChild(body);
    return card;
  }

  function statusBadge(e) {
    const clsMap = { show_phone_only: "badge-phone", show_lens_only: "badge-lens", show_full: "badge-full" };
    const cls = clsMap[e.action_for_web] || "badge-open";
    return `<div class="badge ${cls}">${escapeHTML(e.booking_status_for_web)}</div>`;
  }

  function priceHTML(e) {
    const bits = [];
    if (e.phone_price) bits.push(`<span class="price">เครื่อง ${money(e.phone_price)}฿</span>`);
    if (e.show_lens_option && e.lens_price) bits.push(`<span class="price">Lens ${money(e.lens_price)}฿</span>`);
    if (e.show_lens_option && e.bundle_price) bits.push(`<span class="price">เช่าคู่ ${money(e.bundle_price)}฿</span>`);
    return bits.length ? `<div class="prices">${bits.join("")}</div>` : "";
  }

  function buttonHTML(e) {
    const eventId = escapeHTML(e.event_id);
    const buttons = [];

    if (e.phone_lens_available) {
      buttons.push(`<button class="btn btn-primary" type="button" data-booking-event="${eventId}" data-package="phone_lens_bundle">จองเครื่อง + Lens</button>`);
    }
    if (e.phone_only_available) {
      buttons.push(`<button class="btn btn-secondary" type="button" data-booking-event="${eventId}" data-package="phone_only">จองเฉพาะเครื่อง</button>`);
    }
    if (e.lens_only_available) {
      buttons.push(`<button class="btn btn-secondary" type="button" data-booking-event="${eventId}" data-package="lens_only">จองเฉพาะ Lens</button>`);
    }

    // Show waitlist for: show_phone_only, show_lens_only, and show_full
    const showWaitlist = ["show_phone_only", "show_lens_only", "show_full"].includes(e.action_for_web);
    const waitlistLabel = e.action_for_web === "show_phone_only" ? "ถาม Lens รอบหลุด" : "ถามรอบหลุด";

    if (buttons.length) {
      if (showWaitlist) {
        buttons.push(`<button class="btn btn-secondary" type="button" data-booking-event="${eventId}" data-package="waitlist">${waitlistLabel}</button>`);
      }
      return buttons.join("");
    }

    return `<button class="btn btn-secondary" type="button" data-booking-event="${eventId}" data-package="waitlist">ถามรอบหลุด / waitlist</button>`;
  }

  // ─── Modal ────────────────────────────────────────────────────────────────

  function openBookingModal(eventId, packageType) {
    const eventData = allEvents.find(e => e.event_id === eventId);
    if (!eventData) return;

    selectedBooking = { eventData, packageType };

    const modal = $("bookingModal");
    const form = $("bookingForm");
    const summary = $("bookingSummary");
    const error = $("bookingFormError");

    // Reset inputs manually (no <form> reset())
    const nickInput = $("customerNickname");
    const phoneInput = $("customerPhone");
    const pickupInput = $("pickupTime");
    if (nickInput) nickInput.value = "";
    if (phoneInput) phoneInput.value = "";
    if (pickupInput) pickupInput.value = "";

    if (error) { error.hidden = true; error.textContent = ""; }
    if (summary) {
      summary.innerHTML = `
        <div><span>งาน</span><b>${escapeHTML(eventData.event_name || "-")}</b></div>
        <div><span>วันที่</span><b>${escapeHTML(eventData.event_date_text || "-")}</b></div>
        <div><span>แพ็กเกจ</span><b>${escapeHTML(packageThaiLabel(packageType))}</b></div>
      `;
    }

    if (modal) {
      modal.hidden = false;
      document.body.classList.add("modal-open");
      setTimeout(() => $("customerNickname")?.focus(), 50);
    }
  }

  function closeBookingModal() {
    const modal = $("bookingModal");
    if (!modal || modal.hidden) return;
    selectedBooking = null;
    modal.hidden = true;
    document.body.classList.remove("modal-open");
  }

  function handleBookingSubmit() {
    if (!selectedBooking) return;

    const customer = {
      nickname: String($("customerNickname")?.value || "").trim(),
      phone: String($("customerPhone")?.value || "").trim(),
      pickupTime: String($("pickupTime")?.value || "").trim()
    };

    const error = validateCustomerInput(customer);
    const errorBox = $("bookingFormError");
    if (error) {
      if (errorBox) {
        errorBox.textContent = error;
        errorBox.hidden = false;
        errorBox.focus();
      }
      return;
    }

    if (errorBox) { errorBox.hidden = true; errorBox.textContent = ""; }
    window.location.href = lineUrl(selectedBooking.eventData, selectedBooking.packageType, customer);
  }

  function validateCustomerInput(customer) {
    if (!customer.nickname) return "รบกวนกรอกชื่อเล่นก่อนนะคะ";
    if (!customer.phone) return "รบกวนกรอกเบอร์โทรก่อนนะคะ";
    // Normalize: strip +66 prefix → 0xx format
    const normalized = customer.phone.replace(/^\+66/, "0");
    const digits = normalized.replace(/\D/g, "");
    if (digits.length < 9 || digits.length > 12) return "เบอร์โทรดูเหมือนยังไม่ถูกต้อง รบกวนตรวจอีกครั้งค่ะ";
    if (!customer.pickupTime) return "รบกวนกรอกเวลาที่สะดวกรับเครื่องก่อนนะคะ";
    return "";
  }

  // ─── LINE message ─────────────────────────────────────────────────────────

  function packageThaiLabel(packageType) {
    if (packageType === "phone_lens_bundle") return "เครื่อง + Lens";
    if (packageType === "phone_only") return "เฉพาะเครื่อง";
    if (packageType === "lens_only") return "เฉพาะ Lens";
    return "รอบหลุด / waitlist";
  }

  function cleanBaseMessage(template) {
    const fallback = "สวัสดีค่ะ สนใจจองเช่ามือถือกับ KK Phone Rental";
    const firstLine = String(template || "").split(/\r?\n/).map(s => s.trim()).find(Boolean);
    if (!firstLine) return fallback;
    if (/^(งาน|วันที่|รุ่น|แพ็กเกจ|เครื่อง|เลนส์)\s*:/i.test(firstLine)) return fallback;
    return firstLine.length > 120 ? fallback : firstLine;
  }

  function lineUrl(e, packageType, customer = {}) {
    const packageThai = packageThaiLabel(packageType);
    const includePhone = ["phone_only", "phone_lens_bundle"].includes(packageType);
    const includeLens = ["lens_only", "phone_lens_bundle"].includes(packageType);
    const lines = [
      cleanBaseMessage(e.line_message_template),
      `แพ็กเกจ: ${packageThai}`,
      packageType === "waitlist" ? "ประเภทคำขอ: สอบถามรอบหลุด / waitlist" : "",
      `ชื่องาน: ${e.event_name}`,
      `วันที่: ${e.event_date_text}`,
      `สถานที่: ${e.venue || "-"}`,
      includePhone ? `รุ่นมือถือ: ${e.phone_model_display || "-"}` : "",
      includeLens ? `เลนส์: ${lensLabel(e)}` : "",
      `ชื่อเล่น: ${customer.nickname || "-"}`,
      `เบอร์โทร: ${customer.phone || "-"}`,
      `เวลาที่สะดวกรับเครื่อง: ${customer.pickupTime || "-"}`,
      "",
      "รบกวนคอนเฟิร์มคิวให้หน่อยค่ะ"
    ].filter(line => line !== "");

    const baseUrl = safeUrl(CONFIG.LINE_MESSAGE_URL, DEFAULT_CONFIG.LINE_MESSAGE_URL);
    const separator = baseUrl.includes("?") ? "" : "?";
    return `${baseUrl}${separator}${encodeURIComponent(lines.join("\n"))}`;
  }

  // ─── URL / image helpers ──────────────────────────────────────────────────

  function lensLabel(e) {
    if (e.lens_model_display) return e.lens_model_display;
    const group = String(e.allowed_lens_group || "").toUpperCase();
    if (group === "ZEISS_2_35X") return "ZEISS 2.35x Telephoto Extender";
    if (group === "ZEISS_3_2X") return "ZEISS 3.2x Telephoto Extender";
    if (group && group !== "NONE") return group.replace(/_/g, " ");
    return "Lens";
  }

  function safeUrl(url, fallback) {
    const raw = String(url || "").trim();
    try {
      const parsed = new URL(raw);
      return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : fallback;
    } catch {
      return fallback;
    }
  }

  function googleDriveImageUrl(raw) {
    const text = String(raw || "").trim();
    if (!text) return "";
    const fileMatch = text.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
    const idMatch = text.match(/[?&]id=([^&]+)/i);
    const id = fileMatch?.[1] || idMatch?.[1] || "";
    return id ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1200` : text;
  }

  function safeImageUrl(url) {
    return safeUrl(googleDriveImageUrl(url), "");
  }

  // ─── Formatting helpers ───────────────────────────────────────────────────

  function money(n) {
    return Number(n || 0).toLocaleString("th-TH");
  }

  function showMessage(text, isError) {
    const grid = $("eventsGrid");
    const box = $("messageBox");
    if (grid) grid.innerHTML = "";
    if (!box) return;
    box.hidden = false;
    box.textContent = text;
    box.className = isError ? "error-box" : "empty";
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
