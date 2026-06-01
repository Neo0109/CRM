import { FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { excelExportUrl } from "./api";

export function SettingsPage({ onStatus }: { onStatus: (message: string) => void }) {
  const [downloadPassword, setDownloadPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  function handleExcelDownload() {
    const password = downloadPassword.trim();
    if (!password) {
      setLocalError("请输入 Excel 导出密码");
      return;
    }
    setLocalError(null);
    window.location.assign(excelExportUrl(password));
    onStatus("开始导出 Excel");
  }

  return <section className="radar-shell">
    <div className="radar-head">
      <div><p className="eyebrow">CRM Control</p><h2>设置</h2></div>
    </div>
    {localError && <div className="notice error">{localError}</div>}

    <div className="form-grid two">
      <section className="form-section">
        <h3>密码管理</h3>
        <p className="subline">登录账号、角色和 Excel 导出密码都统一在 Cloudflare 管理，CRM 里不再单独保存账号信息。</p>
        <div className="insight-card">
          <strong>多人登录账号</strong>
          <p className="subline">在 Cloudflare 的 Variables and Secrets 里设置 <code>CRM_USERS_JSON</code>，可为每个人配置独立密码和角色。</p>
        </div>
        <div className="insight-card">
          <strong>兼容旧登录</strong>
          <p className="subline">旧的 <code>CRM_USERNAME</code> + <code>CRM_ACCESS_TOKEN</code> 仍可用，但后续权限和操作记录会优先基于多人账号扩展。</p>
        </div>
        <div className="insight-card">
          <strong>Excel 导出密码</strong>
          <p className="subline">在 Cloudflare 的 Variables and Secrets 里设置或修改 <code>EXCEL_EXPORT_PASSWORD</code>。</p>
        </div>
        <p className="subline">改完变量后，重新部署一次页面，新的密码就会生效。</p>
      </section>

      <section className="form-section">
        <h3>Excel 导出</h3>
        <TextField label="导出时输入密码" type="password" value={downloadPassword} onChange={setDownloadPassword} />
        <div className="actions">
          <button className="ghost-button" onClick={handleExcelDownload}><FileSpreadsheet size={16} />导出 Excel</button>
        </div>
        <p className="subline">这里不再设置密码，只负责输入 Cloudflare 里配置好的导出密码。</p>
      </section>
    </div>
  </section>;
}

function TextField({ label, value, onChange, type = "text" }: { label: string; value: string | null; onChange: (value: string) => void; type?: string }) {
  return <label className="field"><span>{label}</span><input type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} /></label>;
}
