// KK Phone Rental Frontend v14.12 AUDITED FIX — aligned with Google Sheet Backend v14.4 Bulletproof
// ใช้ไฟล์นี้เป็นจุดตั้งค่าหลักของเว็บ Vercel
window.KK_CONFIG = {
  // เปลี่ยนเป็นโดเมน Vercel/custom domain จริงของร้าน หลัง deploy แล้ว
  siteUrl:       "https://kk-phone-rental.vercel.app/",

  // ใช้เป็น fallback ตอนทดสอบแบบ direct Google Sheets เท่านั้น
  // ถ้า deploy บน Vercel แนะนำให้ตั้ง Environment Variable: GOOGLE_SHEET_ID
  sheetId:       "12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU",

  // Backend v14.12 source of truth
  webSheetName:  "08_Web_Ready",
  webRange:      "A4:K",
  pkgSheetName:  "09_Web_Packages",
  pkgRange:      "A4:N", // v14.12: N = use_case จาก backend

  // Vercel API Proxy: ลด CORS/Google Sheet throttle และซ่อน Sheet ID ผ่าน ENV ได้
  useVercelApi:  true,
  apiEndpoint:   "/api/kk-data",
  // ถ้า proxy ใช้งานไม่ได้ เว็บจะ fallback ไปอ่าน Google Sheet ตรงด้วย sheetId ด้านบน
  disableDirectFallback: false,

  lineOAId:      "@827blnmo",
  lineDirectUrl: "https://line.me/R/ti/p/%40827blnmo",
  xUrl:          "https://x.com/KK_PhoneRental",
  headerImage:   "https://lh3.googleusercontent.com/d/16v6ZDbxmqNEkxIpDNsm0ABrDjMT0_tu9=w1600",

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
