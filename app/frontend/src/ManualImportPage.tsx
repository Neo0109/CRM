import { FileJson, PlusCircle, Save } from "lucide-react";
import { useState } from "react";
import { importJsonLeads } from "./api";
import { priorityFromSelection, prioritySelectionOptions, unlabeledPriority, type PrioritySelection } from "./leadPriority";
import type { Bucket, ContactMethod, ContactType, Lead } from "./types";
import "./manual.css";

type ManualImportPageProps = {
  onImported: () => Promise<void>;
  onStatus: (message: string) => void;
};

type ManualLeadForm = {
  project: string;
  team: string;
  steam_app_id: string;
  country: string;
  city: string;
  bucket: Bucket;
  priority: PrioritySelection;
  genre: string;
  progress: string;
  publisher_status: string;
  priority_reason: string;
  rule_fit: string;
  contacts: string;
  links: string;
  notes: string;
};

const bucketOptions: Bucket[] = ["未处理", "待评测", "测试中", "跟进中", "观察池", "推进池", "淘汰池"];
const contactTypeOptions: ContactType[] = ["微信/QQ", "Email", "电话", "官网", "Steam", "Discord", "B站", "X/Twitter", "其他"];

const defaultForm: ManualLeadForm = {
  project: "",
  team: "",
  steam_app_id: "",
  country: "中国",
  city: "",
  bucket: "未处理",
  priority: unlabeledPriority,
  genre: "",
  progress: "待补充",
  publisher_status: "待确认",
  priority_reason: "",
  rule_fit: "",
  contacts: "",
  links: "",
  notes: ""
};

const jsonPlaceholder = `{
  "project": "示例游戏",
  "country": "中国",
  "bucket": "未处理",
  "priority": null,
  "progress": "Demo 已上线",
  "publisher_status": "待确认",
  "priority_reason": "美术风格适合B站内容扩散",
  "rule_fit": "国内项目优先，待验证公开数据",
  "contact_methods": [
    { "type": "Email", "value": "team@example.com" }
  ],
  "links": ["https://store.steampowered.com/app/123456/"],
  "bilibili_fit": "适合UP主试玩和挑战内容",
  "amplification": "可做栏目化内容",
  "verdict": "先进入未处理 inbox"
}`;

export function ManualImportPage({ onImported, onStatus }: ManualImportPageProps) {
  const [form, setForm] = useState<ManualLeadForm>(defaultForm);
  const [jsonText, setJsonText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof ManualLeadForm>(key: K, value: ManualLeadForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submitManualLead() {
    if (!form.project.trim()) {
      setError("项目名不能为空");
      return;
    }

    try {
      setLoading(true);
      const result = await importJsonLeads(buildLead(form));
      setError(null);
      setForm({ ...defaultForm, country: form.country, bucket: form.bucket, priority: form.priority });
      onStatus(result.message);
      await onImported();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "新增 lead 失败");
    } finally {
      setLoading(false);
    }
  }

  async function submitJson() {
    if (!jsonText.trim()) {
      setError("请先粘贴 JSON");
      return;
    }

    try {
      setLoading(true);
      const payload = JSON.parse(jsonText);
      const result = await importJsonLeads(payload);
      setError(null);
      setJsonText("");
      onStatus(result.message);
      await onImported();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "JSON 解析或导入失败");
    } finally {
      setLoading(false);
    }
  }

  return <section className="manual-shell">
    <div className="manual-head">
      <div><p className="eyebrow">Manual Intake</p><h2>新增 Leads</h2></div>
      <p>手动补录一条，或直接粘贴 ChatGPT 生成的 lead JSON / 日报 JSON。</p>
    </div>

    {error && <div className="notice error inline-notice">{error}</div>}

    <div className="manual-grid">
      <article className="manual-card">
        <div className="manual-card-head"><PlusCircle size={18} /><h3>手动新增单条 Lead</h3></div>
        <div className="manual-form-grid">
          <TextField label="项目名" value={form.project} onChange={(value) => setField("project", value)} required />
          <TextField label="团队" value={form.team} onChange={(value) => setField("team", value)} />
          <TextField label="Steam AppID" value={form.steam_app_id} onChange={(value) => setField("steam_app_id", value)} />
          <TextField label="国家/地区" value={form.country} onChange={(value) => setField("country", value || "未知")} />
          <TextField label="城市" value={form.city} onChange={(value) => setField("city", value)} />
          <SelectField label="池子" value={form.bucket} options={bucketOptions} onChange={(value) => setField("bucket", value)} />
          <SelectField label="优先级" value={form.priority} options={prioritySelectionOptions} onChange={(value) => setField("priority", value)} />
          <TextField label="类型" value={form.genre} onChange={(value) => setField("genre", value)} />
        </div>
        <TextareaField label="进度" value={form.progress} onChange={(value) => setField("progress", value)} />
        <TextareaField label="发行结构" value={form.publisher_status} onChange={(value) => setField("publisher_status", value)} />
        <TextareaField label="优先级原因 / insight" value={form.priority_reason} onChange={(value) => setField("priority_reason", value)} />
        <TextareaField label="规则判断" value={form.rule_fit} onChange={(value) => setField("rule_fit", value)} />
        <TextareaField label="联系方式，一行一个" value={form.contacts} onChange={(value) => setField("contacts", value)} placeholder="Email: team@example.com
微信/QQ: example_id
官网: https://example.com" />
        <TextareaField label="Steam / SteamDB / 官网链接，一行一个" value={form.links} onChange={(value) => setField("links", value)} placeholder="https://store.steampowered.com/app/123456/" />
        <TextareaField label="备注" value={form.notes} onChange={(value) => setField("notes", value)} />
        <button className="primary-button manual-submit" onClick={() => void submitManualLead()} disabled={loading}><Save size={16} />保存到 CRM</button>
      </article>

      <article className="manual-card json-card">
        <div className="manual-card-head"><FileJson size={18} /><h3>导入 JSON</h3></div>
        <textarea className="json-import-box" value={jsonText} onChange={(event) => setJsonText(event.target.value)} placeholder={jsonPlaceholder} spellCheck={false} />
        <div className="manual-help">
          <strong>支持格式</strong>
          <span>单条 lead、lead 数组、{`{ "leads": [...] }`}，以及日报的 push_pool / watch_pool / drop_pool。</span>
        </div>
        <button className="primary-button manual-submit" onClick={() => void submitJson()} disabled={loading}><FileJson size={16} />导入 JSON</button>
      </article>
    </div>
  </section>;
}

function buildLead(form: ManualLeadForm): Partial<Lead> {
  return {
    project: form.project.trim(),
    steam_app_id: optionalText(form.steam_app_id),
    team: optionalText(form.team),
    country: form.country.trim() || "未知",
    city: optionalText(form.city),
    bucket: form.bucket,
    priority: priorityFromSelection(form.priority),
    genre: optionalText(form.genre),
    progress: form.progress.trim() || "待补充",
    publisher_status: form.publisher_status.trim() || "待确认",
    priority_reason: optionalText(form.priority_reason),
    rule_fit: optionalText(form.rule_fit),
    contact_methods: parseContacts(form.contacts),
    links: splitLines(form.links),
    bilibili_fit: "待评估",
    amplification: "待评估",
    verdict: optionalText(form.priority_reason) ?? "手动新增，待判断",
    notes: optionalText(form.notes)
  };
}

function parseContacts(value: string): ContactMethod[] {
  return splitLines(value).map((line) => {
    const [rawType, ...rest] = line.split(/[:：]/);
    const typedValue = rest.join(":").trim();
    const inferredType = normalizeContactType(rawType);
    return {
      type: typedValue ? inferredType : "其他",
      value: typedValue || line,
      note: null
    };
  });
}

function normalizeContactType(value: string): ContactType {
  const normalized = value.trim().toLowerCase();
  const direct = contactTypeOptions.find((type) => type.toLowerCase() === normalized);
  if (direct) return direct;
  if (normalized.includes("email") || normalized.includes("邮箱") || normalized.includes("mail")) return "Email";
  if (normalized.includes("微信") || normalized.includes("qq")) return "微信/QQ";
  if (normalized.includes("电话") || normalized.includes("tel") || normalized.includes("phone")) return "电话";
  if (normalized.includes("discord")) return "Discord";
  if (normalized.includes("steam")) return "Steam";
  if (normalized.includes("b站") || normalized.includes("bilibili")) return "B站";
  if (normalized.includes("twitter") || normalized === "x") return "X/Twitter";
  if (normalized.includes("官网") || normalized.includes("site") || normalized.includes("web")) return "官网";
  return "其他";
}

function splitLines(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function optionalText(value: string) {
  const nextValue = value.trim();
  return nextValue ? nextValue : null;
}

function TextField({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return <label className="field"><span>{label}{required ? " *" : ""}</span><input value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function TextareaField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="field span-2"><span>{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

function SelectField<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: T[]; onChange: (value: T) => void }) {
  return <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value as T)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}
