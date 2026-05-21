import { Bot, FileImage, Sparkles, XCircle } from "lucide-react";
import { useState } from "react";
import { runLeadAssistant } from "./api";
import type { LeadAssistantResult } from "./types";

type AssistantAttachment = {
  name?: string;
  type?: string;
};

type AssistantPageProps = {
  onImported: () => Promise<void>;
  onStatus: (message: string) => void;
};

export function AssistantPage({ onImported, onStatus }: AssistantPageProps) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<AssistantAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LeadAssistantResult | null>(null);

  async function handleSubmit() {
    if (!text.trim() && !attachments.length) {
      setError("请输入关键词、线索说明、链接或截图备注");
      return;
    }

    try {
      setLoading(true);
      const nextResult = await runLeadAssistant({ text, attachments });
      setResult(nextResult);
      setError(null);
      onStatus(`线索助手完成：新增 ${nextResult.created}，更新 ${nextResult.updated}`);
      if (nextResult.created > 0 || nextResult.updated > 0) await onImported();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "线索助手处理失败");
    } finally {
      setLoading(false);
    }
  }

  return <section className="assistant-shell">
    <div className="assistant-head">
      <div><p className="eyebrow">Lead Assistant</p><h2>线索助手</h2></div>
      <button className="primary-button" onClick={() => void handleSubmit()} disabled={loading}><Sparkles size={16} />{loading ? "处理中" : "写入 CRM"}</button>
    </div>

    {error && <div className="notice error inline-notice">{error}</div>}

    <div className="assistant-grid">
      <article className="assistant-card input-card">
        <label className="field span-2">
          <span>关键词 / 线索说明 / Steam 链接</span>
          <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="项目：&#10;Steam：https://store.steampowered.com/app/...&#10;团队 / 国家 / 联系方式 / 看到它的原因" />
        </label>
        <label className="file-drop">
          <FileImage size={18} />
          <span>截图备注</span>
          <input type="file" accept="image/*" multiple onChange={(event) => {
            const files = Array.from(event.target.files ?? []).map((file) => ({ name: file.name, type: file.type }));
            setAttachments(files);
          }} />
        </label>
        {attachments.length > 0 && <div className="attachment-list">{attachments.map((item) => <span key={`${item.name}-${item.type}`}>{item.name}</span>)}</div>}
      </article>

      <article className="assistant-card result-card">
        <div className="assistant-result-head"><Bot size={18} /><h3>处理结果</h3></div>
        {!result ? <div className="radar-empty">等待输入</div> : <>
          <div className="assistant-result-metrics">
            <span>新增 <strong>{result.created}</strong></span>
            <span>更新 <strong>{result.updated}</strong></span>
            <span>跳过 <strong>{result.skipped.length}</strong></span>
          </div>
          {result.leads.length > 0 && <div className="assistant-lead-list">{result.leads.map((lead, index) => <div className="assistant-lead" key={`${lead.project}-${index}`}>
            <strong>{lead.project}</strong>
            <small>{lead.priority} · {lead.bucket} · {lead.priority_reason}</small>
          </div>)}</div>}
          {result.skipped.length > 0 && <div className="assistant-skipped">{result.skipped.map((item) => <span key={item}><XCircle size={13} />{item}</span>)}</div>}
        </>}
      </article>
    </div>
  </section>;
}
