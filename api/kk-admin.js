// KK Phone Rental v16.7.0_CRM_PRO_PHASE3_9_5_8_SNAPSHOT_TIMEOUT_STABILITY_FIX — Admin CRM Vercel Proxy
// Browser -> /api/kk-admin -> Apps Script Web App -> Google Sheet
// Adds System Guard diagnostics for Apps Script URL / Sheet ID / public feed / override pipeline.

const KK_APP_VERSION = "v16.7.0_CRM_PRO_PHASE3_9_5_8_SNAPSHOT_TIMEOUT_STABILITY_FIX";
const DEFAULT_SHEET_ID = "12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-KK-App-Version", KK_APP_VERSION);
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.end(JSON.stringify(Object.assign({ proxy_version: KK_APP_VERSION }, body || {})));
}

function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 50000);
  return fetch(url, Object.assign({}, options || {}, { signal: controller.signal }))
    .finally(() => clearTimeout(timer));
}

function timeoutForAction(action) {
  const key = String(action || '').trim();
  if (key === 'phase1Health') return 20000;
  if (key === 'snapshot') return 55000;
  if (key === 'uploadPoster') return 55000;
  return 45000;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 6 * 1024 * 1024) {
        reject(new Error("Request too large. Please keep poster images below 3 MB."));
        req.destroy();
        return;
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function safeUrlHost(value) {
  try { return new URL(String(value || "")).host || ""; }
  catch (_) { return ""; }
}

function looksLikeAppsScriptUrl(value) {
  try {
    const u = new URL(String(value || ""));
    return u.protocol === "https:" && u.host === "script.google.com" && /\/macros\/s\/[^/]+\/exec$/.test(u.pathname);
  } catch (_) {
    return false;
  }
}

function compactNonJsonError(text, contentType, urlHost) {
  const raw = String(text || "");
  const titleMatch = raw.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "Non-JSON response";
  if (/drive|docs\.google|google drive/i.test(raw) || /drive|docs\.google/i.test(String(urlHost))) {
    return "Apps Script URL seems to point to Google Drive/Docs or returned a Google Drive page, not JSON. Check KK_ADMIN_SCRIPT_URL in Vercel.";
  }
  if (/<!doctype html|<html/i.test(raw)) {
    return "Apps Script returned HTML instead of JSON (" + title + "). Check Web App deployment URL and access setting.";
  }
  return "Apps Script returned a non-JSON response" + (contentType ? " (" + contentType + ")" : "") + ".";
}

function gvizCsvUrl(sheetId, sheet, range) {
  const params = new URLSearchParams({ tqx: "out:csv", sheet, range, t: String(Date.now()) });
  return "https://docs.google.com/spreadsheets/d/" + encodeURIComponent(sheetId) + "/gviz/tq?" + params.toString();
}

function csvHeaderLooksValid(sheet, text) {
  const firstLine = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/)[0] || "";
  const normalized = firstLine.toLowerCase();
  if (sheet === "08_Web_Ready") {
    return normalized.includes("event_id") && normalized.includes("poster_image_url") && normalized.includes("action_for_web");
  }
  if (sheet === "09_Web_Packages") {
    return normalized.includes("package_id") && normalized.includes("event_id") && normalized.includes("available_count");
  }
  if (sheet === "04_Event_Overrides") {
    return normalized.includes("event_id") && (normalized.includes("template_id") || normalized.includes("package_id"));
  }
  return true;
}

function diagnosticRow(key, label, status, detail, suggestion) {
  return { key, label, status, detail: detail || "", suggestion: suggestion || "" };
}

async function buildSystemHealth(payload, env) {
  const frontendSheetId = env.frontendSheetId;
  const scriptHost = safeUrlHost(env.scriptUrl);
  const scriptLooksOk = looksLikeAppsScriptUrl(env.scriptUrl);
  const rows = [];
  rows.push(diagnosticRow(
    "proxy_version",
    "Vercel Proxy Version",
    "OK",
    KK_APP_VERSION,
    ""
  ));
  rows.push(diagnosticRow(
    "env_sheet_id",
    "GOOGLE_SHEET_ID",
    env.envSheetId ? "OK" : "WARN",
    env.envSheetId ? "set from Vercel env" : "using default fallback sheet id",
    env.envSheetId ? "" : "Set GOOGLE_SHEET_ID in Vercel to avoid reading an old/default sheet."
  ));
  rows.push(diagnosticRow(
    "admin_script_url",
    "KK_ADMIN_SCRIPT_URL",
    scriptLooksOk ? "OK" : "FAIL",
    env.scriptUrl ? (scriptHost || "invalid URL") : "missing",
    scriptLooksOk ? "" : "Must be Apps Script Web App URL like https://script.google.com/macros/s/.../exec, not Google Drive/Docs URL."
  ));
  rows.push(diagnosticRow(
    "admin_api_key",
    "KK_ADMIN_API_KEY",
    env.apiKey ? "OK" : "FAIL",
    env.apiKey ? "set" : "missing",
    env.apiKey ? "" : "Set the same key in Vercel and Apps Script Script Properties."
  ));
  rows.push(diagnosticRow(
    "admin_pin",
    "KK_ADMIN_PIN",
    env.adminPin ? "OK" : "FAIL",
    env.adminPin ? "set" : "missing",
    env.adminPin ? "" : "Set KK_ADMIN_PIN in Vercel Environment Variables."
  ));

  let upstreamData = null;
  if (scriptLooksOk && env.apiKey) {
    try {
      const upstream = await fetchWithTimeout(env.scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "phase1Health",
          apiKey: env.apiKey,
          proxyVersion: KK_APP_VERSION,
          frontendSheetId,
          sheetIdSource: env.sheetIdSource
        })
      }, 15000);
      const contentType = upstream.headers.get("content-type") || "";
      const text = await upstream.text();
      try {
        upstreamData = JSON.parse(text);
        rows.push(diagnosticRow(
          "apps_script_json",
          "Apps Script JSON Response",
          upstreamData && upstreamData.ok ? "OK" : "FAIL",
          upstreamData && upstreamData.admin_api_version ? upstreamData.admin_api_version : "JSON received but ok=false",
          upstreamData && upstreamData.ok ? "" : (upstreamData && upstreamData.error ? upstreamData.error : "Check Apps Script deployment/API key.")
        ));
      } catch (_) {
        rows.push(diagnosticRow(
          "apps_script_json",
          "Apps Script JSON Response",
          "FAIL",
          compactNonJsonError(text, contentType, scriptHost),
          "Copy the latest Apps Script Web App URL from Deploy > Manage deployments and put it in KK_ADMIN_SCRIPT_URL."
        ));
      }
    } catch (err) {
      rows.push(diagnosticRow(
        "apps_script_reachable",
        "Apps Script Reachable",
        "FAIL",
        err && err.name === "AbortError" ? "timeout" : (err && err.message ? err.message : String(err)),
        "Check Apps Script deployment, access setting, and sheet performance."
      ));
    }
  }

  const upstreamHealth = upstreamData && upstreamData.data ? upstreamData.data : null;
  if (upstreamHealth) {
    const sameSheet = !!upstreamHealth.spreadsheet_id && upstreamHealth.spreadsheet_id === frontendSheetId;
    rows.push(diagnosticRow(
      "same_sheet",
      "Admin Backend Sheet = Public Sheet",
      sameSheet ? "OK" : "FAIL",
      (upstreamHealth.spreadsheet_id || "missing") + " / " + (frontendSheetId || "missing"),
      sameSheet ? "" : "Vercel GOOGLE_SHEET_ID must match the Spreadsheet bound to Apps Script."
    ));
    rows.push(diagnosticRow(
      "poster_folder",
      "KK_POSTER_FOLDER_ID",
      upstreamHealth.poster_folder_id_set ? "OK" : "WARN",
      upstreamHealth.poster_folder_id_set ? "set" : "missing",
      upstreamHealth.poster_folder_id_set ? "" : "Set Script Property KK_POSTER_FOLDER_ID before uploading posters."
    ));
    rows.push(diagnosticRow(
      "log_sheets",
      "Audit/Error Log Sheets",
      upstreamHealth.log_sheets_ready ? "OK" : "WARN",
      upstreamHealth.log_sheets_ready ? "15/16 logs ready" : "missing",
      upstreamHealth.log_sheets_ready ? "" : "Run setup/repair menu in Google Sheet."
    ));
  }

  const publicFeeds = [
    ["08_Web_Ready", "A4:K", "Public Event Feed"],
    ["09_Web_Packages", "A4:N", "Public Package/Price Feed"],
    ["04_Event_Overrides", "A4:G", "Override Feed"]
  ];
  for (const [sheet, range, label] of publicFeeds) {
    if (!frontendSheetId) {
      rows.push(diagnosticRow("feed_" + sheet, label, "FAIL", "missing sheet id", "Set GOOGLE_SHEET_ID in Vercel."));
      continue;
    }
    try {
      const r = await fetchWithTimeout(gvizCsvUrl(frontendSheetId, sheet, range), {}, 12000);
      const text = await r.text();
      const ok = r.ok && csvHeaderLooksValid(sheet, text);
      rows.push(diagnosticRow(
        "feed_" + sheet,
        label,
        ok ? "OK" : "FAIL",
        ok ? "header ok" : "header invalid or sheet not public",
        ok ? "" : "Check sheet tab name, range, and public access for this feed."
      ));
    } catch (err) {
      rows.push(diagnosticRow(
        "feed_" + sheet,
        label,
        "FAIL",
        err && err.message ? err.message : String(err),
        "Check Google Sheet sharing and gviz feed access."
      ));
    }
  }

  const fail = rows.filter(r => r.status === "FAIL").length;
  const warn = rows.filter(r => r.status === "WARN").length;
  return {
    ok: fail === 0,
    data: {
      generated_at: new Date().toISOString(),
      summary: { ok: rows.length - fail - warn, warn, fail, total: rows.length },
      rows,
      proxy_version: KK_APP_VERSION,
      frontend_sheet_id: frontendSheetId,
      frontend_sheet_id_source: env.sheetIdSource,
      apps_script_version: upstreamHealth && upstreamHealth.admin_api_version ? upstreamHealth.admin_api_version : ""
    }
  };
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || "";
  const configuredOrigins = String(process.env.KK_SITE_ORIGIN || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const vercelOrigin = process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "";
  const allowedOrigins = new Set([...configuredOrigins, vercelOrigin].filter(Boolean));
  if (origin && allowedOrigins.has(origin)) {
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

  if (!adminPin) {
    return json(res, 500, { ok: false, error: "Admin API is not configured. Set KK_ADMIN_PIN in Vercel Environment Variables." });
  }

  const providedPin = String(req.headers["x-admin-pin"] || "").trim();
  if (providedPin !== adminPin) return json(res, 401, { ok: false, error: "Invalid admin PIN" });

  let payload = {};
  try {
    if (req.method === "GET") {
      const url = new URL(req.url || "/api/kk-admin", "http://localhost");
      payload = { action: String(url.searchParams.get("action") || "snapshot") };
    } else {
      const raw = await readBody(req);
      try {
        payload = raw ? JSON.parse(raw) : {};
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
          return json(res, 400, { ok: false, error: "JSON request body must be an object" });
        }
      } catch (_) {
        return json(res, 400, { ok: false, error: "Invalid JSON request body" });
      }
    }

    if (payload.action === "systemHealth") {
      const health = await buildSystemHealth(payload, { scriptUrl, apiKey, adminPin, envSheetId, frontendSheetId, sheetIdSource });
      return json(res, health.ok ? 200 : 200, health);
    }

    if (!scriptUrl || !apiKey) {
      return json(res, 500, {
        ok: false,
        error: "Admin API is not configured. Set KK_ADMIN_SCRIPT_URL and KK_ADMIN_API_KEY in Vercel Environment Variables."
      });
    }
    if (!looksLikeAppsScriptUrl(scriptUrl)) {
      return json(res, 500, {
        ok: false,
        error: "KK_ADMIN_SCRIPT_URL is not an Apps Script Web App URL. It must look like https://script.google.com/macros/s/.../exec"
      });
    }

    const upstreamPayload = Object.assign({}, payload, {
      apiKey,
      proxyVersion: KK_APP_VERSION,
      frontendSheetId,
      sheetIdSource
    });
    const actionTimeoutMs = timeoutForAction(payload.action);
    const upstreamStartedAt = Date.now();
    const upstream = await fetchWithTimeout(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(upstreamPayload),
    }, actionTimeoutMs);
    const upstreamElapsedMs = Date.now() - upstreamStartedAt;

    const contentType = upstream.headers.get("content-type") || "";
    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); }
    catch (_) {
      data = { ok: false, error: compactNonJsonError(text, contentType, safeUrlHost(scriptUrl)) };
    }

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
    if (data && typeof data === 'object') {
      data.proxy_upstream_ms = upstreamElapsedMs;
      data.proxy_timeout_ms = actionTimeoutMs;
    }

    return json(res, upstream.ok ? 200 : upstream.status, data);
  } catch (err) {
    const action = String((payload && payload.action) || (req.method === "GET" ? "snapshot" : "unknown"));
    const timeoutMs = timeoutForAction(action);
    const isTimeout = !!(err && err.name === "AbortError");
    const msg = isTimeout
      ? "Apps Script request timed out for action " + action + ". The proxy waited up to " + String(timeoutMs) + " ms. Please retry once; if it repeats, check Apps Script Executions and sheet calculation load."
      : (err && err.message ? err.message : String(err));
    return json(res, 500, {
      ok: false,
      error: msg,
      error_code: isTimeout ? "UPSTREAM_TIMEOUT" : "UPSTREAM_ERROR",
      action,
      timeout_ms: timeoutMs
    });
  }
};
