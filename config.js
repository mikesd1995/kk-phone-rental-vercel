// KK Phone Rental v13.4 — Lean Audited + Optimized
window.KK_CONFIG = {
  siteUrl:       "https://kk-phone-rental.netlify.app/",
  sheetId:       "12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU",
  webSheetName:  "08_Web_Ready",
  webRange:      "A4:K",
  pkgSheetName:  "09_Web_Packages",
  pkgRange:      "A4:L",           // v13.4: package-level output จาก 09_Web_Packages
  lineOAId:      "@827blnmo",       // ใช้สร้าง oaMessage URL อัตโนมัติ
  lineDirectUrl: "https://line.me/R/ti/p/%40827blnmo",
  xUrl:          "https://x.com/KK_PhoneRental",
  headerImage:   "https://lh3.googleusercontent.com/d/16v6ZDbxmqNEkxIpDNsm0ABrDjMT0_tu9=w1600",
  // GA4: ใส่ Measurement ID ที่ได้จาก Google Analytics 4 Console
  // แล้ว uncomment บรรทัดด้านล่าง (ฟรี ไม่กระทบ performance เพราะ load async)
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
