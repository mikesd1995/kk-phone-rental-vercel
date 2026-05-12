// KK Phone Rental v15.0 — Admin CRM Vercel Proxy
// Browser -> /api/kk-admin -> Apps Script Web App -> Google Sheet
// Required ENV on Vercel:
// KK_ADMIN_SCRIPT_URL = Apps Script Web App URL ending /exec
// KK_ADMIN_API_KEY    = secret generated in Google Apps Script menu
// KK_ADMIN_PIN        = PIN that admin types on /admin

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 5 * 1024 * 1024) {
        reject(new Error("Request too large. Please keep poster images below 3 MB."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Pin");
  if (req.method === "OPTIONS") return json(res, 204, {});
  if (!["GET", "POST"].includes(req.method)) return json(res, 405, { ok: false, error: "Method not allowed" });

  const scriptUrl = String(process.env.KK_ADMIN_SCRIPT_URL || "").trim();
  const apiKey = String(process.env.KK_ADMIN_API_KEY || "").trim();
  const adminPin = String(process.env.KK_ADMIN_PIN || "").trim();

  if (!scriptUrl || !apiKey || !adminPin) {
    return json(res, 500, {
      ok: false,
      error: "Admin API is not configured. Set KK_ADMIN_SCRIPT_URL, KK_ADMIN_API_KEY and KK_ADMIN_PIN in Vercel Environment Variables."
    });
  }

  const providedPin = String(req.headers["x-admin-pin"] || req.query.pin || "").trim();
  if (providedPin !== adminPin) return json(res, 401, { ok: false, error: "Invalid admin PIN" });

  try {
    let payload = {};
    if (req.method === "GET") {
      payload = { action: String(req.query.action || "snapshot") };
    } else {
      const raw = await readBody(req);
      payload = raw ? JSON.parse(raw) : {};
    }

    const upstreamPayload = Object.assign({}, payload, { apiKey });
    const upstream = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(upstreamPayload),
    });

    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); }
    catch (_) { data = { ok: false, error: text || "Apps Script returned a non-JSON response" }; }

    res.setHeader("Cache-Control", "no-store");
    return json(res, upstream.ok ? 200 : upstream.status, data);
  } catch (err) {
    return json(res, 500, { ok: false, error: err && err.message ? err.message : String(err) });
  }
};
