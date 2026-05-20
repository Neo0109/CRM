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

## 2. Deploy Web Service

Deploy the GitHub repo as a Node web service.

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

## 3. First Use

Open the deployed URL in any browser.

If `CRM_ACCESS_TOKEN` is configured, enter it once in the CRM. The browser saves it locally and sends it with API requests.

## 4. Storage Mode

- With Supabase variables: leads are stored in Supabase.
- Without Supabase variables: leads fall back to local `data/leads.json`.

For multi-computer usage, use Supabase.
