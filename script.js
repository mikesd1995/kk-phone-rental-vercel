(() => {
  "use strict";

  const CFG = window.KK_CONFIG || {};
  const qs = new URLSearchParams(location.search);
  const state = {
    items: [],
    filter: ["all", "available", "full", "soon"].includes((qs.get("filter") || "all").toLowerCase()) ? (qs.get("filter") || "all").toLowerCase() : "all",
    showPast: qs.get("showPast") === "1",
    debug: qs.get("debug") === "1",
    event: String(qs.get("event") || qs.get("e") || "").trim(),
  };

  const SHEET_ID = CFG.sheetId || "12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU";
  const WEB = { sheet: CFG.webSheetName || "08_Web_Ready", range: CFG.webRange || "A4:K" };
  const PKG = { sheet: CFG.pkgSheetName || "09_Web_Packages", range: CFG.pkgRange || "A4:M" };
  const LINE_DIRECT = CFG.lineDirectUrl || "https://line.me/R/ti/p/%40827blnmo";
  const LINE_OA = "https://line.me/R/oaMessage/" + encodeURIComponent(CFG.lineOAId || "@827blnmo") + "/?";
  const TODAY = startOfDay(new Date()).getTime();
  const THB = new Intl.NumberFormat("th-TH");

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const clean = v => String(v ?? "").trim();
  const num = v => Number(clean(v).replace(/[^0-9.-]/g, "")) || 0;
  const has = v => clean(v) !== "";
  const bool = v => ["true", "yes", "1", "open", "show", "ว่าง"].includes(clean(v).toLowerCase());
  const esc = s => clean(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
  const price = v => num(v) > 0 ? THB.format(num(v)) + " บาท/วัน" : "ไม่ระบุ";

  function startOfDay(d) { d = new Date(d); d.setHours(0, 0, 0, 0); return d; }
  function key(s) { return clean(s).toLowerCase().replace(/[\s_\-()[\].:/\\]+/g, "").replace(/[^a-z0-9ก-๙]/g, ""); }
  function pick(row, names, index) {
    const wanted = names.map(key);
    for (const k of Object.keys(row || {})) if (wanted.includes(key(k))) return row[k];
    if (Number.isInteger(index)) return Object.values(row || {})[index] ?? "";
    return "";
  }

  function parseDate(raw) {
    const s = clean(raw);
    if (!s) return null;
    if (/^\d{5}$/.test(s)) return new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000);
    let m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (m) return new Date(toCE(m[3]), Number(m[2]) - 1, Number(m[1]));
    m = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (m) return new Date(toCE(m[1]), Number(m[2]) - 1, Number(m[3]));
    const en = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
    m = s.match(/^(\d{1,2})\s+([a-z]{3,})\s+(\d{4})$/i);
    if (m && en[m[2].slice(0,3).toLowerCase()] !== undefined) return new Date(toCE(m[3]), en[m[2].slice(0,3).toLowerCase()], Number(m[1]));
    return null;
  }
  function toCE(y) { y = Number(y); return y > 2500 ? y - 543 : y; }
  function fmtDate(raw) {
    const d = parseDate(raw);
    return d ? `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}` : clean(raw);
  }
  function eventTime(item) {
    const d = parseDate(item.rawDate);
    return d ? startOfDay(d).getTime() : Number.MAX_SAFE_INTEGER;
  }

  function driveId(url) {
    const s = clean(url);
    const found = [/\/file\/d\/([^/?#]+)/, /[?&]id=([^&#]+)/, /\/thumbnail\?id=([^&#]+)/, /googleusercontent\.com\/d\/([^=/?#]+)/]
      .map(re => s.match(re)).find(Boolean);
    return found ? decodeURIComponent(found[1]) : "";
  }
  function imageList(url, size = "w600") {
    const id = driveId(url);
    return id ? [
      `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=${size}`,
      `https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}=${size}`,
      `https://drive.google.com/uc?export=view&id=${encodeURIComponent(id)}`,
    ] : clean(url) ? [clean(url)] : [];
  }
  function imageWithFallback(urls, alt, eager = false) {
    const img = document.createElement("img");
    let i = 0;
    img.alt = alt || "Event poster";
    img.loading = eager ? "eager" : "lazy";
    img.decoding = "async";
    img.onerror = () => { if (i < urls.length) img.src = urls[i++]; };
    if (urls.length) img.src = urls[i++];
    return img;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [], val = "", quoted = false;
    text = String(text || "").replace(/^\uFEFF/, "");
    for (let i = 0; i < text.length; i++) {
      const c = text[i], n = text[i + 1];
      if (c === '"') quoted && n === '"' ? (val += '"', i++) : quoted = !quoted;
      else if (c === "," && !quoted) row.push(val), val = "";
      else if ((c === "\n" || c === "\r") && !quoted) {
        if (c === "\r" && n === "\n") i++;
        row.push(val); if (row.some(has)) rows.push(row); row = []; val = "";
      } else val += c;
    }
    row.push(val); if (row.some(has)) rows.push(row);
    return rows;
  }
  function toObjects(csv) {
    const rows = parseCsv(csv);
    if (rows.length < 2) return [];
    const headers = rows[0].map(clean);
    return rows.slice(1).map(r => Object.fromEntries(headers.map((h, i) => [h || `col_${i}`, r[i] || ""]))).filter(r => Object.values(r).some(has));
  }
  function sheetUrl({ sheet, range }) {
    return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(SHEET_ID)}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}&range=${encodeURIComponent(range)}&t=${Date.now()}`;
  }
  function apiUrl({ sheet, range }) {
    return `${CFG.apiEndpoint || "/api/kk-data"}?sheet=${encodeURIComponent(sheet)}&range=${encodeURIComponent(range)}`;
  }
  async function fetchText(url, ms = 9000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: "default" });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0,120)}`);
      return text;
    } finally { clearTimeout(t); }
  }
  async function fetchSheet(def) {
    const cacheKey = `kk:${SHEET_ID}:${def.sheet}:${def.range}`;
    if (!state.debug) {
      try {
        const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
        if (cached && Date.now() - cached.ts < 180000) return cached.data;
      } catch (_) {}
    }
    const viaApi = CFG.useApi !== false && location.protocol !== "file:" && qs.get("direct") !== "1";
    let csv;
    try { csv = await fetchText(viaApi ? apiUrl(def) : sheetUrl(def)); }
    catch (e) {
      if (!CFG.directFallback && viaApi) throw e;
      csv = await fetchText(sheetUrl(def));
    }
    const data = toObjects(csv);
    if (!state.debug) try { sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data })); } catch (_) {}
    return data;
  }

  function normalizePkg(row) {
    const type = clean(pick(row, ["pkg_type", "package_type", "ประเภทแพ็กเกจ"], 2)) || "phone_only";
    const model = clean(pick(row, ["model_display", "phone_model_display", "ชื่อแสดงมือถือ"], 4)) || "มือถือ";
    const lens = clean(pick(row, ["lens_display", "lens_model_display", "ชื่อแสดงเลนส์"], 6));
    return {
      id: clean(pick(row, ["package_id", "pkg_id", "template_id", "รหัสแพ็กเกจ"], 0)),
      eventId: clean(pick(row, ["event_id"], 1)),
      type,
      model,
      lens,
      price: num(pick(row, ["price", "standard_price", "ราคา"], 7)),
      available: pick(row, ["available_count", "จำนวนว่าง"], 8),
      status: clean(pick(row, ["package_status", "status", "สถานะแพ็กเกจ"], 9)).toLowerCase(),
      sort: num(pick(row, ["sort_order"], 10)),
      note: clean(pick(row, ["web_note", "package_note", "หมายเหตุ"], 11)),
      rawAvailable: pick(row, ["raw_available_count", "จำนวนว่างดิบ"], 12),
      active: pick(row, ["pkg_active"]),
    };
  }
  function packageVisible(p) {
    if (["hidden", "hide"].includes(p.status)) return false;
    return has(p.active) ? bool(p.active) : true;
  }
  function packageAvailable(p, event) {
    const count = has(p.available) ? num(p.available) : null;
    const raw = has(p.rawAvailable) ? num(p.rawAvailable) : null;
    if (raw !== null && raw < 0) return false;
    if (["hidden", "hide", "full", "closed"].includes(p.status)) return false;
    if (p.status === "available") return count === null ? p.price > 0 : count > 0 && p.price > 0;
    if (count !== null) return count > 0 && p.price > 0;
    if (p.type === "lens_only") return event.lensCnt > 0 && p.price > 0;
    if (p.type === "phone_lens_bundle") return event.phoneCnt > 0 && event.lensCnt > 0 && p.price > 0;
    return event.phoneCnt > 0 && p.price > 0;
  }
  function displayPackage(p, event) {
    const label = p.type === "lens_only" ? (p.lens || "Lens") : p.type === "phone_lens_bundle" ? `${p.model} + Lens` : p.model;
    const spec = p.type === "lens_only" ? (p.lens || "เลนส์เสริม") : p.type === "phone_lens_bundle" ? "มือถือ + เลนส์" : "เฉพาะมือถือ";
    return { ...p, label, spec, available: packageAvailable(p, event) };
  }
  function buildFallbackPackages(event, row) {
    const p = num(row.phone_price), l = num(row.lens_price), b = num(row.bundle_price);
    const model = clean(row.phone_model_display || row.allowed_phone_model_group) || "มือถือ";
    const lens = clean(row.allowed_lens_group) || "เลนส์เสริม";
    const list = [];
    if (p) list.push({ id:"", type:"phone_only", label:model, spec:"เฉพาะมือถือ", price:p, available:event.phoneCnt>0, note:clean(row.web_note) });
    if (l) list.push({ id:"", type:"lens_only", label:"Lens", spec:lens, price:l, available:event.lensCnt>0, note:clean(row.web_note) });
    if (b) list.push({ id:"", type:"phone_lens_bundle", label:`${model} + Lens`, spec:"มือถือ + เลนส์", price:b, available:event.phoneCnt>0&&event.lensCnt>0, note:clean(row.web_note) });
    return list;
  }

  async function loadData() {
    const [webRows, rawPkgs] = await Promise.all([fetchSheet(WEB), fetchSheet(PKG).catch(() => [])]);
    const pkgsByEvent = rawPkgs.map(normalizePkg).filter(packageVisible).reduce((map, p) => {
      if (!p.eventId) return map;
      (map[p.eventId] ||= []).push(p);
      return map;
    }, {});

    return webRows
      .filter(r => clean(r.action_for_web).toLowerCase() !== "hide")
      .map(row => {
        const id = clean(row.event_id);
        const event = {
          id,
          name: clean(row.event_name),
          rawDate: row.event_date_text,
          date: fmtDate(row.event_date_text),
          venue: clean(row.venue),
          poster: clean(row.poster_image_url),
          phoneCnt: num(row.available_phone_count),
          lensCnt: num(row.available_lens_count),
          status: clean(row.event_status).toLowerCase(),
          action: clean(row.action_for_web).toLowerCase(),
          lineTemplate: clean(row.line_message_template),
          packages: [],
        };
        const mapped = (pkgsByEvent[id] || []).sort((a,b) => a.sort - b.sort).map(p => displayPackage(p, event));
        event.packages = mapped.length ? mapped : buildFallbackPackages(event, row);
        return event;
      });
  }

  function isFuture(item) { return state.showPast || eventTime(item) >= TODAY; }
  function isSoon(item) { const diff = eventTime(item) - TODAY; return diff >= 0 && diff <= 14 * 86400000; }
  function availablePackages(item) { return item.packages.filter(p => p.available); }
  function availableCount(item) {
    if (item.phoneCnt > 0) return item.phoneCnt;
    if (item.lensCnt > 0 && availablePackages(item).some(p => p.type === "lens_only")) return item.lensCnt;
    return 0;
  }
  function filteredItems() {
    let list = state.items.filter(isFuture).sort((a,b) => eventTime(a) - eventTime(b) || a.name.localeCompare(b.name, "th"));
    if (state.filter === "available") list = list.filter(i => availableCount(i) > 0);
    if (state.filter === "full") list = list.filter(i => availableCount(i) <= 0);
    if (state.filter === "soon") list = list.filter(isSoon);
    return list;
  }
  function badge(item) {
    const n = availableCount(item);
    if (n <= 0) return "เต็มแล้ว";
    if (isSoon(item)) return "ใกล้ถึงวันงาน";
    return item.phoneCnt > 0 ? `ว่าง ${n} เครื่อง` : "Lens ว่าง";
  }
  function availableText(item) {
    const n = availableCount(item);
    if (n <= 0) return "เต็มแล้วน้า 😢";
    if (item.phoneCnt > 0) return n === 1 ? "เหลือ 1 เครื่องสุดท้าย ✨" : `ว่าง ${n} เครื่อง ✨`;
    return "เหลือ Lens อย่างเดียว ✨";
  }

  function skeleton() {
    $("#content").innerHTML = `<div class="skeleton"><div class="sk-card"></div><div class="sk-card"></div><div class="sk-card"></div><div class="sk-card"></div></div>`;
  }
  function empty(title, detail = "ถ้ามีงานที่อยากเช่า สามารถทัก LINE OA มาสอบถามได้เลย", cls = "") {
    $("#content").innerHTML = `<div class="empty ${cls}"><h2>${esc(title)}</h2><p>${esc(detail)}</p><a href="${LINE_DIRECT}" target="_blank" rel="noopener">ทัก LINE OA</a></div>`;
  }
  function render() {
    const list = filteredItems();
    setFilterButtons();
    if (!list.length) return empty(state.items.length ? "ยังไม่มีงานในหมวดนี้น้า 💙" : "ยังไม่มีข้อมูลงานตอนนี้น้า 💙");
    const grid = document.createElement("div");
    grid.className = "grid";
    list.forEach((item, idx) => grid.appendChild(card(item, idx)));
    $("#content").replaceChildren(grid);
  }
  function card(item, idx) {
    const canBook = availableCount(item) > 0;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card";
    btn.setAttribute("aria-label", `ดูเครื่องว่างสำหรับงาน ${item.name}`);
    btn.addEventListener("click", () => openPackages(item));

    const poster = document.createElement("div");
    poster.className = "poster";
    poster.innerHTML = `<span class="status ${canBook ? (isSoon(item) ? "soon" : "") : "full"}">${esc(badge(item))}</span>`;
    const imgs = imageList(item.poster, "w600");
    poster.appendChild(imgs.length ? imageWithFallback(imgs, item.name, idx === 0) : placeholder());

    const body = document.createElement("div");
    body.className = "card-body";
    body.innerHTML = `<span class="date">${esc(item.date || "-")}</span><strong class="name">${esc(item.name || "-")}</strong><span class="venue">📍 ${esc(item.venue || "-")}</span><span class="available ${canBook ? "" : "none"}">${esc(availableText(item))}</span><span class="cta ${canBook ? "" : "full"}">${canBook ? "ดูรุ่นที่ว่าง / จองคิว" : "เต็มแล้ว"}</span>`;
    btn.append(poster, body);
    return btn;
  }
  function placeholder() { const el = document.createElement("div"); el.className = "poster-placeholder"; el.textContent = "ยังไม่มีรูป"; return el; }

  function bookingMessage(item, pkg) {
    const base = item.lineTemplate || "สวัสดีค่ะ สนใจจองเช่ามือถือกับ KK Phone Rental ค่ะ";
    return [base, "", `งาน : ${item.name || "-"}`, `วันที่ : ${item.date || "-"}`, `สถานที่ : ${item.venue || "-"}`, `แพ็กเกจ : ${pkg.label || "-"}`, `รายละเอียด : ${pkg.spec || "-"}`, `ราคา : ${price(pkg.price)}`, `event_id : ${item.id || "-"}`, `template_id : ${pkg.id || "-"}`, "", "ชื่อเล่น : ", "เบอร์โทร : ", "เวลาที่สะดวกรับเครื่อง : "].join("\n");
  }
  function bookingUrl(item, pkg) { return LINE_OA + encodeURIComponent(bookingMessage(item, pkg)); }
  function updateEventMeta(item) {
    const title = `${item.name || "Event"} | KK Phone Rental`;
    const desc = `เช่ามือถือถ่ายงาน ${item.name || "คอนเสิร์ต"} วันที่ ${item.date || "-"} ดูแพ็กเกจและจองผ่าน LINE OA`;
    document.title = title;
    setMeta("name", "description", desc);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", desc);
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", desc);
    const img = imageList(item.poster, "w1200")[0];
    if (img) { setMeta("property", "og:image", img); setMeta("name", "twitter:image", img); }
  }
  function setMeta(attr, keyName, value) { const el = document.querySelector(`meta[${attr}="${keyName}"]`); if (el && value) el.content = value; }
  function openPackages(item) {
    updateEventMeta(item);
    if (item.id) { const u = new URL(location.href); u.searchParams.set("event", item.id); history.replaceState(null, "", u); }
    $("#modalTitle").textContent = item.name || "รายละเอียดงาน";
    $("#modalDate").textContent = `📅 ${item.date || "-"}`;
    $("#modalVenue").textContent = `📍 ${item.venue || "-"}`;
    const list = $("#packageList");
    const available = availablePackages(item);
    if (!available.length) list.innerHTML = `<div class="empty"><h2>งานนี้เต็มแล้วน้า 🙏</h2><p>ทักมาถามรอบอื่นได้เลย 💙</p></div>`;
    else list.replaceChildren(...available.map(p => packageRow(item, p)));
    showOverlay("#packageModal");
    track("view_event_packages", { event_name: item.name, available: availableCount(item) });
  }
  function packageRow(item, p) {
    const row = document.createElement("article");
    row.className = "package";
    row.innerHTML = `<div class="phone-icon" aria-hidden="true">📱</div><div class="pkg-info"><h3>${esc(p.label)}</h3><p>${esc(p.spec)}</p>${p.note ? `<p>${esc(p.note)}</p>` : ""}<p>${esc(suitability(p))}</p></div><div class="pkg-side"><div class="price">${esc(price(p.price).replace(" บาท/วัน", ""))}<small>บาท/วัน</small></div></div>`;
    const link = document.createElement("a");
    link.className = "book";
    link.textContent = "จองรุ่นนี้";
    link.href = bookingUrl(item, p);
    link.target = "_blank";
    link.rel = "noopener";
    link.addEventListener("click", e => { e.stopPropagation(); track("booking_click", { event_name: item.name, package: p.label, price: p.price }); });
    $(".pkg-side", row).appendChild(link);
    return row;
  }
  function suitability(p) {
    const t = `${p.label} ${p.spec}`.toLowerCase();
    if (t.includes("lens") || t.includes("zeiss") || t.includes("x300")) return "เหมาะกับ: ถ่ายเวทีไกล / ซูมศิลปิน / วิดีโอคอนเสิร์ต";
    if (t.includes("pro") || t.includes("ultra") || t.includes("zoom")) return "เหมาะกับ: ถ่ายคอนเสิร์ต / ซูมระยะไกล";
    return "เหมาะกับ: ถ่ายภาพและวิดีโอในงานคอนเสิร์ต / แฟนมีท / อีเวนต์";
  }

  function showOverlay(sel) { const el = $(sel); el.hidden = false; document.body.style.overflow = "hidden"; }
  function hideOverlay(sel) { const el = $(sel); el.hidden = true; document.body.style.overflow = ""; }
  function setFilterButtons() {
    $$(".filter").forEach(btn => {
      const active = btn.dataset.filter === state.filter;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }
  function applyConfig() {
    const hero = $("#heroImage");
    hero.src = CFG.headerImage || "";
    hero.addEventListener("error", () => { hero.hidden = true; $("#heroFallback").hidden = false; });
    $("#xLink").href = CFG.xUrl || "#";
    $$('[data-line-link]').forEach(a => a.href = LINE_DIRECT);
    const now = new Date();
    $("#updatedAt").textContent = `อัปเดตล่าสุด: ${String(now.getDate()).padStart(2,"0")}/${String(now.getMonth()+1).padStart(2,"0")}/${now.getFullYear()} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    setMeta("property", "og:url", CFG.siteUrl || location.origin);
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical && CFG.siteUrl) canonical.href = CFG.siteUrl;
  }
  function track(name, params) { try { if (typeof window.gtag === "function") window.gtag("event", name, params || {}); } catch (_) {} }

  document.addEventListener("DOMContentLoaded", async () => {
    applyConfig();
    skeleton();
    $$(".filter").forEach(btn => btn.addEventListener("click", () => { state.filter = btn.dataset.filter || "all"; render(); }));
    $("#faqOpen").addEventListener("click", () => showOverlay("#faqModal"));
    $$("[data-close-modal]").forEach(btn => btn.addEventListener("click", () => hideOverlay("#packageModal")));
    $$("[data-close-faq]").forEach(btn => btn.addEventListener("click", () => hideOverlay("#faqModal")));
    $("#packageModal").addEventListener("click", e => { if (e.target.id === "packageModal") hideOverlay("#packageModal"); });
    $("#faqModal").addEventListener("click", e => { if (e.target.id === "faqModal") hideOverlay("#faqModal"); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") { hideOverlay("#packageModal"); hideOverlay("#faqModal"); } });

    try {
      state.items = await loadData();
      render();
      if (state.event) {
        const item = state.items.find(x => x.id === state.event);
        if (item) setTimeout(() => openPackages(item), 80);
      }
    } catch (err) {
      console.error("KK load failed", err);
      empty("โหลดข้อมูลคิวไม่สำเร็จชั่วคราวน้า", "ลองรีเฟรชอีกครั้ง หรือสอบถามผ่าน LINE OA", "error");
    }
  });
})();
