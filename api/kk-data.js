// KK Phone Rental v14.12 — Vercel Serverless Google Sheets CSV Proxy
// Required on Vercel: Environment Variable GOOGLE_SHEET_ID = your new Google Sheet ID

const DEFAULT_SHEET_ID = "12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU";

const ALLOWED = {
  "08_Web_Ready": new Set(["A4:K"]),
  "09_Web_Packages": new Set(["A4:N", "A4:M", "A4:L"]),
};

function send(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.statusCode = status;
  res.setHeader("Content-Type", contentType);
  res.setHeader("X-Content-Type-Options", "nosniff");
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
  // Use ENV first. DEFAULT_SHEET_ID keeps the frontend working even if ENV is not set yet.
  // Do not accept arbitrary sheetId from query to avoid using this proxy for unrelated sheets.
  const sheetId = String(process.env.GOOGLE_SHEET_ID || DEFAULT_SHEET_ID).trim();

  if (!sheetId) {
    return send(res, 500, "Missing GOOGLE_SHEET_ID environment variable");
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
      headers: { "User-Agent": "KK-Phone-Rental-Vercel-Proxy/14.12" },
    });
    const text = await upstream.text();
    if (!upstream.ok) {
      return send(res, upstream.status, text || "Google Sheets upstream error");
    }
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return send(res, 200, text, "text/csv; charset=utf-8");
  } catch (err) {
    return send(res, 502, "Proxy fetch failed: " + (err && err.message ? err.message : String(err)));
  }
};
