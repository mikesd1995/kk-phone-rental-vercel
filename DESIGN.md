# KK Phone Rental — Product Design Contract

This file is the canonical design contract for AI-assisted changes to customer-facing and Admin UI. It complements `AGENTS.md`: AGENTS defines engineering/release gates; this file defines visual and interaction invariants.

## Product design intent

KK Phone Rental should feel fast, trustworthy, current and event-first rather than like a generic device catalogue.

- Mobile-first is the default. Desktop is an enhancement, not the source layout.
- The storefront is content-first: customers should identify an event, availability/value, price context and the next action quickly.
- Keep the visual language clean, minimal and softly expressive. Prefer restrained pastel-blue accents and clear hierarchy over decorative density.
- Do not couple the brand or hero copy to one phone model. Inventory may contain multiple models in the future.
- Thai and English are first-class. Neither language may be treated as an afterthought or allowed to break layout.
- Light and Dark modes are equal product surfaces. A feature is incomplete if only one mode is coherent.

## Source-of-truth rule

Before changing UI, inspect the existing implementation and concrete viewport evidence. Do not invent a parallel design system when usable tokens/components already exist.

When this contract conflicts with verified business truth, accessibility, safety, or an explicit owner instruction, those higher-authority constraints win. Record the exception instead of silently drifting the design.

## Hierarchy

1. Event/poster and event identity.
2. Rental decision information: date, availability/state, package/price information backed by business truth.
3. Primary booking/contact action.
4. Secondary details, benefits and supporting information.
5. FAQ/help and tertiary navigation.

Do not allow decorative elements, badges, gradients or internal metadata to outrank the rental decision.

## Layout and responsive behavior

- Design from narrow mobile widths first and validate representative mobile, tablet and desktop widths through the existing UX/Visual QA gate.
- No horizontal overflow at supported widths.
- Sticky/fixed controls must not obscure content, browser chrome, safe areas, keyboard interaction or the final CTA.
- Touch targets must remain comfortably operable on mobile.
- Preserve stable layout while images load; avoid avoidable content jumps.
- Dense desktop grids must collapse into readable mobile cards without shrinking essential text into illegibility.
- Search/filter controls must remain usable without iOS focus zoom or clipping.

## Typography and bilingual copy

- Use the repository's existing font stack unless a deliberate migration is separately approved and tested.
- Customer-facing body/form text must remain at least 16 CSS px where mobile browser focus/legibility requires it.
- Thai line-height must accommodate marks without clipping.
- Headings should be concise and scannable; do not use oversized display text that pushes event inventory below the fold without a measured reason.
- Thai/English switching must preserve semantic meaning, CTA priority and layout integrity.
- Never expose engineering tokens, machine annotations, ALL_CAPS snake-case operational notes, debug labels or untranslated internal strings.

## Color, surfaces and themes

- Use semantic design tokens/components instead of scattering new literal colors through feature code.
- Pastel blue is the preferred brand accent; neutral surfaces carry most content.
- Accent color signals action/selection, not decoration everywhere.
- Light mode must retain visible boundaries and readable muted text.
- Dark mode must be designed, not mechanically inverted. Preserve poster imagery, readable surfaces, borders, focus states and semantic status contrast.
- Do not encode status or availability by color alone.
- New colors require a semantic purpose and Light/Dark values.

## Event cards and imagery

- Official event artwork/posters are primary visual content; do not crop away critical artist/event text when a contained treatment is more appropriate.
- Use a consistent aspect-ratio strategy and explicit fallback for missing/broken images.
- Broken remote images must degrade to a deliberate placeholder without collapsing card geometry.
- Do not stretch posters.
- Event title/date/status must remain understandable even if the image fails.
- Image optimization must not materially degrade poster readability.

## Search and filtering

- Search is a core rental-discovery control, not decorative chrome.
- Keep query state and result feedback obvious.
- Empty results need a useful recovery path, not a dead end.
- Loading, error and no-result states must be visually distinct.
- Search behavior must remain stable across Thai/English input and mobile keyboard interaction.
- Do not trade search reliability for visual animation.

## CTA hierarchy

Each surface should have one visually dominant next action.

- Primary CTA: the action that advances the rental/booking intent.
- Secondary CTA: supporting action such as viewing details or contacting for clarification.
- Tertiary actions should not compete with the primary CTA.
- CTA copy must describe the action; avoid vague labels when a specific verb is possible.
- Disabled/unavailable actions must explain state through accessible UI rather than appearing broken.
- Do not introduce auto-send, auto-booking or business writes merely as a UX convenience; existing governed write authority still applies.

## FAQ and help

- FAQ/help must be discoverable from the storefront without overwhelming event discovery.
- Answers should prioritize booking process, pickup/return, deposit/insurance, files/delivery and other verified policies.
- FAQ content must be backed by current business truth; design work must not invent policies.
- FAQ interaction must be keyboard/touch accessible and usable in both themes/languages.

## States are part of the design

Every material component should deliberately handle:
- loading;
- empty;
- partial/missing data;
- image failure;
- network/error;
- unavailable/closed;
- success/confirmation where applicable.

Do not accept a component based only on the happy path.

## Motion

Motion is optional. Clarity and responsiveness are mandatory.

- Prefer short, functional transitions.
- Respect reduced-motion preferences.
- Avoid autoplay motion, excessive parallax, or animation that delays search, browsing or CTA interaction.

## Accessibility baseline

- Preserve semantic HTML and keyboard navigation.
- Provide visible focus indication.
- Maintain readable contrast in both themes.
- Images that convey information require meaningful alternatives; decorative images should not add noise to assistive technology.
- Controls require accessible names and state.
- Do not remove focus outlines without an equivalent replacement.

## Explicit DO

- Reuse and strengthen existing tokens/components.
- Fix root causes of responsive/image/search defects rather than masking screenshots.
- Validate Thai + English and Light + Dark for material UI changes.
- Validate missing/broken image and empty/error states.
- Keep business truth separate from presentation.
- Use concrete screenshots/runtime evidence for visual acceptance.

## Explicit DON'T

- Do not redesign unrelated surfaces while fixing one defect.
- Do not clone another company's visual identity or copy a reference DESIGN.md verbatim.
- Do not hard-code the brand around vivo X300 Pro or any single device model.
- Do not add gratuitous gradients, glass effects, glow, oversized radii or animation merely to appear “2026/27”.
- Do not introduce a second token system when an existing semantic token can be extended.
- Do not hide defects with fixed heights, overflow clipping or text truncation unless truncation is a deliberate product requirement.
- Do not treat a successful build or preview URL as visual acceptance.

## AI-agent workflow

For every material UI task:

1. Read `AGENTS.md` and this `DESIGN.md`.
2. Run the repository context command required by AGENTS.
3. Inspect existing tokens/components plus concrete viewport evidence.
4. Invoke the mandatory storefront UX reviewer before implementation.
5. Implement the minimum coherent diff.
6. Check the diff against this contract, including bilingual and Light/Dark parity.
7. Run targeted regression plus the required Visual QA.
8. Do not claim production acceptance without fresh production runtime/readback evidence.

If a requested design direction is intentionally outside this contract, update the contract in the same governed change so future agents do not regress or reinterpret it.
