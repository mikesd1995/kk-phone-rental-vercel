// KK Phone Rental — Legacy Admin upstream proxy core (non-routable server module)
// Invoked behind the signed-session/guard adapters; not a public Vercel route.
// Adds System Guard diagnostics for Apps Script URL / Sheet ID / public feed / override pipeline.

const SnapshotHealth = require("../admin/snapshot-health.js");
const UpstreamResponse = require("../server/upstream-response.js");
const DirectWriterPhase1 = require("./admin-direct-writer-phase1.js");
const CorePrivacy = require("./core-sheet-private-reader.js");
const KK_APP_VERSION = SnapshotHealth.VERSION;
const DEFAULT_SHEET_ID = "12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-KK-App-Version", KK_APP_VERSION);
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.end(JSON.stringify(Object.assign({ proxy_version: KK_APP_VERSION }, body || {})));
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 50000);
  try {
    const response = await fetch(url, Object.assign({}, options || {}, { signal: controller.signal }));
    const body = await response.text();
    return { ok: response.ok, status: response.status, headers: response.headers, text: async () => body };
  } finally { clearTimeout(timer); }
}

function timeoutForAction(action) {
  const key = String(action || '').trim();
  if (key === 'phase1Health') return 20000;
  if (key === 'snapshot' || key === 'snapshotHealth') return 55000;
  if (key === 'uploadPoster') return 55000;
  return 45000;
}

function isReadOnlyAction(action) {
  return ['snapshot','snapshotHealth','systemHealth','phase1Health'].includes(String(action || '').trim());
}

function logMutation(event, fields) {
  const safe = Object.assign({
    event: String(event || 'mutation'),
    action: '',
    request_id: '',
    transport: '',
    duration_ms: 0,
    status: 0,
    error_code: '',
    uncertain_outcome: false
  }, fields || {});
  console.info('KK_ADMIN_MUTATION', JSON.stringify(safe));
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
  return UpstreamResponse.classifyNonJsonResponse(text, contentType, urlHost).message;
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

  const directWriterPhase1 = DirectWriterPhase1.routingState(process.env);
  rows.push(diagnosticRow(
    "direct_writer_phase1",
    "Direct Google Writer Phase 1",
    directWriterPhase1.ready ? "OK" : "WARN",
    "writer_ready=" + String(directWriterPhase1.writer_ready) +
      "; actions=" + (directWriterPhase1.configured_actions.length ? directWriterPhase1.configured_actions.join(",") : "none"),
    directWriterPhase1.ready
      ? ""
      : "Staged fail-closed. Provision a Google writer identity, pass the write probe, then explicitly allowlist Phase-1 actions."
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
        const failure = UpstreamResponse.classifyNonJsonResponse(text, contentType, scriptHost, upstream.status);
        console.warn("KK_ADMIN_UPSTREAM_PROTOCOL", JSON.stringify(UpstreamResponse.safeProtocolLog({
          code: failure.code,
          status: upstream.status,
          content_type: contentType,
          host: scriptHost,
          action: "phase1Health"
        })));
        rows.push(diagnosticRow(
          "apps_script_json",
          "Apps Script JSON Response",
          "FAIL",
          failure.message + " [" + failure.code + "; HTTP " + String(upstream.status || "unknown") + "]",
          failure.suggestion
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
      const text = CorePrivacy.enabled()
        ? await CorePrivacy.readCsv({sheetId:frontendSheetId,sheet,range})
        : await (async()=>{
            const r=await fetchWithTimeout(gvizCsvUrl(frontendSheetId,sheet,range),{},12000);
            if(!r.ok) throw new Error('Public diagnostic feed unavailable');
            return r.text();
          })();
      const ok = csvHeaderLooksValid(sheet, text);
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

    if (req.method === "POST" && DirectWriterPhase1.SUPPORTED_ACTIONS.includes(String(payload.action || ""))) {
      let directResult;
      try {
        directResult = await DirectWriterPhase1.tryExecute(payload, { env: process.env, fetchImpl: global.fetch });
      } catch (err) {
        res.setHeader("X-KK-Admin-Write-Transport", "DIRECT_GOOGLE_SHEETS");
        res.setHeader("X-KK-Admin-Direct-No-Fallback", "TRUE");
        const code = String(err && err.code || "DIRECT_PHASE1_WRITE_FAILED");
        const status =
          code === "DIRECT_PHASE1_VALIDATION_FAILED" ? 422 :
          code.endsWith("_NOT_FOUND") ? 404 :
          502;
        return json(res, status, {
          ok: false,
          error: err && err.message ? err.message : "Direct Google Sheets write failed",
          error_code: code,
          action: String(payload.action || ""),
          write_transport: "direct-google-sheets",
          no_legacy_fallback: true,
          mutation_committed: !!(err && err.mutation_committed),
          direct_writer_version: DirectWriterPhase1.VERSION
        });
      }
      if (directResult && directResult.handled) {
        res.setHeader("X-KK-Admin-Write-Transport", "DIRECT_GOOGLE_SHEETS");
        res.setHeader("X-KK-Admin-Direct-No-Fallback", "TRUE");
        logMutation('completed', {
          action: String(payload.action || ''),
          request_id: String(payload.request_id || directResult.request_id || ''),
          transport: 'direct-google-sheets',
          status: Number(directResult.status || 200)
        });
        return json(res, Number(directResult.status || 200), directResult.body);
      }
      res.setHeader("X-KK-Admin-Write-Transport", "LEGACY_APPS_SCRIPT");
      res.setHeader("X-KK-Admin-Direct-Skip", String(directResult && directResult.reason || "NOT_ROUTED").slice(0, 120));
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
      action: payload.action === "snapshotHealth" ? "snapshot" : payload.action,
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
      const failure = UpstreamResponse.classifyNonJsonResponse(text, contentType, safeUrlHost(scriptUrl), upstream.status);
      console.warn("KK_ADMIN_UPSTREAM_PROTOCOL", JSON.stringify(UpstreamResponse.safeProtocolLog({
        code: failure.code,
        status: upstream.status,
        content_type: contentType,
        host: safeUrlHost(scriptUrl),
        action: payload.action
      })));
      data = {
        ok: false,
        error: failure.message,
        error_code: "UPSTREAM_NON_JSON",
        upstream_failure_class: failure.code,
        upstream_status: upstream.status
      };
    }

    if (["snapshot", "snapshotHealth"].includes(payload.action)) {
      const health = SnapshotHealth.assess(data && data.ok && upstream.ok ? data.data : null);
      health.latency_ms = Date.now() - upstreamStartedAt;
      health.checked_at = new Date().toISOString();
      health.backend_version = data && data.data && data.data.admin_api_version || data && data.admin_api_version || "";
      health.proxy_version = KK_APP_VERSION;
      if (health.backend_version !== SnapshotHealth.BACKEND) health.warnings.push("Apps Script revision differs from observed 9_5_9; inspect deployed source, never downgrade to repository 9_5_8");
      if (data && data.data && data.data.spreadsheet_id !== frontendSheetId) {
        health.ok = false;
        health.issues.push("Snapshot spreadsheet_id does not match configured sheet");
      }
      if (payload.action === "snapshotHealth") {
        return json(res, 200, {ok:true, data:health});
      }
      if (!health.ok) return json(res, 502, {ok:false, error:"Snapshot rejected: "+health.issues.join("; "), error_code:"INVALID_SNAPSHOT", snapshot_health:health});
      data.snapshot_health = health;
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
      if (!isReadOnlyAction(payload.action)) {
        const confirmed = !!(data.ok && upstream.ok);
        const explicitBusinessReject = !!(upstream.ok && data.ok === false && !data.upstream_failure_class);
        const uncertain = !confirmed && !explicitBusinessReject;
        data.write_transport = data.write_transport || 'legacy-apps-script';
        data.request_id = data.request_id || String(payload.request_id || '');
        data.mutation_outcome = confirmed ? 'confirmed-response' : (uncertain ? 'uncertain-response' : 'rejected-response');
        data.mutation_outcome_uncertain = uncertain;
        data.mutation_may_have_committed = uncertain;
      }
    }

    if (!isReadOnlyAction(payload.action)) {
      const confirmed = !!(data && data.ok && upstream.ok);
      const explicitBusinessReject = !!(upstream.ok && data && data.ok === false && !data.upstream_failure_class);
      const uncertain = !confirmed && !explicitBusinessReject;
      logMutation(confirmed ? 'completed' : (uncertain ? 'uncertain' : 'rejected'), {
        action: String(payload.action || ''),
        request_id: String(payload.request_id || ''),
        transport: 'legacy-apps-script',
        duration_ms: upstreamElapsedMs,
        status: Number(upstream.status || 0),
        error_code: String(data && data.error_code || (data && data.ok === false ? 'UPSTREAM_BUSINESS_REJECTED' : '')),
        error: data && data.ok === false ? String(data.error || '').slice(0, 240) : '',
        uncertain_outcome: uncertain
      });
    }

    return json(res, upstream.ok ? 200 : upstream.status, data);
  } catch (err) {
    const action = String((payload && payload.action) || (req.method === "GET" ? "snapshot" : "unknown"));
    const timeoutMs = timeoutForAction(action);
    const isTimeout = !!(err && err.name === "AbortError");
    const msg = isTimeout
      ? "Apps Script request timed out for action " + action + ". The proxy waited up to " + String(timeoutMs) + " ms. The outcome may be uncertain; do not retry a mutation until readback confirms whether it committed."
      : (err && err.message ? err.message : String(err));
    if (!isReadOnlyAction(action)) {
      logMutation('uncertain', {
        action,
        request_id: String(payload && payload.request_id || ''),
        transport: 'legacy-apps-script',
        duration_ms: timeoutMs,
        status: 0,
        error_code: isTimeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_ERROR',
        uncertain_outcome: true
      });
    }
    return json(res, 500, {
      ok: false,
      error: msg,
      error_code: isTimeout ? "UPSTREAM_TIMEOUT" : "UPSTREAM_ERROR",
      action,
      timeout_ms: timeoutMs,
      request_id: String(payload && payload.request_id || ''),
      mutation_outcome_uncertain: !isReadOnlyAction(action),
      mutation_may_have_committed: !isReadOnlyAction(action)
    });
  }
};
