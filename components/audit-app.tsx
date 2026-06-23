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
  Leaf,
  MagnifyingGlass,
  MapPin,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Tractor,
  UserCircle,
  UsersThree,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import heavyConnectInventory from "@/data/heavyconnect-reports/inventory.json";
import primusV4Index from "@/data/primusgfs/v4/index.json";

type Status = "approved" | "review" | "action" | "draft";
type View = "inspector" | "standard";
type Report = {
  id: number; type: string; code: string; location: string; date: string;
  creator: string; status: Status; severity: "Good" | "Attention" | "Issue";
};

const seedReports: Report[] = [
  { id: 1, code: "R004", type: "Tractor Inspection", location: "2026 South Fork", date: "Jun 22, 2026 8:15 AM", creator: "Juan Diaz", status: "review", severity: "Issue" },
  { id: 2, code: "R001", type: "Field Activity Log", location: "2026 SW Hoffman", date: "Jun 22, 2026 7:42 AM", creator: "Maria Lopez", status: "review", severity: "Attention" },
  { id: 3, code: "R006", type: "Daily Sanitation Log", location: "2026 Maplewood", date: "Jun 21, 2026 4:30 PM", creator: "Alex Torres", status: "action", severity: "Issue" },
  { id: 4, code: "R004", type: "Tractor Inspection", location: "2026 Org. Cram-Jenson", date: "Jun 21, 2026 10:12 AM", creator: "Chris Nguyen", status: "review", severity: "Attention" },
  { id: 5, code: "R001", type: "Field Activity Log", location: "2026 Youngquist", date: "Jun 20, 2026 6:55 PM", creator: "Juan Diaz", status: "approved", severity: "Good" },
  { id: 6, code: "R006", type: "Daily Sanitation Log", location: "2026 S. Reedy", date: "Jun 20, 2026 2:18 PM", creator: "Maria Lopez", status: "approved", severity: "Good" },
  { id: 7, code: "R004", type: "Tractor Inspection", location: "2026 South Fork", date: "Jun 19, 2026 11:05 AM", creator: "Alex Torres", status: "approved", severity: "Good" },
  { id: 8, code: "R001", type: "Field Activity Log", location: "2026 SW Hoffman", date: "Jun 19, 2026 7:20 AM", creator: "Chris Nguyen", status: "draft", severity: "Good" },
];

const statusCopy = {
  approved: { label: "Approved", action: "View PDF" },
  review: { label: "Needs review", action: "Review" },
  action: { label: "Needs action", action: "Add action" },
  draft: { label: "Draft", action: "Continue" },
};

function ReportIcon({ code }: { code: string }) {
  if (code === "R004") return <Tractor weight="duotone" />;
  if (code === "R006") return <ShieldCheck weight="duotone" />;
  return <ClipboardText weight="duotone" />;
}

export function AuditApp() {
  const [view, setView] = useState<View>("inspector");
  const [activeTab, setActiveTab] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number[]>([5, 6, 7]);
  const [modal, setModal] = useState<"report" | "review" | "audit" | null>(null);
  const [currentReport, setCurrentReport] = useState<Report | null>(null);
  const [wizardStep, setWizardStep] = useState(1);
  const [toast, setToast] = useState("");

  const reports = useMemo(() => seedReports.filter((report) => {
    const matchesTab = activeTab === "all" || report.status === activeTab ||
      (activeTab === "ready" && report.status === "approved");
    const text = `${report.code} ${report.type} ${report.location} ${report.creator}`.toLowerCase();
    return matchesTab && text.includes(query.toLowerCase());
  }), [activeTab, query]);

  const toggle = (id: number) => setSelected((items) =>
    items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);

  const openReport = (report: Report) => {
    setCurrentReport(report);
    setModal(report.status === "draft" ? "report" : "review");
  };

  async function downloadPacket() {
    const response = await fetch("/api/audit-packet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: selected.length || 32, generatedBy: "Juan Diaz" }),
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Bay-Baby-Primus-Audit-Packet_2026-05-22_to_2026-06-22.pdf";
    a.click();
    URL.revokeObjectURL(url);
    setToast("Audit packet generated");
    setModal(null);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><strong>Bay Baby Audit</strong><span>Bay Baby Produce</span></div>
        <nav>
          <button className={view === "inspector" ? "active" : ""} onClick={() => setView("inspector")}><ClipboardText /><span>Inspector</span></button>
          <button className={view === "standard" ? "active" : ""} onClick={() => setView("standard")}><BookOpenText /><span>Primus v4.0</span></button>
          <button onClick={() => { setModal("audit"); setWizardStep(1); }}><Archive /><span>Audit Packets</span></button>
          <button><Files /><span>Templates</span></button>
          <button><Buildings /><span>Locations</span></button>
          <button><UsersThree /><span>Team</span></button>
          <button><Gear /><span>Settings</span></button>
        </nav>
        <div className="profile"><div className="avatar">JD</div><div><strong>Juan Diaz</strong><span>Manager</span></div><CaretDown /></div>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <h1>{view === "standard" ? "PrimusGFS v4.0" : "Inspector"}</h1>
            <p>{view === "standard" ? "Audit standard, module readiness, and Bay Baby evidence mapping" : "All inspection reports and review status"}</p>
          </div>
          <button className="primary" onClick={() => view === "standard" ? setModal("audit") : setModal("report")}>
            {view === "standard" ? <FilePdf /> : <Plus />} {view === "standard" ? "Build Audit Packet" : "Start Report"}
          </button>
        </header>

        {view === "standard" ? <PrimusStandardView /> : <div className="workspace">
          <section className="report-area">
            <div className="tabs">
              {[
                ["all", "All reports", "128"],
                ["review", "Needs review", "14"],
                ["action", "Needs action", "6"],
                ["ready", "Ready for audit", "32"],
              ].map(([key, label, count]) => (
                <button key={key} className={activeTab === key ? "active" : ""} onClick={() => setActiveTab(key)}>
                  {label}<span>{count}</span>
                </button>
              ))}
            </div>
            <p className="helper">Review flagged reports and resolve missing corrective actions before generating your packet.</p>
            <div className="filters">
              <button><CalendarBlank /> May 22 – Jun 22, 2026 <CaretDown /></button>
              <button><MapPin /> All locations <CaretDown /></button>
              <button><ClipboardText /> All report types <CaretDown /></button>
              <label><MagnifyingGlass /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search reports..." /></label>
              <button className="filter-button"><Funnel /> Filters</button>
            </div>
            <div className="selection-bar">
              <input type="checkbox" checked={selected.length === reports.length && reports.length > 0} onChange={() => setSelected(selected.length === reports.length ? [] : reports.map(r => r.id))} />
              <span>{selected.length} selected</span><i />
              <button onClick={() => setSelected(reports.map(r => r.id))}>Select all 128</button>
              <span className="sort">Sort: Newest first <CaretDown /></span>
            </div>
            <div className="report-list">
              {reports.map((report) => (
                <article className={`report-row ${report.status}`} key={report.id}>
                  <input type="checkbox" checked={selected.includes(report.id)} onChange={() => toggle(report.id)} />
                  <span className="severity-line" />
                  <div className="report-icon"><ReportIcon code={report.code} /></div>
                  <div className="report-copy">
                    <strong>{report.code} {report.type} {report.severity === "Issue" && <b>HIGH</b>}</strong>
                    <span>{report.location}<em>•</em>{report.date}<em>•</em>{report.creator}</span>
                  </div>
                  <span className={`status ${report.status}`}><i />{statusCopy[report.status].label}</span>
                  <button className="row-action" onClick={() => openReport(report)}>
                    {report.status === "approved" && <FilePdf />}{statusCopy[report.status].action}
                  </button>
                </article>
              ))}
              {reports.length === 0 && <div className="empty"><MagnifyingGlass /><strong>No reports found</strong><span>Try another search or status tab.</span></div>}
            </div>
            <footer className="pagination"><span>1–25 of 128 reports</span><div><button disabled>‹</button><button className="active">1</button><button>2</button><button>3</button><button>…</button><button>6</button><button>›</button></div></footer>
          </section>

          <aside className="audit-scope">
            <h2>Audit scope</h2>
            <button className="date-control"><CalendarBlank /> May 22 – Jun 22, 2026 <CaretDown /></button>
            <div className="scope-section"><strong>Locations</strong><span>All locations</span></div>
            <div className="scope-section"><strong>Reports included</strong><p><b>{selected.length || 32}</b> of 128</p><button className="text-link">View selected</button></div>
            <div className="scope-section readiness"><strong>Readiness</strong><p><b>78%</b></p><span>Good to go</span><div className="progress"><i /></div></div>
            <div className="legend">
              <span><i className="green" />Approved <b>24</b></span>
              <span><i className="yellow" />In review <b>6</b></span>
              <span><i className="orange" />Needs review <b>2</b></span>
              <span><i className="red" />Needs action <b>0</b></span>
              <span><i className="gray" />Draft <b>0</b></span>
            </div>
            <p className="blockers"><WarningCircle /> 8 reports still need attention</p>
            <button className="text-link centered" onClick={() => setActiveTab("review")}>Review blockers</button>
            <button className="generate" onClick={() => { setModal("audit"); setWizardStep(1); }}><FilePdf /> Generate Audit</button>
            <small>Creates a PDF audit packet ready for Primus submission.</small>
          </aside>
        </div>}
      </main>

      {modal && <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
        <div className={`modal ${modal === "audit" ? "wide" : ""}`} onMouseDown={(e) => e.stopPropagation()}>
          <button className="modal-close" onClick={() => setModal(null)}><X /></button>
          {modal === "report" && <ReportForm onDone={() => { setModal(null); setToast("Report saved as draft"); }} />}
          {modal === "review" && <ReviewPanel report={currentReport!} onDone={() => { setModal(null); setToast("Report marked reviewed"); }} />}
          {modal === "audit" && <AuditWizard step={wizardStep} setStep={setWizardStep} onGenerate={downloadPacket} selected={selected.length || 32} />}
        </div>
      </div>}
      {toast && <div className="toast"><CheckCircle weight="fill" />{toast}<button onClick={() => setToast("")}><X /></button></div>}
    </div>
  );
}

function PrimusStandardView() {
  const modules = primusV4Index.modules;
  const totalQuestions = modules.reduce((sum, module) => sum + module.question_count, 0);
  const totalPoints = modules.reduce((sum, module) => sum + module.scored_points, 0);
  const importedReports = heavyConnectInventory.report_count;
  const importedReportTypes = heavyConnectInventory.report_type_count;
  const moduleEvidence = new Map(heavyConnectInventory.primus_v4_module_evidence.map((item) => [item.module_key, item]));
  const recommendedModules = new Set(["module-1-fsms", "module-2-farm", "module-4-harvest-crew", "module-5-facility", "module-6-haccp"]);
  const bayBabyEvidence = heavyConnectInventory.expected_bay_baby_report_status;

  return <div className="standard-workspace">
    <section className="standard-hero">
      <div>
        <span>Audit backbone</span>
        <h2>Use PrimusGFS v4.0 as the source of truth</h2>
        <p>HeavyConnect reports become evidence against v4.0 questions instead of driving the audit structure. That gives Bay Baby a cleaner packet and keeps us ready for the newer standard.</p>
      </div>
      <div className="standard-score">
        <strong>v4.0</strong>
        <span>{totalQuestions} questions</span>
        <span>{totalPoints.toLocaleString()} scored points</span>
        <span>{importedReports} HeavyConnect PDFs imported</span>
      </div>
    </section>

    <section className="module-grid">
      {modules.map((module) => {
        const inScope = recommendedModules.has(module.key);
        const evidence = moduleEvidence.get(module.key);
        return <article key={module.key} className={inScope ? "in-scope" : ""}>
          <div>
            <span>{module.number}</span>
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
        <div className="section-heading"><h2>Bay Baby evidence sources</h2><span>{importedReportTypes} HeavyConnect report types</span></div>
        {bayBabyEvidence.map((item) => <div className="evidence-row" key={item.report_type}>
          <CheckCircle weight="duotone" />
          <div><strong>{item.report_type}</strong><span>{item.count} imported PDF{item.count === 1 ? "" : "s"} • {item.source_files.join(", ")}</span></div>
        </div>)}
      </section>

      <section className="gap-panel">
        <div className="section-heading"><h2>Next gaps to close</h2><span>Before packet generation</span></div>
        <div className="gap-row"><CheckCircle weight="duotone" /><div><strong>HeavyConnect evidence import complete</strong><span>{importedReports} PDFs from Jan 1, 2025 to Jan 1, 2026 are indexed and ready for mapping.</span></div></div>
        <div className="gap-row warning"><WarningCircle weight="fill" /><div><strong>Crosswalk v3.2 self-audit to v4.0</strong><span>HeavyConnect self audit may still be v3.2, so the next build step is a translation layer to v4.0 question IDs.</span></div></div>
        <div className="gap-row"><FilePdf weight="duotone" /><div><strong>Generate question-level packet index</strong><span>Use the imported report examples to attach evidence to specific PrimusGFS v4.0 questions.</span></div></div>
      </section>
    </div>
  </div>;
}

function ReportForm({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(1);
  return <div className="form-panel">
    <div className="modal-heading"><span>New inspection</span><h2>R004 Tractor Inspection</h2><p>Complete the essentials now. You can save and return anytime.</p></div>
    <div className="stepper">{[1, 2, 3].map(n => <span className={step >= n ? "done" : ""} key={n}>{step > n ? <Check /> : n}<b>{["Basics", "Checklist", "Review"][n-1]}</b></span>)}</div>
    {step === 1 && <div className="form-grid">
      <label>Location<select defaultValue=""><option value="" disabled>Select a farm location</option><option>BBP-FARM / 2026 South Fork</option><option>BBP-FARM / 2026 SW Hoffman</option></select></label>
      <label>Date<input type="date" defaultValue="2026-06-22" /></label>
      <label>Time<input type="time" defaultValue="08:15" /></label>
      <label>Inspector<input defaultValue="Juan Diaz" /></label>
      <label className="full">Notes<textarea placeholder="Add optional details for this inspection..." /></label>
    </div>}
    {step === 2 && <div className="checklist">
      {["Tires are properly inflated and undamaged", "Brakes and steering operate correctly", "Lights, guards, and PTO shields are secure", "No visible fuel, oil, or hydraulic leaks"].map((q,i) =>
        <div key={q}><span><b>{i+1}</b>{q}{i===3 && <small>Critical</small>}</span><div><button className="yes">Yes</button><button>No</button><button>N/A</button></div></div>)}
    </div>}
    {step === 3 && <div className="review-summary"><CheckCircle weight="duotone" /><h3>Ready to submit</h3><p>4 checklist items answered • South Fork • June 22, 2026</p><div><span>Calculated severity</span><b>Good</b></div></div>}
    <div className="modal-actions"><button className="secondary" onClick={onDone}>Save draft</button><button className="primary" onClick={() => step < 3 ? setStep(step+1) : onDone()}>{step < 3 ? "Continue" : "Submit report"}</button></div>
  </div>;
}

function ReviewPanel({ report, onDone }: { report: Report; onDone: () => void }) {
  return <div className="form-panel review-panel">
    <div className="modal-heading"><span>Report review</span><h2>{report.code} {report.type}</h2><p>{report.location} • {report.date} • {report.creator}</p></div>
    <div className="review-alert"><WarningCircle weight="fill" /><div><strong>{report.status === "action" ? "Corrective action required" : "2 answers need your review"}</strong><span>Resolve exceptions before marking this report reviewed.</span></div></div>
    <div className="answers">
      <div><span>Equipment sanitized before moving fields?</span><b className="pass">Yes</b></div>
      <div><span>Any visible leaks or damaged guards?</span><b className="fail">No — photo attached</b></div>
      <div><span>Operator completed pre-use inspection?</span><b className="pass">Yes</b></div>
    </div>
    <label>Review notes<textarea placeholder="Add a clear note for the operator..." defaultValue={report.status === "action" ? "Replace damaged PTO guard before equipment returns to service." : ""} /></label>
    <label>Corrective action<textarea placeholder="Describe what must be corrected and by when..." /></label>
    <div className="modal-actions"><button className="secondary" onClick={onDone}>Save notes</button><button className="primary" onClick={onDone}><Check /> Mark reviewed</button></div>
  </div>;
}

function AuditWizard({ step, setStep, onGenerate, selected }: { step: number; setStep: (n:number)=>void; onGenerate:()=>void; selected:number }) {
  const titles = ["Select scope", "Validate readiness", "Preview packet", "Generate PDF"];
  return <div className="wizard">
    <div className="modal-heading"><span>Audit Generator</span><h2>Build a Primus-ready packet</h2><p>We’ll check for missing reports and corrective actions before anything is exported.</p></div>
    <div className="wizard-steps">{titles.map((title,i)=><span className={step >= i+1 ? "done" : ""} key={title}><b>{step > i+1 ? <Check/> : i+1}</b>{title}</span>)}</div>
    <div className="wizard-body">
      {step === 1 && <div className="scope-form"><label>Start date<input type="date" defaultValue="2026-05-22" /></label><label>End date<input type="date" defaultValue="2026-06-22" /></label><label>Locations<select><option>All locations</option></select></label><label>Report types<select><option>All report types</option></select></label><label className="toggle"><input type="checkbox" defaultChecked /><span />Include reviewed reports only</label><label className="toggle"><input type="checkbox" defaultChecked /><span />Include photo attachments</label></div>}
      {step === 2 && <div className="validation-grid">
        <div className="success"><CheckCircle weight="duotone"/><b>{selected}</b><span>Reports found</span></div>
        <div><ClipboardText weight="duotone"/><b>3</b><span>Report types</span></div>
        <div className="warning"><WarningCircle weight="duotone"/><b>8</b><span>Need attention</span></div>
        <div className="warning"><CalendarBlank weight="duotone"/><b>2</b><span>Date gaps</span></div>
        <section><strong>Pre-audit checks</strong><span><CheckCircle/> Required report types found</span><span><WarningCircle/> 6 unreviewed reports</span><span><WarningCircle/> 2 missing corrective actions</span></section>
      </div>}
      {step === 3 && <div className="packet-preview">
        {["Cover page", "Audit summary", "Report index", "Exceptions & corrective actions", "Reports grouped by type", "Attachments appendix", "Signature & review log"].map((s,i)=><div key={s}><span>{i+1}</span><b>{s}</b><CheckCircle weight="fill"/></div>)}
      </div>}
      {step === 4 && <div className="generate-ready"><FilePdf weight="duotone"/><h3>Your packet is ready</h3><p>Bay-Baby-Primus-Audit-Packet_2026-05-22_to_2026-06-22.pdf</p><span>{selected} reports • 7 sections • Attachments included</span></div>}
    </div>
    <div className="modal-actions"><button className="secondary" onClick={() => setStep(Math.max(1,step-1))} disabled={step===1}>Back</button><button className="primary" onClick={() => step < 4 ? setStep(step+1) : onGenerate()}>{step < 4 ? "Continue" : "Generate & download PDF"}</button></div>
  </div>;
}
