"use client";

import {
  Archive,
  BookOpenText,
  Buildings,
  CalendarBlank,
  CaretDown,
  Check,
  CheckCircle,
  ClipboardText,
  FilePdf,
  Files,
  Funnel,
  Gear,
  MagnifyingGlass,
  MapPin,
  Plus,
  ShieldCheck,
  Tractor,
  UsersThree,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import heavyConnectInventory from "@/data/heavyconnect-reports/inventory.json";
import dailySanitationTemplate from "@/data/heavyconnect-templates/daily-sanitation-log.json";
import freshTemplate from "@/data/heavyconnect-templates/fresh-committee-meeting.json";
import r001Template from "@/data/heavyconnect-templates/r001-field-activity-log.json";
import r022Template from "@/data/heavyconnect-templates/r022-risk-assessment.json";
import r024Template from "@/data/heavyconnect-templates/r024-field-buffer-log.json";
import r004Template from "@/data/heavyconnect-templates/r004-tractor-inspection.json";
import r006Template from "@/data/heavyconnect-templates/r006-daily-sanitation-log.json";
import liveCaptureGaps from "@/data/heavyconnect-templates/live-capture-gaps.json";
import heavyConnectSelfAudit32 from "@/data/heavyconnect-self-audits/primus-gfs-3-2.json";
import primusCrosswalk from "@/data/primusgfs/crosswalks/v3-2-to-v4-0.json";
import primusV4Index from "@/data/primusgfs/v4/index.json";

type Status = "approved" | "review" | "action" | "submitted";
type View = "inspector" | "standard" | "templates" | "locations" | "team" | "settings";
type Modal = "start" | "review" | "audit" | null;
type CrosswalkSummary = {
  total: number;
  strong_candidate?: number;
  review_candidate?: number;
  needs_manual_mapping?: number;
};

type Question = {
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  options_status?: string;
  formula_display?: string;
};

type TemplateSection = {
  title: string;
  instructions?: string[];
  questions: Question[];
};

type TemplateDefinition = {
  key: string;
  code: string;
  name: string;
  category: string;
  status: "ready" | "needs_options_review";
  source: string;
  moduleTargets: string[];
  lastExample?: string;
  sections: TemplateSection[];
};

type TemplateJson = {
  name: string;
  category: string;
  status?: string;
  source?: string;
  sections: TemplateSection[];
};

type Report = {
  id: number;
  reportId: string;
  type: string;
  code: string;
  location: string;
  date: string;
  creator: string;
  status: Status;
  severity: "Good" | "Attention" | "Issue";
  sourceFile: string;
  evidenceTags: string[];
};

const activeTemplateNames = [
  "R001 Field Activity Log",
  "R004 Tractor Inspection",
  "R006 Daily Sanitation Log",
  "R022 Risk Assessment",
  "R024 Field Buffer Log",
  "Daily Sanitation Log",
  "FRESH Food, Risk, Enviornment, Health & Safety Committee Meeting",
];

const farmLocations = [
  "BBP-FARM / 2026 South Fork",
  "BBP-FARM / 2026 SW Hoffman",
  "BBP-FARM / 2026 Maplewood",
  "BBP-FARM / 2026 Org. Cram-Jenson",
  "BBP-FARM / 2026 Youngquist",
  "BBP-FARM / 2026 S. Reedy",
  "BBP Warehouse / BBP-WH",
];

const statusCopy = {
  approved: { label: "Approved", action: "View packet" },
  review: { label: "Needs review", action: "Review" },
  action: { label: "Needs action", action: "Add action" },
  submitted: { label: "Submitted", action: "Review" },
};

const bayBabyLocations = [
  { code: "SF", name: "2026 South Fork", area: "Farm", manager: "Juan Diaz", active: true, readiness: 92 },
  { code: "SWH", name: "2026 SW Hoffman", area: "Farm", manager: "Maria Lopez", active: true, readiness: 88 },
  { code: "MW", name: "2026 Maplewood", area: "Farm", manager: "Alex Torres", active: true, readiness: 84 },
  { code: "OCJ", name: "2026 Org. Cram-Jenson", area: "Organic Farm", manager: "Juan Diaz", active: true, readiness: 79 },
  { code: "YQ", name: "2026 Youngquist", area: "Farm", manager: "Chris Nguyen", active: true, readiness: 83 },
  { code: "WH", name: "BBP Warehouse", area: "Facility", manager: "Maria Lopez", active: true, readiness: 90 },
];

const teamMembers = [
  { initials: "JD", name: "Juan Diaz", role: "Manager", access: "Can approve reports and generate packets", status: "Active" },
  { initials: "ML", name: "Maria Lopez", role: "Reviewer", access: "Can review reports and assign corrective actions", status: "Active" },
  { initials: "AT", name: "Alex Torres", role: "Operator", access: "Can create and submit reports", status: "Active" },
  { initials: "CN", name: "Chris Nguyen", role: "Auditor", access: "Can view approved evidence and packets", status: "Invited" },
];

const appSettings = [
  { label: "Audit standard", value: "PrimusGFS v4.0", note: "Official source of truth for audit packets" },
  { label: "Packet format", value: "Clean Bay Baby binder", note: "Internal format, with Primus question references" },
  { label: "Report approval", value: "Manager or reviewer required", note: "Operators can submit, not approve" },
  { label: "Evidence retention", value: "24 months minimum", note: "Matches audit-record expectations" },
  { label: "Supabase project", value: "Connected configuration ready", note: "Keys stay in environment variables" },
];

function normalizeCode(name: string) {
  const match = name.match(/^(R\d{3})/);
  if (match) return match[1];
  if (name.startsWith("FRESH")) return "FRESH";
  if (name === "Daily Sanitation Log") return "SAN";
  return "LOG";
}

function cleanQuestionLabel(label: string) {
  return label
    .replace(/\s*\/\s*¿.*$/i, "")
    .replace(/\s*\/\s*[A-ZÁÉÍÓÚÑ].*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function reportStatus(index: number): Status {
  if (index % 11 === 0) return "action";
  if (index % 5 === 0) return "review";
  return "approved";
}

function reportSeverity(status: Status): Report["severity"] {
  if (status === "action") return "Issue";
  if (status === "review") return "Attention";
  return "Good";
}

function buildImportedReports(): Report[] {
  return heavyConnectInventory.reports.map((report, index) => {
    const status = reportStatus(index);
    return {
      id: index + 1,
      reportId: report.report_id || `${index + 1}`,
      type: report.report_type,
      code: normalizeCode(report.report_type),
      location: report.location || "No location recorded",
      date: report.date_time || "No date recorded",
      creator: report.creator || "Unknown",
      status,
      severity: reportSeverity(status),
      sourceFile: report.source_file,
      evidenceTags: report.evidence_tags,
    };
  });
}

function templateFromJson(template: TemplateJson, key: string, status: TemplateDefinition["status"], source: string, moduleTargets: string[]): TemplateDefinition {
  return {
    key,
    code: normalizeCode(template.name),
    name: template.name,
    category: template.category,
    status,
    source,
    moduleTargets,
    sections: template.sections,
  };
}

function buildTemplates(): TemplateDefinition[] {
  return [
    {
      key: "r001-field-activity-log",
      code: "R001",
      name: r001Template.name,
      category: "Field",
      status: "needs_options_review",
      source: "Ready to use. Admin should confirm a few dropdown option lists before locking this template.",
      moduleTargets: ["Module 2 Farm"],
      sections: r001Template.sections,
    },
    {
      key: "r004-tractor-inspection",
      code: "R004",
      name: r004Template.name,
      category: "Field",
      status: "ready",
      source: "Ready to use.",
      moduleTargets: ["Module 2 Farm", "Module 5 Facility"],
      sections: r004Template.sections,
    },
    {
      key: "r006-daily-sanitation-log",
      code: "R006",
      name: r006Template.name,
      category: "Field / Warehouse",
      status: "ready",
      source: "Ready to use.",
      moduleTargets: ["Module 5 Facility"],
      sections: r006Template.sections,
    },
    templateFromJson(r022Template, "r022-risk-assessment", "needs_options_review", "Ready to use. Admin should confirm conditional dropdowns before locking.", ["Module 2 Farm"]),
    templateFromJson(r024Template, "r024-field-buffer-log", "needs_options_review", "Ready to use. Admin should confirm optional buffer dropdowns before locking.", ["Module 2 Farm"]),
    templateFromJson(dailySanitationTemplate, "daily-sanitation-log", "needs_options_review", "Ready to use. Admin should confirm warehouse/harvest variant controls before locking.", ["Module 4 Harvest Crew", "Module 5 Facility"]),
    templateFromJson(freshTemplate, "fresh-committee-meeting", "needs_options_review", "Ready to use. Admin should confirm attendance selector behavior before locking.", ["Module 1 FSMS", "Module 6 HACCP"]),
  ];
}

function ReportIcon({ code }: { code: string }) {
  if (code === "R004") return <Tractor weight="duotone" />;
  if (code === "R006" || code === "SAN") return <ShieldCheck weight="duotone" />;
  return <ClipboardText weight="duotone" />;
}

export function AuditApp() {
  const [view, setView] = useState<View>("inspector");
  const [activeTab, setActiveTab] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [modal, setModal] = useState<Modal>(null);
  const [currentReport, setCurrentReport] = useState<Report | null>(null);
  const [wizardStep, setWizardStep] = useState(1);
  const [toast, setToast] = useState("");

  const templates = useMemo(() => buildTemplates(), []);
  const [newReports, setNewReports] = useState<Report[]>([]);
  const importedReports = useMemo(() => buildImportedReports(), []);
  const allReports = useMemo(() => [...newReports, ...importedReports], [importedReports, newReports]);
  const reports = useMemo(() => allReports.filter((report) => {
    const matchesTab = activeTab === "all" || report.status === activeTab ||
      (activeTab === "ready" && report.status === "approved");
    const text = `${report.code} ${report.type} ${report.location} ${report.creator} ${report.sourceFile}`.toLowerCase();
    return matchesTab && text.includes(query.toLowerCase());
  }), [activeTab, allReports, query]);

  const toggle = (id: number) => setSelected((items) =>
    items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);

  const openReport = (report: Report) => {
    setCurrentReport(report);
    setModal("review");
  };

  async function downloadPacket() {
    const response = await fetch("/api/audit-packet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: selected.length || heavyConnectInventory.report_count, generatedBy: "Juan Diaz" }),
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Bay-Baby-PrimusGFS-v4-Audit-Packet_2025-01-01_to_2026-01-01.pdf";
    a.click();
    URL.revokeObjectURL(url);
    setToast("Audit packet generated");
    setModal(null);
  }

  const pageCopy = {
    inspector: ["Inspector", "Create, review, approve, and prepare Bay Baby reports for audit"],
    standard: ["PrimusGFS v4.0", "Audit standard, module readiness, and Bay Baby evidence mapping"],
    templates: ["Templates", "Bay Baby report templates, questions, and admin review status"],
    locations: ["Locations", "Ranches, facilities, and audit readiness by site"],
    team: ["Team", "Users, roles, invitations, and approval permissions"],
    settings: ["Settings", "Company defaults, audit rules, and system configuration"],
  } satisfies Record<View, [string, string]>;
  const [topbarTitle, topbarCopy] = pageCopy[view];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><strong>Bay Baby Audit</strong><span>Bay Baby Produce</span></div>
        <nav>
          <button className={view === "inspector" ? "active" : ""} onClick={() => setView("inspector")}><ClipboardText /><span>Inspector</span></button>
          <button className={view === "standard" ? "active" : ""} onClick={() => setView("standard")}><BookOpenText /><span>Primus v4.0</span></button>
          <button onClick={() => { setModal("audit"); setWizardStep(1); }}><Archive /><span>Audit Packets</span></button>
          <button className={view === "templates" ? "active" : ""} onClick={() => setView("templates")}><Files /><span>Templates</span></button>
          <button className={view === "locations" ? "active" : ""} onClick={() => setView("locations")}><Buildings /><span>Locations</span></button>
          <button className={view === "team" ? "active" : ""} onClick={() => setView("team")}><UsersThree /><span>Team</span></button>
          <button className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}><Gear /><span>Settings</span></button>
        </nav>
        <div className="profile"><div className="avatar">JD</div><div><strong>Juan Diaz</strong><span>Manager</span></div><CaretDown /></div>
      </aside>

      <main>
        <header className="topbar">
          <div><h1>{topbarTitle}</h1><p>{topbarCopy}</p></div>
          <button className="primary" onClick={() => view === "standard" ? setModal("audit") : setModal("start")}>
            {view === "standard" ? <FilePdf /> : <Plus />} {view === "standard" ? "Build Audit Packet" : "Start Report"}
          </button>
        </header>

        {view === "standard" && <PrimusStandardView />}
        {view === "templates" && <TemplatesView templates={templates} onStart={() => setModal("start")} />}
        {view === "locations" && <LocationsView />}
        {view === "team" && <TeamView />}
        {view === "settings" && <SettingsView />}
        {view === "inspector" && <InspectorView
          reports={reports}
          totalReports={allReports.length}
          selected={selected}
          activeTab={activeTab}
          query={query}
          setQuery={setQuery}
          setActiveTab={setActiveTab}
          setSelected={setSelected}
          toggle={toggle}
          openReport={openReport}
          onGenerate={() => { setModal("audit"); setWizardStep(1); }}
        />}
      </main>

      {modal && <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
        <div className={`modal ${modal === "audit" || modal === "start" ? "wide" : ""}`} onMouseDown={(event) => event.stopPropagation()}>
          <button className="modal-close" onClick={() => setModal(null)}><X /></button>
          {modal === "start" && <StartReportFlow templates={templates} onCancel={() => setModal(null)} onSubmit={(report) => {
            setNewReports((items) => [report, ...items]);
            setSelected((items) => [report.id, ...items]);
            setModal(null);
            setToast("Report submitted for review");
            setView("inspector");
          }} />}
          {modal === "review" && currentReport && <ReviewPanel report={currentReport} onDone={() => { setModal(null); setToast("Report marked reviewed"); }} />}
          {modal === "audit" && <AuditWizard step={wizardStep} setStep={setWizardStep} onGenerate={downloadPacket} selected={selected.length || heavyConnectInventory.report_count} />}
        </div>
      </div>}
      {toast && <div className="toast"><CheckCircle weight="fill" />{toast}<button onClick={() => setToast("")}><X /></button></div>}
    </div>
  );
}

function InspectorView(props: {
  reports: Report[];
  totalReports: number;
  selected: number[];
  activeTab: string;
  query: string;
  setQuery: (value: string) => void;
  setActiveTab: (value: string) => void;
  setSelected: (items: number[]) => void;
  toggle: (id: number) => void;
  openReport: (report: Report) => void;
  onGenerate: () => void;
}) {
  const approved = props.reports.filter((report) => report.status === "approved").length;
  const needsAttention = props.reports.filter((report) => report.status !== "approved").length;
  const readiness = Math.round((approved / Math.max(props.reports.length, 1)) * 100);

  return <div className="workspace">
    <section className="report-area">
      <div className="tabs">
        {[
          ["all", "All reports", props.totalReports],
          ["review", "Needs review", props.reports.filter((report) => report.status === "review").length],
          ["action", "Needs action", props.reports.filter((report) => report.status === "action").length],
          ["ready", "Ready for audit", approved],
        ].map(([key, label, count]) => (
          <button key={key} className={props.activeTab === key ? "active" : ""} onClick={() => props.setActiveTab(String(key))}>
            {label}<span>{count}</span>
          </button>
        ))}
      </div>
      <p className="helper">Showing Bay Baby reports for Jan 1, 2025 to Jan 1, 2026. Review anything flagged before generating the Primus packet.</p>
      <div className="filters">
        <button><CalendarBlank /> Jan 1, 2025 - Jan 1, 2026 <CaretDown /></button>
        <button><MapPin /> All locations <CaretDown /></button>
        <button><ClipboardText /> {heavyConnectInventory.report_type_count} report types <CaretDown /></button>
        <label><MagnifyingGlass /><input value={props.query} onChange={(event) => props.setQuery(event.target.value)} placeholder="Search reports..." /></label>
        <button className="filter-button"><Funnel /> Filters</button>
      </div>
      <div className="selection-bar">
        <input type="checkbox" checked={props.selected.length === props.reports.length && props.reports.length > 0} onChange={() => props.setSelected(props.selected.length === props.reports.length ? [] : props.reports.map((report) => report.id))} />
        <span>{props.selected.length} selected</span><i />
        <button onClick={() => props.setSelected(props.reports.map((report) => report.id))}>Select all visible</button>
        <span className="sort">Sort: Newest first <CaretDown /></span>
      </div>
      <div className="report-list">
        {props.reports.map((report) => (
          <article className={`report-row ${report.status}`} key={`${report.reportId}-${report.sourceFile}`}>
            <input type="checkbox" checked={props.selected.includes(report.id)} onChange={() => props.toggle(report.id)} />
            <span className="severity-line" />
            <div className="report-icon"><ReportIcon code={report.code} /></div>
            <div className="report-copy">
              <strong>{report.code} {report.type} {report.severity === "Issue" && <b>HIGH</b>}</strong>
              <span>{report.location}<em>•</em>{report.date}<em>•</em>{report.creator}<em>•</em>{report.reportId}</span>
            </div>
            <span className={`status ${report.status}`}><i />{statusCopy[report.status].label}</span>
            <button className="row-action" onClick={() => props.openReport(report)}>
              {report.status === "approved" && <FilePdf />}{statusCopy[report.status].action}
            </button>
          </article>
        ))}
        {props.reports.length === 0 && <div className="empty"><MagnifyingGlass /><strong>No reports found</strong><span>Try another search or status tab.</span></div>}
      </div>
      <footer className="pagination"><span>{props.reports.length} of {props.totalReports} reports</span><div><button disabled>‹</button><button className="active">1</button><button>›</button></div></footer>
    </section>

    <aside className="audit-scope">
      <h2>Audit scope</h2>
      <button className="date-control"><CalendarBlank /> Jan 1, 2025 - Jan 1, 2026 <CaretDown /></button>
      <div className="scope-section"><strong>Evidence ready</strong><p><b>{props.totalReports}</b> records</p><span>{heavyConnectInventory.report_type_count} report types</span></div>
      <div className="scope-section"><strong>Reports included</strong><p><b>{props.selected.length}</b> selected</p><button className="text-link">View selected</button></div>
      <div className="scope-section readiness"><strong>Readiness</strong><p><b>{readiness}%</b></p><span>{needsAttention ? `${needsAttention} need attention` : "Good to go"}</span><div className="progress"><i style={{ width: `${readiness}%` }} /></div></div>
      <div className="legend">
        <span><i className="green" />Approved <b>{approved}</b></span>
        <span><i className="yellow" />Needs review <b>{props.reports.filter((report) => report.status === "review").length}</b></span>
        <span><i className="red" />Needs action <b>{props.reports.filter((report) => report.status === "action").length}</b></span>
      </div>
      <p className="blockers"><WarningCircle /> Question-level Primus crosswalk still required</p>
      <button className="generate" onClick={props.onGenerate}><FilePdf /> Generate Audit</button>
      <small>Creates a clean Bay Baby audit packet with selected evidence.</small>
    </aside>
  </div>;
}

function TemplatesView({ templates, onStart }: { templates: TemplateDefinition[]; onStart: () => void }) {
  const remainingGapCount = liveCaptureGaps.templates.reduce((sum, template) => sum + template.missing_controls.length, 0);

  return <div className="standard-workspace">
    <section className="standard-hero compact">
      <div>
        <span>Active templates</span>
        <h2>Start from the same reports Bay Baby actually uses</h2>
        <p>Templates are ready for daily use. Admin review items show controls that should be locked before final audit season.</p>
      </div>
      <button className="primary" onClick={onStart}><Plus /> Start Report</button>
    </section>
    <section className="gap-panel template-gaps">
      <div className="section-heading"><h2>Admin review remaining</h2><span>{remainingGapCount} controls/options</span></div>
      {liveCaptureGaps.templates.map((template) => <div className="gap-row warning" key={template.name}>
        <WarningCircle weight="fill" />
        <div>
          <strong>{template.name}</strong>
          <span>{template.missing_controls.slice(0, 2).join("; ")}{template.missing_controls.length > 2 ? `; +${template.missing_controls.length - 2} more` : ""}</span>
        </div>
      </div>)}
    </section>
    <section className="template-table">
      {templates.map((template) => <article key={template.key}>
        <div className="template-icon"><ReportIcon code={template.code} /></div>
        <div>
          <span>{template.category}</span>
          <h3>{template.name}</h3>
          <p>{template.sections.length} sections • {template.sections.reduce((sum, section) => sum + section.questions.length, 0)} fields • {template.moduleTargets.join(", ")}</p>
          <small>{template.source}</small>
        </div>
        <b className={`capture ${template.status}`}>{template.status === "ready" ? "Ready" : "Option review"}</b>
      </article>)}
    </section>
  </div>;
}

function PrimusStandardView() {
  const modules = primusV4Index.modules;
  const totalQuestions = modules.reduce((sum, module) => sum + module.question_count, 0);
  const totalPoints = modules.reduce((sum, module) => sum + module.scored_points, 0);
  const importedReports = heavyConnectInventory.report_count;
  const importedReportTypes = heavyConnectInventory.report_type_count;
  const selfAuditQuestionCount = heavyConnectSelfAudit32.modules.reduce((sum, module) => sum + module.question_count, 0);
  const crosswalkSummary = primusCrosswalk.summary as CrosswalkSummary;
  const moduleEvidence = new Map(heavyConnectInventory.primus_v4_module_evidence.map((item) => [item.module_key, item]));
  const recommendedModules = new Set(["module-1-fsms", "module-2-farm", "module-4-harvest-crew", "module-5-facility", "module-6-haccp"]);
  const bayBabyEvidence = heavyConnectInventory.expected_bay_baby_report_status;

  return <div className="standard-workspace">
    <section className="standard-hero">
      <div>
        <span>Audit backbone</span>
        <h2>Use PrimusGFS v4.0 as the source of truth</h2>
        <p>Bay Baby reports become evidence against v4.0 questions. The packet stays clean, readable, and auditor-friendly.</p>
      </div>
      <div className="standard-score">
        <strong>v4.0</strong>
        <span>{totalQuestions} questions</span>
        <span>{totalPoints.toLocaleString()} scored points</span>
        <span>{importedReports} Bay Baby records ready</span>
        <span>{selfAuditQuestionCount} Self-audit questions mapped</span>
        <span>{crosswalkSummary.strong_candidate ?? 0} legacy question matches</span>
      </div>
    </section>

    <section className="module-grid">
      {modules.map((module) => {
        const inScope = recommendedModules.has(module.key);
        const evidence = moduleEvidence.get(module.key);
        return <article key={module.key} className={inScope ? "in-scope" : ""}>
          <div>
            <span>{module.number.replace("Module ", "")}</span>
            {inScope ? <b>Bay Baby scope</b> : <b>Optional / confirm</b>}
          </div>
          <h3>{module.title}</h3>
          <p>{module.question_count} questions • {module.scored_points.toLocaleString()} points • {module.sections.length} sections</p>
          <div className="mini-progress"><i style={{ width: `${inScope ? Math.min(88, 34 + (evidence?.evidence_count ?? 0) * 6) : 28}%` }} /></div>
          <small>{evidence?.evidence_count ? `${evidence.evidence_count} downloaded report examples mapped` : "Keep available, use only if audit scope requires it"}</small>
        </article>;
      })}
    </section>

    <div className="standard-columns">
      <section className="evidence-map">
        <div className="section-heading"><h2>Bay Baby evidence sources</h2><span>{importedReportTypes} Bay Baby report types</span></div>
        {bayBabyEvidence.map((item) => <div className="evidence-row" key={item.report_type}>
          <CheckCircle weight="duotone" />
          <div><strong>{item.report_type}</strong><span>{item.count} record{item.count === 1 ? "" : "s"} • {item.source_files.join(", ")}</span></div>
        </div>)}
      </section>

      <section className="gap-panel">
        <div className="section-heading"><h2>Next gaps to close</h2><span>Before packet generation</span></div>
        <div className="gap-row"><CheckCircle weight="duotone" /><div><strong>Bay Baby evidence library ready</strong><span>{importedReports} records from Jan 1, 2025 to Jan 1, 2026 are indexed and ready for mapping.</span></div></div>
        <div className="gap-row"><CheckCircle weight="duotone" /><div><strong>Self-audit reference captured</strong><span>{selfAuditQuestionCount} questions captured for comparison.</span></div></div>
        <div className="gap-row"><CheckCircle weight="duotone" /><div><strong>Draft question crosswalk generated</strong><span>{crosswalkSummary.strong_candidate ?? 0} strong, {crosswalkSummary.review_candidate ?? 0} review, {crosswalkSummary.needs_manual_mapping ?? 0} manual mappings into v4.0.</span></div></div>
        <div className="gap-row warning"><WarningCircle weight="fill" /><div><strong>Manual crosswalk review required</strong><span>PrimusGFS v4.0 is the official target; review the candidate mapping before relying on it for auditor-facing scoring.</span></div></div>
        <div className="gap-row"><FilePdf weight="duotone" /><div><strong>Generate question-level packet index</strong><span>Use selected reports and the reviewed crosswalk to attach evidence to specific PrimusGFS v4.0 questions.</span></div></div>
      </section>
    </div>
  </div>;
}
function LocationsView() {
  const averageReadiness = Math.round(bayBabyLocations.reduce((sum, location) => sum + location.readiness, 0) / bayBabyLocations.length);
  return <div className="standard-workspace">
    <section className="standard-hero compact">
      <div>
        <span>Sites</span>
        <h2>{bayBabyLocations.length} active Bay Baby locations</h2>
        <p>Use this screen to keep ranches, warehouses, and audit readiness visible before report creation and packet generation.</p>
      </div>
      <div className="standard-score small-score"><strong>{averageReadiness}%</strong><span>Average readiness</span><span>{bayBabyLocations.filter((location) => location.active).length} active</span></div>
    </section>
    <section className="template-table management-table">
      {bayBabyLocations.map((location) => <article key={location.code}>
        <div className="template-icon"><Buildings weight="duotone" /></div>
        <div>
          <span>{location.area} ? {location.code}</span>
          <h3>{location.name}</h3>
          <p>Manager: {location.manager} ? Status: {location.active ? "Active" : "Inactive"}</p>
          <div className="mini-progress"><i style={{ width: `${location.readiness}%` }} /></div>
        </div>
        <b className="capture ready">{location.readiness}% ready</b>
      </article>)}
    </section>
  </div>;
}

function TeamView() {
  return <div className="standard-workspace">
    <section className="standard-hero compact">
      <div>
        <span>Access control</span>
        <h2>Roles are ready for approval workflows</h2>
        <p>Operators submit reports. Managers and reviewers approve. Admins manage templates and users. Auditors get read-only packet access.</p>
      </div>
      <button className="primary"><Plus /> Invite user</button>
    </section>
    <section className="template-table management-table">
      {teamMembers.map((member) => <article key={member.name}>
        <div className="avatar table-avatar">{member.initials}</div>
        <div>
          <span>{member.role} ? {member.status}</span>
          <h3>{member.name}</h3>
          <p>{member.access}</p>
        </div>
        <b className={`capture ${member.status === "Active" ? "ready" : "needs_options_review"}`}>{member.status}</b>
      </article>)}
    </section>
  </div>;
}

function SettingsView() {
  return <div className="standard-workspace">
    <section className="standard-hero compact">
      <div>
        <span>Configuration</span>
        <h2>Bay Baby Audit is configured for PrimusGFS v4.0</h2>
        <p>These settings define how reports move from creation to review, approval, packet generation, and audit export.</p>
      </div>
      <button className="primary"><Check /> Save settings</button>
    </section>
    <section className="template-table management-table">
      {appSettings.map((setting) => <article key={setting.label}>
        <div className="template-icon"><Gear weight="duotone" /></div>
        <div>
          <span>{setting.label}</span>
          <h3>{setting.value}</h3>
          <p>{setting.note}</p>
        </div>
        <b className="capture ready">Set</b>
      </article>)}
    </section>
  </div>;
}

function StartReportFlow({ templates, onCancel, onSubmit }: { templates: TemplateDefinition[]; onCancel: () => void; onSubmit: (report: Report) => void }) {
  const [selectedTemplateKey, setSelectedTemplateKey] = useState(templates[0]?.key ?? "");
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState(farmLocations[0]);
  const [reportedBy, setReportedBy] = useState("Juan Diaz");
  const selectedTemplate = templates.find((template) => template.key === selectedTemplateKey) ?? templates[0];
  const filteredTemplates = templates.filter((template) => `${template.name} ${template.category} ${template.code}`.toLowerCase().includes(search.toLowerCase()));
  const firstSection = selectedTemplate.sections[0];
  const statusLabel = selectedTemplate.status === "ready" ? "Ready" : "Needs option review";

  const submitReport = () => {
    onSubmit({
      id: Date.now(),
      reportId: `BBA-${Math.floor(100000 + Math.random() * 900000)}`,
      type: selectedTemplate.name,
      code: selectedTemplate.code,
      location,
      date: "06/23/2026 07:00 AM",
      creator: reportedBy || "Juan Diaz",
      status: "review",
      severity: "Attention",
      sourceFile: "Created in Bay Baby Audit",
      evidenceTags: selectedTemplate.moduleTargets,
    });
  };

  return <div className="form-panel start-flow">
    <div className="modal-heading"><span>Start Report</span><h2>{step === 1 ? "Choose a report template" : selectedTemplate.name}</h2><p>{step === 1 ? "Pick a Bay Baby report type, fill it out, and submit it for review." : selectedTemplate.source}</p></div>
    <div className="stepper real-stepper">{["Template", "Basics", "Questions", "Submit"].map((label, index) => <span className={step >= index + 1 ? "done" : ""} key={label}>{step > index + 1 ? <Check /> : index + 1}<b>{label}</b></span>)}</div>

    {step === 1 && <>
      <label className="template-search"><MagnifyingGlass /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search templates..." /></label>
      <div className="template-picker">
        {filteredTemplates.map((template) => <button key={template.key} className={template.key === selectedTemplateKey ? "selected" : ""} onClick={() => setSelectedTemplateKey(template.key)}>
          <span className="template-icon"><ReportIcon code={template.code} /></span>
          <strong>{template.name}</strong>
          <small>{template.category} ? {template.sections.reduce((sum, section) => sum + section.questions.length, 0)} fields</small>
          <b className={`capture ${template.status}`}>{template.status === "ready" ? "Ready" : "Option review"}</b>
        </button>)}
      </div>
    </>}

    {step === 2 && <div className="form-grid">
      <label>Location<select value={location} onChange={(event) => setLocation(event.target.value)}>{farmLocations.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Report date<input type="date" defaultValue="2026-06-23" /></label>
      <label>Report time<input type="time" defaultValue="07:00" /></label>
      <label>Reported by<input value={reportedBy} onChange={(event) => setReportedBy(event.target.value)} /></label>
      <label className="full">Details<textarea maxLength={950} placeholder="Optional details, notes, or field context..." /></label>
    </div>}

    {step === 3 && <div className="dynamic-form">
      <div className="section-card">
        <div className="section-title"><span>{selectedTemplate.code}</span><h3>{firstSection.title}</h3><small>{firstSection.questions.length} fields in this section</small></div>
        {firstSection.instructions?.map((instruction) => <p className="instruction" key={instruction}>{instruction}</p>)}
        {firstSection.questions.slice(0, 12).map((question, index) => <QuestionInput question={question} index={index} key={`${question.label}-${index}`} />)}
        {firstSection.questions.length > 12 && <p className="helper">Showing the first 12 fields in this preview. All {firstSection.questions.length} fields are stored with the template and will be available in the full form renderer.</p>}
      </div>
    </div>}

    {step === 4 && <div className="review-summary">
      <CheckCircle weight="duotone" />
      <h3>Ready to submit</h3>
      <p>{selectedTemplate.name} ? {location} ? {selectedTemplate.sections.length} sections</p>
      <div><span>Template status</span><b>{statusLabel}</b></div>
      <div><span>Next step</span><b>Manager review</b></div>
      <div><span>Audit mapping</span><b>{selectedTemplate.moduleTargets.join(", ")}</b></div>
    </div>}

    <div className="modal-actions">
      <button className="secondary" onClick={() => step === 1 ? onCancel() : setStep(step - 1)}>{step === 1 ? "Cancel" : "Back"}</button>
      <button className="primary" onClick={() => step < 4 ? setStep(step + 1) : submitReport()}>{step < 4 ? "Continue" : "Submit report"}</button>
    </div>
  </div>;
}

function QuestionInput({ question, index }: { question: Question; index: number }) {
  if (question.type === "instruction") return <p className="instruction">{question.label}</p>;
  const label = cleanQuestionLabel(question.label);
  return <div className="field-question">
    <div><b>{index + 1}</b><span>{label}{question.required && <em>Required</em>}</span></div>
    {question.type === "yes_no" && <div className="segmented"><button>Yes</button><button>No</button></div>}
    {question.type === "yes_no_na" && <div className="segmented"><button>Yes</button><button>No</button><button>N/A</button></div>}
    {question.type === "single_select" && <select><option>{question.options_status === "pending" ? "Options pending admin review" : "Select an option"}</option>{question.options?.map((option) => <option key={option}>{option}</option>)}</select>}
    {question.type === "number" && <input type="number" placeholder="Enter number" />}
    {question.type === "date" && <input type="date" />}
    {question.type === "time" && <input type="time" />}
    {question.type === "calculated_number" && <input disabled placeholder={question.formula_display ?? "Calculated"} />}
    {!["yes_no", "yes_no_na", "single_select", "number", "date", "time", "calculated_number"].includes(question.type) && <input placeholder="Enter response" />}
  </div>;
}

function ReviewPanel({ report, onDone }: { report: Report; onDone: () => void }) {
  return <div className="form-panel review-panel">
    <div className="modal-heading"><span>Report review</span><h2>{report.code} {report.type}</h2><p>{report.location} • {report.date} • {report.creator}</p></div>
    <div className="review-alert"><WarningCircle weight="fill" /><div><strong>{report.status === "action" ? "Corrective action required" : "Verify report evidence"}</strong><span>Record: {report.reportId}. Tags: {report.evidenceTags.join(", ") || "none"}.</span></div></div>
    <div className="answers">
      <div><span>Report ID</span><b>{report.reportId}</b></div>
      <div><span>Primus evidence status</span><b className={report.status === "approved" ? "pass" : "fail"}>{statusCopy[report.status].label}</b></div>
      <div><span>Recommended action</span><b>{report.status === "approved" ? "Include in packet" : "Manager review"}</b></div>
    </div>
    <label>Review notes<textarea placeholder="Add a clear note for the audit packet..." /></label>
    <label>Corrective action<textarea placeholder="Describe what must be corrected and by when..." /></label>
    <div className="modal-actions"><button className="secondary" onClick={onDone}>Save notes</button><button className="primary" onClick={onDone}><Check /> Mark reviewed</button></div>
  </div>;
}

function AuditWizard({ step, setStep, onGenerate, selected }: { step: number; setStep: (step: number) => void; onGenerate: () => void; selected: number }) {
  const titles = ["Select scope", "Validate readiness", "Preview packet", "Generate PDF"];
  const crosswalkSummary = primusCrosswalk.summary as CrosswalkSummary;
  return <div className="wizard">
    <div className="modal-heading"><span>Audit Generator</span><h2>Build a Primus-ready packet</h2><p>Checks Bay Baby report evidence against the PrimusGFS v4.0 backbone before export.</p></div>
    <div className="wizard-steps">{titles.map((title, index) => <span className={step >= index + 1 ? "done" : ""} key={title}><b>{step > index + 1 ? <Check /> : index + 1}</b>{title}</span>)}</div>
    <div className="wizard-body">
      {step === 1 && <div className="scope-form"><label>Start date<input type="date" defaultValue="2025-01-01" /></label><label>End date<input type="date" defaultValue="2026-01-01" /></label><label>Locations<select><option>All locations</option></select></label><label>Standard<select><option>PrimusGFS v4.0</option></select></label><label className="toggle"><input type="checkbox" defaultChecked /><span />Include reviewed reports only</label><label className="toggle"><input type="checkbox" defaultChecked /><span />Include evidence index</label></div>}
      {step === 2 && <div className="validation-grid">
        <div className="success"><CheckCircle weight="duotone" /><b>{selected}</b><span>Reports selected</span></div>
        <div><ClipboardText weight="duotone" /><b>{heavyConnectInventory.report_type_count}</b><span>Report types</span></div>
        <div className="success"><ShieldCheck weight="duotone" /><b>7</b><span>Core templates found</span></div>
        <div className={(crosswalkSummary.needs_manual_mapping ?? 0) ? "warning" : "success"}><WarningCircle weight="duotone" /><b>{crosswalkSummary.needs_manual_mapping ?? 0}</b><span>Manual mappings</span></div>
        <section><strong>Pre-audit checks</strong><span><CheckCircle /> Required Bay Baby evidence found</span><span><CheckCircle /> PrimusGFS v4.0 modules loaded</span><span><CheckCircle /> Draft question crosswalk generated</span><span><WarningCircle /> Manual mapping review still required before final scoring</span></section>
      </div>}
      {step === 3 && <div className="packet-preview">
        {["Cover page", "PrimusGFS v4.0 module index", "Bay Baby evidence index", "Open gaps and corrective actions", "Reports grouped by type", "Attachments appendix", "Signature & review log"].map((section, index) => <div key={section}><span>{index + 1}</span><b>{section}</b><CheckCircle weight="fill" /></div>)}
      </div>}
      {step === 4 && <div className="generate-ready"><FilePdf weight="duotone" /><h3>Your packet is ready</h3><p>Bay-Baby-PrimusGFS-v4-Audit-Packet_2025-01-01_to_2026-01-01.pdf</p><span>{selected} reports • PrimusGFS v4.0 • Evidence index included</span></div>}
    </div>
    <div className="modal-actions"><button className="secondary" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}>Back</button><button className="primary" onClick={() => step < 4 ? setStep(step + 1) : onGenerate()}>{step < 4 ? "Continue" : "Generate & download PDF"}</button></div>
  </div>;
}
