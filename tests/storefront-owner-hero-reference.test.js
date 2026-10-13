'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),css=fs.readFileSync(path.join(root,'assets/kk-storefront-v5.css'),'utf8'),js=fs.readFileSync(path.join(root,'script.js'),'utf8');
test('owner reference uses dedicated podium artwork without replacing shared event fallback art',()=>{
 const file=path.join(root,'assets/kk-hero-phones-podium-20261014.png');
 assert.ok(fs.existsSync(file),'dedicated artwork must exist');
 const bytes=fs.readFileSync(file);assert.ok(bytes.length<2*1024*1024,'bounded PNG asset');assert.ok(bytes.readUInt32BE(16)>=1200);assert.ok(bytes.readUInt32BE(20)>=700);
 const hero=css.slice(css.indexOf('V6.35 — 2026-10-14: owner-approved phone podium hero'));
 assert.ok(hero.includes('kk-hero-phones-podium-20261014.png'));
 assert.match(hero,/background-size:contain!important/);
 assert.ok(!hero.includes('kk-brand-hero-final-20260920.png'));
 assert.ok(js.includes('art.src="/assets/kk-brand-hero-final-20260920.png"'));
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'assets/kk-brand-hero-final-20260920.png'))).digest('hex'),'34b8ec9531337418b85f741b594e4765dbd7254808353f52bdddaafc59b9c31d');
});
test('hero keeps semantic bilingual copy, working CTA destinations and exactly three inside-frame trust items',()=>{
 const hero=html.slice(html.indexOf('<section class="v3-hero'),html.indexOf('<section class="kk-benefit-grid'));
 assert.equal((hero.match(/class="hero-trust-item"/g)||[]).length,3);
 assert.match(hero,/<a class="v3-primary" href="#content">/);
 assert.match(hero,/<a class="v3-secondary" href="#booking-journey">/);
 assert.match(hero,/<h1 id="v2-intro-title">/);
 assert.ok(!hero.includes('เครื่องแท้ 100%'),'do not invent new service guarantees from decorative reference');
 assert.match(js,/document\.querySelectorAll\("\.kk-hero-trust \.hero-trust-item"\)/);
 for(const key of ['proof_deposit','proof_onsite','proof_drive'])assert.ok(js.includes('"'+key+'"'));
});
test('reference blue emphasis and mobile compactness retain tap targets and hide only decoration at narrow widths',()=>{
 const hero=css.slice(css.indexOf('V6.35 — 2026-10-14: owner-approved phone podium hero'));
 assert.match(hero,/h1 em\{color:#8bd4ff!important/);
 assert.match(hero,/@media \(max-width:375px\)/);
 assert.match(hero,/\.kk-hero-art\{display:none!important/);
 assert.match(hero,/min-height:44px!important/);
 assert.ok(!hero.includes('.concert-card'),'hero scope must not change catalogue');
});
test('both modified hero assets carry paired cache keys',()=>{
 assert.match(html,/kk-storefront-v5\.css\?v=20261014-v635-owner-podium-hero/);
 assert.match(html,/script\.js\?v=storefront-owner-podium-hero-20261014/);
});
