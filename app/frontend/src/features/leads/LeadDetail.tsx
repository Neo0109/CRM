import { AlertTriangle, CalendarCheck, CheckCircle2, ExternalLink, ListChecks, Plus, Save, Trash2, TrendingUp, XCircle } from "lucide-react";
import { useEffect, useState, type ReactElement } from "react";
import { LeadEvidencePanel } from "../../LeadEvidencePanel";
import type { Bucket, ContactMethod, ContactType, EvaluationGrade, Lead } from "../../types";
import { bucketClass, bucketValues, contactTypes, dropReasonOptions, evaluationGradeOptions, priorityFromSelection, priorityLabel, prioritySelection, prioritySelectionOptions, regionPriorityValues, regionValues, stageLabel, stageValues } from "./leadConstants";
import { Select, TextareaField, TextField } from "./leadControls";
import { applySteamLinkToLead, contactLabel, gameLinks, linkLabel, normalizeSteamLinkInput, normalizedLinkHref, visibleContacts, type NormalizedSteamLink } from "./leadLinks";
import { cleanHumanLeadText } from "./leadHumanFields";
import { buildLeadReviewChecklist, type LeadReviewChecklistItem } from "./leadReviewChecklist";
import { buildQuickActionSpecs, isTestingOverdue, reviewPatchForBucket, stageFromBucket, type QuickActionSpec } from "./leadWorkflow";

export function LeadDetail({ lead, onPatch, missingLinksMode }: { lead: Lead | null; onPatch: (id: string, patch: Partial<Lead>) => Promise<void>; missingLinksMode: boolean }) {
  const [draft, setDraft] = useState<Lead | null>(null);

  useEffect(() => {
    if (lead) setDraft({
      ...lead,
      contact_methods: [...lead.contact_methods],
      links: [...lead.links],
      priority_reason: cleanHumanLeadText(lead.priority_reason),
      next_action: cleanHumanLeadText(lead.next_action),
      notes: cleanHumanLeadText(lead.notes)
    });
  }, [lead]);

  if (!lead || !draft) return <aside className="detail-panel" data-detail-layout="pc-review-polish"><div className="empty-cell">{missingLinksMode ? "暂无缺链接 lead" : "暂无 lead"}</div></aside>;
  const activeLead = lead;
  const activeDraft = draft;

  function setField<K extends keyof Lead>(key: K, value: Lead[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  async function applySteamLink(normalized: NormalizedSteamLink) {
    const nextDraft = applySteamLinkToLead(activeDraft, normalized);
    setDraft(nextDraft);
    await onPatch(activeLead.id, nextDraft);
  }

  async function confirmCalendarReminder() {
    if (!activeDraft.due_date) {
      window.alert("请先选择 Due Date，再确认放入日历。");
      return;
    }
    const nextDraft = { ...activeDraft, calendar_enabled: true };
    setDraft(nextDraft);
    await onPatch(activeLead.id, { due_date: activeDraft.due_date, calendar_enabled: true });
  }

  const addContact = () => setField("contact_methods", [...draft.contact_methods, { type: "微信/QQ", value: "", note: null }]);
  const ensureContactDraft = () => {
    if (draft.contact_methods.some((method) => !method.value.trim())) return;
    addContact();
  };
  const updateContact = (index: number, patch: Partial<ContactMethod>) => setField("contact_methods", draft.contact_methods.map((method, methodIndex) => methodIndex === index ? { ...method, ...patch } : method));
  const removeContact = (index: number) => setField("contact_methods", draft.contact_methods.filter((_, methodIndex) => methodIndex !== index));
  const moveDraft = async (nextLead: Lead, bucket: Bucket) => {
    const patch = { bucket, stage: stageFromBucket(bucket), ...reviewPatchForBucket(bucket) };
    setDraft({ ...nextLead, ...patch });
    await onPatch(nextLead.id, patch);
  };
  const save = () => {
    const evaluationChanged = draft.evaluation_grade !== lead.evaluation_grade || draft.evaluation_result !== lead.evaluation_result;
    const nextDraft = evaluationChanged && (draft.evaluation_grade || draft.evaluation_result)
      ? { ...draft, evaluated_at: new Date().toISOString() }
      : draft;
    if (nextDraft !== draft) setDraft(nextDraft);
    return onPatch(lead.id, nextDraft);
  };
  const reviewChecklist = buildLeadReviewChecklist(draft);
  const showReviewActionPanel = reviewChecklist.some((item) => item.key !== "ready");

  return <aside className="detail-panel" data-detail-layout="pc-review-polish">
    <div className="detail-head">
      <div><p className="eyebrow">{draft.bucket} · {priorityLabel(draft.priority)} · {draft.review_status}</p><h2>{isTestingOverdue(draft) && <span className="overdue-marker" title="测试已超过两周未更新"><AlertTriangle size={16} /></span>}{draft.project}</h2></div>
      <button className="primary-button save-icon-button" type="button" onClick={save} aria-label="保存" title="保存"><Save size={18} /></button>
    </div>

    <QuickActions lead={draft} onPatch={onPatch} missingLinksMode={missingLinksMode} />
    <BucketButtons lead={draft} onMove={moveDraft} />

    <section className="review-command-card">
      <div className="review-command-summary">
        <div>
          <p className="eyebrow">评测结论</p>
          <h3>{leadDecisionHeadline(draft)}</h3>
          <p>{leadDecisionSummary(draft)}</p>
        </div>
        <span className={`grade-badge ${gradeClass(draft.evaluation_grade)}`}>{draft.evaluation_grade ?? "未评级"}</span>
      </div>
      <div className="review-command-form">
        <Select label="评级" value={draft.evaluation_grade ?? "未评级"} options={evaluationGradeOptions} onChange={(value) => setField("evaluation_grade", value === "未评级" ? null : value)} />
        <label className="field"><span>一句话评测结论</span><textarea value={draft.evaluation_result ?? ""} onChange={(event) => setField("evaluation_result", event.target.value || null)} /></label>
      </div>
      <div className="review-evidence-grid">
        {buildReviewEvidence(draft).map((item) => <div key={item.label}><small>{item.label}</small><strong>{item.value}</strong></div>)}
      </div>
    </section>

    <FollowUpActionPanel
      lead={draft}
      checklist={reviewChecklist}
      showChecklist={showReviewActionPanel}
      onAddContactRow={ensureContactDraft}
      onConfirmCalendarReminder={confirmCalendarReminder}
      onFieldChange={setField}
      onSave={save}
    />

    <EvidenceAndLinksPanel lead={draft} onApplySteamLink={applySteamLink} />

    <div className="form-section detail-section detail-section-core">
      <h3>核心复核</h3>
      <div className="form-grid two">
        <TextField label="项目名" value={draft.project} onChange={(value) => setField("project", value)} />
        <TextField label="团队" value={draft.team} onChange={(value) => setField("team", value)} />
        <TextField label="Steam AppID" value={draft.steam_app_id} onChange={(value) => setField("steam_app_id", value)} />
        <TextField label="团队规模" value={draft.team_size} onChange={(value) => setField("team_size", value)} />
        <Select label="地区" value={draft.region} options={regionValues} onChange={(value) => setField("region", value)} />
        <TextField label="国家/地区" value={draft.country} onChange={(value) => setField("country", value || "未知")} />
        <TextField label="城市" value={draft.city} onChange={(value) => setField("city", value)} />
        <Select label="区域优先级" value={draft.region_priority} options={regionPriorityValues} onChange={(value) => setField("region_priority", value)} />
      </div>
    </div>

    <div className="form-section detail-section detail-section-followup">
      <h3>商务状态</h3>
      <div className="form-grid two">
        <Select label="池子" value={draft.bucket} options={bucketValues} onChange={(value) => setDraft((current) => (current ? { ...current, bucket: value, stage: stageFromBucket(value), ...reviewPatchForBucket(value) } : current))} />
        <Select label="阶段" value={draft.stage} options={stageValues} getOptionLabel={stageLabel} onChange={(value) => setField("stage", value)} />
        <Select label="优先级" value={prioritySelection(draft.priority)} options={prioritySelectionOptions} onChange={(value) => setField("priority", priorityFromSelection(value))} />
        <TextField label="发售窗口" value={draft.release_window} onChange={(value) => setField("release_window", value)} />
        {(draft.bucket === "未处理" || draft.bucket === "淘汰池" || draft.drop_reason) ? <Select label="淘汰原因（若淘汰）" value={draft.drop_reason ?? "未选择"} options={dropReasonOptions} onChange={(value) => setField("drop_reason", value === "未选择" ? null : value)} /> : null}
      </div>
      <TextareaField label="优先级高/低的原因" value={draft.priority_reason} onChange={(value) => setField("priority_reason", value)} />
      <TextareaField label="备注" value={draft.notes} onChange={(value) => setField("notes", value)} />
    </div>

    <div className="form-section detail-section detail-section-contacts">
      <h3>联系方式</h3>
      <div className="contact-editor">
        {draft.contact_methods.map((method, index) => <div className="contact-row" key={`${method.type}-${index}`}>
          <select value={method.type} onChange={(event) => updateContact(index, { type: event.target.value as ContactType })}>{contactTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select>
          <input value={method.value} onChange={(event) => updateContact(index, { value: event.target.value })} placeholder="微信 / QQ / 邮箱 / 电话 / 官网 / Steam 社区" />
          <input value={method.note ?? ""} onChange={(event) => updateContact(index, { note: event.target.value || null })} placeholder="备注" />
          <button className="icon-button danger" onClick={() => removeContact(index)}><Trash2 size={15} /></button>
        </div>)}
        <button className="ghost-button" onClick={addContact}><Plus size={16} />添加联系方式</button>
      </div>
    </div>

    <div className="form-section detail-section detail-section-product">
      <h3>产品与发行</h3>
      <div className="form-grid two">
        <TextField label="类型" value={draft.genre} onChange={(value) => setField("genre", value)} />
        <TextField label="发行商" value={draft.publisher_name} onChange={(value) => setField("publisher_name", value)} />
      </div>
      <TextareaField label="玩法" value={draft.gameplay} onChange={(value) => setField("gameplay", value)} />
      <TextareaField label="进度" value={draft.progress} onChange={(value) => setField("progress", value || "待补充")} />
      <TextareaField label="发行结构" value={draft.publisher_status} onChange={(value) => setField("publisher_status", value || "待确认")} />
      <TextareaField label="B站适配度" value={draft.bilibili_fit} onChange={(value) => setField("bilibili_fit", value || "待评估")} />
      <TextareaField label="风险" value={draft.risks} onChange={(value) => setField("risks", value)} />
    </div>
    <div className="detail-floating-safe-zone" aria-hidden="true" />
  </aside>;
}

type LeadFieldSetter = <K extends keyof Lead>(key: K, value: Lead[K]) => void;

function FollowUpActionPanel({
  lead,
  checklist,
  showChecklist,
  onAddContactRow,
  onConfirmCalendarReminder,
  onFieldChange,
  onSave
}: {
  lead: Lead;
  checklist: LeadReviewChecklistItem[];
  showChecklist: boolean;
  onAddContactRow: () => void;
  onConfirmCalendarReminder: () => Promise<void>;
  onFieldChange: LeadFieldSetter;
  onSave: () => Promise<void>;
}) {
  const needsContact = hasChecklistItem(checklist, "missing-contact");
  const needsDueDate = hasChecklistItem(checklist, "missing-due-date");

  return <section className="review-action-panel followup-action-panel" aria-label="跟进动作">
    <div className="review-action-head">
      <div>
        <p className="eyebrow">跟进动作</p>
        <h3>只保留一个下一步，给 BD 明确落点</h3>
      </div>
      <button className="primary-button" type="button" onClick={() => void onSave()}><Save size={16} />保存跟进动作</button>
    </div>
    {showChecklist && <ul className="review-action-checklist">
      {checklist.map((item) => <li key={item.key}>
        <strong>{item.label}</strong>
        <span>{item.detail}</span>
      </li>)}
    </ul>}
    <div className="review-action-form">
      <TextField label="Owner" value={lead.owner} onChange={(value) => onFieldChange("owner", value || null)} />
      <TextField label="Due Date" type="date" value={lead.due_date} onChange={(value) => onFieldChange("due_date", value || null)} />
      <TextareaField label="下一步动作" value={lead.next_action} onChange={(value) => onFieldChange("next_action", value)} />
      {needsContact && <div className="review-action-field span-2">
        <button className="ghost-button" type="button" onClick={onAddContactRow}><Plus size={16} />添加联系方式行</button>
        <span>添加后可在下方“联系方式”区域填写微信、QQ、Email、官网或 Steam 社区入口。</span>
      </div>}
      <div className="due-date-actions span-2">
        <button className="ghost-button" type="button" onClick={() => void onConfirmCalendarReminder()}><CalendarCheck size={16} />确认放入日历</button>
        {lead.calendar_enabled && lead.due_date ? <span>已在日历显示：{lead.due_date}</span> : <span>只有点确认后才会进入日历，避免页面被系统自动塞满。</span>}
      </div>
    </div>
    {needsDueDate && <p className="review-action-note">Due Date 可以先在详情里设置；是否进入日历仍由“确认放入日历”手动控制。</p>}
  </section>;
}

function hasChecklistItem(checklist: LeadReviewChecklistItem[], key: LeadReviewChecklistItem["key"]) {
  return checklist.some((item) => item.key === key);
}

function EvidenceAndLinksPanel({ lead, onApplySteamLink }: { lead: Lead; onApplySteamLink: (link: NormalizedSteamLink) => Promise<void> }) {
  return <section className="form-section detail-section detail-section-evidence-links">
    <h3>证据与链接</h3>
    <LeadEvidencePanel lead={lead} />
    <SteamLinkEditor lead={lead} onApply={onApplySteamLink} />
  </section>;
}

export function QuickActions({ lead, onPatch, compact = false, missingLinksMode = false }: { lead: Lead; onPatch: (id: string, patch: Partial<Lead>) => Promise<void>; compact?: boolean; missingLinksMode?: boolean }) {
  const specs = buildQuickActionSpecs(lead, { missingLinksMode });
  return <div className={compact ? "quick-actions compact" : "quick-actions"} data-fixed-actions="native-pipeline" data-action-count={specs.length} onClick={(event) => event.stopPropagation()}>
    {specs.map((spec) => (
      <button key={spec.key} className={`quick-button ${spec.tone}`} data-action-label={compact ? spec.compactLabel : undefined} title={spec.title} aria-label={spec.title} onClick={() => void onPatch(lead.id, spec.patch)}>
        {quickActionIcon(spec)}
        <span className={compact ? "visually-hidden" : ""}>{spec.label}</span>
      </button>
    ))}
  </div>;
}

export function ContactChips({ contacts, links }: { contacts: ContactMethod[]; links: string[] }) {
  const contactChips = visibleContacts(contacts).slice(0, 3).map((method, index) => ({
    href: isHttpUrl(method.value) ? normalizedLinkHref(method.value) : null,
    key: `contact-${method.value}-${index}`,
    label: contactLabel(method),
    title: `${method.type}: ${method.value}`
  }));
  const usedLabels = new Set(contactChips.map((chip) => chip.label));
  const linkChips = gameLinks(links).map((link, index) => ({
    href: normalizedLinkHref(link),
    key: `link-${link}-${index}`,
    label: linkLabel(link),
    title: link
  })).filter((chip) => {
    if (usedLabels.has(chip.label)) return false;
    usedLabels.add(chip.label);
    return true;
  }).slice(0, 2);
  const displayChips = [...contactChips, ...linkChips];
  if (!displayChips.length) return <span className="muted">待补充</span>;
  return <div className="chip-list contact-chip-list">{displayChips.map((chip) => (
    chip.href
      ? <a className="chip contact-chip-link" key={chip.key} href={chip.href} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} title={chip.title}><ExternalLink size={12} /><span className="chip-label">{chip.label}</span></a>
      : <span className="chip" key={chip.key} title={chip.title}><span className="chip-label">{chip.label}</span></span>
  ))}</div>;
}

function BucketButtons({ lead, onMove, compact = false }: { lead: Lead; onMove: (lead: Lead, bucket: Bucket) => Promise<void>; compact?: boolean }) {
  return <div className={compact ? "bucket-actions compact" : "bucket-actions"} onClick={(event) => event.stopPropagation()}>
    {bucketValues.map((bucket) => <button key={bucket} className={`bucket-button ${bucketClass(bucket)} ${lead.bucket === bucket ? "active" : ""}`} onClick={() => void onMove(lead, bucket)} disabled={lead.bucket === bucket}>{bucket}</button>)}
  </div>;
}

function SteamLinkEditor({ lead, onApply }: { lead: Lead; onApply: (link: NormalizedSteamLink) => Promise<void> }) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const links = gameLinks(lead.links);

  useEffect(() => setValue(""), [lead.id]);

  async function handleApply() {
    const normalized = normalizeSteamLinkInput(value);
    if (!normalized) {
      window.alert("请粘贴 Steam 商店/SteamDB/Steam 社区链接，或者直接输入 Steam AppID");
      return;
    }

    try {
      setSaving(true);
      await onApply(normalized);
      setValue("");
    } finally {
      setSaving(false);
    }
  }

  return <div className="steam-link-editor">
    <div className="steam-link-copy">
      <strong>Steam 链接补录</strong>
      <span>粘贴 Steam 商店、SteamDB、Steam 社区链接，或直接填 AppID；保存后左侧会出现 Steam / SteamDB 跳转标签。</span>
    </div>
    <div className="steam-link-input-row">
      <input value={value} onChange={(event) => setValue(event.target.value)} placeholder="https://store.steampowered.com/app/... 或 AppID" />
      <button className="ghost-button" onClick={handleApply} disabled={saving}>{saving ? "保存中" : "补录并保存"}</button>
    </div>
    {links.length > 0 && <div className="chip-list current-steam-links">{links.map((link) => <a className="chip contact-chip-link" key={link} href={normalizedLinkHref(link)} target="_blank" rel="noreferrer"><ExternalLink size={12} /><span className="chip-label">{linkLabel(link)}</span></a>)}</div>}
  </div>;
}

function quickActionIcon(spec: QuickActionSpec): ReactElement {
  if (spec.key === "testing") return <CalendarCheck size={15} />;
  if (spec.key === "follow") return <CheckCircle2 size={15} />;
  if (spec.key === "push") return <TrendingUp size={15} />;
  if (spec.key === "drop") return <XCircle size={15} />;
  return <ListChecks size={15} />;
}

function leadDecisionHeadline(lead: Lead) {
  if (lead.bucket === "推进池") return "已进入深度商务推进";
  if (lead.bucket === "跟进中") return "值得继续商务跟进";
  if (lead.bucket === "测试中") return "等待测试结论定级";
  if (lead.bucket === "待评测") return "先拿运营/测试判断";
  if (lead.bucket === "淘汰池") return "已淘汰，保留反例";
  if (lead.bucket === "观察池") return "保留信号，暂缓推进";
  return "等待人工首轮判断";
}

function leadDecisionSummary(lead: Lead) {
  return firstText([
    lead.evaluation_result,
    lead.priority_reason,
    lead.bilibili_fit,
    lead.next_action
  ], "还没有形成评审结论，先完成实机/运营测试；不成立就淘汰，成立后再补商务判断。");
}

function buildReviewEvidence(lead: Lead) {
  return [
    { label: "产品亮点", value: firstText([lead.priority_reason, lead.gameplay, lead.genre], "待补充玩法钩子、视觉或数据亮点。") },
    { label: "B站适配", value: firstText([lead.bilibili_fit], "待判断直播、切片、二创或 UP 主传播空间。") },
    { label: "商务可行", value: firstText([lead.publisher_status, `${lead.region_priority} · ${lead.release_window ?? "窗口待确认"}`], "待确认团队地区、发行空位和发售窗口。") },
    { label: "风险反证", value: firstText([lead.risks], "待补充为什么不该推进，避免只看亮点。") }
  ];
}

function firstText(values: Array<string | null | undefined>, fallback: string) {
  const value = values.find((item) => item && item.trim());
  return value ? truncateText(value.trim(), 76) : fallback;
}

function truncateText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function gradeClass(grade: EvaluationGrade | null) {
  if (!grade) return "grade-empty";
  return `grade-${grade.toLowerCase().replace("+", "plus").replace("-", "minus")}`;
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
