# Online Deployment

This CRM can run as one online web service with Supabase as the shared database.

## 1. Create Supabase Project

1. Create a Supabase project.
2. Open SQL Editor.
3. Run:

```sql
create table if not exists public.crm_leads (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists crm_leads_updated_at_idx
  on public.crm_leads (updated_at desc);
```

4. Copy these values from Project Settings:
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY` or legacy `SUPABASE_SERVICE_ROLE_KEY`

Keep the secret / service role key private. It must only be used on the server.

## 2. Deploy on Cloudflare Pages

Cloudflare Pages + Functions is the recommended free-friendly option for this CRM.

1. Open `https://dash.cloudflare.com`.
2. Go to **Workers & Pages**.
3. Create an application, choose **Pages**, then connect GitHub.
4. Select `Neo0109/CRM`.
5. Use:

```text
Build command: npm install && npm run build --workspace app/frontend
Build output directory: app/frontend/dist
```

6. Add environment variables:

```text
SUPABASE_URL=your-supabase-url
SUPABASE_SECRET_KEY=your-server-side-key
CRM_ACCESS_TOKEN=choose-a-private-password
```

Do not set `NODE_ENV=production` in Cloudflare Pages build variables. It can make npm skip type-related dev packages during build.

7. Deploy and open the generated `*.pages.dev` domain.

> 说明：本仓库当前不依赖 `wrangler.toml`，Cloudflare 构建日志出现 “No Wrangler configuration file found. Continuing.” 属于正常现象。

Cloudflare Pages serves the React CRM, and Cloudflare Pages Functions serve `/api/*`.

## 3. Deploy on Zeabur

Zeabur is a good option when Render phone verification is not available.

1. Open `https://zeabur.com`.
2. Sign in with GitHub.
3. Create a new project.
4. Add a service from GitHub.
5. Select `Neo0109/CRM`.
6. Zeabur will use `zbpack.json`:

```bash
npm install && npm run build
npm run start --workspace app/backend
```

7. Add environment variables:

```text
SUPABASE_URL=your-supabase-url
SUPABASE_SECRET_KEY=your-server-side-key
CRM_ACCESS_TOKEN=choose-a-private-password
NODE_ENV=production
```

8. Deploy and open the generated domain.

## 4. Alternative Generic Node Web Service

If you use another Node hosting service, use:

Build command:

```bash
npm install && npm run build
```

Start command:

```bash
npm run start --workspace app/backend
```

Environment variables:

```text
SUPABASE_URL=your-supabase-url
SUPABASE_SECRET_KEY=your-server-side-key
CRM_ACCESS_TOKEN=choose-a-private-password
NODE_ENV=production
```

The app will serve the React CRM and API from the same online URL.

## 5. First Use

Open the deployed URL in any browser.

If `CRM_ACCESS_TOKEN` is configured, enter it once in the CRM. The browser saves it locally and sends it with API requests.

## 6. Storage Mode

- With Supabase variables: leads are stored in Supabase.
- Without Supabase variables: leads fall back to local `data/leads.json`.

For multi-computer usage, use Supabase.
