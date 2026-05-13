// KK Phone Rental v16.0_PHASE1_STABILIZED — Vercel Serverless Google Sheets CSV Proxy
// Phase 1: production must read through this proxy only. No hardcoded Sheet ID fallback.

const KK_APP_VERSION = "v16.0_PHASE1_STABILIZED";

const ALLOWED = {
  "08_Web_Ready": new Set(["A4:K"]),
  "09_Web_Packages": new Set(["A4:N", "A4:M", "A4:L"]),
};

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

  const sheet = String(req.query.sheet || "").trim();
  const range = String(req.query.range || "").trim();
  const sheetId = String(process.env.GOOGLE_SHEET_ID || "").trim();
  res.setHeader("X-KK-Sheet-ID", sheetId ? sheetId.slice(0, 8) + "…" : "missing");

  if (!sheetId) {
    return send(res, 500, "Missing GOOGLE_SHEET_ID environment variable. Direct fallback is disabled in v16.0 Phase 1.");
  }
  if (!ALLOWED[sheet] || !ALLOWED[sheet].has(range)) {
    return send(res, 400, "Sheet/range not allowed");
  }

  const url = "https://docs.google.com/spreadsheets/d/" + encodeURIComponent(sheetId) +
    "/gviz/tq?tqx=out:csv&sheet=" + encodeURIComponent(sheet) +
    "&range=" + encodeURIComponent(range) +
    "&t=" + Date.now();

  try {
    const upstream = await fetch(url, {
      headers: { "User-Agent": "KK-Phone-Rental-Vercel-Proxy/16.0-Phase1" },
    });
    const text = await upstream.text();
    if (!upstream.ok) {
      return send(res, upstream.status, text || "Google Sheets upstream error");
    }
    res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=45");
    return send(res, 200, text, "text/csv; charset=utf-8");
  } catch (err) {
    return send(res, 502, "Proxy fetch failed: " + (err && err.message ? err.message : String(err)));
  }
};
