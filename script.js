// KK Phone Rental Frontend v16.6.2_LINE_AUDITED — Phase 1 recovery-stable baseline
// Backend contract:
// - 08_Web_Ready!A4:K = event-level output
// - 09_Web_Packages!A4:N = package-level output, including M raw_available_count and N use_case
// Improvements:
// - Vercel API proxy first, with read-only Google Sheets fallback for outage recovery
// - Safer package mapping so raw_available_count is not mistaken for pkg_active
// - Availability uses package_status + available_count, with raw negative protection
// - Keeps existing compact modal and 2-column card UX
// - Adds month dropdown selector and removes soon-only filter button

var APP       = window.KK_CONFIG || {};
var KK_APP_VERSION = APP.appVersion || "v16.7.0_CRM_PRO_PHASE3_9_5_4_BOOKING_STOCK_RESERVATION_FIX";
var DEFAULT_TITLE = "KK Phone Rental | เช่ามือถือคอนเสิร์ต แฟนมีท และอีเวนต์";
var DEFAULT_DESCRIPTION = "KK Phone Rental บริการเช่ามือถือสำหรับคอนเสิร์ต แฟนมีต และอีเวนต์ เลือกงาน เช็กคิวว่าง และจองผ่าน LINE OA";
var DEFAULT_OG_IMAGE = APP.headerImage || "https://lh3.googleusercontent.com/d/16v6ZDbxmqNEkxIpDNsm0ABrDjMT0_tu9=w1600";
var SHEET_ID  = APP.sheetId      || "12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU";
var WEB_SHEET = APP.webSheetName || "08_Web_Ready";
var WEB_RANGE = APP.webRange     || "A4:K";
var PKG_SHEET = APP.pkgSheetName || "09_Web_Packages";
var PKG_RANGE = APP.pkgRange     || "A4:N"; // M raw_available_count, N use_case from backend
var LINE_URL  = APP.lineDirectUrl|| "https://line.me/R/ti/p/%40827blnmo";
var LINE_OA_ID = APP.lineOAId || "@827blnmo";
var LINE_OA   = "https://line.me/R/oaMessage/" + encodeURIComponent(LINE_OA_ID) + "/?";
var API_ENDPOINT = APP.apiEndpoint || "/api/kk-data";
var USE_API = APP.useVercelApi !== false && typeof window !== "undefined" && window.location.protocol !== "file:" && !(APP.disableDirectFallback !== true && (new URLSearchParams(window.location.search)).get("direct") === "1");

var concertsData  = [];

function bangkokParts(now){
  var parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now||new Date());
  var out={};
  parts.forEach(function(p){if(p.type!=="literal")out[p.type]=p.value;});
  return out;
}
function bangkokDayKey(now){
  var p=bangkokParts(now);
  return p.year+"-"+p.month+"-"+p.day;
}
function bangkokMidnightTs(dayKey){
  return Date.parse(String(dayKey||"")+"T00:00:00+07:00");
}
function eventDateKey(raw){
  var value=String(raw||"").trim();
  if(!value)return "";
  if(/^\d{5}$/.test(value))return new Date(Date.UTC(1899,11,30)+Number(value)*86400000).toISOString().slice(0,10);
  var m=value.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if(m){var y=Number(m[3]);if(y>2500)y-=543;return String(y).padStart(4,"0")+"-"+String(Number(m[2])).padStart(2,"0")+"-"+String(Number(m[1])).padStart(2,"0");}
  m=value.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if(m){var y2=Number(m[1]);if(y2>2500)y2-=543;return String(y2).padStart(4,"0")+"-"+String(Number(m[2])).padStart(2,"0")+"-"+String(Number(m[3])).padStart(2,"0");}
  var d=parseDate(value);
  if(!d)return "";
  return String(d.getFullYear()).padStart(4,"0")+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
var TODAY_TS = bangkokMidnightTs(bangkokDayKey(new Date()));
var URL_PARAMS = new URLSearchParams(window.location.search);
var DEBUG_MODE = URL_PARAMS.get("debug")==="1";
var SHOW_PAST  = URL_PARAMS.get("showPast")==="1";
var REQUESTED_EVENT = String(URL_PARAMS.get("event") || URL_PARAMS.get("e") || "").trim();
var REQUESTED_FILTER = String(URL_PARAMS.get("filter") || "all").trim().toLowerCase();
var currentFilter = ["all","available","full"].indexOf(REQUESTED_FILTER)>=0 ? REQUESTED_FILTER : "all";
var REQUESTED_MONTH = String(URL_PARAMS.get("month") || "all").trim().toLowerCase();
var currentMonth = /^\d{4}-\d{2}$/.test(REQUESTED_MONTH) ? REQUESTED_MONTH : "all";
var currentSearch = String(URL_PARAMS.get("q") || "").trim();
var BROWSE_PAGE_SIZE = 24;
var browseLimit = BROWSE_PAGE_SIZE;
var TH_MONTHS_SHORT = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
var EN_MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
var PRELOADED_IMAGES = {};
var REQUESTED_LANG = String(URL_PARAMS.get("lang")||"").trim().toLowerCase();
var currentLang = (REQUESTED_LANG==="en"||REQUESTED_LANG==="th") ? REQUESTED_LANG : getStoredLanguage();
if(currentLang!=="th"&&currentLang!=="en") currentLang="th";
var activeModalEvent = null;
var lastDataLoadAt = 0;
var storefrontRefreshPromise = null;
var STALE_REFRESH_MS = 3*60*1000;

var I18N = {
  th: {
    meta_title:"KK Phone Rental | เช่ามือถือสำหรับคอนเสิร์ต แฟนมีต และอีเวนต์",
    meta_description:"KK Phone Rental บริการเช่ามือถือสำหรับคอนเสิร์ต แฟนมีต และอีเวนต์ เลือกงาน เช็กคิวว่าง แล้วจองผ่าน LINE OA",
    event_meta_description:"เช่ามือถือสำหรับงาน {event} วันที่ {date} ดูแพ็กเกจและจองผ่าน LINE OA",
    brand_subtitle:"Concert Phone Rental",
    hero_body:"เช่ามือถือสำหรับคอนเสิร์ตและแฟนมีต · เลือกงาน เช็กคิวว่าง แล้วรับ–คืนที่หน้างาน",
    hero_cta:"เช็กงานที่ยังว่าง",
    hero_secondary:"เช่ายังไง?",
    benefit_insurance:"จองง่ายขึ้น · ฟรีประกันเครื่องและไม่ต้องวางมัดจำ",
    benefit_onsite:"รับ–คืนหน้างาน · พร้อมสอนใช้ก่อนเข้าคอน",
    benefit_drive:"ส่งไฟล์ผ่าน Google Drive · เก็บให้ฟรี 30 วัน",
    benefit_discount:"ลูกค้าใหม่ลด 40฿ · ลูกค้าเก่ามีรีวิวลด 100฿",
    proof_deposit_title:"ไม่วางมัดจำ", proof_deposit_body:"พร้อมประกันเครื่องฟรี",
    proof_onsite_title:"หน้างาน", proof_onsite_body:"รับ–คืน + สอนใช้",
    proof_drive_title:"30 วัน", proof_drive_body:"เก็บไฟล์บน Drive",
    events_eyebrow:"UPCOMING EVENTS", events_title:"เลือกงานของคุณ แล้วเช็กคิวว่างได้เลย", events_body:"กดโปสเตอร์ → ดูแพ็กเกจและราคา → จองคิว", journey_kicker:"จองง่ายใน 3 ขั้นตอน", journey_1_title:"เลือกงาน", journey_1_body:"เลือกงานที่คุณจะไป", journey_2_title:"เลือกแพ็กเกจ", journey_2_body:"ดูรุ่น ราคา และคิวว่าง", journey_3_title:"จองผ่าน LINE", journey_3_body:"ร้านยืนยันคิว แล้วรับเครื่องหน้างาน",
    value_steps:"เลือกงาน > ดูแพ็กเกจและคิวว่าง > จองผ่าน LINE",
    value_note:"ไม่พบงานที่ต้องการ? สอบถามผ่าน LINE OA ได้",
    follow_promo:"ติดตาม X ร้าน · ไม่ต้องวางมัดจำ · ฟรีประกันเครื่อง",
    faq_button:"FAQ",
    language_aria:"เลือกภาษา",
    skip_link:"ข้ามไปดูงาน",
    theme_to_light_aria:"ใช้ธีมสว่าง",
    theme_to_dark_aria:"ใช้ธีมมืด",
    benefit_group_aria:"จุดเด่นบริการ",
    browse_group_aria:"ค้นหาและกรองงาน",
    journey_aria:"ขั้นตอนการจอง",
    select_month_aria:"เลือกเดือน",
    filter_group_aria:"เลือกเดือนและกรองสถานะงาน",
    search_placeholder:"ค้นหาชื่องาน / ศิลปิน / สถานที่",
    search_aria:"ค้นหางาน ศิลปิน หรือสถานที่",
    search_empty:"ไม่พบงานที่ตรงกับคำค้น “{query}”",
    search_results:"พบ {count} งาน",
    browse_results:"แสดง {count} งาน",
    clear_filters:"ล้างตัวกรอง",
    load_more:"ดูงานเพิ่มเติมอีก {count} งาน",
    card_waitlist:"คิวเต็ม · เปิดรับจองคิวหลุด",
    search_line:"ถามร้านเรื่อง “{query}”",
    share_event:"แชร์งานนี้",
    share_copied:"คัดลอกลิงก์งานแล้ว",
    card_venue:"{venue}",
    card_price_from:"เริ่ม {price}฿",
    card_price_ask:"สอบถามราคา",
    select_month:"ทุกเดือน",
    filter_all:"ทุกงาน",
    filter_available:"ยังมีคิว",
    filter_waitlist:"รอคิวหลุด",
    section_title:"เลือกงาน แล้วเช็กคิวว่าง",
    updated_prefix:"ตรวจสอบข้อมูลเมื่อ",
    loading_aria:"กำลังโหลดข้อมูลงาน",
    loading_text:"กำลังตรวจสอบคิวว่าง...",
    line_book:"ทัก LINE เพื่อจอง",
    sticky_line:"ทัก LINE เพื่อจอง",
    footer_tagline:"เช่ามือถือสำหรับคอนเสิร์ตและแฟนมีต",
    footer_trust:"รับ–คืนหน้างาน · จองผ่าน LINE",
    modal_close_aria:"ปิดหน้าต่าง",
    modal_title_placeholder:"ชื่องาน",
    modal_date_placeholder:"วันที่",
    modal_venue_placeholder:"สถานที่",
    modal_note_strong:"เลือกแพ็กเกจที่ต้องการ:",
    modal_note_body:"ถ้างานยังว่างให้กด “จองเลย” ถ้างานเต็มให้จองคิวหลุดผ่าน LINE ได้เลย",
    close:"ปิด",
    faq_close_aria:"ปิด FAQ",
    faq_title:"FAQ · คำถามที่พบบ่อย",
    faq_q1:"Q: เช่ามือถือยังไง?",
    faq_a1:"A: เลือกงาน ดูแพ็กเกจและคิวว่าง แล้วจองผ่าน LINE OA เพื่อให้ร้านยืนยันคิว",
    faq_q2:"Q: ในเซ็ตเช่ามีอุปกรณ์อะไรให้บ้าง?",
    faq_a2:"A: อุปกรณ์พื้นฐานมีตัวเครื่องมือถือ กระเป๋าใส่มือถือ และแบตสำรอง หากเช่าเลนส์เพิ่มจะมีถุงใส่เลนส์และผ้าเช็ดเลนส์ให้ด้วย",
    faq_q3:"Q: รับและคืนมือถือที่ไหน?",
    faq_a3:"A: รับและคืนมือถือพร้อมอุปกรณ์ที่หน้างานเท่านั้น",
    faq_q4:"Q: ต้องวางมัดจำหรือมีค่าประกันเครื่องไหม?",
    faq_a4:"A: ตอนนี้ร้านยังอยู่ในช่วงโปรโมชั่น จึงไม่เก็บค่ามัดจำและค่าประกัน เพียงฟอล X ของทางร้าน",
    faq_q5:"Q: การจ่ายเงินต้องจ่ายยังไง?",
    faq_a5:"A: จ่ายเงินตอนรับอุปกรณ์ที่หน้างาน",
    faq_q6:"Q: ต้องใช้เอกสารอะไรในการเช่า?",
    faq_a6:"A: รูปถ่ายบัตรประชาชน ใบขับขี่ หรือ Passport คู่กับหลักฐานการเข้างาน และถ่ายคู่กับมือถือและอุปกรณ์ตอนรับของอีกครั้ง",
    faq_q7:"Q: ทำไมไฟล์จาก Google Drive ไม่ชัด?",
    faq_a7:"A: Google Drive Preview อาจลดคุณภาพของภาพ ต้องกดดาวน์โหลดลงเครื่องก่อน ภาพจึงจะชัด",
    faq_q8:"Q: ไฟล์บน Google Drive เก็บไว้ได้กี่วัน?",
    faq_a8:"A: ร้านจะเก็บไฟล์ไว้ประมาณ 30 วัน หลังจากนั้นจะไม่สามารถเข้าถึงไฟล์ได้ แนะนำให้ดาวน์โหลดทันทีหลังได้รับลิงก์ค่ะ",
    every_month:"ทุกเดือน",
    full_availability:"คิวเต็ม · จองคิวหลุดได้",
    one_phone_left:"เหลือ 1 เครื่องสุดท้าย",
    phones_available:"ว่าง {count} เครื่อง",
    lens_only_available:"เหลือ Lens อย่างเดียว",
    available:"ว่าง",
    empty_available:"ยังไม่มีงานที่มีอุปกรณ์ว่าง{month}",
    empty_waitlist:"ยังไม่มีงานที่เปิดรอคิวหลุด{month}",
    empty_all:"ยังไม่มีงานที่เปิดให้จอง{month}",
    in_month:"ในเดือน {month} ",
    no_event_data:"ยังไม่มีข้อมูลงานในขณะนี้",
    empty_detail:"ถ้ามีงานที่อยากเช่า สามารถทัก LINE OA มาสอบถามได้เลย",
    contact_line:"ทัก LINE OA",
    badge_full:"คิวเต็ม",
    badge_today:"งานวันนี้",
    badge_soon:"ใกล้ถึงวันงาน",
    badge_available:"ว่าง {count} เครื่อง",
    badge_lens:"Lens ว่าง",
    badge_inquiry:"สอบถามราคา",
    inquiry_available:"เช็กคิว / สอบถามราคากับร้าน",
    ask_this:"สอบถามแพ็กเกจนี้",
    card_aria_available:"ดูอุปกรณ์ที่ว่างสำหรับงาน {event}",
    card_aria_waitlist:"จองคิวหลุดสำหรับงาน {event}",
    no_image:"ยังไม่มีรูป",
    tap_available:"ดูคิวว่างและแพ็กเกจ",
    tap_waitlist:"จองคิวหลุด",
    pkg_phone_only:"เฉพาะมือถือ",
    pkg_lens_only:"เลนส์เสริม",
    pkg_bundle:"มือถือ + เลนส์",
    pkg_ask:"สอบถามแพ็กเกจผ่าน LINE OA",
    pkg_tagline_phone:"เหมาะกับถ่ายเวทีไกล ซูมชัด",
    pkg_tagline_lens:"เลนส์เสริมสำหรับซูมไกล",
    pkg_tagline_bundle:"เซ็ตครบ ประหยัดกว่า",
    ask_price:"สอบถามราคา",
    per_day:" บาท/วัน",
    book_this:"จองเลย",
    book_aria:"จอง {package} สำหรับงาน {event}",
    full_title:"งานนี้เต็มแล้ว",
    full_body:"กดจองคิวหลุดไว้ได้เลย ถ้ามีลูกค้ายกเลิก ร้านจะได้เช็กคิวให้",
    waitlist_line:"จองคิวหลุดผ่าน LINE",
    waitlist_aria:"จองคิวหลุดสำหรับงาน {event}",
    event_details:"รายละเอียดงาน",
    booking_interest:"สนใจเช่า {package}",
    line_event:"งาน",
    line_date:"วันที่",
    line_venue:"สถานที่",
    line_price:"ราคา",
    line_nickname:"ชื่อเล่น",
    line_phone:"เบอร์โทร",
    line_pickup:"เวลาที่สะดวกรับอุปกรณ์",
    waitlist_title:"ขอจองคิวหลุด",
    line_package:"แพ็กเกจที่สนใจ",
    waitlist_note:"ถ้ามีคิวหลุด รบกวนแจ้งกลับด้วยค่ะ",
    unspecified:"ไม่ระบุ",
    error_title:"ไม่สามารถโหลดข้อมูลคิวได้ชั่วคราว",
    error_detail:"ลองรีเฟรชอีกครั้ง หรือสอบถามผ่าน LINE OA",
    error_line:"ทัก LINE OA มาสอบถาม",
    error_retry:"ลองโหลดข้อมูลใหม่",
    refreshed:"อัปเดตคิวล่าสุดแล้ว"
  },
  en: {
    meta_title:"KK Phone Rental | Phone Rental for Concerts and Events",
    meta_description:"Phone rental for concerts, fan meetings and events. Choose an event, check availability, and book directly with KK Phone Rental via LINE OA.",
    event_meta_description:"Rent a phone for {event} on {date}. View available packages and book via LINE OA.",
    brand_subtitle:"Concert Phone Rental",
    hero_body:"Phone rental for concerts and fan meetings. Choose your event, check availability, then pick up and return at the venue.",
    hero_cta:"Check available events",
    hero_secondary:"How to rent",
    benefit_insurance:"Book with less hassle · Free insurance, no deposit",
    benefit_onsite:"Venue pickup & return · Setup help before the show",
    benefit_drive:"Files via Google Drive · Stored free for 30 days",
    benefit_discount:"New customer −฿40 · Returning review −฿100",
    proof_deposit_title:"No deposit", proof_deposit_body:"Free device insurance",
    proof_onsite_title:"At the venue", proof_onsite_body:"Pickup, return + setup help",
    proof_drive_title:"30 days", proof_drive_body:"Drive file storage",
    events_eyebrow:"UPCOMING EVENTS", events_title:"Find your event and check availability", events_body:"Tap a poster → compare packages & price → book your slot", journey_kicker:"BOOK IN 3 STEPS", journey_1_title:"Choose event", journey_1_body:"Pick the event you are attending.", journey_2_title:"Choose package", journey_2_body:"Compare models, price and availability.", journey_3_title:"Book via LINE", journey_3_body:"We confirm your booking; pick up at the venue.",
    value_steps:"Choose an event > Compare packages and availability > Book via LINE",
    value_note:"Can't find your event? Ask us on LINE OA.",
    follow_promo:"Follow on X · No deposit · Free insurance",
    faq_button:"FAQ",
    language_aria:"Choose language",
    skip_link:"Skip to events",
    theme_to_light_aria:"Switch to light theme",
    theme_to_dark_aria:"Switch to dark theme",
    benefit_group_aria:"Service benefits",
    browse_group_aria:"Search and filter events",
    journey_aria:"How to book",
    select_month_aria:"Choose month",
    filter_group_aria:"Choose a month and filter event availability",
    search_placeholder:"Search event / artist / venue",
    search_aria:"Search events, artists or venues",
    search_empty:"No events match “{query}”",
    search_results:"{count} events found",
    browse_results:"Showing {count} events",
    clear_filters:"Clear filters",
    load_more:"View {count} more events",
    card_waitlist:"Fully booked · Join the waitlist",
    search_line:"Ask us about “{query}”",
    share_event:"Share this event",
    share_copied:"Event link copied",
    card_venue:"{venue}",
    card_price_from:"From ฿{price}",
    card_price_ask:"Ask for price",
    select_month:"All months",
    filter_all:"All events",
    filter_available:"Slots open",
    filter_waitlist:"Waitlist",
    section_title:"Choose an event and check availability",
    updated_prefix:"Data checked at",
    loading_aria:"Loading events",
    loading_text:"Checking availability...",
    line_book:"Book on LINE",
    sticky_line:"Book on LINE",
    footer_tagline:"Phone rental for concerts and fan meetings",
    footer_trust:"Venue pickup & return · Book via LINE",
    modal_close_aria:"Close window",
    modal_title_placeholder:"Event name",
    modal_date_placeholder:"Date",
    modal_venue_placeholder:"Venue",
    modal_note_strong:"Choose a package:",
    modal_note_body:"If slots are open, tap “Book now”. If full, join the waitlist via LINE.",
    close:"Close",
    faq_close_aria:"Close FAQ",
    faq_title:"FAQ · Frequently Asked Questions",
    faq_q1:"Q: How do I rent a phone?",
    faq_a1:"A: Choose your event, compare available packages, then book via LINE OA so we can confirm your booking.",
    faq_q2:"Q: What is included in the rental set?",
    faq_a2:"A: A phone rental includes the phone, a carrying pouch and a power bank. An add-on lens rental also includes a lens pouch and cleaning cloth.",
    faq_q3:"Q: Where do I pick up and return the rental?",
    faq_a3:"A: Phone and accessory pickup and return are available at the event venue only.",
    faq_q4:"Q: Is a deposit or device insurance fee required?",
    faq_a4:"A: During the current promotion, the deposit and insurance fee are waived when you follow our X account.",
    faq_q5:"Q: When do I pay?",
    faq_a5:"A: Payment is made when you pick up the equipment at the event venue.",
    faq_q6:"Q: What documents are required?",
    faq_a6:"A: A photo of your Thai ID card, driving licence or passport together with your event-entry proof, plus another photo with the rented equipment at pick-up.",
    faq_q7:"Q: Why do files look blurry in Google Drive?",
    faq_a7:"A: Google Drive Preview may reduce image quality. Download the file to your device to view the full-quality version.",
    faq_q8:"Q: How long are files stored on Google Drive?",
    faq_a8:"A: Files are stored for approximately 30 days. Please download them as soon as you receive the link.",
    every_month:"Every month",
    full_availability:"Fully booked · Join the waitlist",
    one_phone_left:"Only 1 phone left",
    phones_available:"{count} phones available",
    lens_only_available:"Lens-only package available",
    available:"Available",
    empty_available:"No equipment is available {month}yet.",
    empty_waitlist:"No events are currently accepting waitlist requests {month}.",
    empty_all:"No events are open for booking {month}yet.",
    in_month:"in {month} ",
    no_event_data:"No event information is available right now.",
    empty_detail:"Message us on LINE OA if you would like to ask about another event.",
    contact_line:"Message us on LINE OA",
    badge_full:"Fully Booked",
    badge_today:"Today",
    badge_soon:"Coming Soon",
    badge_available:"{count} Available",
    badge_lens:"Lens Available",
    badge_inquiry:"Ask Price",
    inquiry_available:"Check availability / Ask for price",
    ask_this:"Ask About This Package",
    card_aria_available:"View available equipment for {event}",
    card_aria_waitlist:"Join the waitlist for {event}",
    no_image:"No image",
    tap_available:"Check slots & packages",
    tap_waitlist:"Join waitlist",
    pkg_phone_only:"Phone only",
    pkg_lens_only:"Add-on lens",
    pkg_bundle:"Phone + Lens",
    pkg_ask:"Ask about packages via LINE OA",
    pkg_tagline_phone:"Great for distant-stage shots and clear zoom",
    pkg_tagline_lens:"Extra reach for distant-stage shots",
    pkg_tagline_bundle:"Complete set, better value",
    ask_price:"Ask for price",
    per_day:" THB/day",
    book_this:"Book now",
    book_aria:"Book {package} for {event}",
    full_title:"This event is fully booked",
    full_body:"Join the waitlist and we will check for you if another customer cancels.",
    waitlist_line:"Join Waitlist via LINE",
    waitlist_aria:"Join the waitlist for {event}",
    event_details:"Event details",
    booking_interest:"Interested in renting {package}",
    line_event:"Event",
    line_date:"Date",
    line_venue:"Venue",
    line_price:"Price",
    line_nickname:"Nickname",
    line_phone:"Phone number",
    line_pickup:"Preferred equipment pick-up time",
    waitlist_title:"Join waitlist",
    line_package:"Interested package",
    waitlist_note:"Please let me know if a slot becomes available.",
    unspecified:"Not specified",
    error_title:"Unable to load availability right now",
    error_detail:"Please refresh the page or contact us via LINE OA.",
    error_line:"Contact us via LINE OA",
    error_retry:"Try again",
    refreshed:"Availability refreshed"
  }
};

function getStoredLanguage(){
  try{ var v=localStorage.getItem("kk_public_language"); return v==="en"?"en":"th"; }catch(e){ return "th"; }
}
function tr(key, vars){
  var dict=I18N[currentLang]||I18N.th;
  var out=String(dict[key]!==undefined?dict[key]:(I18N.th[key]!==undefined?I18N.th[key]:key));
  Object.keys(vars||{}).forEach(function(k){out=out.replace(new RegExp("\\{"+k+"\\}","g"),String(vars[k]));});
  return out;
}
function setText(selector,key,vars){var el=document.querySelector(selector);if(el)el.textContent=tr(key,vars);}
function setAttr(selector,attr,key,vars){var el=document.querySelector(selector);if(el)el.setAttribute(attr,tr(key,vars));}
function setFaqLanguage(index,qKey,aKey){
  var item=document.querySelector("#faqOverlay .faq-item:nth-child("+index+")"); if(!item)return;
  var q=item.querySelector(".faq-q"), a=item.querySelector(".faq-a");
  if(q)q.innerHTML=esc(tr(qKey))+' <span class="faq-plus">+</span>';
  if(a)a.textContent=tr(aKey);
}
function updateLanguageButtons(){
  var sw=document.getElementById("language-switch"); if(sw)sw.setAttribute("aria-label",tr("language_aria"));
  document.querySelectorAll("[data-lang]").forEach(function(btn){
    var active=btn.getAttribute("data-lang")===currentLang;
    btn.classList.toggle("active",active); btn.setAttribute("aria-pressed",active?"true":"false");
  });
}
function applyStaticLanguage(){
  document.documentElement.lang=currentLang;
  setText(".skip-link","skip_link");
  setText(".v3-brand-copy small","brand_subtitle");
  var heroEyebrow=document.querySelector(".v3-eyebrow"); if(heroEyebrow)heroEyebrow.innerHTML=currentLang==="en"?"CONCERT PHONE RENTAL<br><span>EVENT PICKUP</span>":"เช่ามือถือไปคอน<br><span>รับ–คืนหน้างาน</span>";
  var heroTitle=document.querySelector("#v2-intro-title"); if(heroTitle)heroTitle.innerHTML=currentLang==="en"?"BRING THE STAGE<br><em>CLOSER.</em>":"ไกลแค่ไหน<br><em>ก็เก็บโมเมนต์ได้ใกล้กว่า</em>";
  setText(".v3-hero-copy>p","hero_body");
  var heroCta=document.querySelector(".v3-primary"); if(heroCta)heroCta.innerHTML=esc(tr("hero_cta"))+' <span aria-hidden="true">→</span>';
  setText(".v3-secondary","hero_secondary");
  var benefits=document.querySelectorAll(".kk-benefit-grid>div>span:last-child");
  ["benefit_insurance","benefit_onsite","benefit_drive","benefit_discount"].forEach(function(key,index){
    if(benefits[index])benefits[index].textContent=tr(key);
  });
  var proofItems=document.querySelectorAll(".v3-proof>div:not(.kk-proof-label)");
  if(proofItems[0]){var p0s=proofItems[0].querySelector("strong"),p0b=proofItems[0].querySelector("span");if(p0s)p0s.textContent=tr("proof_deposit_title");if(p0b)p0b.textContent=tr("proof_deposit_body");}
  if(proofItems[1]){var p1s=proofItems[1].querySelector("strong"),p1b=proofItems[1].querySelector("span");if(p1s)p1s.textContent=tr("proof_onsite_title");if(p1b)p1b.textContent=tr("proof_onsite_body");}
  if(proofItems[2]){var p2s=proofItems[2].querySelector("strong"),p2b=proofItems[2].querySelector("span");if(p2s)p2s.textContent=tr("proof_drive_title");if(p2b)p2b.textContent=tr("proof_drive_body");}
  setText(".v3-events-heading span","events_eyebrow");
  var eventHeading=document.querySelector(".v3-events-heading h2");
  if(eventHeading)eventHeading.innerHTML=currentLang==="en"?"FIND YOUR EVENT.<br><em>CHECK AVAILABILITY.</em>":"เลือกงานของคุณ<br><em>แล้วเช็กคิวว่างได้เลย</em>";
  var eventBody=document.querySelector(".v3-events-heading p");
  if(eventBody)eventBody.textContent=tr("events_body");
  setText(".kk-journey-kicker","journey_kicker");
  var journey=document.querySelectorAll(".kk-journey-steps>div");
  [["journey_1_title","journey_1_body"],["journey_2_title","journey_2_body"],["journey_3_title","journey_3_body"]].forEach(function(keys,i){
    if(!journey[i])return;var title=journey[i].querySelector("strong"),body=journey[i].querySelector("span");
    if(title)title.textContent=tr(keys[0]);if(body)body.textContent=tr(keys[1]);
  });
  setText(".value-box p:not(.value-note)","value_steps");
  setText(".value-box .value-note","value_note");
  setText("a.quick-link","follow_promo");
  setText("#faq-open-btn","faq_button");
  setAttr("#language-switch","aria-label","language_aria");
  setAttr(".kk-benefit-grid","aria-label","benefit_group_aria");
  setAttr(".browse-controls-shell","aria-label","browse_group_aria");
  setAttr("#booking-journey","aria-label","journey_aria");
  setText(".event-search-wrap .sr-only","search_aria");
  setText(".month-select-wrap .sr-only","select_month_aria");
  setAttr("#content .skeleton-grid","aria-label","loading_aria");
  setText("#content .skeleton-loading-text","loading_text");
  var activeTheme=document.documentElement.getAttribute("data-theme")==="dark"?"dark":"light";
  setAttr("#theme-toggle","aria-label",activeTheme==="dark"?"theme_to_light_aria":"theme_to_dark_aria");
  document.querySelectorAll(".filter-group,.status-filter-bar").forEach(function(el){el.setAttribute("aria-label",tr("filter_group_aria"));});
  setAttr("#event-search","placeholder","search_placeholder");
  setAttr("#event-search","aria-label","search_aria");
  setAttr("#month-filter-select","aria-label","select_month_aria");
  setText('[data-filter="all"]',"filter_all");
  setText('[data-filter="available"]',"filter_available");
  setText('[data-filter="full"]',"filter_waitlist");
  setText("#clear-browse-btn","clear_filters");
  setText(".sec-title span","section_title");
  setText("#line-btn-label","line_book");
  setText("#sticky-line-label","sticky_line");
  setText("footer .footer-tagline","footer_tagline");
  setText("footer .trust-note","footer_trust");
  setAttr("#modal-x-btn","aria-label","modal_close_aria");
  setText("#modal-title","modal_title_placeholder");
  setText("#modal-date","modal_date_placeholder");
  setText("#modal-venue","modal_venue_placeholder");
  var note=document.querySelector(".modal-note"); if(note)note.innerHTML="<strong>"+esc(tr("modal_note_strong"))+"</strong> "+esc(tr("modal_note_body"));
  setText("#modal-close","close");
  setText("#event-share-btn","share_event");
  setAttr("#faq-x-btn","aria-label","faq_close_aria");
  setText("#faq-title","faq_title");
  for(var i=1;i<=8;i++)setFaqLanguage(i,"faq_q"+i,"faq_a"+i);
  setText("#faq-close-btn","close");
  updateLanguageButtons();
}
function updateLanguageUrl(){
  try{
    var u=new URL(window.location.href);
    if(currentLang==="en")u.searchParams.set("lang","en"); else u.searchParams.delete("lang");
    window.history.replaceState(null,"",u.toString());
  }catch(e){}
}
function applyLanguage(lang,options){
  options=options||{};
  currentLang=lang==="en"?"en":"th";
  if(options.save!==false){try{localStorage.setItem("kk_public_language",currentLang);}catch(e){}}
  if(options.updateUrl!==false)updateLanguageUrl();
  applyStaticLanguage();
  resetMeta();
  setUpdateDate();
  if(concertsData&&concertsData.length)renderConcerts(concertsData);
  var ov=document.getElementById("overlay");
  if(activeModalEvent&&ov&&ov.classList.contains("active"))showModal(activeModalEvent,{skipTrack:true});
}
function bindLanguageSwitch(){
  document.querySelectorAll("[data-lang]").forEach(function(btn){
    btn.addEventListener("click",function(){
      var next=btn.getAttribute("data-lang")==="en"?"en":"th";
      if(next===currentLang)return;
      applyLanguage(next);
      track("language_change",{language:next});
    });
  });
}


function preferredTheme(){
  try{var saved=localStorage.getItem("kk_public_theme");if(saved==="dark"||saved==="light")return saved;}catch(e){}
  return "light";
}
function applyTheme(theme,options){
  options=options||{};
  var next=theme==="dark"?"dark":"light";
  document.documentElement.setAttribute("data-theme",next);
  var btn=document.getElementById("theme-toggle");
  if(btn){btn.setAttribute("aria-pressed",next==="dark"?"true":"false");btn.setAttribute("aria-label",tr(next==="dark"?"theme_to_light_aria":"theme_to_dark_aria"));}
  var meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute("content",next==="dark"?"#071426":"#f4f6f8");
  if(options.save!==false){try{localStorage.setItem("kk_public_theme",next);}catch(e){}}
}
function bindThemeToggle(){
  applyTheme(preferredTheme(),{save:false});
  var btn=document.getElementById("theme-toggle");if(!btn)return;
  btn.addEventListener("click",function(){
    var next=document.documentElement.getAttribute("data-theme")==="dark"?"light":"dark";
    applyTheme(next);track("theme_change",{theme:next});
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────
function esc(s){ return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function toNum(v){ var n=Number(String(v||"").replace(/[^0-9.\-]/g,"")); return isNaN(n)?0:n; }
function hasVal(v){ return v!==undefined && v!==null && String(v).trim()!==""; }
function toBool(v){ if(v===true||v===1)return true; var s=String(v||"").trim().toUpperCase(); return s==="TRUE"||s==="YES"||s==="1"||s==="ว่าง"||s==="OPEN"||s==="SHOW"; }
function numberLocale(){return currentLang==="en"?"en-US":"th-TH";}
function fmtPrice(n){ n=toNum(n); return n>0?(currentLang==="en"?n.toLocaleString(numberLocale())+" THB/day":n.toLocaleString(numberLocale())+" บาท/วัน"):tr("unspecified"); }
function fmtPriceLine(n){ n=toNum(n); return n>0?(currentLang==="en"?n.toLocaleString(numberLocale())+" THB":n.toLocaleString(numberLocale())+" บาท"):tr("unspecified"); }
function lineVal(v){ var s=String(v||"").replace(/\s+/g," ").trim(); return s||"-"; }

// Header-safe row utilities: Google Sheets CSV may export Thai headers with line breaks.
function compactKey(k){
  return String(k||"")
    .toLowerCase()
    .replace(/[\s_\-()\[\].:\/\\]+/g,"")
    .replace(/[^a-z0-9ก-๙]/g,"")
    .trim();
}
function pick(obj, keys, fallbackIndex){
  var rawKeys = Object.keys(obj||{}), wanted = keys.map(compactKey);
  for(var i=0;i<rawKeys.length;i++){
    if(wanted.indexOf(compactKey(rawKeys[i]))>=0) return obj[rawKeys[i]];
  }
  if(typeof fallbackIndex==="number"){
    var vals = rawKeys.map(function(k){return obj[k];});
    if(vals[fallbackIndex]!==undefined) return vals[fallbackIndex];
  }
  return "";
}
function normalizePkgRow(p){
  // Backend package headers:
  // A package_id, B event_id, C package_type, D model_group, E model_display,
  // F lens_group, G lens_display, H price, I available_count, J package_status,
  // K sort_order, L web_note, M raw_available_count, N use_case
  var status = pick(p,["package_status","package status","status","สถานะแพ็กเกจ"],9);
  var price  = pick(p,["price","standard_price","standard price","ราคา"],7);
  var modelDisplay = pick(p,["model_display","phone_model_display","ชื่อแสดง\nมือถือ","ชื่อแสดงมือถือ"],4);
  var lensDisplay  = pick(p,["lens_display","lens_model_display","ชื่อแสดง\nเลนส์","ชื่อแสดงเลนส์"],6);
  var pkgType = pick(p,["pkg_type","package_type","package type","ประเภท\nแพ็กเกจ","ประเภทแพ็กเกจ"],2);
  var availableCount = pick(p,["available_count","available count","available_count\n(auto)","จำนวนว่าง"],8);
  var rawAvailableCount = pick(p,["raw_available_count","raw available count","raw_available_count\n(auto)","จำนวนว่างดิบ"],12);
  var useCase = pick(p,["use_case","use case","use_case_note","เหมาะกับ","ข้อความเหมาะกับ"],13);

  return {
    package_id:          pick(p,["package_id","pkg_id","template_id","รหัสแพ็กเกจ\n(Auto)","รหัสแพ็กเกจ"],0),
    event_id:            pick(p,["event_id","event_id\n(ตรงกับ 01_Events)"],1),
    pkg_type:            pkgType,
    model_group:         pick(p,["model_group","model_group\n(จาก Settings)"],3),
    phone_model_display: modelDisplay,
    model_display:       modelDisplay,
    lens_group:          pick(p,["lens_group","lens_group\n(NONE ถ้าไม่มี)"],5),
    lens_model_display:  lensDisplay,
    lens_display:        lensDisplay,
    price:               price,
    web_note:            pick(p,["web_note","package_note","หมายเหตุ\n(สำหรับเว็บ)","หมายเหตุ"],11),
    // ห้าม fallback เป็น index 12 เพราะ column M คือ raw_available_count ไม่ใช่ active flag
    pkg_active:          pick(p,["pkg_active","pkg_active\n(TRUE/FALSE)"]),
    available_count:     availableCount,
    raw_available_count: rawAvailableCount,
    use_case:            useCase,
    package_status:      status,
    sort_order:          pick(p,["sort_order"],10)
  };
}
function isPkgVisible(p){
  var st=String((p&&p.package_status)||"").trim().toLowerCase();
  if(st==="hidden"||st==="hide") return false;
  if(hasVal(p&&p.pkg_active)) return toBool(p.pkg_active);
  return true;
}

// ─── GA4 minimal tracker ──────────────────────────────────────────────────
// ถ้ายังไม่ได้เซ็ต GA_ID ใน config.js ก็ skip ไปเงียบๆ
function track(name, params){
  try{ if(typeof gtag==="function"){ gtag("event", name, params||{}); } }catch(e){}
}
var SEARCH_MISS_TIMER=null;
var LAST_SEARCH_MISS={query:"",at:0};
function normalizeAnalyticsQuery(value){
  return String(value||"").normalize("NFKC").replace(/\s+/g," ").trim().toLocaleLowerCase("th-TH");
}
function queueSearchMissTrack(query){
  var normalized=normalizeAnalyticsQuery(query);
  clearTimeout(SEARCH_MISS_TIMER);
  if(normalized.length<3)return;
  SEARCH_MISS_TIMER=setTimeout(function(){
    var now=Date.now();
    if(LAST_SEARCH_MISS.query===normalized && now-LAST_SEARCH_MISS.at<30000)return;
    if(normalizeAnalyticsQuery(currentSearch)!==normalized)return;
    LAST_SEARCH_MISS={query:normalized,at:now};
    track("search_no_result",{query:normalized});
  },700);
}
function setMeta(attr, key, val){
  try{
    if(!val)return;
    var el=document.querySelector('meta['+attr+'="'+key+'"]');
    if(el)el.setAttribute("content", val);
  }catch(e){}
}
function eventUrl(c){
  try{ var u=new URL(homeUrl()); u.searchParams.set("event", c.id||""); return u.toString(); }
  catch(e){ return (APP.siteUrl || window.location.href); }
}
function eventShareUrl(c){
  try{ return window.location.origin+"/event/"+encodeURIComponent(String(c&&c.id||"")); }
  catch(e){ return eventUrl(c); }
}
function resetMeta(){
  try{
    var title=tr("meta_title"), desc=tr("meta_description");
    document.title = title;
    setMeta("name","description",desc);
    setMeta("property","og:title",title);
    setMeta("property","og:description",desc);
    setMeta("property","og:url",APP.siteUrl || homeUrl());
    setMeta("property","og:image",DEFAULT_OG_IMAGE);
    setMeta("name","twitter:title",title);
    setMeta("name","twitter:description",desc);
    setMeta("name","twitter:image",DEFAULT_OG_IMAGE);
  }catch(e){}
}
function updateMetaForEvent(c){
  if(!c)return;
  var title=(c.name?c.name+" | ":"")+"KK Phone Rental";
  var desc=tr("event_meta_description",{event:c.name||tr("event_details"),date:c.date||"-"});
  document.title=title;
  setMeta("name","description",desc);
  setMeta("property","og:title",title);
  setMeta("property","og:description",desc);
  setMeta("property","og:url",eventUrl(c));
  if(c.imgFull&&c.imgFull[0])setMeta("property","og:image",c.imgFull[0]);
  setMeta("name","twitter:title",title);
  setMeta("name","twitter:description",desc);
  if(c.imgFull&&c.imgFull[0])setMeta("name","twitter:image",c.imgFull[0]);
}

// ─── Date utils ───────────────────────────────────────────────────────────
function parseDate(s){
  s=String(s||"").trim(); if(!s)return null;
  if(/^\d{5}$/.test(s)){ return new Date(Date.UTC(1899,11,30)+Number(s)*86400000); }
  var m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if(m){ var y=parseInt(m[3],10); if(y>2500)y-=543; return new Date(y,parseInt(m[2],10)-1,parseInt(m[1],10)); }
  m=s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if(m){ var y2=parseInt(m[1],10); if(y2>2500)y2-=543; return new Date(y2,parseInt(m[2],10)-1,parseInt(m[3],10)); }
  var en={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
  m=s.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/i);
  if(m){ var mo=en[m[2].toLowerCase().slice(0,3)]; if(mo!==undefined){ var y3=parseInt(m[3],10); if(y3>2500)y3-=543; return new Date(y3,mo,parseInt(m[1],10)); }}
  var th={"ม.ค.":0,"มกราคม":0,"ก.พ.":1,"กุมภาพันธ์":1,"มี.ค.":2,"มีนาคม":2,"เม.ย.":3,"เมษายน":3,"พ.ค.":4,"พฤษภาคม":4,"มิ.ย.":5,"มิถุนายน":5,"ก.ค.":6,"กรกฎาคม":6,"ส.ค.":7,"สิงหาคม":7,"ก.ย.":8,"กันยายน":8,"ต.ค.":9,"ตุลาคม":9,"พ.ย.":10,"พฤศจิกายน":10,"ธ.ค.":11,"ธันวาคม":11};
  for(var k in th){ if(s.indexOf(k)>=0){ var parts=s.split(k); var d2=parseInt(String(parts[0]).replace(/\D/g,""),10); var ym=String(parts[1]||"").match(/\d{4}/); var y4=ym?parseInt(ym[0],10):new Date().getFullYear(); if(y4>2500)y4-=543; if(d2)return new Date(y4,th[k],d2); }}
  return null;
}
function fmtDate(s){ var d=parseDate(s); if(!d)return String(s||""); return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")+"/"+d.getFullYear(); }

// ─── Image utils — FIX 2: w600 thumbnail, w1200 only for modal ───────────
function storefrontPosterOverride(row){
  var name=String((row&&row.event_name)||"").normalize("NFKC").toLowerCase().replace(/\\s+/g," ").trim();
  var dateKey=eventDateKey((row&& (row.event_date_text||row.event_date||row.date))||"");
  if(dateKey==="2026-11-14" && name.indexOf("masterz")>=0){
    return "/assets/event-posters/kpop-masterz-special-live-bangkok-2026-11-14.jpeg";
  }
  if(dateKey==="2026-09-28" && name.indexOf("mizumi")>=0 && name.indexOf("pp krit")>=0){
    return "/assets/event-posters/mizumi-ppkrit-pink-aura-2026-09-28.jpg";
  }
  if(dateKey==="2026-10-08" && name.indexOf("unlucky bae")>=0){
    return "/assets/event-posters/unlucky-bae-final-ep-official-2026-10-08.jpg";
  }
  if(dateKey==="2026-10-08" && name.indexOf("cir*crl")>=0 && name.indexOf("anniversary")>=0){
    return "/assets/event-posters/circrl-1st-anniversary-2026-10-08.jpeg";
  }
  if(dateKey==="2026-11-08" && name.indexOf("maxkybas")>=0 && name.indexOf("arcade")>=0){
    return "/assets/event-posters/maxkybas-arcade-2026-11-08.jpg";
  }
  if(dateKey==="2026-09-30" && name.indexOf("nineentertain")>=0 && name.indexOf("24th")>=0){
    return "/assets/event-posters/nineentertain-24th-anniversary-charity-concert-2026-09-30.jpg";
  }
  if(dateKey==="2026-09-30" && (name.indexOf("min min")>=0 || name.indexOf("minmin")>=0) && name.indexOf("teeteepor")>=0){
    return "/assets/event-posters/minmin-teeteepor-frozen-candy-land-2026-09-30.jpg";
  }
  // KHOM KHLANG Special Episode 5: the canonical sheet poster points to an
  // owner-private Drive file, so unauthenticated storefront clients cannot render it.
  // Keep canonical SOT first and retain this publicly-readable owner copy only as the
  // exact-event delivery fallback.
  if(dateKey==="2026-10-05" && name.indexOf("khom khlang")>=0 && name.indexOf("special")>=0 && (name.indexOf("episode 5")>=0 || name.indexOf("ep.5")>=0 || name.indexOf("ep5")>=0)){
    return "https://lh3.googleusercontent.com/d/1f995RLhvIO-aSJb6Hu12lg8BBUgmMAYC=w900";
  }
  // 2026-09-28 missing-poster recovery. These rows are live/bookable in 08_Web_Ready
  // but currently have a blank poster_image_url. Exact-event sources were verified
  // before adding these bounded storefront overrides.
  if(dateKey==="2026-10-04" && name.indexOf("bnk48")>=0 && name.indexOf("cgm48")>=0 && name.indexOf("fan festival")>=0){
    return "https://bnk48ota.com/wp-content/uploads/2026/09/fan-festival2026.jpeg";
  }
  if(dateKey==="2026-10-04" && name.indexOf("idol exchange")>=0 && name.indexOf("before halloween")>=0){
    return "https://scontent-sjc6-1.xx.fbcdn.net/v/t39.30808-6/819068726_1564442942035301_479602733273844169_n.jpg?stp=dst-jpg_tt6&cstp=mx1144x1430&ctp=p600x600&_nc_cat=100&ccb=1-7&_nc_sid=b96d88&_nc_ohc=BxXx_Pb4wZcQ7kNvwEQtgy-&_nc_oc=Adq-Wb6SVXs6Uh1uhvzJkqdu-HZnhhpCR4wK1KU393GSe8XJXoNAX7BLl9HlE_JuyGw&_nc_zt=23&_nc_ht=scontent-sjc6-1.xx&_nc_gid=Y82lgi9EUQf7Sa7d1RKAHA&_nc_ss=7b289&oh=00_AQNnKea7bYxQKcjw4mwHbInAxvy48N-EL-PcEEel0CabXQ&oe=6ABFD343";
  }
  if(dateKey==="2026-10-04" && name.indexOf("aibeck")>=0 && name.indexOf("bangkok")>=0){
    return "https://tm-prod-event-files-v3.ticketmelon.com/abbee918818711f1922201117567899b/poster/22ca6dd890a511f1922201117567899b.png";
  }
  return "";
}
function getDriveId(url){
  var s=String(url||"").trim();
  var pats=[
    /\/file\/d\/([a-zA-Z0-9_-]{15,})/,
    /[?&]id=([a-zA-Z0-9_-]{15,})/,
    /\/thumbnail\?id=([a-zA-Z0-9_-]{15,})/,
    /googleusercontent\.com\/d\/([a-zA-Z0-9_-]{15,})/,
    /lh[3-6]\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]{15,})/,
    /uc\?export=(?:view|download)&id=([a-zA-Z0-9_-]{15,})/
  ];
  for(var i=0;i<pats.length;i++){ var m=s.match(pats[i]); if(m&&m[1])return decodeURIComponent(m[1]).trim(); }
  if(!/^https?:\/\//i.test(s) && /^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;
  return "";
}
function getImgCandidates(url, size){
  // Keep Drive thumbnail as the primary path because it is the proven production baseline.
  // "thumb" = w600 (grid), "full" = w1200 (modal)
  var sz = size==="full" ? "w1200" : "w600";
  var s=String(url||"").trim(); if(!s)return [];
  var id=getDriveId(s);
  if(id)return [
    "https://drive.google.com/thumbnail?id="+encodeURIComponent(id)+"&sz="+sz,
    "https://lh3.googleusercontent.com/d/"+encodeURIComponent(id)+"="+sz,
    "https://drive.google.com/uc?export=view&id="+encodeURIComponent(id)
  ];
  return [s];
}
function setImgFallbackWhenVisible(img, urls, options){
  options=options||{};
  if(typeof img._kkCancelImageVisibilityFallback==="function") img._kkCancelImageVisibilityFallback();
  if(typeof IntersectionObserver==="undefined"){
    setImgFallback(img,urls,options); return;
  }
  var started=false;
  var observer=new IntersectionObserver(function(entries){
    for(var i=0;i<entries.length;i++){
      if(entries[i].isIntersecting||entries[i].intersectionRatio>0){
        if(started)return;
        started=true;
        observer.disconnect();
        img._kkCancelImageVisibilityFallback=null;
        setImgFallback(img,urls,options);
        return;
      }
    }
  },{rootMargin:options.rootMargin||"600px 0px"});
  observer.observe(img);
  img._kkCancelImageVisibilityFallback=function(){
    if(!started) observer.disconnect();
  };
}

function setImgFallback(img, urls, options){
  options=options||{};
  var seen={};
  urls=(urls||[]).filter(function(url){
    var v=String(url||"").trim();
    if(!v||seen[v])return false;
    seen[v]=true; return true;
  });
  var idx=0, attempt=0, timer=null, settled=false;
  var timeoutMs=Math.max(1000,Number(options.timeoutMs||5000));

  // Modal image is reused across events. Cancel any older timeout/handler chain first,
  // otherwise a slow request from the previous event can overwrite the new poster.
  if(typeof img._kkCancelImageFallback==="function") img._kkCancelImageFallback();

  function clearTimer(){ if(timer){ clearTimeout(timer); timer=null; } }
  function cancel(){
    settled=true; clearTimer();
    img.onerror=null; img.onload=null;
  }
  img._kkCancelImageFallback=cancel;

  function imageHasPixels(){ return !!(img && img.complete && Number(img.naturalWidth||0)>0); }
  function settleLoaded(){
    clearTimer(); settled=true;
    img.onerror=null; img.onload=null;
  }
  function exhausted(){
    // Safari/iOS may paint a cross-origin/Drive image before the expected load callback
    // reaches this fallback chain. Never replace an image that already has decoded pixels.
    if(imageHasPixels()){ settleLoaded(); return; }
    cancel();
    if(img.id==="modal-poster-img"){ img.style.display="none"; return; }
    if(typeof options.onExhausted==="function"){
      try{ options.onExhausted(img); }catch(e){}
      return;
    }
    var w=img.parentElement;
    if(typeof img.remove==="function") img.remove();
    if(w&&!w.querySelector(".poster-placeholder")){
      var ph=document.createElement("div"); ph.className="poster-placeholder";
      ph.innerHTML="<span>ยังไม่มีรูป</span>"; w.appendChild(ph);
    }
  }
  function next(){
    if(settled)return;
    clearTimer();
    if(imageHasPixels()){ settleLoaded(); return; }
    if(idx>=urls.length){ exhausted(); return; }
    var url=urls[idx++], token=++attempt;
    img.style.display="block";
    img.onload=function(){
      if(settled||token!==attempt)return;
      settleLoaded();
    };
    img.onerror=function(){
      if(settled||token!==attempt)return;
      next();
    };
    img.src=url;
    timer=setTimeout(function(){
      if(settled||token!==attempt)return;
      // Safari/iOS can paint the image while load-event delivery is delayed. If pixels
      // are already present, freeze the successful candidate instead of overwriting it.
      if(imageHasPixels()){ settleLoaded(); return; }
      // Otherwise advance a genuinely stalled Google image request.
      next();
    },timeoutMs);
  }
  next();
}

// ─── CSV + fetch ──────────────────────────────────────────────────────────
function parseCsv(text){
  var rows=[],row=[],val="",q=false;
  text=String(text||"").replace(/^\uFEFF/,"");
  for(var i=0;i<text.length;i++){
    var c=text[i],n=text[i+1];
    if(c==='"'){ if(q&&n==='"'){val+='"';i++;}else q=!q; }
    else if(c===','&&!q){ row.push(val);val=""; }
    else if((c==='\n'||c==='\r')&&!q){ if(c==='\r'&&n==='\n')i++; row.push(val); if(row.some(function(x){return String(x||"").trim()!=="";})){ rows.push(row); } row=[];val=""; }
    else val+=c;
  }
  row.push(val);
  if(row.some(function(x){return String(x||"").trim()!=="";})){ rows.push(row); }
  return rows;
}
function csvToObjects(rows){
  if(!rows||rows.length<2)return [];
  var headers=rows[0].map(function(h){return String(h||"").trim();});
  return rows.slice(1).map(function(row){
    var obj={}; headers.forEach(function(h,i){ if(h)obj[h]=row[i]!==undefined?row[i]:""; });
    return obj;
  }).filter(function(o){ return Object.keys(o).some(function(k){return String(o[k]||"").trim()!=="";});});
}
function abortAfter(ms){ var c=new AbortController(); var t=setTimeout(function(){c.abort();},ms); return {signal:c.signal,clear:function(){clearTimeout(t);}}; }
async function fetchText(url,ms){
  var ab=abortAfter(ms||9000);
  try{ var r=await fetch(url,{cache:"no-store",signal:ab.signal}); if(!r.ok)throw new Error("HTTP "+r.status); return await r.text(); }
  finally{ ab.clear(); }
}
async function withRetry(fn,tries,delay){
  var err; tries=tries||2; delay=delay||700;
  for(var i=0;i<tries;i++){ try{return await fn();}catch(e){err=e;if(i<tries-1)await new Promise(function(r){setTimeout(r,delay);});} }
  throw err;
}
function directSheetUrl(name,range){ if(!SHEET_ID) throw new Error("Direct Google Sheet fallback is not configured. Please check config.js sheetId or /api/kk-data."); return "https://docs.google.com/spreadsheets/d/"+encodeURIComponent(SHEET_ID)+"/gviz/tq?tqx=out:csv&sheet="+encodeURIComponent(name)+"&range="+encodeURIComponent(range)+"&t="+Date.now(); }
function apiSheetUrl(name,range){
  var url=API_ENDPOINT+"?sheet="+encodeURIComponent(name)+"&range="+encodeURIComponent(range)+"&t="+Date.now();
  if(SHOW_PAST) url+="&showPast=1";
  return url;
}
function csvHeaderLooksValid(name,text){
  var rows=parseCsv(text);
  if(!rows.length)return false;
  var headers=rows[0].map(function(h){return String(h||"").trim().toLowerCase();});
  if(name===WEB_SHEET) return headers.indexOf("event_id")>=0 && headers.indexOf("action_for_web")>=0 && headers.indexOf("poster_image_url")>=0;
  if(name===PKG_SHEET) return headers.indexOf("package_id")>=0 && headers.indexOf("event_id")>=0 && headers.indexOf("available_count")>=0;
  return true;
}
async function fetchValidatedSheetCsv(url,name,range,ms,sourceLabel){
  var text=await fetchText(url,ms||9000);
  if(!csvHeaderLooksValid(name,text)){
    throw new Error("Invalid CSV header from "+sourceLabel+" for "+name+" "+range);
  }
  return text;
}
async function fetchSheetCsv(name,range,ms){
  if(USE_API){
    try{ return await fetchValidatedSheetCsv(apiSheetUrl(name,range),name,range,ms||9000,"/api/kk-data"); }
    catch(e){
      // Emergency public restore: never let package cards lose all prices because the Vercel
      // package proxy failed. Direct fallback may not include the newest override, but it is safer
      // than showing every event as package-less / ask-price.
      console.warn("KK proxy failed or returned invalid CSV; falling back to read-only Google Sheets", e);
      if(APP.disableDirectFallback && name!==PKG_SHEET) throw e;
    }
  }
  return await fetchValidatedSheetCsv(directSheetUrl(name,range),name,range,ms||9000,"direct Google Sheets");
}

// ─── Session cache ───────────────────────────────────────────────────────
var CACHE_TTL=0; // Stock and booking availability must refresh live after admin changes.
var PKG_CACHE_TTL=0; // Phase 3.6.12: package price override must be live from /api/kk-data canonical join.
function cacheGet(k,ttl){ try{ var raw=sessionStorage.getItem(k); if(!raw)return null; var o=JSON.parse(raw); var maxAge=(typeof ttl==="number"?ttl:CACHE_TTL); return (Date.now()-o.ts)<maxAge?o.data:null; }catch(e){return null;} }
function cacheSet(k,d){ try{sessionStorage.setItem(k,JSON.stringify({ts:Date.now(),data:d}));}catch(e){} }

async function fetchWebRows(){
  var k="kk_web_v16_7_0_phase3_9_5_4_stock_live:"+SHEET_ID+":"+WEB_SHEET+":"+WEB_RANGE+":"+(USE_API?"api":"direct"); var c=cacheGet(k,CACHE_TTL); if(!DEBUG_MODE&&c)return c;
  var t=await withRetry(function(){return fetchSheetCsv(WEB_SHEET,WEB_RANGE,9000);},2,700);
  var d=csvToObjects(parseCsv(t)); if(!DEBUG_MODE)cacheSet(k,d); return d;
}
async function fetchPkgRows(){
  var k="kk_pkg_v16_7_0_phase3_6_15_price_source_restore:"+SHEET_ID+":"+PKG_SHEET+":"+PKG_RANGE+":"+(USE_API?"api":"direct"); var c=cacheGet(k,PKG_CACHE_TTL); if(!DEBUG_MODE&&c)return c;
  var t=await withRetry(function(){return fetchSheetCsv(PKG_SHEET,PKG_RANGE,9000);},2,700);
  var d=csvToObjects(parseCsv(t)).map(normalizePkgRow); if(!DEBUG_MODE)cacheSet(k,d); return d;
}

function looksInternalPublicText(raw){
  var s=String(raw||"");
  try{s=s.normalize("NFKC");}catch(e){}
  s=s.trim();
  if(!s)return false;

  // Customer-facing notes must never render machine/internal annotations.
  // This generic guard catches operational tokens even when a new token name appears.
  var machineToken=/(?:^|[\s([{])(?:[A-Z][A-Z0-9-]{1,})(?:_[A-Z0-9-]+){2,}(?=$|[\s)\]}.,;:])/;
  if(machineToken.test(s))return true;

  return /(?:^|\b)v\d+(?:\.\d+){1,3}\b|capacity\s*(?:tight|blocked|readback)|exact\s+capacity|readback|owner[_\s-]?locked|core\s+promotion|promotion\s+repair|reopened\s+after|manifest|write\s+transaction|pass[_\s-]?200|policy\s+version|restored\s+\d{4}-\d{2}-\d{2}|scanner\s+raw|verifier\s+backlog|machine[_\s-]?sot|manual[_\s-]?cutover|internal[_\s-]?(?:note|only)|override[_\s-]?(?:note|reason)/i.test(s);
}
function sanitizePublicText(raw){
  var s=String(raw||"").replace(/\[INQUIRY_ONLY\]/ig,"").trim();
  return looksInternalPublicText(s)?"":s;
}

function packagePublicSubtitle(p){
  if(!p)return "";
  var useCase=sanitizePublicText(p.useCase);
  var note=sanitizePublicText(p.note);
  // Package feed copy can be Thai-only. Never leak Thai helper copy into EN UI:
  // prefer an English feed value when present, otherwise use the localized fallback.
  if(currentLang==="en"){
    var englishCandidate=!/[\u0E00-\u0E7F]/.test(useCase)?useCase:"";
    if(!englishCandidate&&!/[\u0E00-\u0E7F]/.test(note))englishCandidate=note;
    if(englishCandidate)return englishCandidate;
    if(p.type==="phone_only")return tr("pkg_tagline_phone");
    if(p.type==="lens_only")return tr("pkg_tagline_lens");
    if(p.type==="phone_lens_bundle")return tr("pkg_tagline_bundle");
    return "";
  }
  if(useCase)return useCase;
  if(note)return note;
  if(p.type==="phone_only")return tr("pkg_tagline_phone");
  if(p.type==="lens_only")return tr("pkg_tagline_lens");
  if(p.type==="phone_lens_bundle")return tr("pkg_tagline_bundle");
  return "";
}

// Generated web-package feeds must remain one-row-per-package_id for rendering.
// If an upstream recovery temporarily leaves duplicate IDs, keep the last occurrence:
// 09_Web_Packages generators materialize their authoritative output after older/manual rows.
function dedupePackageRows(pkgRows){
  var rows=Array.isArray(pkgRows)?pkgRows:[];
  var seen=Object.create(null);
  var out=[];
  for(var i=rows.length-1;i>=0;i--){
    var p=rows[i]||{};
    var id=String(p.package_id||"").trim();
    if(id){
      if(seen[id])continue;
      seen[id]=true;
    }
    out.push(p);
  }
  out.reverse();
  return out;
}

// Apply the same last-occurrence rule to event feed rows. This keeps stale/manual
// output from rendering duplicate event cards when a later generated row exists.
function dedupeWebRowsByEventId(webRows){
  var rows=Array.isArray(webRows)?webRows:[];
  var seen=Object.create(null);
  var out=[];
  for(var i=rows.length-1;i>=0;i--){
    var r=rows[i]||{};
    var id=String(r.event_id||"").trim();
    if(id){
      if(seen[id])continue;
      seen[id]=true;
    }
    out.push(r);
  }
  out.reverse();
  return out;
}

// ─── FIX 1: buildPackagesFromSheet — ใช้ available_count จาก 09_Web_Packages จริง ─
function buildPackagesFromSheet(pkgRows, eventId, phoneCnt, lensCnt){
  // phoneCnt + lensCnt มาจาก 08_Web_Ready G/H; package count มาจาก 09_Web_Packages I
  var evtPkgs=dedupePackageRows(pkgRows).filter(function(p){
    var rowEvent = String(p.event_id||"").trim();
    return (!rowEvent || rowEvent===String(eventId||"").trim()) && isPkgVisible(p);
  });
  if(!evtPkgs.length)return [];

  return evtPkgs.sort(function(a,b){
    var sa=hasVal(a.sort_order)?toNum(a.sort_order):999999;
    var sb=hasVal(b.sort_order)?toNum(b.sort_order):999999;
    return sa-sb || String(a.package_id||"").localeCompare(String(b.package_id||""));
  }).map(function(p){
    var pkgType      = String(p.pkg_type||"phone_only").trim();
    var modelDisplay = String(p.model_display||p.phone_model_display||"มือถือ").trim();
    var lensDisplay  = String(p.lens_display||p.lens_model_display||p.lens_group||"").trim();
    var rawNote      = String(p.web_note||p.package_note||"").trim();
    var rawUseCase   = String(p.use_case||"").trim();
    var inquiryOnly  = /\[INQUIRY_ONLY\]/i.test(rawNote) || /(^|\b)INQUIRY_ONLY(\b|$)/i.test(rawUseCase);
    var note         = sanitizePublicText(rawNote);
    var useCase      = sanitizePublicText(rawUseCase);

    var override = toNum(p.price_override);
    var directPrice = toNum(p.price);
    var price;
    if(inquiryOnly){ price=0; }
    else if(directPrice>0){ price=directPrice; }
    else if(override>0){ price=override; }
    else if(pkgType==="phone_only"){ price=toNum(p.phone_price); }
    else if(pkgType==="lens_only"){  price=toNum(p.lens_price); }
    else{ price=toNum(p.bundle_price||p.phone_price); }

    var spec  = pkgType==="phone_only" ? "เฉพาะมือถือ" : pkgType==="lens_only" ? (lensDisplay||"เลนส์เสริม") : "มือถือ + เลนส์";
    var label = pkgType==="lens_only"  ? (lensDisplay||"Lens") : pkgType==="phone_lens_bundle" ? modelDisplay+" + Lens" : modelDisplay;

    // FIX: ใช้ available_count จาก 09_Web_Packages แทน isOpen&&price>0
    // available_count จาก 09_Web_Packages เป็น source of truth ต่อ package
    var sheetAvailRaw = p.available_count;
    var sheetHasAvail = hasVal(sheetAvailRaw);
    var sheetAvail = toNum(sheetAvailRaw);
    var rawAvailRaw = p.raw_available_count;
    var rawHasAvail = hasVal(rawAvailRaw);
    var rawAvail = toNum(rawAvailRaw);
    var pkgStatus = String(p.package_status||"").trim().toLowerCase();
    var avail;
    if(pkgStatus==="hidden"||pkgStatus==="hide"){
      avail = false;
    } else if(pkgStatus==="available"){
      avail = sheetHasAvail ? sheetAvail > 0 : true;
    } else if(pkgStatus==="full"){
      avail = false;
    } else if(sheetHasAvail){
      // 09_Web_Packages!available_count เป็น source of truth ต่อ package
      avail = sheetAvail > 0;
    } else if(pkgType==="lens_only"){
      // backward compatibility ถ้าใช้ backend เก่า
      avail = lensCnt > 0;
    } else if(pkgType==="phone_lens_bundle"){
      // bundle ต้องมีทั้งเครื่องและเลนส์
      avail = phoneCnt > 0 && lensCnt > 0;
    } else {
      avail = phoneCnt > 0;
    }
    // ปกติ price=0 จะปิดแพ็กเกจ แต่ verified event ที่รอ commercial price ใช้ [INQUIRY_ONLY]
    // เพื่อให้ลูกค้าเห็นงานและทัก LINE ได้โดยไม่ต้องเดาราคา และยังเคารพ stock จริง
    if(price<=0 && !inquiryOnly) avail = false;
    if(rawHasAvail && rawAvail < 0) avail = false;

    return { id:p.package_id||"", model:label, spec:spec, price:price, note:note, useCase:useCase, inquiryOnly:inquiryOnly, avail:avail, count:sheetAvail, rawCount:rawAvail, type:pkgType, lensDisp:lensDisplay, sort:toNum(p.sort_order) };
  });
}

// Fallback from 08_Web_Ready single row (backward compat)
function buildPackagesFromWebRow(r){
  var pkgs=[];
  var model=String(r.phone_model_display||r.allowed_phone_model_group||"มือถือ").trim();
  var lens=String(r.allowed_lens_group||"").trim();
  var note=sanitizePublicText(r.web_note||"");
  var pPrice=toNum(r.phone_price), lPrice=toNum(r.lens_price), bPrice=toNum(r.bundle_price);
  var phoneAvail = r.phone_only_available!==undefined ? toBool(r.phone_only_available) : toNum(r.available_phone_count)>0;
  var lensAvail  = r.lens_only_available!==undefined  ? toBool(r.lens_only_available)  : toNum(r.available_lens_count)>0;
  var bundleAvail= r.phone_lens_available!==undefined ? toBool(r.phone_lens_available) : (phoneAvail&&lensAvail&&bPrice>0);
  var fallbackUseCase=sanitizePublicText(r.use_case||"");
  if(pPrice>0)pkgs.push({model:model, spec:"เฉพาะมือถือ",  price:pPrice, note:note, useCase:fallbackUseCase, avail:phoneAvail, type:"phone_only"});
  if(lPrice>0)pkgs.push({model:"Lens",spec:lens&&lens!=="NONE"?lens:"เลนส์เสริม",price:lPrice,note:note,useCase:fallbackUseCase,avail:lensAvail,type:"lens_only"});
  if(bPrice>0)pkgs.push({model:model+" + Lens",spec:"มือถือ + เลนส์",price:bPrice,note:note,useCase:fallbackUseCase,avail:bundleAvail,type:"phone_lens_bundle"});
  if(!pkgs.length)pkgs.push({model:model,spec:"สอบถามแพ็กเกจผ่าน LINE OA",price:0,note:note,useCase:fallbackUseCase,avail:true,type:"ask"});
  return pkgs;
}

async function loadData(){
  var results=await Promise.all([
    fetchWebRows(),
    fetchPkgRows().catch(function(){return [];})
  ]);
  var webRows=results[0]||[], pkgRows=results[1]||[];

  var pkgMap={}, pkgPresence={};
  pkgRows.forEach(function(p){
    var id=String(p.event_id||"").trim(); if(!id)return;
    pkgPresence[id]=true;
    if(!pkgMap[id])pkgMap[id]=[];
    if(isPkgVisible(p))pkgMap[id].push(p);
  });

  var rows=dedupeWebRowsByEventId(webRows).filter(function(r){ var a=String(r.action_for_web||"").trim().toLowerCase(); return a&&a!=="hide"; });

  return rows.map(function(r){
    var eventId    = String(r.event_id||"").trim();
    var rawDate    = r.event_date_text || r.event_date || r.date || "";
    var rawPoster  = String(r.poster_image_url||"").trim() || storefrontPosterOverride(r);
    var emergencyPoster = storefrontPosterOverride(r);
    var posterThumbCandidates = getImgCandidates(rawPoster,"thumb");
    var posterFullCandidates = getImgCandidates(rawPoster,"full");
    if(emergencyPoster && emergencyPoster!==rawPoster){
      getImgCandidates(emergencyPoster,"thumb").forEach(function(url){
        if(posterThumbCandidates.indexOf(url)<0) posterThumbCandidates.push(url);
      });
      getImgCandidates(emergencyPoster,"full").forEach(function(url){
        if(posterFullCandidates.indexOf(url)<0) posterFullCandidates.push(url);
      });
    }
    var phoneCnt   = toNum(r.available_phone_count);
    var lensCnt    = toNum(r.available_lens_count);

    var hasPkgSheet = !!pkgPresence[eventId];
    var visiblePkgRows = pkgMap[eventId] || [];
    // Package visibility and event visibility are separate concerns.
    // If every package is hidden, keep the event card online with zero bookable
    // packages so the normal full/waitlist flow can still capture demand.
    var packages = hasPkgSheet
      ? buildPackagesFromSheet(visiblePkgRows, eventId, phoneCnt, lensCnt)
      : buildPackagesFromWebRow(r);

    // Shared-inventory guard: all phone packages consume the same phone pool and all
    // lens packages consume the same lens pool. Clamp every package to the event-level
    // stock from 08_Web_Ready so one package row cannot make a booked phone reappear.
    packages = packages.map(function(p){
      if(p.type==="phone_only"){
        p.avail = p.avail && phoneCnt>0;
        p.count = phoneCnt;
      } else if(p.type==="lens_only"){
        p.avail = p.avail && lensCnt>0;
        p.count = lensCnt;
      } else if(p.type==="phone_lens_bundle"){
        p.avail = p.avail && phoneCnt>0 && lensCnt>0;
        p.count = Math.min(phoneCnt,lensCnt);
      }
      return p;
    });

    return {
      id:           eventId,
      name:         String(r.event_name||"").trim(),
      date:         fmtDate(rawDate),
      rawDate:      rawDate,
      venue:        String(r.venue||"").trim(),
      rawPoster:    rawPoster,
      // FIX: thumbnail ใช้ w600 (เร็วกว่า w1200 4x)
      img:          posterThumbCandidates[0]||"",
      imgThumb:     posterThumbCandidates,
      imgFull:      posterFullCandidates, // canonical first; verified emergency poster is delivery fallback only
      webNote:      String(r.event_note||r.web_note||"").trim(),
      phoneCnt:     phoneCnt,
      lensCnt:      lensCnt,
      bookingStatus:String(r.booking_status_for_web||"").trim(),
      action:       String(r.action_for_web||"show").trim().toLowerCase(),
      lineTemplate: String(r.line_message_template||"").trim(),
      packages:     packages,
      hasPkgSheet:  hasPkgSheet
    };
  });
}

// ─── Concert logic ────────────────────────────────────────────────────────
function concertTs(c){ var key=eventDateKey(c&&c.rawDate); return key?bangkokMidnightTs(key):Number.MAX_SAFE_INTEGER; }
function isFuture(c){ return SHOW_PAST||concertTs(c)>=TODAY_TS; }
function isToday(c){ return concertTs(c)===TODAY_TS; }
function isSoon(c){ var ms=concertTs(c)-TODAY_TS; return ms>=0&&ms<=14*86400000; }
function monthKey(c){ var key=eventDateKey(c&&c.rawDate); return key?key.slice(0,7):""; }
function monthLabel(key){
  var m=String(key||"").match(/^(\d{4})-(\d{2})$/); if(!m)return tr("every_month");
  var year=parseInt(m[1],10), mo=parseInt(m[2],10)-1;
  var months=currentLang==="en"?EN_MONTHS_SHORT:TH_MONTHS_SHORT;
  return (months[mo]||m[2])+" "+year;
}
function getMonthOptions(concerts){
  var seen={}, out=[];
  (concerts||[]).filter(isFuture).forEach(function(c){
    var k=monthKey(c); if(k&&!seen[k]){seen[k]=true; out.push(k);}
  });
  out.sort(); return out;
}
function availPkgs(c){ return (c.packages||[]).filter(function(p){return p.avail;}); }
function availCnt(c){
  // Event-level stock is the canonical shared pool. Never use MAX(package counts):
  // phone_only and phone_lens_bundle draw from the same phones, so taking MAX can
  // make a booked phone appear available again.
  var ap=availPkgs(c);
  var hasPhone=ap.some(function(p){return p.type==="phone_only"||p.type==="phone_lens_bundle";});
  var hasLensOnly=ap.some(function(p){return p.type==="lens_only";});
  if(hasPhone) return Math.max(0,toNum(c&&c.phoneCnt));
  if(hasLensOnly) return Math.max(0,toNum(c&&c.lensCnt));
  return 0;
}
function availTextFor(c){
  var ap=availPkgs(c), cnt=availCnt(c);
  if(cnt<=0) return tr("full_availability");
  if(ap.some(function(p){return p.inquiryOnly;})) return tr("inquiry_available");
  var hasPhone=ap.some(function(p){return p.type==="phone_only"||p.type==="phone_lens_bundle";});
  var hasLensOnly=ap.some(function(p){return p.type==="lens_only";});
  if(hasPhone) return cnt===1 ? tr("one_phone_left") : tr("phones_available",{count:cnt});
  if(hasLensOnly) return tr("lens_only_available");
  return tr("available");
}
function startingPriceFor(c){
  var min=0;
  (c&&c.packages||[]).forEach(function(p){
    var n=toNum(p&&p.price);
    if(n>0&&(min===0||n<min))min=n;
  });
  return min;
}
function cardPriceText(c){
  if(availCnt(c)<=0) return tr("card_waitlist");
  var p=startingPriceFor(c);
  return p>0 ? tr("card_price_from",{price:p.toLocaleString(numberLocale())}) : tr("card_price_ask");
}
function hasBrowseFilters(){
  return currentSearch!=="" || currentMonth!=="all" || currentFilter!=="all";
}
function updateBrowseChrome(count){
  var countEl=document.getElementById("event-search-count");
  if(countEl)countEl.textContent=currentSearch?tr("search_results",{count:count}):tr("browse_results",{count:count});
  var clearEl=document.getElementById("clear-browse-btn");
  if(clearEl)clearEl.hidden=!hasBrowseFilters();
}

function normalizeSearchText(value){
  return String(value||"").normalize("NFKC").toLocaleLowerCase(currentLang==="en"?"en":"th").replace(/\s+/g," ").trim();
}
function filtered(concerts){
  var vis=concerts.filter(isFuture).sort(function(a,b){return concertTs(a)-concertTs(b)||a.name.localeCompare(b.name,currentLang==="en"?"en":"th");});
  if(currentMonth!=="all") vis=vis.filter(function(c){return monthKey(c)===currentMonth;});
  if(currentSearch){
    var q=normalizeSearchText(currentSearch);
    vis=vis.filter(function(c){
      return normalizeSearchText([c.name,c.venue,c.date,c.webNote].join(" ")).includes(q);
    });
  }
  if(currentFilter==="available")return vis.filter(function(c){return availCnt(c)>0;});
  if(currentFilter==="full")     return vis.filter(function(c){return availCnt(c)===0;});
  return vis;
}
function emptyMsg(){
  if(currentSearch)return tr("search_empty",{query:currentSearch});
  var m = currentMonth!=="all" ? tr("in_month",{month:monthLabel(currentMonth)}) : "";
  if(currentFilter==="available")return tr("empty_available",{month:m});
  if(currentFilter==="full")     return tr("empty_waitlist",{month:m});
  return tr("empty_all",{month:m});
}

// ─── DOM ──────────────────────────────────────────────────────────────────
function applyConfig(){
  DEFAULT_OG_IMAGE = APP.headerImage || DEFAULT_OG_IMAGE;
  if(APP.siteUrl){
    var canonical=document.querySelector('link[rel="canonical"]'); if(canonical)canonical.href=APP.siteUrl;
  }
  if(APP.headerImage){var h=document.querySelector(".brand-header-img");if(h)h.src=APP.headerImage;}
  resetMeta();
  if(APP.xUrl){document.querySelectorAll("a.quick-link").forEach(function(a){a.href=APP.xUrl;});}
  document.querySelectorAll("a.line-btn,a.sticky-line").forEach(function(a){a.href=LINE_URL;});
}
function setUpdateDate(){
  var p=bangkokParts(new Date()); var el=document.getElementById("update-note");
  if(el)el.textContent=tr("updated_prefix")+": "+p.day+"/"+p.month+"/"+p.year+" "+p.hour+":"+p.minute+" (Bangkok)";
}
function showBrandFallback(){var a=document.getElementById("brandImageCard"),b=document.getElementById("brandFallback");if(a)a.style.display="none";if(b)b.style.display="flex";}

function renderLoadingSkeleton(count){
  var el=document.getElementById("content"); if(!el)return;
  count=count||4;
  var html='<div class="poster-grid skeleton-grid" aria-label="'+esc(tr("loading_aria"))+'">';
  for(var i=0;i<count;i++){
    html+='<div class="concert-card skeleton-card" aria-hidden="true"><div class="poster-img-wrap skeleton-poster"><span></span></div><div class="poster-info skeleton-info"><div class="sk sk-date"></div><div class="sk sk-title"></div><div class="sk sk-title short"></div><div class="sk sk-btn"></div></div></div>';
  }
  html+='</div><div class="loading-text skeleton-loading-text">'+esc(tr("loading_text"))+'</div>';
  el.innerHTML=html;
}
function buildSearchInquiryMsg(query){
  var q=String(query||"").trim();
  if(currentLang==="en") return "Hi, I searched for "+q+" on the KK Phone Rental website but could not find the event. Do you accept rentals for this event?";
  return "สวัสดีค่ะ ค้นหางาน "+q+" ในเว็บไซต์ KK Phone Rental แต่ยังไม่พบ ขอสอบถามว่าร้านรับงานนี้ไหมคะ";
}
function getSearchInquiryUrl(query){ return LINE_OA+encodeURIComponent(buildSearchInquiryMsg(query)); }
function buildEventInquiryMsg(c){
  if(currentLang==="en") return "Hi, I am viewing "+lineVal(c&&c.name)+" on KK Phone Rental. Could you help me check the booking details?";
  return "สวัสดีค่ะ กำลังดูงาน "+lineVal(c&&c.name)+" บนเว็บไซต์ KK Phone Rental ขอสอบถามรายละเอียดการจองค่ะ";
}
function getEventInquiryUrl(c){ return LINE_OA+encodeURIComponent(buildEventInquiryMsg(c)); }
function renderEmpty(msg,detail){
  var el=document.getElementById("content"); if(!el)return;
  var contextual=!!currentSearch;
  var href=contextual?getSearchInquiryUrl(currentSearch):LINE_URL;
  var label=contextual?tr("search_line",{query:currentSearch}):tr("contact_line");
  if(contextual) queueSearchMissTrack(currentSearch);
  el.innerHTML='<div class="empty-state"><h3>'+esc(msg)+'</h3><p>'+esc(detail||tr("empty_detail"))+'</p><a class="empty-line-btn" href="'+href+'" target="_blank" rel="noopener">'+esc(label)+'</a></div>';
  if(contextual){
    var inquiry=el.querySelector(".empty-line-btn");
    if(inquiry) inquiry.onclick=function(){
      track("search_inquiry_click",{query:normalizeAnalyticsQuery(currentSearch),source:"empty_state"});
    };
  }
}
function getBadgeText(c){ var cnt=availCnt(c), ap=availPkgs(c); if(cnt<=0)return tr("badge_full"); if(isToday(c))return tr("badge_today"); if(isSoon(c))return tr("badge_soon"); if(ap.some(function(p){return p.inquiryOnly;}))return tr("badge_inquiry"); return ap.some(function(p){return p.type==="phone_only"||p.type==="phone_lens_bundle";}) ? tr("badge_available",{count:cnt}) : tr("badge_lens"); }

function renderMonthSelect(concerts){
  var sel=document.getElementById("month-filter-select"); if(!sel)return;
  var opts=getMonthOptions(concerts);
  if(currentMonth!=="all" && opts.indexOf(currentMonth)<0) currentMonth="all";
  sel.innerHTML="";
  function addOpt(key,label){
    var opt=document.createElement("option");
    opt.value=key;
    opt.textContent=label;
    sel.appendChild(opt);
  }
  addOpt("all",tr("select_month"));
  opts.forEach(function(key){addOpt(key,monthLabel(key));});
  sel.value=currentMonth;
}

function renderConcerts(concerts){
  renderMonthSelect(concerts);
  var el=document.getElementById("content"); if(!el)return;
  el.innerHTML="";
  if(!concerts||!concerts.length){updateBrowseChrome(0);renderEmpty(tr("no_event_data"));return;}
  var vis=filtered(concerts);
  // Owner rule: an event without a usable poster must not render on the storefront.
  // Blank URLs fail closed here; dead URLs fail closed after the bounded fallback chain below.
  vis=vis.filter(function(c){ return !!(c&&c.img&&String(c.img).trim()); });
  updateBrowseChrome(vis.length);
  if(!vis.length){renderEmpty(emptyMsg());return;}

  var grid=document.createElement("div"); grid.className="poster-grid";
  var totalMatches=vis.length;
  var page=vis.slice(0,browseLimit);

  // LCP improvement: preload the same CDN candidate that the first card will use.
  var firstPoster=page[0]&&page[0].imgThumb&&page[0].imgThumb[0] ? page[0].imgThumb[0] : (page[0]&&page[0].img ? page[0].img : "");
  if(firstPoster&&!PRELOADED_IMAGES[firstPoster]){
    PRELOADED_IMAGES[firstPoster]=true;
    var lnk=document.createElement("link"); lnk.rel="preload"; lnk.as="image"; lnk.href=firstPoster;
    document.head.appendChild(lnk);
  }

  page.forEach(function(c,idx){
    var cnt=availCnt(c), avail=cnt>0;
    var availText=availTextFor(c);
    var pkgHint="";

    var lowStock=avail&&cnt===1;
    var card=document.createElement("button"); card.type="button"; card.className="concert-card"+(avail?"":" waitlist-card")+(lowStock?" low-stock-card":"");
    card.dataset.eventId=String(c.id||"");
    card.dataset.eventName=String(c.name||"");
    card.dataset.posterSource=String(c.rawPoster||c.img||"");
    card.setAttribute("aria-label", avail ? tr("card_aria_available",{event:c.name}) : tr("card_aria_waitlist",{event:c.name}));
    card.onclick=function(){
      if(!avail) track("waitlist_card_open",{event_name:c.name, available:0, source:"card"});
      showModal(c);
    };

    var imgWrap=document.createElement("div"); imgWrap.className="poster-img-wrap";
    var badge=document.createElement("div"); badge.className="status-badge"+(avail?"":" full")+(isSoon(c)&&avail?" soon":""); badge.textContent=getBadgeText(c); imgWrap.appendChild(badge);

    var imgUrl=c.img?String(c.img).trim():"";
    if(imgUrl){
      var img=document.createElement("img"); img.alt=c.name||"Event poster";
      // Keep the first viewport worth of posters eager. Remaining cards stay lazy.
      // Timeout failover handles Safari/iOS requests that remain pending without onerror.
      img.loading=idx<6?"eager":"lazy"; img.decoding="async";
      if("fetchPriority" in img) img.fetchPriority=idx<2?"high":"auto";
      imgWrap.appendChild(img);
      var imgCandidates=c.imgThumb&&c.imgThumb.length?c.imgThumb:[imgUrl];
      var posterFailure=function(){
        card.dataset.posterFailed="1";
        card.dataset.posterFallback="event-summary";
        // Poster delivery must never make a valid bookable event disappear.
        // Render a deterministic exact-event fallback from already-visible business data;
        // never substitute an unrelated series/artist image just to make the poster gate green.
        if(img&&img.parentElement){
          var ph=document.createElement("div");
          ph.className="poster-placeholder poster-placeholder-event";
          ph.setAttribute("role","img");
          ph.setAttribute("aria-label",tr("no_image")+" · "+String(c.name||""));
          var kicker=document.createElement("span");
          kicker.className="poster-placeholder-kicker";
          kicker.textContent="KK EVENT";
          var title=document.createElement("strong");
          title.className="poster-placeholder-title";
          title.textContent=String(c.name||tr("no_image"));
          var meta=document.createElement("span");
          meta.className="poster-placeholder-meta";
          meta.textContent=[String(c.date||"").trim(),String(c.venue||"").trim()].filter(Boolean).join(" · ");
          ph.appendChild(kicker);
          ph.appendChild(title);
          if(meta.textContent) ph.appendChild(meta);
          img.parentElement.replaceChild(ph,img);
        }
        updateBrowseChrome(grid.children.length);
      };
      if(idx<6){
        setImgFallback(img,imgCandidates,{timeoutMs:4000,onExhausted:posterFailure});
      }else{
        // Do not start a timeout while a native-lazy image is still off-screen.
        // Start the fallback chain when the card is near the viewport.
        setImgFallbackWhenVisible(img,imgCandidates,{timeoutMs:6000,rootMargin:"600px 0px",onExhausted:posterFailure});
      }
    } else {
      var ph=document.createElement("div"); ph.className="poster-placeholder"; ph.innerHTML="<span>"+esc(tr("no_image"))+"</span>"; imgWrap.appendChild(ph);
    }

    var info=document.createElement("div"); info.className="poster-info";
    var dateEl=document.createElement("div"); dateEl.className="pi-date"; dateEl.textContent=c.date||"";
    var nameEl=document.createElement("div"); nameEl.className="pi-name"; nameEl.textContent=c.name||"";
    var metaEl=document.createElement("div"); metaEl.className="pi-meta";
    var venueEl=document.createElement("div"); venueEl.className="pi-venue"; venueEl.textContent=tr("card_venue",{venue:c.venue||tr("unspecified")});
    var priceEl=document.createElement("div"); priceEl.className="pi-price"; priceEl.textContent=cardPriceText(c);
    metaEl.appendChild(venueEl); metaEl.appendChild(priceEl);
    var availEl=document.createElement("div"); availEl.className="pi-avail"+(avail?(lowStock?" low":""):" none"); availEl.textContent=availText+pkgHint;
    var tap=document.createElement("div"); tap.className="pi-tap"+(avail?"":" full"); tap.textContent=avail?tr("tap_available"):tr("tap_waitlist");
    info.appendChild(dateEl); info.appendChild(nameEl); info.appendChild(metaEl); info.appendChild(availEl); info.appendChild(tap);
    card.appendChild(imgWrap); card.appendChild(info); grid.appendChild(card);
  });
  el.appendChild(grid);
  if(page.length<totalMatches){
    var moreWrap=document.createElement("div"); moreWrap.className="browse-more";
    var more=document.createElement("button"); more.type="button"; more.className="browse-more-btn"; more.id="browse-more-btn";
    more.textContent=tr("load_more",{count:totalMatches-page.length});
    more.onclick=function(){ browseLimit+=BROWSE_PAGE_SIZE; renderConcerts(concerts); };
    moreWrap.appendChild(more); el.appendChild(moreWrap);
  }
}

// ─── Modal ────────────────────────────────────────────────────────────────
function packageSpecForLanguage(p){
  if(!p)return "";
  if(p.type==="phone_only")return tr("pkg_phone_only");
  if(p.type==="lens_only")return p.lensDisp||tr("pkg_lens_only");
  if(p.type==="phone_lens_bundle")return tr("pkg_bundle");
  if(p.type==="ask")return tr("pkg_ask");
  return p.spec||"";
}
function buildBookingMsg(c,p){
  // Keep LINE OA message short and package-specific.
  // The pick-up field intentionally says "equipment" so lens-only rentals are covered.
  return [
    "สนใจเช่ามือถือ",
    "🎫 "+tr("line_event")+": "+lineVal(c&&c.name),
    "📅 "+tr("line_date")+": "+lineVal(c&&c.date),
    "📍 "+tr("line_venue")+": "+lineVal(c&&c.venue),
    "📱 รุ่น: "+lineVal(p&&p.model),
    "💰 "+tr("line_price")+": "+((p&&p.inquiryOnly)?tr("ask_price"):fmtPriceLine(p&&p.price)),
    "⏰ "+tr("line_pickup")+": ",
    "",
    "👤 "+tr("line_nickname")+": ",
    "📞 "+tr("line_phone")+": "
  ].join("\n");
}
function getBookingUrl(c,p){ return LINE_OA+encodeURIComponent(buildBookingMsg(c,p)); }
function buildWaitlistMsg(c,p){
  return [
    tr("waitlist_title"),
    tr("line_event")+" : "+lineVal(c&&c.name),
    tr("line_date")+" : "+lineVal(c&&c.date),
    tr("line_venue")+" : "+lineVal(c&&c.venue),
    tr("line_package")+" : "+lineVal(p&&p.model),
    "",
    tr("line_nickname")+" : ",
    tr("line_phone")+" : ",
    tr("waitlist_note")
  ].join("\n");
}
function getWaitlistUrl(c,p){ return LINE_OA+encodeURIComponent(buildWaitlistMsg(c,p)); }
function showModal(c,options){
  if(!c)return;
  options=options||{};
  activeModalEvent=c;
  document.querySelectorAll("a.sticky-line").forEach(function(a){
    var waitlisted=availCnt(c)<=0;
    a.href=waitlisted?getWaitlistUrl(c,null):getEventInquiryUrl(c);
    a.onclick=function(){
      track(waitlisted?"waitlist_click":"event_inquiry_click",{
        event_id:c.id||"",
        event_name:c.name||"",
        available:availCnt(c),
        source:"sticky_line"
      });
    };
  });
  // NEW: GA4 track modal open
  if(!options.skipTrack)track("view_event_packages",{event_name:c.name, available:availCnt(c)});
  updateMetaForEvent(c);
  setEventUrl(c.id);

  document.getElementById("modal-title").textContent=c.name||tr("event_details");
  document.getElementById("modal-date").textContent=(currentLang==="en"?"Date: ":"วันที่: ")+(c.date||"-");
  var venueEl=document.getElementById("modal-venue");
  venueEl.textContent=(currentLang==="en"?"Venue: ":"สถานที่: ")+(c.venue||"-");
  var eventNoteEl=document.getElementById("modal-event-note");
  if(!eventNoteEl){
    eventNoteEl=document.createElement("div");
    eventNoteEl.id="modal-event-note";
    eventNoteEl.className="modal-meta";
    venueEl.insertAdjacentElement("afterend",eventNoteEl);
  }
  var publicEventNote=sanitizePublicText(c.webNote);
  eventNoteEl.textContent=publicEventNote?"ℹ️ "+publicEventNote:"";
  eventNoteEl.hidden=!publicEventNote;

  // UX fix: ไม่แสดงรูปโปสเตอร์ซ้ำใน modal
  // รูปยังแสดงเฉพาะบนการ์ด เพื่อให้ modal กระชับและพอดีกับจอมากขึ้น

  var list=document.getElementById("phone-list"); list.innerHTML="";
  var avail=availPkgs(c);

  if(!avail.length){
    var fullBox=document.createElement("div");
    fullBox.className="full-booked-box waitlist-box";
    fullBox.innerHTML=esc(tr("full_title"))+'<br><span>'+esc(tr("full_body"))+'</span>';
    var waitBtn=document.createElement("a");
    waitBtn.className="waitlist-line-btn";
    waitBtn.href=getWaitlistUrl(c,null);
    waitBtn.target="_blank";
    waitBtn.rel="noopener";
    waitBtn.textContent=tr("waitlist_line");
    waitBtn.setAttribute("aria-label",tr("waitlist_aria",{event:c.name||""}));
    waitBtn.onclick=function(e){
      e.stopPropagation();
      track("waitlist_click",{event_id:c.id||"", event_name:c.name, available:0, source:"modal"});
    };
    fullBox.appendChild(waitBtn);
    list.appendChild(fullBox);
    openModal(); return;
  }

  avail.forEach(function(p){
    var row=document.createElement("div"); row.className="phone-row";
    var icon=document.createElement("div"); icon.className="ph-icon";
    icon.innerHTML='<svg viewBox="0 0 28 28" fill="none"><rect x="6" y="3" width="16" height="22" rx="3" stroke="#5B8DEF" stroke-width="1.8"/><rect x="10" y="6" width="8" height="1.5" rx="0.75" fill="#5B8DEF"/><circle cx="14" cy="22" r="1.2" fill="#5B8DEF"/></svg>';
    var info=document.createElement("div"); info.className="ph-info";
    var mEl=document.createElement("div"); mEl.className="ph-model"; mEl.textContent=p.model||"";
    var sEl=document.createElement("div"); sEl.className="ph-spec";  sEl.textContent=packageSpecForLanguage(p);
    info.appendChild(mEl); info.appendChild(sEl);
    var publicSubtitle=packagePublicSubtitle(p);
    if(publicSubtitle){var nEl=document.createElement("div"); nEl.className="ph-note"; nEl.textContent=publicSubtitle; info.appendChild(nEl);}
    var right=document.createElement("div"); right.className="ph-right";
    var priceEl=document.createElement("div"); priceEl.className="ph-price";
    if(toNum(p.price)>0){
      priceEl.textContent=toNum(p.price).toLocaleString(numberLocale());
      var sm=document.createElement("span"); sm.textContent=tr("per_day"); priceEl.appendChild(sm);
    } else {
      priceEl.textContent=tr("ask_price");
    }
    var bookBtn=document.createElement("a"); bookBtn.className="badge book-pill"; bookBtn.textContent=p.inquiryOnly?tr("ask_this"):tr("book_this");
    bookBtn.href=getBookingUrl(c,p); bookBtn.target="_blank"; bookBtn.rel="noopener";
    bookBtn.setAttribute("aria-label",tr("book_aria",{package:p.model||"",event:c.name||""}));
    // NEW: GA4 track booking click
    bookBtn.onclick=function(e){
      e.stopPropagation();
      track("booking_click",{event_id:c.id||"", event_name:c.name, package_type:p.type||"", package:p.model, price:p.price, source:"modal"});
    };
    right.appendChild(priceEl); right.appendChild(bookBtn);
    row.appendChild(icon); row.appendChild(info); row.appendChild(right); list.appendChild(row);
  });
  openModal();
}

var PACKAGE_CLOSE_SELECTOR = "#modal-close,#modal-x-btn,[data-modal-close=\"package\"]";
var FAQ_CLOSE_SELECTOR = "#faq-close-btn,#faq-x-btn,[data-modal-close=\"faq\"]";
var packageFocusReturn=null;
var faqFocusReturn=null;
function focusableIn(el){
  if(!el)return [];
  return Array.prototype.slice.call(el.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'))
    .filter(function(x){return !x.hidden && x.offsetParent!==null;});
}
function focusDialog(el,preferred){
  var target=preferred&&el?el.querySelector(preferred):null;
  var list=focusableIn(el);
  (target||list[0]||el).focus&& (target||list[0]||el).focus();
}
function restoreFocus(target){
  if(target&&document.contains(target)&&typeof target.focus==="function"){
    try{target.focus({preventScroll:true});}catch(e){/* Safari fallback: skip focus rather than move viewport */}
  }
}
var modalScrollY=0;
var modalScrollX=0;
function exactScrollRestore(){
  // The page is never moved to a fixed-body coordinate system, so close has no
  // intermediate top-of-page frame to correct. This is only a drift guard.
  var x=modalScrollX,y=modalScrollY;
  if(Math.abs((window.scrollY||window.pageYOffset||0)-y)>1)window.scrollTo(x,y);
}
function lockBody(){
  if(document.body.dataset.modalLocked==="1")return;
  modalScrollX=window.scrollX||window.pageXOffset||0;
  modalScrollY=window.scrollY||window.pageYOffset||0;
  document.body.dataset.modalLocked="1";
  // Modern iOS Safari supports overflow locking. Keep the document in its
  // existing coordinate space instead of position:fixed + negative top,
  // which exposed scrollY=0 for a paint frame during modal close.
  document.documentElement.style.overflow="hidden";
  document.body.style.overflow="hidden";
  document.body.style.touchAction="none";
}
function unlockBodyIfNoModal(){
  var ov=document.getElementById("overlay"), fo=document.getElementById("faqOverlay");
  if((ov&&ov.classList.contains("active"))||(fo&&fo.classList.contains("active")))return;
  if(document.body.dataset.modalLocked!=="1"){
    document.documentElement.style.overflow="";
    document.body.style.overflow="";
    document.body.style.touchAction="";
    return;
  }
  delete document.body.dataset.modalLocked;
  document.documentElement.style.overflow="";
  document.body.style.overflow="";
  document.body.style.touchAction="";
  exactScrollRestore();
}
function homeUrl(){return window.location.origin + "/";}
function setEventUrl(eventId){
  try{
    if(!eventId)return;
    var u=new URL(window.location.href);
    u.searchParams.delete("e");
    u.searchParams.set("event",String(eventId));
    if(currentLang==="en")u.searchParams.set("lang","en");else u.searchParams.delete("lang");
    window.history.replaceState(null,"",u.toString());
  }catch(e){}
}
function clearEventParam(){
  try{
    var u=new URL(window.location.href);
    u.searchParams.delete("event");
    u.searchParams.delete("e");
    if(currentLang==="en")u.searchParams.set("lang","en");else u.searchParams.delete("lang");
    window.history.replaceState(null,"",u.toString());
  }catch(e){}
}
function openModal(){
  var el=document.getElementById("overlay");
  if(el){packageFocusReturn=document.activeElement;el.classList.add("active");lockBody();setTimeout(function(){focusDialog(el,"#modal-x-btn");},0);}
}
function closeModal(e){
  var el=document.getElementById("overlay");if(e&&el&&e.target!==el&&!e.target.closest(PACKAGE_CLOSE_SELECTOR))return;
  if(el)el.classList.remove("active");activeModalEvent=null;clearEventParam();resetMeta();unlockBodyIfNoModal();
  document.querySelectorAll("a.sticky-line").forEach(function(a){a.href=LINE_URL;a.onclick=null;});
  restoreFocus(packageFocusReturn);packageFocusReturn=null;
}
function showError(m){
  var el=document.getElementById("content"); if(!el)return;
  el.innerHTML='<div class="empty-state error-state" role="alert" aria-live="assertive"><h3>'+esc(tr("error_title"))+'</h3><p>'+esc(m||tr("error_detail"))+'</p><div class="error-actions"><button class="empty-retry-btn" id="storefront-retry-btn" type="button">'+esc(tr("error_retry"))+'</button><a class="empty-line-btn" href="'+LINE_URL+'" target="_blank" rel="noopener">'+esc(tr("error_line"))+'</a></div></div>';
}
async function refreshStorefrontData(reason){
  if(storefrontRefreshPromise) return storefrontRefreshPromise;
  storefrontRefreshPromise=loadData().then(function(data){
    concertsData=data;
    lastDataLoadAt=Date.now();
    renderConcerts(concertsData);
    if(reason==="retry"){
      var note=document.getElementById("update-note");
      if(note) note.textContent=tr("refreshed")+" · "+note.textContent;
    }
    return data;
  }).finally(function(){storefrontRefreshPromise=null;});
  return storefrontRefreshPromise;
}

function openFaq(){
  var el=document.getElementById("faqOverlay");
  if(el){faqFocusReturn=document.activeElement;el.classList.add("active");lockBody();setTimeout(function(){focusDialog(el,"#faq-x-btn");},0);}
}
function closeFaq(e){
  var el=document.getElementById("faqOverlay");if(e&&el&&e.target!==el&&!e.target.closest(FAQ_CLOSE_SELECTOR))return;
  if(el)el.classList.remove("active");unlockBodyIfNoModal();restoreFocus(faqFocusReturn);faqFocusReturn=null;
}
function toggleFaq(btn){var item=btn&&btn.parentElement;if(item){item.classList.toggle("active");btn.setAttribute("aria-expanded",item.classList.contains("active")?"true":"false");}}

function syncBrowseUrl(){
  try{
    var u=new URL(window.location.href);
    if(currentFilter==="all")u.searchParams.delete("filter");else u.searchParams.set("filter",currentFilter);
    if(currentMonth==="all")u.searchParams.delete("month");else u.searchParams.set("month",currentMonth);
    if(currentSearch)u.searchParams.set("q",currentSearch);else u.searchParams.delete("q");
    window.history.replaceState(null,"",u.toString());
  }catch(e){}
}
function setFilter(f,options){
  options=options||{};
  currentFilter=["all","available","full"].indexOf(f)>=0?f:"all";
  if(!options.preserveLimit) browseLimit=BROWSE_PAGE_SIZE;
  document.querySelectorAll("[data-filter]").forEach(function(b){var a=b.getAttribute("data-filter")===currentFilter;b.classList.toggle("active",a);b.setAttribute("aria-pressed",a?"true":"false");});
  if(options.updateUrl)syncBrowseUrl();
  if(concertsData&&concertsData.length) renderConcerts(concertsData);
}
function setMonth(month,options){
  options=options||{};
  currentMonth=/^\d{4}-\d{2}$/.test(month)?month:"all";
  if(!options.preserveLimit) browseLimit=BROWSE_PAGE_SIZE;
  var sel=document.getElementById("month-filter-select");
  if(sel) sel.value=currentMonth;
  if(options.updateUrl)syncBrowseUrl();
  if(concertsData&&concertsData.length) renderConcerts(concertsData);
}
function setSearch(value,options){
  options=options||{};
  currentSearch=String(value||"").trim();
  if(!options.preserveLimit) browseLimit=BROWSE_PAGE_SIZE;
  if(options.updateUrl)syncBrowseUrl();
  if(concertsData&&concertsData.length)renderConcerts(concertsData);
}
function clearBrowseFilters(){
  currentFilter="all";
  currentMonth="all";
  currentSearch="";
  browseLimit=BROWSE_PAGE_SIZE;
  document.querySelectorAll("[data-filter]").forEach(function(b){
    var active=b.getAttribute("data-filter")==="all";
    b.classList.toggle("active",active);
    b.setAttribute("aria-pressed",active?"true":"false");
  });
  var sel=document.getElementById("month-filter-select"); if(sel)sel.value="all";
  var search=document.getElementById("event-search"); if(search)search.value="";
  syncBrowseUrl();
  if(concertsData&&concertsData.length)renderConcerts(concertsData); else updateBrowseChrome(0);
}

window.addEventListener("error",function(e){track("client_error",{surface:"storefront",message:String(e&&e.message||"unknown").slice(0,120)});});
window.addEventListener("unhandledrejection",function(e){track("client_error",{surface:"storefront",message:String(e&&e.reason&&e.reason.message||e&&e.reason||"promise").slice(0,120)});});

document.addEventListener("DOMContentLoaded",function(){
  bindThemeToggle();
  bindLanguageSwitch();
  applyStaticLanguage();
  applyConfig(); setUpdateDate(); renderLoadingSkeleton(4);
  document.querySelectorAll("[data-filter]").forEach(function(b){b.addEventListener("click",function(){setFilter(b.getAttribute("data-filter")||"all",{updateUrl:true});});});
  var monthSelect=document.getElementById("month-filter-select");
  if(monthSelect) monthSelect.addEventListener("change",function(){setMonth(monthSelect.value||"all",{updateUrl:true});});
  var eventSearch=document.getElementById("event-search");
  if(eventSearch){
    eventSearch.value=currentSearch;
    eventSearch.addEventListener("input",function(){setSearch(eventSearch.value,{updateUrl:true});});
  }
  var clearBrowse=document.getElementById("clear-browse-btn");
  if(clearBrowse)clearBrowse.addEventListener("click",clearBrowseFilters);
  document.addEventListener("click",function(e){
    var retry=e.target&&e.target.closest&&e.target.closest("#storefront-retry-btn");
    if(!retry)return;
    retry.disabled=true;
    retry.textContent=tr("loading_text");
    refreshStorefrontData("retry").catch(function(err){console.error("storefront retry failed",err);showError(tr("error_detail"));});
  });
  var shareBtn=document.getElementById("event-share-btn");
  if(shareBtn){
    shareBtn.textContent=tr("share_event");
    shareBtn.addEventListener("click",async function(){
      if(!activeModalEvent)return;
      var shareData={title:activeModalEvent.name||document.title,text:(activeModalEvent.name||"")+" · "+(activeModalEvent.date||""),url:eventShareUrl(activeModalEvent)};
      try{
        if(navigator.share){ await navigator.share(shareData); track("share_event",{event_name:activeModalEvent.name,method:"native"}); }
        else{ await navigator.clipboard.writeText(shareData.url); shareBtn.textContent=tr("share_copied"); setTimeout(function(){shareBtn.textContent=tr("share_event");},1800); track("share_event",{event_name:activeModalEvent.name,method:"copy"}); }
      }catch(e){ if(e&&e.name!=="AbortError") console.warn("share event failed",e); }
    });
  }
  setFilter(currentFilter);
  var bImg=document.querySelector(".brand-header-img"); if(bImg)bImg.addEventListener("error",showBrandFallback);
  var faqBtn=document.getElementById("faq-open-btn"); if(faqBtn)faqBtn.addEventListener("click",openFaq);
  document.querySelectorAll("[data-open-faq]").forEach(function(b){b.addEventListener("click",openFaq);});
  document.querySelectorAll(".faq-q").forEach(function(b){b.addEventListener("click",function(){toggleFaq(b);});});
  var ov=document.getElementById("overlay"); if(ov)ov.addEventListener("click",closeModal);
  var fov=document.getElementById("faqOverlay"); if(fov)fov.addEventListener("click",closeFaq);
  document.querySelectorAll("#overlay .modal,.faq-overlay .modal").forEach(function(m){m.addEventListener("click",function(e){e.stopPropagation();});});
  function bindClose(selector,fn){
    document.querySelectorAll(selector).forEach(function(el){
      ["click","touchend"].forEach(function(evt){
        el.addEventListener(evt,function(e){e.preventDefault();e.stopPropagation();fn();},{passive:false});
      });
    });
  }
  bindClose(PACKAGE_CLOSE_SELECTOR,closeModal);
  bindClose(FAQ_CLOSE_SELECTOR,closeFaq);
  // Capture-phase close handler keeps close buttons working inside LINE/mobile browsers.
  document.addEventListener("click",function(e){
    if(e.target.closest(FAQ_CLOSE_SELECTOR)){e.preventDefault();e.stopPropagation();closeFaq();return;}
    if(e.target.closest(PACKAGE_CLOSE_SELECTOR)){e.preventDefault();e.stopPropagation();closeModal();return;}
  },true);
  document.addEventListener("visibilitychange",function(){
    if(document.visibilityState!=="visible" || activeModalEvent)return;
    if(lastDataLoadAt && Date.now()-lastDataLoadAt<STALE_REFRESH_MS)return;
    refreshStorefrontData("foreground").catch(function(err){console.warn("foreground availability refresh failed",err);});
  });
    window.addEventListener("popstate",function(){
    var ov=document.getElementById("overlay");
    if(ov&&ov.classList.contains("active")&&!new URL(window.location.href).searchParams.get("event")){
      ov.classList.remove("active");
      activeModalEvent=null;
      resetMeta();
      unlockBodyIfNoModal();
      restoreFocus(packageFocusReturn);
      packageFocusReturn=null;
    }
  });

  loadData().then(function(data){
      concertsData=data;
      lastDataLoadAt=Date.now();
      renderConcerts(concertsData);
      if(REQUESTED_EVENT){
        var target=concertsData.find(function(c){return String(c.id)===REQUESTED_EVENT;});
        if(target){ setTimeout(function(){ showModal(target); }, 80); }
        else{ clearEventParam(); }
      }
    })
    .catch(function(e){ console.error("KK v16.7.0_PHASE3_9_5_BILINGUAL:",e); showError(tr("error_detail")); });
});

document.addEventListener("keydown",function(e){
  if(e.key==="Escape"){
    var ov=document.getElementById("overlay"); if(ov&&ov.classList.contains("active"))closeModal();
    var fo=document.getElementById("faqOverlay"); if(fo&&fo.classList.contains("active"))closeFaq();
    return;
  }
  if(e.key==="Tab"){
    var activeOverlay=document.querySelector(".faq-overlay.active")||document.querySelector(".overlay.active");
    if(!activeOverlay)return;
    var list=focusableIn(activeOverlay);
    if(!list.length){e.preventDefault();return;}
    var first=list[0],last=list[list.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }
});
