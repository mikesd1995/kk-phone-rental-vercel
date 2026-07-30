KK Phone Rental Phase 3.9.5.4

IMPORTANT: This fix has TWO deployment parts.

A) GOOGLE APPS SCRIPT
1. Open the existing Apps Script project.
2. Replace Code.gs with apps-script/Code.gs from this package.
3. Save.
4. Deploy > Manage deployments > Edit > New version > Deploy.
5. In the Google Sheet, run KK Admin > Repair Lens Stock (ZEISS/G1 only) once.

B) VERCEL
1. Replace index.html, script.js, config.js, and api/kk-data.js.
2. Redeploy Vercel.
3. Hard refresh the public site (Ctrl+F5).

TEST
- Create/inspect an active phone_only booking on an event date.
- 09_Web_Packages column I must decrease for phone_only and bundle rows.
- 08_Web_Ready column G must show the same remaining phone count.
- The public card must match column G.
