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
