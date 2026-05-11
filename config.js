// KK Phone Rental Frontend v14.6 LEAN
window.KK_CONFIG = {
  siteUrl: "https://kk-phone-rental.vercel.app/",
  sheetId: "12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU",

  webSheetName: "08_Web_Ready",
  webRange: "A4:K",
  pkgSheetName: "09_Web_Packages",
  pkgRange: "A4:M",

  useApi: true,
  apiEndpoint: "/api/kk-data",
  directFallback: true,

  lineOAId: "@827blnmo",
  lineDirectUrl: "https://line.me/R/ti/p/%40827blnmo",
  xUrl: "https://x.com/KK_PhoneRental",
  headerImage: "https://lh3.googleusercontent.com/d/16v6ZDbxmqNEkxIpDNsm0ABrDjMT0_tu9=w1600"
};

(function () {
  var id = window.KK_CONFIG && window.KK_CONFIG.ga4Id;
  if (!id) return;
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", id, { send_page_view: true });
})();
