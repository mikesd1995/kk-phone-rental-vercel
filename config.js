// KK Phone Rental Frontend v16.2_FULL_AUDIT_STABLE
// Recovery-stable baseline: API-first, but keeps a read-only emergency Google Sheets fallback so the public site does not go blank if Vercel ENV/API is missing.
window.KK_CONFIG = {
  appVersion:    "v16.2_FULL_AUDIT_STABLE",
  expectedAdminApiVersion: "v16.2_FULL_AUDIT_STABLE",
  siteUrl:       "https://kk-phone-rental.vercel.app/",

  // Emergency read-only fallback used only when /api/kk-data fails or when opening ?direct=1.
  // This keeps the public site recoverable when GOOGLE_SHEET_ID or the proxy response is unavailable.
  sheetId:       "12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU",

  webSheetName:  "08_Web_Ready",
  webRange:      "A4:K",
  pkgSheetName:  "09_Web_Packages",
  pkgRange:      "A4:N",

  useVercelApi:  true,
  apiEndpoint:   "/api/kk-data",
  disableDirectFallback: false,

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
