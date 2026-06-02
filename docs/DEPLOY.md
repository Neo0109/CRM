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
CRM_USERS_JSON=[{"username":"Neo","password":"choose-a-private-password","role":"admin","permissions":["*"]}]
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
CRM_USERS_JSON=[{"username":"Neo","password":"choose-a-private-password","role":"admin","permissions":["*"]}]
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
CRM_USERS_JSON=[{"username":"Neo","password":"choose-a-private-password","role":"admin","permissions":["*"]}]
NODE_ENV=production
```

The app will serve the React CRM and API from the same online URL.

## 5. First Use

Open the deployed URL in any browser.

If `CRM_USERS_JSON` is configured, enter one of its usernames and passwords on the CRM login page. The browser saves the current user's credentials locally and sends them with API requests.

Single-user legacy variables are still supported:

```text
CRM_USERNAME=Neo
CRM_ACCESS_TOKEN=choose-a-private-password
```

For multiple users, set one Cloudflare secret named `CRM_USERS_JSON`. Do not create multiple `CRM_USERNAME` variables. Recommended format:

```json
[
  {
    "username": "Neo",
    "password": "choose-a-private-password",
    "role": "admin",
    "permissions": ["*"]
  },
  {
    "username": "BDUser",
    "password": "choose-another-private-password",
    "role": "operator",
    "permissions": ["leads:read", "leads:write"]
  }
]
```

Each user object must be separated by a comma. For example, when adding a third person:

```json
[
  {"username":"neo","display_name":"Neo","password":"choose-a-private-password","role":"admin","permissions":["*"]},
  {"username":"nanyuan","display_name":"南鸢","password":"choose-another-private-password","role":"member","permissions":[]},
  {"username":"jojo","display_name":"Jojo","password":"choose-a-third-private-password","role":"member","permissions":[]},
  {"username":"yuyang","display_name":"于老板","password":"choose-a-fourth-private-password","role":"member","permissions":[]}
]
```

After deployment, open `/api/health` and confirm `crmUsersJsonStatus` is `valid` and `crmUserCount` matches the number of CRM users. `repaired` means the app tolerated a common paste error, but you should still fix the Cloudflare value.

Object-map format is also accepted if it is easier to edit in Cloudflare:

```json
{
  "Neo": {
    "password": "choose-a-private-password",
    "role": "admin",
    "permissions": ["*"]
  },
  "BDUser": {
    "password": "choose-another-private-password",
    "role": "operator",
    "permissions": ["leads:read", "leads:write"]
  }
}
```

## 6. Storage Mode

- With Supabase variables: leads are stored in Supabase.
- Without Supabase variables: leads fall back to local `data/leads.json`.

For multi-computer usage, use Supabase.
