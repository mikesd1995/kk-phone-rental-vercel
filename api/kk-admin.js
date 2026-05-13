// KK Phone Rental v16.2_FULL_AUDIT_STABLE — Admin CRM Vercel Proxy
// Browser -> /api/kk-admin -> Apps Script Web App -> Google Sheet
// Required ENV on Vercel:
// GOOGLE_SHEET_ID      = same Spreadsheet ID used by Apps Script
// KK_ADMIN_SCRIPT_URL  = Apps Script Web App URL ending /exec
// KK_ADMIN_API_KEY     = secret generated in Google Apps Script menu
// KK_ADMIN_PIN         = PIN that admin types on /admin
// Optional ENV:
// KK_SITE_ORIGIN       = https://kk-phone-rental.vercel.app or custom domain

const KK_APP_VERSION = "v16.2_FULL_AUDIT_STABLE";
const DEFAULT_SHEET_ID = "12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-KK-App-Version", KK_APP_VERSION);
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.end(JSON.stringify(Object.assign({ proxy_version: KK_APP_VERSION }, body || {})));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 6 * 1024 * 1024) {
        reject(new Error("Request too large. Please keep poster images below 3 MB."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || "";
  const allowedOrigin = process.env.KK_SITE_ORIGIN || (process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "");
  if (origin && allowedOrigin && origin === allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Pin");
  if (req.method === "OPTIONS") return json(res, 204, {});
  if (!["GET", "POST"].includes(req.method)) return json(res, 405, { ok: false, error: "Method not allowed" });

  const scriptUrl = String(process.env.KK_ADMIN_SCRIPT_URL || "").trim();
  const apiKey = String(process.env.KK_ADMIN_API_KEY || "").trim();
  const adminPin = String(process.env.KK_ADMIN_PIN || "").trim();
  const envSheetId = String(process.env.GOOGLE_SHEET_ID || "").trim();
  const frontendSheetId = envSheetId || DEFAULT_SHEET_ID;
  const sheetIdSource = envSheetId ? "env" : "default-fallback";

  if (!scriptUrl || !apiKey || !adminPin) {
    return json(res, 500, {
      ok: false,
      error: "Admin API is not configured. Set KK_ADMIN_SCRIPT_URL, KK_ADMIN_API_KEY and KK_ADMIN_PIN in Vercel Environment Variables."
    });
  }

  const providedPin = String(req.headers["x-admin-pin"] || "").trim();
  if (providedPin !== adminPin) return json(res, 401, { ok: false, error: "Invalid admin PIN" });

  try {
    let payload = {};
    if (req.method === "GET") {
      payload = { action: String(req.query.action || "snapshot") };
    } else {
      const raw = await readBody(req);
      payload = raw ? JSON.parse(raw) : {};
    }

    const upstreamPayload = Object.assign({}, payload, {
      apiKey,
      proxyVersion: KK_APP_VERSION,
      frontendSheetId,
      sheetIdSource
    });
    const upstream = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(upstreamPayload),
    });

    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); }
    catch (_) { data = { ok: false, error: text || "Apps Script returned a non-JSON response" }; }

    if (data && data.ok && payload && payload.action === "snapshot") {
      data.frontend_sheet_id = frontendSheetId;
      data.frontend_sheet_id_source = sheetIdSource;
      data.frontend_proxy_version = KK_APP_VERSION;
      if (data.data) {
        data.data.frontend_sheet_id = frontendSheetId;
        data.data.frontend_sheet_id_source = sheetIdSource;
        data.data.frontend_proxy_version = KK_APP_VERSION;
      }
    }

    return json(res, upstream.ok ? 200 : upstream.status, data);
  } catch (err) {
    return json(res, 500, { ok: false, error: err && err.message ? err.message : String(err) });
  }
};
