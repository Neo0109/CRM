import { Bot, Camera, Clipboard, FileImage, Sparkles, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import type { ChangeEvent, ClipboardEvent } from "react";
import { runLeadAssistant } from "./api";
import { analyzeAssistantDraft, buildAssistantResultHints, readinessLabel } from "./assistantQuality";
import type { LeadAssistantAttachment, LeadAssistantResult } from "./types";
import "./assistant.css";

type AssistantAttachment = Required<Pick<LeadAssistantAttachment, "name" | "type" | "size" | "source" | "data_url">> & {
  id: string;
};

type AssistantPageProps = {
  onImported: () => Promise<void>;
  onStatus: (message: string) => void;
};

const maxAttachments = 6;
const maxAttachmentBytes = 8 * 1024 * 1024;

type AttachmentSource = "paste" | "upload" | "camera";

export function AssistantPage({ onImported, onStatus }: AssistantPageProps) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<AssistantAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LeadAssistantResult | null>(null);
  const draftAnalysis = analyzeAssistantDraft({ text, attachments });
  const resultHints = result ? buildAssistantResultHints(result) : [];

  async function handleSubmit() {
    if (!text.trim() && !attachments.length) {
      setError("请输入关键词、线索说明、Steam 链接，或直接粘贴截图");
      return;
    }

    try {
      setLoading(true);
      const nextResult = await runLeadAssistant({
        text,
        attachments: attachments.map(({ id, ...attachment }) => attachment)
      });
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

  async function addImageFiles(files: File[], source: AttachmentSource) {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) {
      setError("没有识别到图片");
      return;
    }

    const availableSlots = maxAttachments - attachments.length;
    if (availableSlots <= 0) {
      setError(`最多可附加 ${maxAttachments} 张截图`);
      return;
    }

    const acceptedFiles = imageFiles.slice(0, availableSlots);
    const oversizedFiles = acceptedFiles.filter((file) => file.size > maxAttachmentBytes);
    const readableFiles = acceptedFiles.filter((file) => file.size <= maxAttachmentBytes);

    if (!readableFiles.length) {
      setError("截图太大，请压缩到 8MB 以内再粘贴");
      return;
    }

    const nextAttachments = await Promise.all(readableFiles.map((file, index) => fileToAttachment(file, source, index)));
    setAttachments((current) => [...current, ...nextAttachments].slice(0, maxAttachments));
    setError(oversizedFiles.length ? `已跳过 ${oversizedFiles.length} 张超过 8MB 的截图` : null);
  }

  function handlePaste(event: ClipboardEvent<HTMLElement>) {
    const imageFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));

    if (!imageFiles.length) return;
    event.preventDefault();
    void addImageFiles(imageFiles, "paste");
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>, source: "upload" | "camera") {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    void addImageFiles(files, source);
  }

  function removeAttachment(id: string) {
    setAttachments((current) => current.filter((attachment) => attachment.id !== id));
  }

  return <section className="assistant-shell">
    <div className="assistant-head">
      <div><p className="eyebrow">Lead Assistant</p><h2>线索助手</h2></div>
      <button className="primary-button" onClick={() => void handleSubmit()} disabled={loading}><Sparkles size={16} />{loading ? "识别并写入中" : "AI 识别并写入 CRM"}</button>
    </div>

    {error && <div className="notice error inline-notice">{error}</div>}

    <div className="assistant-grid">
      <article className="assistant-card input-card">
        <label className="field span-2">
          <span>关键词 / 线索说明 / Steam 链接</span>
          <textarea value={text} onChange={(event) => setText(event.target.value)} onPaste={handlePaste} placeholder={"项目：\nSteam：https://store.steampowered.com/app/...\n团队 / 国家 / 联系方式 / 看到它的原因"} />
        </label>

        <div className={`assistant-quality assistant-quality-${draftAnalysis.readiness}`}>
          <div className="assistant-quality-head">
            <strong>录入质量</strong>
            <span>{readinessLabel(draftAnalysis.readiness)}</span>
          </div>
          <div className="assistant-quality-signals">
            {draftAnalysis.signals.projectName && <span>项目：{draftAnalysis.signals.projectName}</span>}
            {draftAnalysis.signals.steamAppIds.length > 0 && <span>Steam：{draftAnalysis.signals.steamAppIds.join(", ")}</span>}
            {!draftAnalysis.signals.steamAppIds.length && draftAnalysis.signals.gameLinks.length > 0 && <span>链接：{draftAnalysis.signals.gameLinks.length}</span>}
            {draftAnalysis.signals.contacts.length > 0 && <span>联系方式：{draftAnalysis.signals.contacts.length}</span>}
            {draftAnalysis.signals.screenshots > 0 && <span>截图：{draftAnalysis.signals.screenshots}</span>}
            {!draftAnalysis.signals.projectName && !draftAnalysis.signals.gameLinks.length && !draftAnalysis.signals.contacts.length && !draftAnalysis.signals.screenshots && <span>等待关键信息</span>}
          </div>
          {draftAnalysis.suggestions.length > 0 && <ul className="assistant-quality-suggestions">
            {draftAnalysis.suggestions.map((item) => <li key={item}>{item}</li>)}
          </ul>}
        </div>

        <div className="paste-target" tabIndex={0} onPaste={handlePaste}>
          <span><Clipboard size={18} />直接粘贴截图</span>
          <span className="paste-hint">Ctrl+V</span>
        </div>

        <div className="assistant-upload-row">
          <label className="file-drop">
            <FileImage size={18} />
            <span>从相册选择</span>
            <input type="file" accept="image/*" multiple onChange={(event) => handleFileChange(event, "upload")} />
          </label>
          <label className="file-drop">
            <Camera size={18} />
            <span>拍照上传</span>
            <input type="file" accept="image/*" capture="environment" onChange={(event) => handleFileChange(event, "camera")} />
          </label>
        </div>

        {attachments.length > 0 && <div className="screenshot-grid">{attachments.map((item) => <article className="screenshot-card" key={item.id}>
          <img src={item.data_url} alt={item.name} />
          <div className="screenshot-meta">
            <div>
              <strong>{item.name}</strong>
              <small>{sourceLabel(item.source)} / {formatBytes(item.size)}</small>
            </div>
            <button className="icon-button danger" onClick={() => removeAttachment(item.id)} aria-label={`删除 ${item.name}`}><Trash2 size={14} /></button>
          </div>
        </article>)}</div>}
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
            <small>{lead.priority ?? "P2"} · {lead.bucket ?? "观察池"} · {lead.priority_reason ?? "待复核"}</small>
          </div>)}</div>}
          {resultHints.length > 0 && <div className="assistant-result-hints">
            <strong>补充建议</strong>
            <ul>{resultHints.map((hint) => <li key={hint}>{hint}</li>)}</ul>
          </div>}
          {result.skipped.length > 0 && <div className="assistant-skipped">{result.skipped.map((item) => <span key={item}><XCircle size={13} />{item}</span>)}</div>}
        </>}
      </article>
    </div>
  </section>;
}

function fileToAttachment(file: File, source: AttachmentSource, index: number): Promise<AssistantAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) {
        reject(new Error("截图读取失败"));
        return;
      }
      const extension = file.type.split("/")[1] || "png";
      resolve({
        id: `${source}-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
        name: file.name || `截图-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`,
        type: file.type || "image/png",
        size: file.size,
        source,
        data_url: dataUrl
      });
    };
    reader.onerror = () => reject(new Error("截图读取失败"));
    reader.readAsDataURL(file);
  });
}

function sourceLabel(source: AttachmentSource) {
  if (source === "paste") return "粘贴";
  if (source === "camera") return "拍照";
  return "相册";
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
