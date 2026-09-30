# KK Storefront Art Director

Use this skill before implementing material storefront visual changes.

1. Invoke `storefront_art_direction` through the Agent Gateway/Task Router.
2. Treat its design system, hierarchy and anti-patterns as implementation constraints.
3. Preserve price, inventory, event visibility, booking semantics and Machine SOT.
4. Implement on a branch/preview. Never auto-merge or auto-deploy.
5. Run existing `storefront_ux_review` before implementation evidence is accepted.
6. Run `storefront_visual_qa` after implementation at all required widths.
7. Invoke `storefront_art_acceptance`; BLOCKED means the visual work is not accepted.
8. Record material decisions and rollback scope in a dated implementation document.
