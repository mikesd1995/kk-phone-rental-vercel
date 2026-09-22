// KK Phone Rental Frontend v16.6.2_LINE_AUDITED
// Public-data browser hardening: the customer browser reads only through /api/kk-data.
// The server proxy remains the transition boundary until the private service-account reader is accepted.
window.KK_CONFIG = {
  appVersion:    "v16.7.0_CRM_PRO_PHASE3_9_5_4_BOOKING_STOCK_RESERVATION_FIX",
  expectedAdminApiVersion: "v16.6.2_LINE_AUDITED",
  siteUrl:       "https://kk-phone-rental.vercel.app/",

  webSheetName:  "08_Web_Ready",
  webRange:      "A4:K",
  pkgSheetName:  "09_Web_Packages",
  pkgRange:      "A4:N",

  useVercelApi:  true,
  apiEndpoint:   "/api/kk-data",
  disableDirectFallback: true,
  publicDataMode: "api-only",

  lineOAId:      "@827blnmo",
  lineDirectUrl: "https://line.me/R/ti/p/%40827blnmo",
  xUrl:          "https://x.com/KK_PhoneRental",
  headerImage:   "https://lh3.googleusercontent.com/d/16v6ZDbxmqNEkxIpDNsm0ABrDjMT0_tu9=w1600"

  // GA4: ใส่ Measurement ID ที่ได้จาก Google Analytics 4 Console
  // ga4Id: "G-XXXXXXXXXX"
};

// Transitional browser guard.
// config.js is a defer script loaded before script.js. Registering this listener here means it
// runs first at DOMContentLoaded, after script.js has defined its legacy globals but before the
// script.js data-loader listener runs. This disables every browser-side direct-Sheets fallback,
// including the historical package exception, without rewriting the large recovery-stable script.
(function installApiOnlyPublicDataGuard(){
  function enforceApiOnly(){
    try{
      if(window.KK_CONFIG){
        delete window.KK_CONFIG.sheetId;
        window.KK_CONFIG.useVercelApi = true;
        window.KK_CONFIG.disableDirectFallback = true;
        window.KK_CONFIG.publicDataMode = "api-only";
      }

      // Replace legacy global runtime state only after script.js has created it.
      if("SHEET_ID" in window) window.SHEET_ID = "api-only";
      if("USE_API" in window) window.USE_API = true;

      if(typeof window.apiSheetUrl !== "function" || typeof window.fetchValidatedSheetCsv !== "function"){
        throw new Error("Public data API helpers are unavailable");
      }

      window.directSheetUrl = function(){
        throw new Error("Direct Google Sheets browser access is disabled; use /api/kk-data");
      };

      window.fetchSheetCsv = async function(name, range, ms){
        return await window.fetchValidatedSheetCsv(
          window.apiSheetUrl(name, range),
          name,
          range,
          ms || 9000,
          "/api/kk-data"
        );
      };

      window.__KK_PUBLIC_DATA_GUARD__ = "api-only";
    }catch(err){
      window.__KK_PUBLIC_DATA_GUARD__ = "failed";
      console.error("KK public-data API-only guard failed", err);
    }
  }

  if(typeof document !== "undefined"){
    document.addEventListener("DOMContentLoaded", enforceApiOnly, {once:true});
  }
})();

// GA4 loader — โหลด async ไม่บล็อก render
(function(){
  var id = window.KK_CONFIG && window.KK_CONFIG.ga4Id;
  if(!id) return;
  var s=document.createElement("script");
  s.async=true; s.src="https://www.googletagmanager.com/gtag/js?id="+id;
  document.head.appendChild(s);
  window.dataLayer=window.dataLayer||[];
  window.gtag=function(){dataLayer.push(arguments);};
  gtag("js",new Date()); gtag("config",id,{send_page_view:true});
})();
