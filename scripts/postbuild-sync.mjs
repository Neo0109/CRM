const disabled = process.env.CRM_POSTBUILD_SYNC === '0';

if (disabled) {
  console.log('[postbuild-sync] skipped because CRM_POSTBUILD_SYNC=0');
  process.exit(0);
}

const reportDate =
  process.env.CRM_SYNC_DATE ||
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

const baseUrl = (process.env.CRM_SYNC_BASE_URL || 'https://crm-pages.pages.dev').replace(/\/$/, '');
const url = `${baseUrl}/api/reports/sync?date=${encodeURIComponent(reportDate)}`;

try {
  const response = await fetch(url, { method: 'GET' });
  const body = await response.text();

  if (!response.ok) {
    console.warn(`[postbuild-sync] sync returned ${response.status}: ${body.slice(0, 500)}`);
  } else {
    console.log(`[postbuild-sync] synced ${reportDate}: ${body.slice(0, 500)}`);
  }
} catch (error) {
  console.warn(`[postbuild-sync] sync request failed: ${error instanceof Error ? error.message : String(error)}`);
}
