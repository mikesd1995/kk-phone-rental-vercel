// KK Phone Rental Frontend v16.0_PHASE1_STABILIZED
// Phase 1 stability baseline: version health check, Vercel API only in production, and admin/backend diagnostics.
window.KK_CONFIG = {
  appVersion:    "v16.0_PHASE1_STABILIZED",
  expectedAdminApiVersion: "v16.0_PHASE1_STABILIZED",
  siteUrl:       "https://kk-phone-rental.vercel.app/",

  // Direct Google Sheet fallback is disabled in Phase 1 production baseline.
  // Keep sheetId only for local emergency debug; normal website traffic must use /api/kk-data.
  sheetId:       "",

  webSheetName:  "08_Web_Ready",
  webRange:      "A4:K",
  pkgSheetName:  "09_Web_Packages",
  pkgRange:      "A4:N",

  useVercelApi:  true,
  apiEndpoint:   "/api/kk-data",
  disableDirectFallback: true,

  lineOAId:      "@827blnmo",
  lineDirectUrl: "https://line.me/R/ti/p/%40827blnmo",
  xUrl:          "https://x.com/KK_PhoneRental",
  headerImage:   "https://lh3.googleusercontent.com/d/16v6ZDbxmqNEkxIpDNsm0ABrDjMT0_tu9=w1600"

  // GA4: ใส่ Measurement ID ที่ได้จาก Google Analytics 4 Console
  // ga4Id: "G-XXXXXXXXXX"
};

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
