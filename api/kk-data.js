// KK Phone Rental v16.6.2_LINE_AUDITED — Vercel Serverless Google Sheets CSV Proxy
// Production reads through this proxy first. If GOOGLE_SHEET_ID is missing, it falls back to the known read-only sheet ID to prevent public-site outages.

const KK_APP_VERSION = "v16.7.0_CRM_PRO_PHASE3_6_14_PUBLIC_PACKAGE_RESTORE";
const DEFAULT_SHEET_ID = "12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU";

const ALLOWED = {
  "08_Web_Ready": new Set(["A4:K"]),
  "09_Web_Packages": new Set(["A4:N", "A4:M", "A4:L"]),
  "03_Packages": new Set(["A4:J"]),
  "04_Event_Overrides": new Set(["A4:G"]),
};

function csvHeaderLooksValid(sheet, text) {
  const firstLine = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/)[0] || "";
  const normalized = firstLine.toLowerCase();
  if (sheet === "08_Web_Ready") {
    return normalized.includes("event_id") && normalized.includes("poster_image_url") && normalized.includes("action_for_web");
  }
  if (sheet === "09_Web_Packages") {
    return normalized.includes("package_id") && normalized.includes("event_id") && normalized.includes("available_count");
  }
  return true;
}


function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 12000);
  return fetch(url, Object.assign({}, options || {}, { signal: controller.signal }))
    .finally(() => clearTimeout(timer));
}


function parseCsv(text) {
  const rows = [];
  let row = [];
  let val = "";
  let q = false;
  const src = String(text || "").replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '"') {
      if (q && n === '"') { val += '"'; i++; }
      else q = !q;
    } else if (c === ',' && !q) {
      row.push(val); val = "";
    } else if ((c === '\n' || c === '\r') && !q) {
      if (c === '\r' && n === '\n') i++;
      row.push(val); rows.push(row); row = []; val = "";
    } else {
      val += c;
    }
  }
  row.push(val); rows.push(row);
  return rows.filter(r => r.some(x => String(x || "").trim() !== ""));
}

function csvCell(v) {
  const s = String(v === undefined || v === null ? "" : v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function toCsv(rows) {
  return (rows || []).map(r => (r || []).map(csvCell).join(",")).join("\n");
}

function compactKey(k) {
  return String(k || "").toLowerCase().replace(/[\s_\-()\[\].:\/\\]+/g, "").replace(/[^a-z0-9ก-๙]/g, "").trim();
}

function findHeader(headers, names, fallbackIndex) {
  const wanted = (names || []).map(compactKey);
  for (let i = 0; i < headers.length; i++) {
    if (wanted.includes(compactKey(headers[i]))) return i;
  }
  return typeof fallbackIndex === "number" ? fallbackIndex : -1;
}

function normalizeBoolText(v) {
  const s = String(v === undefined || v === null ? "" : v).trim().toLowerCase();
  if (!s) return "";
  if (["true", "1", "yes", "y", "open", "show", "available", "เปิด", "เปิดขาย"].includes(s)) return "TRUE";
  if (["false", "0", "no", "n", "hidden", "hide", "closed", "ซ่อน", "ปิด", "ปิดขาย"].includes(s)) return "FALSE";
  return "";
}

function templateIdFromPackageId(packageId, eventId) {
  const pkg = String(packageId || "").trim();
  const ev = String(eventId || "").trim();
  if (!pkg) return "";
  const tplPos = pkg.indexOf("TPL-");
  if (tplPos >= 0) return pkg.slice(tplPos);
  if (ev && pkg.indexOf(ev + "-") === 0) return pkg.slice(ev.length + 1);
  return pkg;
}


function applySafeEventOverridesToWebPackagesCsv(webCsv, overrideCsv) {
  const webRows = parseCsv(webCsv);
  const ovRows = parseCsv(overrideCsv);
  if (webRows.length < 2 || ovRows.length < 2) {
    return { csv: webCsv, applied: 0, hidden: 0, exact: 0 };
  }

  const wh = webRows[0];
  const oh = ovRows[0];
  const wPackageId = findHeader(wh, ["package_id", "pkg_id"], 0);
  const wEventId = findHeader(wh, ["event_id"], 1);
  const wPrice = findHeader(wh, ["price", "ราคา"], 7);
  const wStatus = findHeader(wh, ["package_status", "status"], 9);
  const wSort = findHeader(wh, ["sort_order"], 10);
  const wNote = findHeader(wh, ["web_note", "package_note", "หมายเหตุ"], 11);
  const wUseCase = findHeader(wh, ["use_case", "use case"], 13);

  const oEventId = findHeader(oh, ["event_id"], 0);
  const oTemplateId = findHeader(oh, ["template_id", "package_id", "pkg_id"], 1);
  const oPrice = findHeader(oh, ["override_price", "price_override", "price"], 2);
  const oActive = findHeader(oh, ["active_override", "active", "pkg_active"], 3);
  const oNote = findHeader(oh, ["override_note", "web_note", "note"], 4);
  const oSort = findHeader(oh, ["sort_order_override", "sort_order"], 5);
  const oUseCase = findHeader(oh, ["use_case_override", "use_case"], 6);

  if (wPackageId < 0 || wEventId < 0 || wPrice < 0 || oEventId < 0 || oTemplateId < 0) {
    return { csv: webCsv, applied: 0, hidden: 0, exact: 0 };
  }

  // Emergency restore rule:
  // The public proxy must NEVER delete package rows. Stock filtering/compatibility belongs in
  // Google Sheet formulas + Apps Script repair, not in the Vercel CSV proxy. The proxy only overlays
  // event-specific overrides if it can match them safely.
  const latestByTemplate = new Map();
  for (let i = 1; i < ovRows.length; i++) {
    const r = ovRows[i] || [];
    const ev = String(r[oEventId] || "").trim();
    const tpl = String(r[oTemplateId] || "").trim();
    if (!ev || !tpl) continue;
    const hasAny = [oPrice, oActive, oNote, oSort, oUseCase].some(idx => idx >= 0 && String(r[idx] || "").trim() !== "");
    if (!hasAny) continue;
    latestByTemplate.set(ev + "||" + tpl, r);
  }

  let applied = 0;
  let hidden = 0;
  let exact = 0;
  for (let i = 1; i < webRows.length; i++) {
    const r = webRows[i] || [];
    const ev = String(r[wEventId] || "").trim();
    const packageId = String(r[wPackageId] || "").trim();
    const tpl = templateIdFromPackageId(packageId, ev);
    const ov = latestByTemplate.get(ev + "||" + tpl) || latestByTemplate.get(ev + "||" + packageId);
    if (!ov) continue;
    exact++;

    if (oPrice >= 0 && String(ov[oPrice] || "").trim() !== "") {
      r[wPrice] = String(ov[oPrice]).trim();
      applied++;
    }
    if (oSort >= 0 && wSort >= 0 && String(ov[oSort] || "").trim() !== "") r[wSort] = String(ov[oSort]).trim();
    if (oNote >= 0 && wNote >= 0 && String(ov[oNote] || "").trim() !== "") r[wNote] = String(ov[oNote]).trim();
    if (oUseCase >= 0 && wUseCase >= 0 && String(ov[oUseCase] || "").trim() !== "") r[wUseCase] = String(ov[oUseCase]).trim();

    const active = oActive >= 0 ? normalizeBoolText(ov[oActive]) : "";
    if (active === "FALSE" && wStatus >= 0) {
      r[wStatus] = "hidden";
      hidden++;
    } else if (active === "TRUE" && wStatus >= 0 && ["hidden", "hide"].includes(String(r[wStatus] || "").trim().toLowerCase())) {
      r[wStatus] = "available";
    }
  }
  return { csv: toCsv(webRows), applied, hidden, exact };
}

function send(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.statusCode = status;
  res.setHeader("Content-Type", contentType);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-KK-App-Version", KK_APP_VERSION);
  res.end(body);
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return send(res, 204, "");
  if (req.method !== "GET") return send(res, 405, "Method Not Allowed");

  const sheet = Array.isArray(req.query.sheet) ? "" : String(req.query.sheet || "").trim();
  const range = Array.isArray(req.query.range) ? "" : String(req.query.range || "").trim();
  const envSheetId = String(process.env.GOOGLE_SHEET_ID || "").trim();
  const sheetId = envSheetId || DEFAULT_SHEET_ID;
  const usingDefault = !envSheetId;
  res.setHeader("X-KK-Sheet-ID", sheetId ? sheetId.slice(0, 8) + "…" : "missing");
  res.setHeader("X-KK-Sheet-Source", usingDefault ? "default-fallback" : "env");

  if (!sheetId) {
    return send(res, 500, "Missing GOOGLE_SHEET_ID environment variable and DEFAULT_SHEET_ID is empty.");
  }
  if (!ALLOWED[sheet] || !ALLOWED[sheet].has(range)) {
    return send(res, 400, "Sheet/range not allowed");
  }

  const url = "https://docs.google.com/spreadsheets/d/" + encodeURIComponent(sheetId) +
    "/gviz/tq?tqx=out:csv&sheet=" + encodeURIComponent(sheet) +
    "&range=" + encodeURIComponent(range) +
    "&t=" + Date.now();

  try {
    const upstream = await fetchWithTimeout(url, {
      headers: { "User-Agent": "KK-Phone-Rental-Vercel-Proxy/16.7.0-Package-Restore" },
    }, 12000);
    let text = await upstream.text();
    if (!upstream.ok) {
      return send(res, upstream.status, text || "Google Sheets upstream error");
    }
    if (!csvHeaderLooksValid(sheet, text)) {
      return send(res, 502, "Google Sheets returned invalid CSV header for " + sheet + ". Check GOOGLE_SHEET_ID, sheet name, sharing, and range.");
    }
    if (sheet === "09_Web_Packages") {
      try {
        const overrideCsv = await fetchSheetCsvRaw(sheetId, "04_Event_Overrides", "A4:G", 10000);
        const transformed = applySafeEventOverridesToWebPackagesCsv(text, overrideCsv);
        text = transformed.csv;
        res.setHeader("X-KK-Override-Applied-Rows", String(transformed.applied || 0));
        res.setHeader("X-KK-Override-Hidden-Rows", String(transformed.hidden || 0));
        res.setHeader("X-KK-Override-Exact-Rows", String(transformed.exact || 0));
        res.setHeader("X-KK-Package-Restore", "safe-no-row-delete");
      } catch (joinErr) {
        // Emergency production rule: never break the public package feed because an optional
        // override join failed. Return original 09_Web_Packages instead of empty packages.
        res.setHeader("X-KK-Override-Join-Warning", String(joinErr && joinErr.message || joinErr).slice(0, 180));
        res.setHeader("X-KK-Package-Restore", "original-feed-fallback");
      }
      res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
    } else {
      res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=45");
    }
    return send(res, 200, text, "text/csv; charset=utf-8");
  } catch (err) {
    const msg = err && err.name === "AbortError"
      ? "Google Sheets CSV proxy timed out. Please refresh or check sheet sharing/performance."
      : (err && err.message ? err.message : String(err));
    return send(res, 502, "Proxy fetch failed: " + msg);
  }
};
