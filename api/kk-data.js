// KK Phone Rental v16.6.2_LINE_AUDITED — Vercel Serverless Google Sheets CSV Proxy
// Production reads through this proxy first. If GOOGLE_SHEET_ID is missing, it falls back to the known read-only sheet ID to prevent public-site outages.

const KK_APP_VERSION = "v16.7.0_CRM_PRO_PHASE3_6_7_OVERRIDE_PRICE_APPLY_FIX";
const DEFAULT_SHEET_ID = "12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU";

const ALLOWED = {
  "08_Web_Ready": new Set(["A4:K"]),
  "09_Web_Packages": new Set(["A4:N", "A4:M", "A4:L"]),
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
      headers: { "User-Agent": "KK-Phone-Rental-Vercel-Proxy/16.6.2-Line-Audited" },
    }, 12000);
    const text = await upstream.text();
    if (!upstream.ok) {
      return send(res, upstream.status, text || "Google Sheets upstream error");
    }
    if (!csvHeaderLooksValid(sheet, text)) {
      return send(res, 502, "Google Sheets returned invalid CSV header for " + sheet + ". Check GOOGLE_SHEET_ID, sheet name, sharing, and range.");
    }
    if (sheet === "09_Web_Packages") {
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
