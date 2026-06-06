import { ExternalLink, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { buildLeadEvidence } from "./leadEvidence";
import type { Lead } from "./types";

export function LeadEvidencePanel({ lead }: { lead: Lead }) {
  const evidence = buildLeadEvidence(lead);
  const Icon = evidence.tone === "complete" ? ShieldCheck : evidence.tone === "risk" ? ShieldAlert : ShieldQuestion;

  return <section className={`lead-evidence-panel ${evidence.tone}`} aria-label="线索证据链与可信度">
    <div className="lead-evidence-head">
      <div>
        <p className="eyebrow">证据链 / 可信度</p>
        <h3><Icon size={18} />{evidence.status}</h3>
        <p>{evidence.summary}</p>
      </div>
      <span className={`evidence-status-pill ${evidence.tone}`}>{evidence.status}</span>
    </div>

    <div className="evidence-flags">
      {evidence.flags.map((flag) => <span className={`evidence-flag ${flag.tone}`} key={flag.label}>{flag.label}</span>)}
    </div>

    <div className="evidence-grid">
      {evidence.rows.map((row) => <div className={`evidence-row ${row.tone}`} key={row.label}>
        <small>{row.label}</small>
        <strong>{row.value}</strong>
      </div>)}
    </div>

    {evidence.links.length > 0 && <div className="evidence-links">
      {evidence.links.map((link) => <a key={`${link.label}-${link.url}`} href={link.url} target="_blank" rel="noreferrer">
        <ExternalLink size={12} />
        {link.label}
      </a>)}
    </div>}
  </section>;
}
