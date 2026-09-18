'use strict';

function classifyNonJsonResponse(text, contentType, urlHost) {
  const raw = String(text || '');
  const ct = String(contentType || '').toLowerCase();
  const host = String(urlHost || '').toLowerCase();
  const titleMatch = raw.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Non-JSON response';

  if (/accounts\.google\.com|servicelogin|<title>\s*sign in\s*<\/title>/i.test(raw)) {
    return {
      code: 'GOOGLE_AUTH_HTML',
      message: 'Apps Script returned a Google sign-in/auth page instead of JSON. The Web App access setting or deployment authorization is not usable from Vercel.',
      suggestion: 'Open the current Apps Script Web App /exec URL in an incognito window. If Google asks you to sign in, fix Deploy > Manage deployments > Web app access, then update KK_ADMIN_SCRIPT_URL only if the deployment URL changed.'
    };
  }

  if (/drive\.google\.com\/(?:drive|file)|docs\.google\.com\/(?:document|spreadsheets|presentation)/i.test(raw) ||
      /drive\.google\.com|docs\.google\.com/.test(host)) {
    return {
      code: 'GOOGLE_DRIVE_DOCS_HTML',
      message: 'Apps Script URL resolved to a Google Drive/Docs page instead of JSON.',
      suggestion: 'Copy the current Apps Script Web App URL from Deploy > Manage deployments. It must be the /macros/s/.../exec URL, not a Drive, Docs, Sheet, editor, or /dev URL.'
    };
  }

  if (/<!doctype html|<html/i.test(raw) || ct.includes('text/html')) {
    return {
      code: 'GENERIC_HTML_RESPONSE',
      message: 'Apps Script returned HTML instead of JSON (' + title + ').',
      suggestion: 'Check the Web App deployment URL, access mode, and Apps Script Executions. The Vercel server must receive application/json from the /exec endpoint.'
    };
  }

  return {
    code: 'NON_JSON_RESPONSE',
    message: 'Apps Script returned a non-JSON response' + (contentType ? ' (' + contentType + ')' : '') + '.',
    suggestion: 'Check the Apps Script Web App deployment and confirm the /exec endpoint returns JSON.'
  };
}

function safeProtocolLog(fields) {
  const f = fields && typeof fields === 'object' ? fields : {};
  return {
    code: String(f.code || ''),
    status: Number.isFinite(Number(f.status)) ? Number(f.status) : null,
    content_type: String(f.content_type || '').slice(0, 120),
    host: String(f.host || '').slice(0, 160),
    action: String(f.action || '').slice(0, 80)
  };
}

module.exports = { classifyNonJsonResponse, safeProtocolLog };
