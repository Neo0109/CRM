import { Plus, X } from "lucide-react";
import { useState } from "react";
import { ManualImportPage } from "./ManualImportPage";

type ManualLeadLauncherProps = {
  visible?: boolean;
};

export function ManualLeadLauncher({ visible = true }: ManualLeadLauncherProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  if (!visible) return null;

  async function handleImported() {
    setStatus("已写入 CRM，正在刷新列表");
    window.setTimeout(() => window.location.reload(), 450);
  }

  return <>
    <button className="manual-floating-button" onClick={() => { setStatus(null); setOpen(true); }}><Plus size={17} />新增 Leads</button>
    {open && <div className="manual-modal-backdrop" role="dialog" aria-modal="true" aria-label="新增 Leads">
      <div className="manual-modal">
        <button className="manual-modal-close" onClick={() => setOpen(false)} aria-label="关闭"><X size={18} /></button>
        {status && <div className="notice manual-modal-status">{status}</div>}
        <ManualImportPage onImported={handleImported} onStatus={setStatus} />
      </div>
    </div>}
  </>;
}
