# Product Version Governance

Every user-facing product request must bump the visible CRM version before build and deploy.

Use one command as the independent version entrypoint:

```bash
npm run version:product -- --minor --slug short-release-slug --summary "What changed"
```

The script updates the canonical version manifest and synchronizes:

- `app/frontend/src/productVersion.ts`
- Cloudflare Pages HTML brand labels
- Cloudflare and local backend health versions
- `docs/CHANGELOG.md`
- `docs/CRM_OPTIMIZATION_CONTEXT.md`

After the version bump, rebuild the frontend and pin Cloudflare asset URLs to the commit that contains the built assets. Do not hand-edit version strings in feature files.

## Version Lines

- Product-visible functionality uses the `v2.x` product version line.
- Daily/sourcing rules use the `sourcing-rules-vX` rule version line.
- Automation-only guardrails or watchdog fixes should use descriptive release notes such as `daily-report-*` or `automation-*`, not product-like `v2.x.y` names unless the visible CRM product version is also bumped.
- If a PR adds a user-facing page, visible field, workflow control, diagnostic panel, navigation change, or login/permission behavior, it is a product change and must bump the product version.
