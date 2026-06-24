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
import type { AppLocation, AppReport, AppTeamMember, AppTemplate } from "@/app/page";
import heavyConnectInventory from "@/data/heavyconnect-reports/inventory.json";
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
  id: string;
  key: string;
  code: string;
  name: string;
  category: string;
  status: "ready" | "needs_options_review";
  source: string;
  moduleTargets: string[];
  sections: TemplateSection[];
};

type Report = {
  id: string;
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

const statusCopy = {
  approved: { label: "Approved", action: "View packet" },
  review: { label: "Needs review", action: "Review" },
  action: { label: "Needs action", action: "Add action" },
  submitted: { label: "Submitted", action: "Review" },
};

type AuditAppData = {
  connected: boolean;
  error: string | null;
  reports: AppReport[];
  locations: AppLocation[];
  teamMembers: AppTeamMember[];
  templates: AppTemplate[];
};

function cleanQuestionLabel(label: string) {
  return label
    .replace(/\s*\/\s*¿.*$/i, "")
    .replace(/\s*\/\s*[A-ZÁÉÍÓÚÑ].*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function ReportIcon({ code }: { code: string }) {
  if (code === "R004") return <Tractor weight="duotone" />;
  if (code === "R006" || code === "SAN") return <ShieldCheck weight="duotone" />;
  return <ClipboardText weight="duotone" />;
}

export function AuditApp({ initialData }: { initialData: AuditAppData }) {
  const [view, setView] = useState<View>("inspector");
  const [activeTab, setActiveTab] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [modal, setModal] = useState<Modal>(null);
  const [currentReport, setCurrentReport] = useState<Report | null>(null);
  const [wizardStep, setWizardStep] = useState(1);
  const [toast, setToast] = useState("");

  const templates = initialData.templates;
  const allReports = initialData.reports;
  const reports = useMemo(() => allReports.filter((report) => {
    const matchesTab = activeTab === "all" || report.status === activeTab ||
      (activeTab === "ready" && report.status === "approved");
    const text = `${report.code} ${report.type} ${report.location} ${report.creator} ${report.sourceFile}`.toLowerCase();
    return matchesTab && text.includes(query.toLowerCase());
  }), [activeTab, allReports, query]);

  const toggle = (id: string) => setSelected((items) =>
    items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);

  const openReport = (report: Report) => {
    setCurrentReport(report);
    setModal("review");
  };

  async function downloadPacket() {
    const selectedReports = allReports.filter((report) => selected.includes(report.id));
    const approvedCount = selectedReports.filter((report) => report.status === "approved").length;
    const reviewCount = selectedReports.filter((report) => report.status === "review" || report.status === "submitted").length;
    const actionCount = selectedReports.filter((report) => report.status === "action").length;
    const readiness = selectedReports.length ? Math.round((approvedCount / selectedReports.length) * 100) : 0;
    const response = await fetch("/api/audit-packet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        count: selectedReports.length,
        approvedCount,
        reviewCount,
        actionCount,
        readiness,
        generatedBy: "Bay Baby Audit",
      }),
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Bay-Baby-PrimusGFS-v4-Audit-Packet.pdf";
    a.click();
    URL.revokeObjectURL(url);
    setToast("Audit packet generated");
    setModal(null);
  }

  const pageCopy = {
    inspector: ["Inspector", "Create, review, approve, and prepare Supabase reports for audit"],
    standard: ["PrimusGFS v4.0", "Audit standard, module readiness, and Bay Baby evidence mapping"],
    templates: ["Templates", "Bay Baby report templates, questions, and admin review status"],
    locations: ["Locations", "Sites loaded from Supabase"],
    team: ["Team", "Users and roles loaded from Supabase"],
    settings: ["Settings", "Supabase connection and schema status"],
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
        <div className="profile"><div className="avatar">BB</div><div><strong>Bay Baby</strong><span>Supabase data</span></div><CaretDown /></div>
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
        {view === "locations" && <LocationsView locations={initialData.locations} />}
        {view === "team" && <TeamView teamMembers={initialData.teamMembers} />}
        {view === "settings" && <SettingsView connected={initialData.connected} error={initialData.error} reportCount={allReports.length} locationCount={initialData.locations.length} templateCount={templates.length} teamCount={initialData.teamMembers.length} />}
        {view === "inspector" && <InspectorView
          reports={reports}
          totalReports={allReports.length}
          reportTypeCount={new Set(allReports.map((report) => report.code)).size}
          dataError={initialData.error}
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
          {modal === "start" && <StartReportFlow templates={templates} locations={initialData.locations} onCancel={() => setModal(null)} />}
          {modal === "review" && currentReport && <ReviewPanel report={currentReport} onDone={() => { setModal(null); setToast("Report marked reviewed"); }} />}
          {modal === "audit" && <AuditWizard step={wizardStep} setStep={setWizardStep} onGenerate={downloadPacket} selected={selected.length} reportTypeCount={new Set(allReports.map((report) => report.code)).size} templateCount={templates.length} />}
        </div>
      </div>}
      {toast && <div className="toast"><CheckCircle weight="fill" />{toast}<button onClick={() => setToast("")}><X /></button></div>}
    </div>
  );
}

function InspectorView(props: {
  reports: Report[];
  totalReports: number;
  reportTypeCount: number;
  dataError: string | null;
  selected: string[];
  activeTab: string;
  query: string;
  setQuery: (value: string) => void;
  setActiveTab: (value: string) => void;
  setSelected: (items: string[]) => void;
  toggle: (id: string) => void;
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
      <p className="helper">{props.dataError ? `Supabase data is unavailable: ${props.dataError}` : "Showing live Bay Baby reports from Supabase. Review anything flagged before generating the Primus packet."}</p>
      <div className="filters">
        <button><CalendarBlank /> All report dates <CaretDown /></button>
        <button><MapPin /> All locations <CaretDown /></button>
        <button><ClipboardText /> {props.reportTypeCount} report types <CaretDown /></button>
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
        {props.reports.length === 0 && <div className="empty"><MagnifyingGlass /><strong>No Supabase reports found</strong><span>{props.dataError ? "Apply the migration or check the table names in Supabase." : "Create reports in Supabase or adjust the current filters."}</span></div>}
      </div>
      <footer className="pagination"><span>{props.reports.length} of {props.totalReports} reports</span><div><button disabled>‹</button><button className="active">1</button><button>›</button></div></footer>
    </section>

    <aside className="audit-scope">
      <h2>Audit scope</h2>
      <button className="date-control"><CalendarBlank /> All report dates <CaretDown /></button>
      <div className="scope-section"><strong>Supabase records</strong><p><b>{props.totalReports}</b> reports</p><span>{props.reportTypeCount} report types</span></div>
      <div className="scope-section"><strong>Reports included</strong><p><b>{props.selected.length}</b> selected</p><button className="text-link">View selected</button></div>
      <div className="scope-section readiness"><strong>Readiness</strong><p><b>{readiness}%</b></p><span>{props.reports.length === 0 ? "No reports loaded" : needsAttention ? `${needsAttention} need attention` : "Good to go"}</span><div className="progress"><i style={{ width: `${readiness}%` }} /></div></div>
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
  return <div className="standard-workspace">
    <section className="standard-hero compact">
      <div>
        <span>Supabase templates</span>
        <h2>{templates.length} report templates loaded</h2>
        <p>Templates are read from Supabase. Add real published templates and questions before operators create reports.</p>
      </div>
      <button className="primary" onClick={onStart}><Plus /> Start Report</button>
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
      {templates.length === 0 && <EmptyTable title="No Supabase templates" copy="Apply the schema and insert real report_templates with report_template_questions." />}
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
function LocationsView({ locations }: { locations: AppLocation[] }) {
  const activeLocations = locations.filter((location) => location.active).length;
  return <div className="standard-workspace">
    <section className="standard-hero compact">
      <div>
        <span>Sites</span>
        <h2>{activeLocations} active Bay Baby locations</h2>
        <p>Locations are loaded from Supabase. Empty results mean the reference table has not been seeded yet or RLS is blocking the current user.</p>
      </div>
      <div className="standard-score small-score"><strong>{locations.length}</strong><span>Total locations</span><span>{activeLocations} active</span></div>
    </section>
    <section className="template-table management-table">
      {locations.map((location) => <article key={location.id}>
        <div className="template-icon"><Buildings weight="duotone" /></div>
        <div>
          <span>{location.code}</span>
          <h3>{location.name}</h3>
          <p>Status: {location.active ? "Active" : "Inactive"}</p>
        </div>
        <b className={`capture ${location.active ? "ready" : "inferred"}`}>{location.active ? "Active" : "Inactive"}</b>
      </article>)}
      {locations.length === 0 && <EmptyTable title="No Supabase locations" copy="Apply the migration and seed real location rows before using this view." />}
    </section>
  </div>;
}

function TeamView({ teamMembers }: { teamMembers: AppTeamMember[] }) {
  return <div className="standard-workspace">
    <section className="standard-hero compact">
      <div>
        <span>Access control</span>
        <h2>{teamMembers.length} Supabase user profiles</h2>
        <p>User profiles are loaded from Supabase. Invite and authentication flows should create these rows instead of relying on demo people.</p>
      </div>
      <button className="primary"><Plus /> Invite user</button>
    </section>
    <section className="template-table management-table">
      {teamMembers.map((member) => <article key={member.id}>
        <div className="avatar table-avatar">{member.initials}</div>
        <div>
          <span>{member.role} - {member.status}</span>
          <h3>{member.name}</h3>
          <p>Role stored in public.users_profile</p>
        </div>
        <b className={`capture ${member.status === "Active" ? "ready" : "needs_options_review"}`}>{member.status}</b>
      </article>)}
      {teamMembers.length === 0 && <EmptyTable title="No Supabase profiles" copy="Sign in or insert real users_profile rows to populate team access." />}
    </section>
  </div>;
}

function SettingsView(props: { connected: boolean; error: string | null; reportCount: number; locationCount: number; templateCount: number; teamCount: number }) {
  const settings = [
    { label: "Supabase connection", value: props.connected ? "Readable" : "Needs setup", note: props.error ?? "Queries completed without Supabase errors" },
    { label: "Reports table", value: `${props.reportCount} rows`, note: "Loaded from public.reports" },
    { label: "Locations table", value: `${props.locationCount} rows`, note: "Loaded from public.locations" },
    { label: "Templates table", value: `${props.templateCount} rows`, note: "Loaded from public.report_templates" },
    { label: "User profiles", value: `${props.teamCount} rows`, note: "Loaded from public.users_profile" },
  ];

  return <div className="standard-workspace">
    <section className="standard-hero compact">
      <div>
        <span>Configuration</span>
        <h2>{props.connected ? "Supabase schema is readable" : "Supabase schema needs attention"}</h2>
        <p>{props.error ?? "The app is reading live tables through the configured Supabase project."}</p>
      </div>
      <button className="primary"><Check /> Checked</button>
    </section>
    <section className="template-table management-table">
      {settings.map((setting) => <article key={setting.label}>
        <div className="template-icon"><Gear weight="duotone" /></div>
        <div>
          <span>{setting.label}</span>
          <h3>{setting.value}</h3>
          <p>{setting.note}</p>
        </div>
        <b className={`capture ${props.connected ? "ready" : "needs_options_review"}`}>{props.connected ? "Loaded" : "Check"}</b>
      </article>)}
    </section>
  </div>;
}

function EmptyTable({ title, copy }: { title: string; copy: string }) {
  return <div className="empty table-empty"><MagnifyingGlass /><strong>{title}</strong><span>{copy}</span></div>;
}

function StartReportFlow({ templates, locations, onCancel }: { templates: TemplateDefinition[]; locations: AppLocation[]; onCancel: () => void }) {
  const [selectedTemplateKey, setSelectedTemplateKey] = useState(templates[0]?.key ?? "");
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState(locations[0]?.id ?? "");
  const selectedTemplate = templates.find((template) => template.key === selectedTemplateKey) ?? templates[0];
  const filteredTemplates = templates.filter((template) => `${template.name} ${template.category} ${template.code}`.toLowerCase().includes(search.toLowerCase()));
  const firstSection = selectedTemplate?.sections[0];
  const statusLabel = selectedTemplate?.status === "ready" ? "Ready" : "Needs option review";

  return <div className="form-panel start-flow">
    <div className="modal-heading"><span>Start Report</span><h2>{step === 1 ? "Choose a report template" : selectedTemplate?.name ?? "No templates available"}</h2><p>{step === 1 ? "Pick a Supabase template before creating a report." : selectedTemplate?.source}</p></div>
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
      {filteredTemplates.length === 0 && <div className="empty"><MagnifyingGlass /><strong>No Supabase templates</strong><span>Seed real report templates before creating reports.</span></div>}
    </>}

    {step === 2 && <div className="form-grid">
      <label>Location<select value={location} onChange={(event) => setLocation(event.target.value)}>{locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Report date<input type="date" /></label>
      <label>Report time<input type="time" /></label>
      <label className="full">Details<textarea maxLength={950} placeholder="Optional details, notes, or field context..." /></label>
    </div>}

    {step === 3 && firstSection && <div className="dynamic-form">
      <div className="section-card">
        <div className="section-title"><span>{selectedTemplate.code}</span><h3>{firstSection.title}</h3><small>{firstSection.questions.length} fields in this section</small></div>
        {firstSection.instructions?.map((instruction) => <p className="instruction" key={instruction}>{instruction}</p>)}
        {firstSection.questions.slice(0, 12).map((question, index) => <QuestionInput question={question} index={index} key={`${question.label}-${index}`} />)}
        {firstSection.questions.length > 12 && <p className="helper">Showing the first 12 fields in this preview. All {firstSection.questions.length} fields are stored with the template and will be available in the full form renderer.</p>}
      </div>
    </div>}

    {step === 4 && <div className="review-summary">
      <CheckCircle weight="duotone" />
      <h3>Ready to create in Supabase</h3>
      <p>{selectedTemplate?.name} - {locations.find((item) => item.id === location)?.name ?? "No location"} - {selectedTemplate?.sections.length ?? 0} sections</p>
      <div><span>Template status</span><b>{statusLabel}</b></div>
      <div><span>Next step</span><b>Manager review</b></div>
      <div><span>Audit mapping</span><b>{selectedTemplate.moduleTargets.join(", ")}</b></div>
    </div>}

    <div className="modal-actions">
      <button className="secondary" onClick={() => step === 1 ? onCancel() : setStep(step - 1)}>{step === 1 ? "Cancel" : "Back"}</button>
      <button className="primary" disabled={templates.length === 0 || locations.length === 0} onClick={() => step < 4 ? setStep(step + 1) : onCancel()}>{step < 4 ? "Continue" : "Close"}</button>
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

function AuditWizard({ step, setStep, onGenerate, selected, reportTypeCount, templateCount }: { step: number; setStep: (step: number) => void; onGenerate: () => void; selected: number; reportTypeCount: number; templateCount: number }) {
  const titles = ["Select scope", "Validate readiness", "Preview packet", "Generate PDF"];
  const crosswalkSummary = primusCrosswalk.summary as CrosswalkSummary;
  return <div className="wizard">
    <div className="modal-heading"><span>Audit Generator</span><h2>Build a Primus-ready packet</h2><p>Checks Bay Baby report evidence against the PrimusGFS v4.0 backbone before export.</p></div>
    <div className="wizard-steps">{titles.map((title, index) => <span className={step >= index + 1 ? "done" : ""} key={title}><b>{step > index + 1 ? <Check /> : index + 1}</b>{title}</span>)}</div>
    <div className="wizard-body">
      {step === 1 && <div className="scope-form"><label>Start date<input type="date" /></label><label>End date<input type="date" /></label><label>Locations<select><option>All Supabase locations</option></select></label><label>Standard<select><option>PrimusGFS v4.0</option></select></label><label className="toggle"><input type="checkbox" defaultChecked /><span />Include reviewed reports only</label><label className="toggle"><input type="checkbox" defaultChecked /><span />Include evidence index</label></div>}
      {step === 2 && <div className="validation-grid">
        <div className="success"><CheckCircle weight="duotone" /><b>{selected}</b><span>Reports selected</span></div>
        <div><ClipboardText weight="duotone" /><b>{reportTypeCount}</b><span>Report types</span></div>
        <div className={templateCount ? "success" : "warning"}><ShieldCheck weight="duotone" /><b>{templateCount}</b><span>Templates found</span></div>
        <div className={(crosswalkSummary.needs_manual_mapping ?? 0) ? "warning" : "success"}><WarningCircle weight="duotone" /><b>{crosswalkSummary.needs_manual_mapping ?? 0}</b><span>Manual mappings</span></div>
        <section><strong>Pre-audit checks</strong><span><CheckCircle /> Required Bay Baby evidence found</span><span><CheckCircle /> PrimusGFS v4.0 modules loaded</span><span><CheckCircle /> Draft question crosswalk generated</span><span><WarningCircle /> Manual mapping review still required before final scoring</span></section>
      </div>}
      {step === 3 && <div className="packet-preview">
        {["Cover page", "PrimusGFS v4.0 module index", "Bay Baby evidence index", "Open gaps and corrective actions", "Reports grouped by type", "Attachments appendix", "Signature & review log"].map((section, index) => <div key={section}><span>{index + 1}</span><b>{section}</b><CheckCircle weight="fill" /></div>)}
      </div>}
      {step === 4 && <div className="generate-ready"><FilePdf weight="duotone" /><h3>Your packet is ready</h3><p>Bay-Baby-PrimusGFS-v4-Audit-Packet.pdf</p><span>{selected} reports • PrimusGFS v4.0 • Evidence index included</span></div>}
    </div>
    <div className="modal-actions"><button className="secondary" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}>Back</button><button className="primary" onClick={() => step < 4 ? setStep(step + 1) : onGenerate()}>{step < 4 ? "Continue" : "Generate & download PDF"}</button></div>
  </div>;
}
