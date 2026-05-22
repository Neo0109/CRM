import { FileSpreadsheet, RefreshCw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { excelExportUrl, fetchSettings, saveAccessToken, saveSettings, sendSettingsVerification } from "./api";
import type { CrmSettings, SettingsPatch } from "./types";

export function SettingsPage({ onStatus, onTokenChanged }: { onStatus: (message: string) => void; onTokenChanged: (token: string) => void }) {
  const [settings, setSettings] = useState<CrmSettings | null>(null);
  const [boundEmail, setBoundEmail] = useState("");
  const [excelPassword, setExcelPassword] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [downloadPassword, setDownloadPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => { void loadSettings(); }, []);

  async function loadSettings() {
    try {
      setLoading(true);
      const nextSettings = await fetchSettings();
      setSettings(nextSettings);
      setBoundEmail(nextSettings.bound_email ?? "");
      setLocalError(null);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "设置加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendVerification() {
    try {
      const result = await sendSettingsVerification();
      if (!result.sent) {
        setLocalError("邮件服务还没配置：请在 Cloudflare 增加 RESEND_API_KEY 和 CRM_FROM_EMAIL");
        return;
      }
      setLocalError(null);
      onStatus(`验证码已发送到 ${result.email}`);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "验证码发送失败");
    }
  }

  async function handleSave() {
    try {
      const patch: SettingsPatch = { bound_email: boundEmail };
      if (excelPassword.trim()) patch.excel_export_password = excelPassword.trim();
      if (loginPassword.trim()) patch.login_password = loginPassword.trim();
      if (verificationCode.trim()) patch.verification_code = verificationCode.trim();
      const nextSettings = await saveSettings(patch);
      setSettings(nextSettings);
      setBoundEmail(nextSettings.bound_email ?? "");
      if (loginPassword.trim()) {
        saveAccessToken(loginPassword.trim());
        onTokenChanged(loginPassword.trim());
      }
      setExcelPassword("");
      setLoginPassword("");
      setVerificationCode("");
      setLocalError(null);
      onStatus("CRM 设置已保存");
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "设置保存失败");
    }
  }

  function handleExcelDownload() {
    if (!downloadPassword.trim()) {
      setLocalError("请输入 Excel 导出密码");
      return;
    }
    window.location.assign(excelExportUrl(downloadPassword.trim()));
  }

  if (loading) return <section className="radar-shell"><div className="empty-cell">加载设置中</div></section>;

  return <section className="radar-shell">
    <div className="radar-head">
      <div><p className="eyebrow">CRM Control</p><h2>设置</h2></div>
      <button className="ghost-button" onClick={() => void loadSettings()}><RefreshCw size={16} />刷新设置</button>
    </div>
    {localError && <div className="notice error">{localError}</div>}

    <div className="form-grid two">
      <section className="form-section">
        <h3>账号</h3>
        <TextField label="绑定邮箱" value={boundEmail} onChange={setBoundEmail} />
        <TextField label="新登录密码" type="password" value={loginPassword} onChange={setLoginPassword} />
        <TextField label="验证码" value={verificationCode} onChange={setVerificationCode} />
        <div className="actions">
          <button className="ghost-button" onClick={() => void handleSendVerification()}>发送验证码</button>
          <button className="primary-button" onClick={handleSave}><Save size={16} />保存账号设置</button>
        </div>
        <p className="subline">邮箱：{settings?.bound_email ?? "未绑定"} · 登录密码：{settings?.has_login_password ? "已设置" : "使用环境口令"}</p>
      </section>

      <section className="form-section">
        <h3>Excel 导出</h3>
        <TextField label="设置导出密码" type="password" value={excelPassword} onChange={setExcelPassword} />
        <TextField label="导出时输入密码" type="password" value={downloadPassword} onChange={setDownloadPassword} />
        <div className="actions">
          <button className="primary-button" onClick={handleSave}><Save size={16} />保存导出密码</button>
          <button className="ghost-button" onClick={handleExcelDownload}><FileSpreadsheet size={16} />导出 Excel</button>
        </div>
        <p className="subline">导出密码：{settings?.has_excel_export_password ? "已设置" : "未设置"}</p>
      </section>
    </div>
  </section>;
}

function TextField({ label, value, onChange, type = "text" }: { label: string; value: string | null; onChange: (value: string) => void; type?: string }) {
  return <label className="field"><span>{label}</span><input type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} /></label>;
}
