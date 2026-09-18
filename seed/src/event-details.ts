import type { Attachment } from "../../src/db/json-types";

/** Agendas and attachments per calendar event key (meeting keys and upcoming-event keys). */
const brief = (title: string, body: string): Attachment => ({ title, kind: "doc", url: "", body });
const link = (title: string, kind: Attachment["kind"], url: string): Attachment => ({ title, kind, url });

const SSO_ONE_PAGER = brief(
  "SSO vs Jira one-pager (Daniel)",
  `Recommendation: SAML SSO first (Okta + Azure AD, audit logs), full Jira integration in Q1, one-way "create Jira issue" button now.

Why: $420K ACV (Globex $260K, Arcadia $160K) is blocked on SAML. Jira: 11 accounts asked, ~2 churned.
Effort: SSO 2 engineers x 4-5 weeks. Jira 2 x 4 weeks. Button ~1.5 weeks.
Risks: Azure AD quirks; need real test tenants. SCIM deferred.`,
);
const EVAL_SHEET = brief(
  "Clustering eval sheet (Priya)",
  `Precision on labeled set (800 comments): August pilot 71% -> re-ranking 78% -> new embeddings 79%. GA bar: 85%.
Failure modes: merged distinct billing problems; overly broad themes ("the app is slow"); ~4% unsupported summary sentences (dropped).
Next: 2,000-comment labeled set incl. retail + healthcare; merge/split feedback from beta.`,
);

export const eventDetails: Record<string, { agenda?: string; attachments?: Attachment[] }> = {
  "q4-product-alignment": {
    agenda: "1. Customer signal (Tom, Aisha)\n2. Clustering model status (Priya)\n3. Capacity (Raj)\n4. Themes-first dashboard (Marcus)\n5. SSO vs Jira (Daniel)\n6. Launch plan (Elena)\n7. Owners and dates",
    attachments: [SSO_ONE_PAGER, EVAL_SHEET, brief("Dashboard v3 notes (Marcus)", "Home = Themes (ranked by volume + growth), 3 quotes per card, neutral trend arrows + sentiment dot, merge/split buttons in theme detail, empty state below ~200 comments with Zendesk import.")],
  },
  "globex-security-review": {
    agenda: "Globex security review: SAML/Okta enforcement, audit logs and retention, AI data handling, timeline.",
    attachments: [brief("Globex security questionnaire (answers draft)", "SSO: in development (Okta, Azure AD). Audit logs: logins, exports, role/settings changes, deletions; 1-year retention; CSV + API export.\nData: US-hosted, encrypted at rest and in transit. AI provider: no training, no retention; emails and phone numbers redacted.")],
  },
  "pricing-ai-usage-caps": {
    agenda: "Agree the AI pricing proposal for leadership: options A (Pro + cap), B (add-on), C (per seat).",
    attachments: [{ ...brief("AI cost model (Helen)", "Median workspace: $1.80/month AI cost. Largest pilot: $14/month. ~all cost is theme summaries. Cap at 50K comments/month -> worst-case Pro ~$9/month. Target gross margin 80%."), kind: "sheet" }],
  },
  "launch-planning-insights": { agenda: "Draft Insights 2.0 launch plan for the alignment meeting: phases, design partner program, GA stories." },
  "postmortem-ingest-delay": {
    agenda: "Blameless review: timeline, what went well, what went badly, owned follow-ups.",
    attachments: [brief("Incident timeline (Sam)", "09:12 index migration on events takes lock\n13:40 Brightline reports missing feedback\n13:52 migration killed, lock released\n15:15 queue drained. 212 workspaces affected, no data lost.")],
  },
  "up-go-no-go": {
    agenda: "Decide whether the Insights 2.0 private beta ships.\n- Precision report on the 2,000-comment set (Priya)\n- Incremental assignment latency, p95 < 3s (Raj)\n- Design partner shortlist (Tom)\n- Beta invite + messaging (Elena)",
    attachments: [EVAL_SHEET, brief("Design partner shortlist (Tom)", "Lakeshore Bank, Kestrel Logistics, Brightline Retail, Harbor & Pine, + 16 more. Healthcare partners join after PII redaction ships.")],
  },
  "up-globex-saml": { agenda: "Walk Globex through the SAML design and commit a written date.", attachments: [SSO_ONE_PAGER] },
  "up-pricing-leadership": {
    agenda: "Review the AI usage-caps proposal: Pro includes summaries up to 50K comments/month; clustering unlimited; Business uncapped.",
    attachments: [brief("AI pricing proposal (Maya)", "Recommendation: AI included in Pro. Summaries capped at 50K comments/month (backfill excluded, 80% warning, monthly reset). Worst-case Pro AI cost ~$9/month keeps >80% margin. No per-seat pricing.")],
  },
  "up-security-review": { agenda: "SAML security design review before build: JIT provisioning, enforce-SSO + break-glass, audit log events.", attachments: [SSO_ONE_PAGER] },
  "up-kestrel-kickoff": { agenda: "Design partner kickoff: goals, weekly check-in, Zendesk + app review connectors, success criteria." },
  "up-cab": { agenda: "Quarterly Customer Advisory Board: Insights 2.0 themes preview, roadmap Q&A, feedback round." },
  "up-interview-staff-data": { agenda: "System design (ingest + clustering), past projects, questions.", attachments: [link("Candidate resume (Kwame Mensah)", "pdf", "https://example.com/resume.pdf")] },
};
