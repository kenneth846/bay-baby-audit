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
import { useEffect, useMemo, useState } from "react";
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
import localPrimusSources from "@/data/primus-local/source-map.json";
import primusCrosswalk from "@/data/primusgfs/crosswalks/v3-2-to-v4-0.json";
import primusV4Index from "@/data/primusgfs/v4/index.json";

type Status = "approved" | "review" | "action" | "submitted";
type View = "inspector" | "readiness" | "evidence" | "actions" | "documents" | "traceability" | "standard" | "templates" | "locations" | "team" | "settings";
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
  max_length?: number;
  archived_for_future_reports?: boolean;
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
  answers?: Record<string, string>;
  answerRows?: ReportAnswer[];
  details?: string;
  review?: ReviewRecord;
};

type ReportAnswer = {
  section: string;
  question: string;
  answer: string;
  evidenceMarked: boolean;
  attachments?: MediaAttachment[];
};

type FormAnswers = Record<string, string>;
type EvidenceAnswers = Record<string, MediaAttachment[]>;

type MediaAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
};

type ReviewRecord = {
  note: string;
  correctiveAction: string;
  reviewedAt: string;
  reviewer: string;
};

type CorrectiveAction = {
  id: string;
  title: string;
  module: string;
  source: string;
  severity: "Critical" | "Major" | "Minor";
  owner: string;
  due: string;
  status: "Open" | "In review" | "Closed";
  rootCause: string;
  evidence: string;
};

type DocumentControl = {
  id: string;
  title: string;
  owner: string;
  revision: string;
  status: string;
  linked: string;
};

type TraceabilityTest = {
  lot: string;
  crop: string;
  location: string;
  status: string;
  percent: number;
  next: string;
};

type LocalPrimusModuleSource = {
  module_key: string;
  module: string;
  title: string;
  status: string;
  standard_basis: string;
  source_count: number;
  evidence_categories: string[];
  key_files: string[];
  next_actions: string[];
};

type LocalSourceRecord = {
  id: string;
  title: string;
  module_keys: string[];
  source_files: string[];
  status: string;
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
  "2026 Brent Field",
  "2026 Britt Rd",
  "2026 Davis",
  "2026 Krangnes",
  "2026 Kruse",
  "2026 Lockens",
  "2026 Maplewood",
  "2026 Olsen",
  "BBP-FARM / 2026 South Fork",
  "BBP-FARM / 2026 SW Hoffman",
  "BBP-FARM / 2026 Maplewood",
  "BBP-FARM / 2026 Org. Cram-Jenson",
  "BBP-FARM / 2026 Youngquist",
  "BBP-FARM / 2026 S. Reedy",
  "BBP Warehouse / BBP-WH",
];

const regionSites: Record<string, string[]> = {
  "Farm Fields": ["BBP-FARM", "-"],
  "BBP Warehouse": ["BBP-WH"],
};

const statusCopy = {
  approved: { label: "Approved", action: "View PDF" },
  review: { label: "Needs review", action: "Review" },
  action: { label: "Needs action", action: "Add action" },
  submitted: { label: "Submitted", action: "Review" },
};

const bayBabyLocations: Array<{ code: string; name: string; area: string; manager: string; active: boolean; readiness: number }> = [];
const teamMembers: Array<{ initials: string; name: string; role: string; access: string; status: string }> = [];
const appSettings: Array<{ label: string; value: string; note: string }> = [];
const correctiveActions: CorrectiveAction[] = [];
const documentControls: DocumentControl[] = [];
const traceabilityTests: TraceabilityTest[] = [];

const importColumns = "section_key,section_en,question_key,question_en,type,required,options,comment_required_when,photo_required_when,ca_required_when";
const exampleImportCsv = `${importColumns}
facility,Facility Condition,floors_clean,Are floors clean and free of standing water?,yes_no_na,true,yes:Yes|no:No|na:N/A,no,no,no
facility,Facility Condition,floors_notes,Describe the corrective action taken,long_text,false,,,,`;

const heavyConnectTemplateLibrary = [
  { category: "Field", templates: ["R001 Field Activity Log", "R002 Daily Field Checklist", "R002 Daily Field Checklist - TEST (Do not use)", "R004 Tractor Inspection", "R006 Daily Sanitation Log", "R022 Risk Assessment", "R023 Bee Activity log", "R024 Field Buffer Log"] },
  { category: "Food Safety", templates: ["Anti-Microbial Water Testing - Irrigation and Post Harvest Water", "GMP Buyer Complaint & Feedback", "GMP In House Pest Control Trap Monitoring Log", "Laboratory Testing Results", "Recall Verification", "Traceability Log"] },
  { category: "Harvest", templates: ["Daily Sanitation Log", "Daily Truck Inspection", "Harvest Report/", "Pre-Harvest Inspection", "Pre-Work HEAT Checklist", "R003 Daily Harvest Checklist", "R009 Daily Forklift Inspection", "Tractor Inspection"] },
  { category: "Health & Safety", templates: ["Accident Report", "Equipment Operation Safety Training", "Fire Extinguisher / Eye Wash Station Inspection", "Forklift Operator Safety Test", "FRESH Food, Risk, Enviornment, Health & Safety Committee Meeting", "Hearing Conservation Program", "HEAT EMERGENCY Instruction Checklist", "R013 NUOCA Log", "R014 Corrective Actions", "R015 Facility Walkaround", "R021 Varmint Trap Inspection", "Tractor Operator Safety Test"] },
  { category: "HR", templates: ["BBP Handbook Acknowledgement", "Employee Warning Notice Form", "Housing Safety and Health Checklist", "Parental Leave Policy Revision"] },
  { category: "Maintenance", templates: ["Group 1", "Group 2", "Group 3", "R005 Farm Equipment Service Request", "R010 Warehouse Service Request", "R011 Parts Request", "R012 Post Maintenance Equipment Release"] },
  { category: "Primus v3.2", templates: ["R016 Module 1: Food Safety Management Systems (FSMS)", "R017 Module 2: Farm", "R018 Module 4: Harvest Crew", "R019 Module 5: Facility", "R020 Module 6: HACCP"] },
  { category: "Trainings", templates: ["Forklift Propane Filling handling instructions.", "Garbage/recycle disposal", "Leadership Training: Communication and Team Management", "Peventing the spread of Infectious Diseases", "Preventing Slips, Trips and Falls", "Review on field reports", "Safety Training 3/20/24", "Safety training- Proper Body Mechanics", "Situational Awareness Training"] },
  { category: "Warehouse", templates: ["Chemical Pump Calibration Report", "Daily Sanitation Log", "Discussion and Planning", "Forklift Inspection", "GMP Daily Knife Accountability Log", "GMP In House Pest Control Trap Monitoring Log", "GMP Truck Checklist - Outbound Shipments", "R007 Line Lead - End of Day", "R008 Daily Warehouse Checklist", "Supplies Request", "Tools and Equipment Cleaning and Sanitizing Log", "Wash Water Monitoring Log", "Water Monitoring Log", "Water testing Log- WH wash stations"] },
];

const localStorageKeys = {
  reports: "bay-baby-audit:v2:reports",
  reviews: "bay-baby-audit:v2:reviews",
  actions: "bay-baby-audit:v2:actions",
  documents: "bay-baby-audit:v2:documents",
  recalls: "bay-baby-audit:v2:recalls",
};

const localSourceModules = localPrimusSources.module_sources as LocalPrimusModuleSource[];
const localSourceByModule = new Map(localSourceModules.map((source) => [source.module_key, source]));
const bayBabyActiveModuleKeys = new Set(localPrimusSources.bay_baby_scope.active_module_keys);
const localCapaSources = localPrimusSources.capa_sources as LocalSourceRecord[];
const localDocumentSources = localPrimusSources.document_control_sources as LocalSourceRecord[];
const localTraceabilitySources = localPrimusSources.traceability_sources as LocalSourceRecord[];

function labelForModuleKeys(moduleKeys: string[]) {
  return moduleKeys.map((key) => localSourceByModule.get(key)?.module ?? key.replaceAll("-", " ")).join(", ");
}

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

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function readMediaFile(file: File): Promise<MediaAttachment> {
  return new Promise((resolve) => {
    const attachment = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
    };
    if (!file.type.startsWith("image/") || file.size > 1_500_000) {
      resolve(attachment);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve({ ...attachment, dataUrl: String(reader.result || "") });
    reader.onerror = () => resolve(attachment);
    reader.readAsDataURL(file);
  });
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
  const detailedTemplates: TemplateDefinition[] = [
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
  const detailedNames = new Set(detailedTemplates.map((template) => template.name));
  const inferredTemplates = heavyConnectInventory.reports
    .filter((report, index, reports) =>
      !detailedNames.has(report.report_type) &&
      reports.findIndex((candidate) => candidate.report_type === report.report_type) === index)
    .map((report): TemplateDefinition => ({
      key: `captured-${normalizeCode(report.report_type).toLowerCase()}-${report.report_id}`,
      code: normalizeCode(report.report_type),
      name: report.report_type,
      category: report.evidence_tags.includes("warehouse") ? "Warehouse" :
        report.evidence_tags.includes("worker-health-safety") ? "Health & Safety" :
        report.evidence_tags.includes("training") ? "Trainings" : "Operations",
      status: "needs_options_review",
      source: `Reconstructed from verified HeavyConnect report ${report.report_id}. Admin must confirm answer types and option lists before publishing.`,
      moduleTargets: heavyConnectInventory.primus_v4_module_evidence
        .filter((module) => module.report_types.includes(report.report_type))
        .map((module) => module.module_key.replaceAll("-", " ")),
      sections: [{
        title: "Captured report fields",
        instructions: ["Fields were reconstructed from a completed HeavyConnect PDF and require admin verification before final template lock."],
        questions: report.sample_fields
          .filter((field) => !["Report ID:", "Date & Time:", "Creator:", "Location:", "Coordinates:"].includes(field.question))
          .map((field) => ({
            label: cleanQuestionLabel(field.question),
            type: ["Yes", "No", "N/A"].includes(field.answer) ? "yes_no_na" : field.question.length > 120 ? "long_text" : "short_text",
          })),
      }],
    }));
  return [...detailedTemplates, ...inferredTemplates];
}

function ReportIcon({ code }: { code: string }) {
  if (code === "R004") return <Tractor weight="duotone" />;
  if (code === "R006" || code === "SAN") return <ShieldCheck weight="duotone" />;
  return <ClipboardText weight="duotone" />;
}

function loadStoredJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function formatDateTime(date = new Date()) {
  return date.toLocaleString("en-US", { month: "2-digit", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function AuditApp() {
  const [view, setView] = useState<View>("inspector");
  const [activeTab, setActiveTab] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [modal, setModal] = useState<Modal>(null);
  const [currentReport, setCurrentReport] = useState<Report | null>(null);
  const [wizardStep, setWizardStep] = useState(1);
  const [toast, setToast] = useState("");

  const templates = useMemo(() => buildTemplates(), []);
  const [newReports, setNewReports] = useState<Report[]>([]);
  const [reviews, setReviews] = useState<Record<string, ReviewRecord>>({});
  const [actions, setActions] = useState<CorrectiveAction[]>(correctiveActions);
  const [documents, setDocuments] = useState(documentControls);
  const [recalls, setRecalls] = useState(traceabilityTests);
  const [hydrated, setHydrated] = useState(false);
  const importedReports = useMemo<Report[]>(() => [], []);
  const allReports = useMemo(() => [...newReports, ...importedReports], [importedReports, newReports]);
  const reports = useMemo(() => allReports.filter((report) => {
    const matchesTab = activeTab === "all" || report.status === activeTab ||
      (activeTab === "ready" && report.status === "approved");
    const text = `${report.code} ${report.type} ${report.location} ${report.creator} ${report.sourceFile}`.toLowerCase();
    return matchesTab && text.includes(query.toLowerCase());
  }), [activeTab, allReports, query]);

  useEffect(() => {
    setNewReports(loadStoredJson<Report[]>(localStorageKeys.reports, []));
    setReviews(loadStoredJson<Record<string, ReviewRecord>>(localStorageKeys.reviews, {}));
    setActions(loadStoredJson<CorrectiveAction[]>(localStorageKeys.actions, correctiveActions));
    setDocuments(loadStoredJson(localStorageKeys.documents, documentControls));
    setRecalls(loadStoredJson(localStorageKeys.recalls, traceabilityTests));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(localStorageKeys.reports, JSON.stringify(newReports));
  }, [hydrated, newReports]);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(localStorageKeys.reviews, JSON.stringify(reviews));
  }, [hydrated, reviews]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(localStorageKeys.actions, JSON.stringify(actions));
    window.localStorage.setItem(localStorageKeys.documents, JSON.stringify(documents));
    window.localStorage.setItem(localStorageKeys.recalls, JSON.stringify(recalls));
  }, [actions, documents, hydrated, recalls]);

  const toggle = (id: number) => setSelected((items) =>
    items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);

  const openReport = (report: Report) => {
    if (report.status === "approved") {
      void downloadPacket([report], "report");
      return;
    }
    setCurrentReport(report);
    setModal("review");
  };

  const openAuditWizard = () => {
    setWizardStep(1);
    setModal("audit");
  };

  async function downloadPacket(reportOverride?: Report[], mode: "audit" | "report" = reportOverride?.length === 1 ? "report" : "audit") {
    const sourceReports = reportOverride ?? (selected.length ? allReports.filter((report) => selected.includes(report.id)) : allReports);
    const packetReports = sourceReports.map((report) => ({
      ...report,
      answerRows: answerRowsForReport(report, templates),
      review: reviews[report.reportId],
    }));
    const response = await fetch("/api/audit-packet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        count: packetReports.length || selected.length || heavyConnectInventory.report_count,
        generatedBy: "Juan Diaz",
        selectedIds: reportOverride ? reportOverride.map((report) => report.id) : selected,
        reports: packetReports,
        startDate: "2025-01-01",
        endDate: "2026-01-01",
      }),
    });
    if (!response.ok) {
      setToast("Packet validation failed");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    if (mode === "report") {
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setToast("Report PDF opened");
      setModal(null);
      return;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = "Bay-Baby-PrimusGFS-Audit-Packet_2025-01-01_to_2026-01-01.pdf";
    a.click();
    URL.revokeObjectURL(url);
    setToast("Audit packet generated");
    setModal(null);
  }

  const pageCopy = {
    inspector: ["Inspector", "Create, review, approve, and prepare Bay Baby reports for audit"],
    readiness: ["Readiness", "Certification blockers, module scores, and next audit-critical work"],
    evidence: ["Evidence", "Map Bay Baby records to Primus questions and module expectations"],
    actions: ["CAPA", "Corrective actions, root cause, due dates, and reviewer acceptance"],
    documents: ["Documents", "Controlled SOPs, revisions, retention, and training dependencies"],
    traceability: ["Traceability", "Lot recall readiness, KDE-style records, and mock recall tests"],
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
          <button className={view === "readiness" ? "active" : ""} onClick={() => setView("readiness")}><ShieldCheck /><span>Readiness</span></button>
          <button className={view === "evidence" ? "active" : ""} onClick={() => setView("evidence")}><Files /><span>Evidence</span></button>
          <button className={view === "actions" ? "active" : ""} onClick={() => setView("actions")}><WarningCircle /><span>CAPA</span></button>
          <button className={view === "documents" ? "active" : ""} onClick={() => setView("documents")}><BookOpenText /><span>Documents</span></button>
          <button className={view === "traceability" ? "active" : ""} onClick={() => setView("traceability")}><MapPin /><span>Traceability</span></button>
          <button className={view === "standard" ? "active" : ""} onClick={() => setView("standard")}><BookOpenText /><span>Primus v4.0</span></button>
          <button onClick={openAuditWizard}><Archive /><span>Audit Packets</span></button>
          <button className={view === "templates" ? "active" : ""} onClick={() => setView("templates")}><Files /><span>Templates</span></button>
          <button className={view === "locations" ? "active" : ""} onClick={() => setView("locations")}><Buildings /><span>Locations</span></button>
          <button className={view === "team" ? "active" : ""} onClick={() => setView("team")}><UsersThree /><span>Team</span></button>
          <button className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}><Gear /><span>Settings</span></button>
        </nav>
        <div className="profile"><div className="avatar">BB</div><div><strong>Bay Baby</strong><span>Workspace</span></div><CaretDown /></div>
      </aside>

      <main>
        <header className="topbar">
          <div><h1>{topbarTitle}</h1><p>{topbarCopy}</p></div>
          <button className="primary" onClick={() => view === "standard" ? openAuditWizard() : setModal("start")}>
            {view === "standard" ? <FilePdf /> : <Plus />} {view === "standard" ? "Build Audit Packet" : "Start Report"}
          </button>
        </header>

        {view === "readiness" && <ReadinessView reports={allReports} actions={actions} documents={documents} recalls={recalls} onNavigate={setView} />}
        {view === "evidence" && <EvidenceWorkbench onReview={(reportType) => { setQuery(reportType); setActiveTab("all"); setView("inspector"); }} onAttach={() => setModal("start")} />}
        {view === "actions" && <CorrectiveActionsView actions={actions} onCreate={() => {
          setActions((items) => [{
            id: `CAPA-${String(Date.now()).slice(-6)}`, title: "New corrective action", module: "Unassigned", source: "Manual entry",
            severity: "Minor", owner: "Juan Diaz", due: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
            status: "Open", rootCause: "Root cause analysis pending", evidence: "Closure evidence pending",
          }, ...items]);
          setToast("New CAPA created");
        }} onAdvance={(id) => setActions((items) => items.map((action) => action.id === id ? { ...action, status: action.status === "Open" ? "In review" : action.status === "In review" ? "Closed" : "Closed" } : action))} />}
        {view === "documents" && <DocumentsView documents={documents} onAdd={() => {
          setDocuments((items) => [{ id: `DOC-${String(Date.now()).slice(-5)}`, title: "New controlled document", owner: "Juan Diaz", revision: "0.1", status: "Draft review required", linked: "Unassigned" }, ...items]);
          setToast("Controlled document added");
        }} onReview={(id) => setDocuments((items) => items.map((document) => document.id === id ? { ...document, status: "Current" } : document))} />}
        {view === "traceability" && <TraceabilityView recalls={recalls} onStart={() => {
          setRecalls((items) => [{ lot: `BBP-MOCK-${new Date().toISOString().slice(0, 10)}`, crop: "Select product", location: "BBP Warehouse", status: "In progress", percent: 0, next: new Date().toISOString().slice(0, 10) }, ...items]);
          setToast("Mock recall started");
        }} onAdvance={(lot) => setRecalls((items) => items.map((test) => test.lot === lot ? { ...test, percent: Math.min(100, test.percent + 20), status: test.percent >= 80 ? "Complete" : "In progress" } : test))} />}
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
          onGenerate={openAuditWizard}
        />}
      </main>

      {modal && <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
        <div className={`modal ${modal === "audit" || modal === "start" || modal === "review" ? "wide" : ""} ${modal === "review" ? "report-detail-modal" : ""}`} onMouseDown={(event) => event.stopPropagation()}>
          <button className="modal-close" onClick={() => setModal(null)}><X /></button>
          {modal === "start" && <StartReportFlow templates={templates} onCancel={() => setModal(null)} onSubmit={(report) => {
            setNewReports((items) => [report, ...items]);
            setSelected((items) => [report.id, ...items]);
            setModal(null);
            setToast("Report submitted for review");
            setView("inspector");
          }} />}
          {modal === "review" && currentReport && <ReviewPanel report={currentReport} review={reviews[currentReport.reportId]} answerRows={answerRowsForReport(currentReport, templates)} onPacket={() => downloadPacket([currentReport])} onDone={(review, approve) => {
            setReviews((items) => ({ ...items, [currentReport.reportId]: review }));
            if (approve) setNewReports((items) => items.map((report) => report.reportId === currentReport.reportId ? { ...report, status: "approved", severity: "Good" } : report));
            setModal(null);
            setToast(approve ? "Report approved" : "Review notes saved");
          }} />}
          {modal === "audit" && <AuditWizard step={wizardStep} setStep={setWizardStep} onGenerate={downloadPacket} selected={selected.length || allReports.length} />}
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

function ReadinessView({ reports, actions, documents, recalls, onNavigate }: {
  reports: Report[];
  actions: CorrectiveAction[];
  documents: typeof documentControls;
  recalls: typeof traceabilityTests;
  onNavigate: (view: View) => void;
}) {
  const approved = reports.filter((report) => report.status === "approved").length;
  const inReview = reports.filter((report) => report.status === "review").length;
  const openActionCount = actions.filter((action) => action.status !== "Closed").length;
  const needsAction = reports.filter((report) => report.status === "action").length + openActionCount;
  const scopedSources = localSourceModules.filter((source) => bayBabyActiveModuleKeys.has(source.module_key));
  const sourceCoverage = Math.round((scopedSources.filter((source) => source.source_count > 0).length / Math.max(scopedSources.length, 1)) * 100);
  const forecast = reports.length ? Math.round((approved / Math.max(reports.length, 1)) * 100) : sourceCoverage;
  const localSourceCount = scopedSources.reduce((sum, source) => sum + source.source_count, 0);

  return <div className="standard-workspace">
    <section className="standard-hero readiness-hero">
      <div>
        <span>Production cockpit</span>
        <h2>Primus readiness is {forecast}% with v3.2 evidence ready to migrate</h2>
        <p>Bay Baby's supplied PRIMUS files are real v3.2-era audit evidence. The next production step is to preserve what Bay Baby actually uses, then map it carefully into the v4.0 backbone before relying on question-level scoring.</p>
      </div>
      <div className="standard-score">
        <strong>{forecast}%</strong>
        <span>{localSourceCount} source items mapped</span>
        <span>{inReview} awaiting manager review</span>
        <span>{needsAction} app blockers</span>
        <span>{scopedSources.length} Bay Baby modules in scope</span>
      </div>
    </section>
    {reports.length === 0 && <section className="empty-state"><ShieldCheck weight="duotone" /><h2>No app-created reports yet</h2><p>Readiness is currently based on the shared-drive PRIMUS source map. Create reports when the team starts using Bay Baby Audit for live records.</p></section>}
    <section className="audit-command-grid">
      <div className="gap-panel"><div className="section-heading"><h2>Certification blockers</h2><span>Fix first</span></div>
        <button className="gap-row warning" onClick={() => onNavigate("evidence")}><WarningCircle weight="fill" /><div><strong>v3.2 evidence needs v4.0 crosswalk review</strong><span>Review shared-drive evidence against the exact PrimusGFS v4.0 questions before final scoring.</span></div></button>
        <button className="gap-row warning" onClick={() => onNavigate("documents")}><WarningCircle weight="fill" /><div><strong>Controlled final versions must be confirmed</strong><span>Food safety plan, binder materials, supplier register, IPM plan, and HACCP documents need owner/revision/effective-date control.</span></div></button>
        <button className="gap-row warning" onClick={() => onNavigate("actions")}><WarningCircle weight="fill" /><div><strong>{localPrimusSources.capa_sources.length} historical CAPA packages found</strong><span>Normalize NCRs into root cause, correction, prevention, evidence, and reviewer acceptance fields.</span></div></button>
        <button className="gap-row warning" onClick={() => onNavigate("traceability")}><WarningCircle weight="fill" /><div><strong>{localPrimusSources.traceability_sources.length} mock recall source found</strong><span>Convert the historical exercise into a repeatable 2026 mock recall workflow.</span></div></button>
      </div>
      <div className="gap-panel"><div className="section-heading"><h2>Bay Baby scope</h2><span>Source backed</span></div>
        {scopedSources.map((source) => <div className="gap-row" key={source.module_key}><CheckCircle weight="duotone" /><div><strong>{source.module}: {source.title}</strong><span>{source.source_count} source items found / {source.standard_basis}</span></div></div>)}
      </div>
    </section>
  </div>;
}

function EvidenceWorkbench({ onReview, onAttach }: { onReview: (reportType: string) => void; onAttach: () => void }) {
  const modules = primusV4Index.modules;
  const moduleEvidence = new Map(heavyConnectInventory.primus_v4_module_evidence.map((item) => [item.module_key, item]));
  const displayModules = [
    ...modules,
    ...localSourceModules.filter((source) => !modules.some((module) => module.key === source.module_key)).map((source) => ({
      key: source.module_key,
      number: source.module,
      title: source.title,
      question_count: 0,
      sections: [],
      scored_points: 0,
    })),
  ];
  return <div className="standard-workspace">
    <section className="standard-hero compact">
      <div>
        <span>Question-level evidence</span>
        <h2>Map Bay Baby's v3.2-era evidence into the audit backbone</h2>
        <p>The shared-drive PRIMUS files show what Bay Baby actually uses. Keep these source links intact, then review each mapping before treating it as v4.0-ready proof.</p>
      </div>
      <button className="primary" onClick={onAttach}><Plus /> Create evidence report</button>
    </section>
    <section className="evidence-board">
      {displayModules.map((module) => {
        const evidence = moduleEvidence.get(module.key);
        const localSource = localSourceByModule.get(module.key);
        const coverage = localSource?.source_count ? Math.min(92, 48 + localSource.source_count * 3) : Math.min(96, evidence?.evidence_count ? 44 + evidence.evidence_count * 8 : 18);
        return <article key={module.key}>
          <div className="section-heading"><h2>{module.number}: {module.title}</h2><span>{coverage}% mapped</span></div>
          <div className="mini-progress"><i style={{ width: `${coverage}%` }} /></div>
          <p>{localSource ? `${localSource.source_count} Bay Baby source items found. ${localSource.standard_basis}.` : `${module.question_count} questions, ${module.sections.length} sections, ${module.scored_points.toLocaleString()} points.`}</p>
          <div className="evidence-tags">
            {(localSource?.evidence_categories ?? evidence?.report_types ?? ["No mapped records yet"]).slice(0, 5).map((item) => <span key={item}>{item}</span>)}
          </div>
          <button className="row-action" onClick={() => onReview(evidence?.report_types?.[0] ?? "")}>Open mapped records</button>
        </article>;
      })}
    </section>
  </div>;
}

function CorrectiveActionsView({ actions, onCreate, onAdvance }: { actions: CorrectiveAction[]; onCreate: () => void; onAdvance: (id: string) => void }) {
  const sourcePackages = localCapaSources;
  return <div className="standard-workspace">
    <section className="standard-hero compact">
      <div>
        <span>Corrective actions</span>
        <h2>{sourcePackages.length} historical CAPA packages need normalization</h2>
        <p>Bay Baby's folders include real NCR closure evidence. Convert each package into root cause, correction, preventive action, due date, closure evidence, and reviewer acceptance before the next audit cycle.</p>
      </div>
      <button className="primary" onClick={onCreate}><Plus /> New CAPA</button>
    </section>
    <section className="capa-list">
      {sourcePackages.map((source) => <article key={source.id} className="major">
        <div><span>{source.id}</span><b className="capture needs_options_review">Normalize</b></div>
        <h3>{source.title}</h3>
        <p>{labelForModuleKeys(source.module_keys)} / {source.status}</p>
        <div className="capa-meta"><span>Historical NCR</span><span>{source.source_files.length} source files</span><span>v3.2-era evidence</span></div>
        <div className="answers">
          <div><span>Source package</span><b>{source.source_files[0]}</b></div>
          <div><span>Next step</span><b>Create live CAPA fields and attach closure evidence</b></div>
        </div>
      </article>)}
      {actions.length === 0 && sourcePackages.length === 0 && <div className="empty-state"><WarningCircle weight="duotone" /><h2>No corrective actions</h2><p>CAPAs created from report findings will appear here.</p></div>}
      {actions.map((action) => <article key={action.id} className={action.severity === "Major" ? "major" : ""}>
        <div><span>{action.id}</span><b className={`capture ${action.status === "Closed" ? "ready" : "needs_options_review"}`}>{action.status}</b></div>
        <h3>{action.title}</h3>
        <p>{action.module} / {action.source}</p>
        <div className="capa-meta"><span>{action.severity}</span><span>Owner: {action.owner}</span><span>Due: {action.due}</span></div>
        <div className="answers">
          <div><span>Root cause</span><b>{action.rootCause}</b></div>
          <div><span>Closure evidence</span><b>{action.evidence}</b></div>
        </div>
        <button className="row-action" disabled={action.status === "Closed"} onClick={() => onAdvance(action.id)}>{action.status === "Open" ? "Send to review" : action.status === "In review" ? "Accept closure" : "Closed"}</button>
      </article>)}
    </section>
  </div>;
}

function DocumentsView({ documents, onAdd, onReview }: { documents: DocumentControl[]; onAdd: () => void; onReview: (id: string) => void }) {
  const sourceDocuments = localDocumentSources;
  return <div className="standard-workspace">
    <section className="standard-hero compact">
      <div>
        <span>Document control</span>
        <h2>{sourceDocuments.length} controlled source groups found</h2>
        <p>These are the real Bay Baby PRIMUS documents to convert into controlled records with owner, approval, revision, effective date, retention, and module/question links.</p>
      </div>
      <button className="primary" onClick={onAdd}><Plus /> Add document</button>
    </section>
    <section className="template-table management-table">
      {sourceDocuments.map((document) => <article key={document.id}>
        <div className="template-icon"><BookOpenText weight="duotone" /></div>
        <div>
          <span>{document.id} / {labelForModuleKeys(document.module_keys)}</span>
          <h3>{document.title}</h3>
          <p>{document.source_files.length} source file{document.source_files.length === 1 ? "" : "s"} / {document.source_files[0]}</p>
        </div>
        <b className="capture needs_options_review">{document.status}</b>
        <button className="row-action" disabled>Source mapped</button>
      </article>)}
      {documents.length === 0 && sourceDocuments.length === 0 && <div className="empty-state"><BookOpenText weight="duotone" /><h2>No controlled documents</h2><p>Add the first approved SOP, policy, or audit record.</p></div>}
      {documents.map((document) => <article key={document.id}>
        <div className="template-icon"><BookOpenText weight="duotone" /></div>
        <div>
          <span>{document.id} / Rev {document.revision}</span>
          <h3>{document.title}</h3>
          <p>Owner: {document.owner} / Linked to {document.linked} / Retention: 24 months minimum</p>
        </div>
        <b className={document.status.includes("gap") || document.status.includes("required") ? "capture needs_options_review" : "capture ready"}>{document.status}</b>
        <button className="row-action" disabled={document.status === "Current"} onClick={() => onReview(document.id)}>{document.status === "Current" ? "Current" : "Mark reviewed"}</button>
      </article>)}
    </section>
  </div>;
}

function TraceabilityView({ recalls, onStart, onAdvance }: { recalls: TraceabilityTest[]; onStart: () => void; onAdvance: (lot: string) => void }) {
  const sourceExercises = localTraceabilitySources;
  return <div className="standard-workspace">
    <section className="standard-hero compact">
      <div>
        <span>Traceability</span>
        <h2>{sourceExercises.length} historical mock recall source found</h2>
        <p>Use the existing mock recall as the evidence baseline, then run the next exercise with traceback, trace-forward, contact checks, quantity reconciliation, and lessons learned inside the app.</p>
      </div>
      <button className="primary" onClick={onStart}><Plus /> Start mock recall</button>
    </section>
    <section className="traceability-grid">
      {sourceExercises.map((exercise) => <article key={exercise.id}>
        <div><span>{exercise.id}</span><b>Found</b></div>
        <h3>{exercise.title}</h3>
        <p>{exercise.source_files[0]}</p>
        <div className="mini-progress"><i style={{ width: "68%" }} /></div>
        <div className="capa-meta"><span>{exercise.status}</span><span>Next: convert to live 2026 workflow</span></div>
      </article>)}
      {recalls.length === 0 && sourceExercises.length === 0 && <div className="empty-state"><MapPin weight="duotone" /><h2>No mock recalls</h2><p>Start a mock recall to track traceback and trace-forward completion.</p></div>}
      {recalls.map((test) => <article key={test.lot}>
        <div><span>{test.lot}</span><b>{test.percent}%</b></div>
        <h3>{test.crop}</h3>
        <p>{test.location}</p>
        <div className="mini-progress"><i style={{ width: `${test.percent}%` }} /></div>
        <div className="capa-meta"><span>{test.status}</span><span>Next: {test.next}</span></div>
        <button className="row-action" disabled={test.percent >= 100} onClick={() => onAdvance(test.lot)}>{test.percent >= 100 ? "Complete" : "Record recall step"}</button>
      </article>)}
    </section>
  </div>;
}

function TemplatesView({ templates, onStart }: { templates: TemplateDefinition[]; onStart: () => void }) {
  const remainingGapCount = liveCaptureGaps.templates.reduce((sum, template) => sum + template.missing_controls.length, 0);
  const [importText, setImportText] = useState(exampleImportCsv);
  const importRows = useMemo(() => {
    const lines = importText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const [headerLine, ...rows] = lines;
    const headers = headerLine?.split(",").map((item) => item.trim()) ?? [];
    return rows.slice(0, 6).map((row) => {
      const values = row.split(",").map((item) => item.trim());
      return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    });
  }, [importText]);

  return <div className="standard-workspace">
    <section className="standard-hero compact">
      <div>
        <span>Active templates</span>
        <h2>Start from the same reports Bay Baby actually uses</h2>
        <p>Templates are ready for daily use. Admin review items show controls that should be locked before final audit season.</p>
      </div>
      <button className="primary" onClick={onStart}><Plus /> Start Report</button>
    </section>
    <section className="import-workbench">
      <div className="section-heading"><h2>HeavyConnect template import</h2><span>CSV, PDF, or screen capture</span></div>
      <div className="import-grid">
        <div>
          <h3>Accepted CSV columns</h3>
          <p>{importColumns}</p>
          <textarea value={importText} onChange={(event) => setImportText(event.target.value)} spellCheck={false} />
        </div>
        <div>
          <h3>Detected questions</h3>
          {importRows.map((row, index) => <div className="import-row" key={`${row.question_key}-${index}`}>
            <strong>{row.question_en || "Untitled question"}</strong>
            <span>{row.section_en || "No section"} / {row.type || "unknown"} / {row.required === "true" ? "required" : "optional"}</span>
          </div>)}
          {importRows.length === 0 && <p className="helper">Paste CSV exported from HeavyConnect or built from a PDF/screenshot review to preview detected questions.</p>}
        </div>
      </div>
      <div className="import-sources">
        {[
          ["Logged-in screen", "We observe the template builder or blank form after you sign in, then map fields and conditional rules."],
          ["PDF / print export", "Upload or print a blank HeavyConnect template and parse sections, questions, answer options, and uncertain fields."],
          ["CSV / Excel", "Best path if available. Import columns directly into versioned templates, then publish after admin review."],
        ].map(([title, copy]) => <article key={title}><strong>{title}</strong><span>{copy}</span></article>)}
      </div>
      <div className="hc-library">
        <div className="section-heading"><h2>Observed HeavyConnect library</h2><span>{heavyConnectTemplateLibrary.reduce((sum, group) => sum + group.templates.length, 0)} report templates</span></div>
        {heavyConnectTemplateLibrary.map((group) => <article key={group.category}>
          <strong>{group.category}</strong>
          <p>{group.templates.join(" / ")}</p>
        </article>)}
      </div>
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
  const displayModules = [
    ...modules,
    ...localSourceModules.filter((source) => !modules.some((module) => module.key === source.module_key)).map((source) => ({
      key: source.module_key,
      number: source.module,
      title: source.title,
      question_count: 0,
      sections: [],
      scored_points: 0,
    })),
  ];
  const totalQuestions = modules.reduce((sum, module) => sum + module.question_count, 0);
  const totalPoints = modules.reduce((sum, module) => sum + module.scored_points, 0);
  const importedReports = heavyConnectInventory.report_count;
  const localSourceCount = localSourceModules.reduce((sum, module) => sum + module.source_count, 0);
  const selfAuditQuestionCount = heavyConnectSelfAudit32.modules.reduce((sum, module) => sum + module.question_count, 0);
  const crosswalkSummary = primusCrosswalk.summary as CrosswalkSummary;
  const moduleEvidence = new Map(heavyConnectInventory.primus_v4_module_evidence.map((item) => [item.module_key, item]));
  const bayBabyEvidence = localSourceModules.map((source) => ({
    report_type: `${source.module}: ${source.title}`,
    count: source.source_count,
    source_files: source.key_files,
  }));

  return <div className="standard-workspace">
    <section className="standard-hero">
      <div>
        <span>Audit backbone</span>
        <h2>Preserve Bay Baby's v3.2 evidence while preparing for v4.0</h2>
        <p>The supplied PRIMUS folders are the practical source of truth for what Bay Baby does today. PrimusGFS v4.0 remains the target standard, but each old document/report needs a reviewed crosswalk before official scoring.</p>
      </div>
      <div className="standard-score">
        <strong>v4.0</strong>
        <span>{totalQuestions} questions</span>
        <span>{totalPoints.toLocaleString()} scored points</span>
        <span>{localSourceCount} local source items mapped</span>
        <span>{importedReports} HeavyConnect examples retained</span>
        <span>{selfAuditQuestionCount} Self-audit questions mapped</span>
        <span>{crosswalkSummary.strong_candidate ?? 0} legacy question matches</span>
      </div>
    </section>

    <section className="module-grid">
      {displayModules.map((module) => {
        const inScope = bayBabyActiveModuleKeys.has(module.key);
        const evidence = moduleEvidence.get(module.key);
        const localSource = localSourceByModule.get(module.key);
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
        <div className="section-heading"><h2>Bay Baby PRIMUS source folders</h2><span>{localSourceCount} source items</span></div>
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
  const averageReadiness = bayBabyLocations.length ? Math.round(bayBabyLocations.reduce((sum, location) => sum + location.readiness, 0) / bayBabyLocations.length) : 0;
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
      {bayBabyLocations.length === 0 && <div className="empty-state"><Buildings weight="duotone" /><h2>No locations configured</h2><p>Add Bay Baby ranches and facilities when the production database is connected.</p></div>}
      {bayBabyLocations.map((location) => <article key={location.code}>
        <div className="template-icon"><Buildings weight="duotone" /></div>
        <div>
          <span>{location.area} / {location.code}</span>
          <h3>{location.name}</h3>
          <p>Manager: {location.manager} / Status: {location.active ? "Active" : "Inactive"}</p>
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
          <span>{member.role} / {member.status}</span>
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

function questionAnswerKey(sectionIndex: number, questionIndex: number) {
  return `${sectionIndex}:${questionIndex}`;
}

function answerForLabel(template: TemplateDefinition, answers: FormAnswers, label: string) {
  for (const [sectionIndex, section] of template.sections.entries()) {
    const questionIndex = section.questions.findIndex((question) => cleanQuestionLabel(question.label) === label);
    if (questionIndex >= 0) return answers[questionAnswerKey(sectionIndex, questionIndex)] ?? "";
  }
  return "";
}

function isQuestionVisible(template: TemplateDefinition, question: Question, answers: FormAnswers) {
  if (template.code !== "R001") return true;
  const label = cleanQuestionLabel(question.label);
  const activityType = answerForLabel(template, answers, "Activity Type");
  if (!activityType && label !== "Activity Type") return false;
  const activitySpecific = new Set([
    "Ground Work",
    "Product Applied",
    "Application Method",
    "Volume Applied",
    "Other Volume",
    "Pre-Harvest Interval",
    "Restricted Entry Interval",
    "Target Pest",
  ]);
  const irrigationSpecific = new Set([
    "Irrigation Type",
    "Source Inspection",
    "Hours of Use",
    "For Drip Irrigation input 1470. For Overhead Irrigation input 13582",
    "Volume of Water Applied",
  ]);
  const plantingSpecific = new Set(["Variety", "Seed Volume (lbs)"]);
  if (label === "Ground Work") return activityType === "Ground Work";
  if (activitySpecific.has(label)) return activityType === "Application";
  if (irrigationSpecific.has(label)) return activityType === "Irrigation";
  if (plantingSpecific.has(label)) return ["Planting", "Transplant", "Re-Plant"].includes(activityType);
  return true;
}

function answerRowsForReport(report: Report, templates: TemplateDefinition[]): ReportAnswer[] {
  if (report.answerRows?.length) return report.answerRows;
  if (!report.answers) return [];
  const template = templates.find((item) => item.name === report.type || item.code === report.code);
  if (!template) return Object.entries(report.answers).map(([key, value]) => ({
    section: "Captured answers",
    question: key,
    answer: value,
    evidenceMarked: false,
    attachments: [],
  }));
  return template.sections.flatMap((section, sectionIndex) =>
    section.questions.map((question, questionIndex): ReportAnswer | null => {
      if (question.type === "instruction") return null;
      const key = questionAnswerKey(sectionIndex, questionIndex);
      const answer = report.answers?.[key];
      if (!answer) return null;
      return {
        section: section.title,
        question: cleanQuestionLabel(question.label),
        answer,
        evidenceMarked: false,
        attachments: [],
      };
    }).filter((row): row is ReportAnswer => row !== null));
}

function StartReportFlow({ templates, onCancel, onSubmit }: { templates: TemplateDefinition[]; onCancel: () => void; onSubmit: (report: Report) => void }) {
  const [selectedTemplateKey, setSelectedTemplateKey] = useState(templates[0]?.key ?? "");
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("Farm Fields");
  const [site, setSite] = useState("BBP-FARM");
  const [location, setLocation] = useState(farmLocations[0]);
  const [reportedBy, setReportedBy] = useState("Juan Diaz");
  const [reportDate, setReportDate] = useState("2026-06-23");
  const [reportTime, setReportTime] = useState("07:00");
  const [endTime, setEndTime] = useState("08:00");
  const [details, setDetails] = useState("");
  const [answers, setAnswers] = useState<FormAnswers>({});
  const [evidence, setEvidence] = useState<EvidenceAnswers>({});
  const [activeSection, setActiveSection] = useState(0);
  const [loadedSections, setLoadedSections] = useState(1);
  const [validationMessage, setValidationMessage] = useState("");
  const selectedTemplate = templates.find((template) => template.key === selectedTemplateKey) ?? templates[0];
  const filteredTemplates = templates.filter((template) => `${template.name} ${template.category} ${template.code}`.toLowerCase().includes(search.toLowerCase()));
  const statusLabel = selectedTemplate.status === "ready" ? "Ready" : "Needs option review";
  const requiredQuestions = selectedTemplate.sections.flatMap((section, sectionIndex) =>
    section.questions.map((question, questionIndex) => ({ question, key: questionAnswerKey(sectionIndex, questionIndex) })))
    .filter(({ question }) => question.required && question.type !== "instruction" && isQuestionVisible(selectedTemplate, question, answers));
  const missingRequired = requiredQuestions.filter(({ key }) => !answers[key]);
  const visibleSections = selectedTemplate.sections.slice(0, loadedSections);
  const currentSection = visibleSections[Math.min(activeSection, visibleSections.length - 1)] ?? selectedTemplate.sections[0];
  const currentSectionIndex = Math.max(0, selectedTemplate.sections.indexOf(currentSection));

  const updateAnswer = (key: string, value: string) => {
    setAnswers((items) => ({ ...items, [key]: value }));
    setValidationMessage("");
  };

  const chooseTemplate = (templateKey: string) => {
    setSelectedTemplateKey(templateKey);
    setAnswers({});
    setEvidence({});
    setActiveSection(0);
    setLoadedSections(1);
    setValidationMessage("");
  };

  const loadNextSection = () => {
    const nextLoaded = Math.min(selectedTemplate.sections.length, loadedSections + 1);
    setLoadedSections(nextLoaded);
    setActiveSection(Math.min(nextLoaded - 1, selectedTemplate.sections.length - 1));
  };

  const submitReport = () => {
    if (missingRequired.length > 0) {
      setValidationMessage(`${missingRequired.length} required field${missingRequired.length === 1 ? "" : "s"} still need answers.`);
      setStep(3);
      return;
    }
    const answerRows = selectedTemplate.sections.flatMap((section, sectionIndex) =>
      section.questions.map((question, questionIndex): ReportAnswer | null => {
        if (question.type === "instruction" || !isQuestionVisible(selectedTemplate, question, answers)) return null;
        const key = questionAnswerKey(sectionIndex, questionIndex);
        return {
          section: section.title,
          question: cleanQuestionLabel(question.label),
          answer: answers[key] || "",
          evidenceMarked: (evidence[key]?.length ?? 0) > 0,
          attachments: evidence[key] ?? [],
        };
      }).filter((row): row is ReportAnswer => row !== null));
    onSubmit({
      id: Date.now(),
      reportId: `BBA-${Math.floor(100000 + Math.random() * 900000)}`,
      type: selectedTemplate.name,
      code: selectedTemplate.code,
      location,
      date: `${reportDate} ${reportTime}`,
      creator: reportedBy || "Juan Diaz",
      status: "review",
      severity: "Attention",
      sourceFile: "Created in Bay Baby Audit",
      evidenceTags: selectedTemplate.moduleTargets,
      answers,
      answerRows,
      details: `${region} / ${site}. ${details}`.trim(),
    });
  };

  return <div className="form-panel start-flow">
    <div className="modal-heading"><span>Start Report</span><h2>{step === 1 ? "Choose a report template" : selectedTemplate.name}</h2><p>{step === 1 ? "Pick a Bay Baby report type, fill it out, and submit it for review." : selectedTemplate.source}</p></div>
    <div className="stepper real-stepper">{["Template", "Basics", "Questions", "Submit"].map((label, index) => <span className={step >= index + 1 ? "done" : ""} key={label}>{step > index + 1 ? <Check /> : index + 1}<b>{label}</b></span>)}</div>

    {step === 1 && <>
      <label className="template-search"><MagnifyingGlass /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search templates..." /></label>
      <div className="template-picker">
        {filteredTemplates.map((template) => <button type="button" key={template.key} className={template.key === selectedTemplateKey ? "selected" : ""} onClick={() => chooseTemplate(template.key)}>
          <span className="template-icon"><ReportIcon code={template.code} /></span>
          <strong>{template.name}</strong>
          <small>{template.category} / {template.sections.reduce((sum, section) => sum + section.questions.length, 0)} fields</small>
          <b className={`capture ${template.status}`}>{template.status === "ready" ? "Ready" : "Option review"}</b>
        </button>)}
      </div>
    </>}

    {step === 2 && <div className="form-grid">
      <label>Region<select value={region} onChange={(event) => { setRegion(event.target.value); setSite(regionSites[event.target.value]?.[0] ?? ""); }}><option>Farm Fields</option><option>BBP Warehouse</option></select></label>
      <label>Site<select value={site} onChange={(event) => setSite(event.target.value)}>{(regionSites[region] ?? []).map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Location<select value={location} onChange={(event) => setLocation(event.target.value)}>{farmLocations.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Date of Activity<input type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} /></label>
      <label>Start Time<input type="time" value={reportTime} onChange={(event) => setReportTime(event.target.value)} /></label>
      <label>End Time<input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label>
      <label>Reported by<input value={reportedBy} onChange={(event) => setReportedBy(event.target.value)} /></label>
      <label className="full">Details<textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={950} placeholder="Optional details, notes, or field context..." /></label>
    </div>}

    {step === 3 && <div className="dynamic-form">
      {validationMessage && <p className="form-warning"><WarningCircle weight="fill" /> {validationMessage}</p>}
      <div className="form-workbench">
        <aside className="section-rail"><strong>Sections</strong>{selectedTemplate.sections.map((section, index) => <button type="button" disabled={index >= loadedSections} className={activeSection === index ? "active" : ""} onClick={() => setActiveSection(index)} key={section.title}>{index + 1}<span>{section.title}</span></button>)}</aside>
        <div className="section-card" key={`${selectedTemplate.key}-${currentSection.title}`}>
          <div className="section-title"><span>{currentSectionIndex + 1}</span><h3>{currentSection.title}</h3><small>{currentSection.questions.filter((question) => isQuestionVisible(selectedTemplate, question, answers)).length} visible fields</small></div>
          {currentSection.instructions?.map((instruction) => <p className="instruction" key={instruction}>{instruction}</p>)}
          {currentSection.questions.map((question, index) => {
            if (!isQuestionVisible(selectedTemplate, question, answers)) return null;
            const answerKey = questionAnswerKey(currentSectionIndex, index);
            return <QuestionInput
              question={question}
              index={index}
              value={answers[answerKey] ?? ""}
              attachments={evidence[answerKey] ?? []}
              onAttach={async (files) => {
                const nextAttachments = await Promise.all(files.map(readMediaFile));
                setEvidence((items) => ({ ...items, [answerKey]: [...(items[answerKey] ?? []), ...nextAttachments].slice(0, 6) }));
              }}
              onClearAttachments={() => setEvidence((items) => {
                const next = { ...items };
                delete next[answerKey];
                return next;
              })}
              onChange={(value) => updateAnswer(answerKey, value)}
              key={`${currentSection.title}-${question.label}-${index}`}
            />;
          })}
          {loadedSections < selectedTemplate.sections.length && <div className="load-section"><button type="button" className="primary" onClick={loadNextSection}>Load next section</button></div>}
        </div>
      </div>
    </div>}

    {step === 4 && <div className="review-summary">
      <CheckCircle weight="duotone" />
      <h3>Ready to submit</h3>
      <p>{selectedTemplate.name} / {site} / {location} / {selectedTemplate.sections.length} sections</p>
      <div><span>Answered fields</span><b>{Object.values(answers).filter(Boolean).length}</b></div>
      <div><span>Media attachments</span><b>{Object.values(evidence).reduce((sum, files) => sum + files.length, 0)}</b></div>
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

function QuestionInput({ question, index, value, attachments, onAttach, onClearAttachments, onChange }: {
  question: Question;
  index: number;
  value: string;
  attachments: MediaAttachment[];
  onAttach: (files: File[]) => void;
  onClearAttachments: () => void;
  onChange: (value: string) => void;
}) {
  if (question.type === "instruction") return <p className="instruction">{question.label}</p>;
  const label = cleanQuestionLabel(question.label);
  const inputId = `media-${index}-${label.replace(/[^a-z0-9]+/gi, "-").slice(0, 24)}`;
  return <div className="field-question">
    <div><b>{index + 1}</b><span>{label}{question.required && <em>Required</em>}{question.archived_for_future_reports && <small>Archived in HeavyConnect</small>}</span></div>
    <div className="question-control">
      {question.type === "yes_no" && <div className="segmented">{["Yes", "No"].map((option) => <button type="button" className={value === option ? "selected" : ""} onClick={() => onChange(option)} key={option}>{option}</button>)}</div>}
      {question.type === "yes_no_na" && <div className="segmented">{["Yes", "No", "N/A"].map((option) => <button type="button" className={value === option ? "selected" : ""} onClick={() => onChange(option)} key={option}>{option}</button>)}</div>}
      {question.type === "single_select" && <select value={value} onChange={(event) => onChange(event.target.value)}><option value="">{question.options_status === "pending" ? "Options pending admin review" : "Select an option"}</option>{question.options?.map((option) => <option key={option}>{option}</option>)}</select>}
      {question.type === "number" && <input type="number" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Enter number" />}
      {question.type === "date" && <input type="date" value={value} onChange={(event) => onChange(event.target.value)} />}
      {question.type === "time" && <input type="time" value={value} onChange={(event) => onChange(event.target.value)} />}
      {question.type === "long_text" && <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder="Enter notes" />}
      {question.type === "calculated_number" && <input disabled placeholder={question.formula_display ?? "Calculated"} />}
      {question.type === "unsupported_in_web_dashboard" && <p className="helper">HeavyConnect hides this control in the web dashboard. Mark for admin review before locking.</p>}
      {!["yes_no", "yes_no_na", "single_select", "number", "date", "time", "long_text", "calculated_number", "unsupported_in_web_dashboard"].includes(question.type) && <input value={value} maxLength={question.max_length} onChange={(event) => onChange(event.target.value)} placeholder="Enter response" />}
    </div>
    <div className="media-control">
      <label className={`evidence-button ${attachments.length ? "selected" : ""}`} htmlFor={inputId} title="Attach photos, PDFs, or evidence files">
        <Files />{attachments.length ? `${attachments.length} file${attachments.length === 1 ? "" : "s"}` : "Attach"}
      </label>
      <input id={inputId} type="file" multiple accept="image/*,.pdf" onChange={(event) => {
        onAttach(Array.from(event.target.files ?? []));
        event.currentTarget.value = "";
      }} />
      {attachments.length > 0 && <button type="button" className="clear-media" onClick={onClearAttachments}>Clear</button>}
      {attachments.length > 0 && <small>{attachments.map((file) => `${file.name} (${formatFileSize(file.size)})`).join(", ")}</small>}
    </div>
  </div>;
}

function ReviewPanel({ report, review, answerRows, onDone, onPacket }: { report: Report; review?: ReviewRecord; answerRows: ReportAnswer[]; onDone: (review: ReviewRecord, approve: boolean) => void; onPacket: () => void }) {
  const [note, setNote] = useState(review?.note ?? "");
  const [correctiveAction, setCorrectiveAction] = useState(review?.correctiveAction ?? "");
  const [severityFilter, setSeverityFilter] = useState("All Severities");
  const saveReview = (approve: boolean) => onDone({
    note,
    correctiveAction,
    reviewedAt: new Date().toISOString(),
    reviewer: "Juan Diaz",
  }, approve);
  const groupedRows = answerRows.reduce<Record<string, ReportAnswer[]>>((groups, row) => {
    const key = row.section || "Report questions";
    groups[key] = [...(groups[key] ?? []), row];
    return groups;
  }, {});
  const displayedGroups = Object.entries(groupedRows).map(([section, rows]) => [
    section,
    severityFilter === "Evidence marked" ? rows.filter((row) => row.evidenceMarked) : rows,
  ] as const).filter(([, rows]) => rows.length > 0);
  const answeredCount = answerRows.filter((row) => row.answer).length;
  const evidenceCount = answerRows.reduce((sum, row) => sum + (row.attachments?.length ?? (row.evidenceMarked ? 1 : 0)), 0);
  const statusLabel = statusCopy[report.status].label;

  return <div className="report-detail">
    <div className="report-detail-bar">Report Details</div>
    <section className="report-detail-head">
      <div className="report-type-icon"><ReportIcon code={report.code} /></div>
      <div className="report-title-block">
        <span>{report.evidenceTags[0] ?? "Bay Baby report"}</span>
        <h2>{report.code} {report.type}</h2>
        <b className={`detail-status ${report.status}`}>{statusLabel}</b>
      </div>
      <div className="detail-actions">
        <button className="secondary" onClick={() => saveReview(false)}><Plus /> Add review</button>
        <button className="row-action" onClick={onPacket}><FilePdf /> View PDF</button>
      </div>
    </section>
    <section className="detail-meta">
      <div><span>ID:</span><b>{report.reportId}</b></div>
      <div><span>Date & Time:</span><b>{report.date}</b></div>
      <div><span>Creator:</span><b>{report.creator}</b></div>
      <div><span>Location:</span><b>{report.location}</b></div>
      <div><span>Answered:</span><b>{answeredCount}/{answerRows.length}</b></div>
      <div><span>Evidence:</span><b>{evidenceCount}</b></div>
    </section>
    <div className="detail-tabs"><button className="active">Report Questions</button><button>Review</button></div>
    <section className="detail-review-fields">
      <label><span>General Corrective Action</span><textarea value={correctiveAction} onChange={(event) => setCorrectiveAction(event.target.value)} placeholder="Type a corrective action" /></label>
      <label><span>General Recommendations</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Type a recommendation" /></label>
      <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}>
        <option>All Severities</option>
        <option>Good</option>
        <option>Needs review</option>
        <option>Needs action</option>
        <option>Evidence marked</option>
      </select>
    </section>
    {report.details && <section className="detail-section">
      <h3>Header</h3>
      <ol>{report.details.split(". ").filter(Boolean).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ol>
    </section>}
    {displayedGroups.map(([section, rows], sectionIndex) => <section className="detail-section" key={section}>
      <h3>{sectionIndex + 1}. {section}</h3>
      <div className="detail-table">
        <div className="detail-table-head"><span>Question</span><span>Answer</span><span>Attachment</span></div>
        {rows.map((row, index) => <div className={`detail-row ${row.evidenceMarked ? "marked" : ""}`} key={`${section}-${row.question}-${index}`}>
          <div><i>{row.evidenceMarked ? <Check /> : ""}</i><b>{index + 1}. {row.question}</b></div>
          <span>{row.answer || "No answer recorded"}</span>
          <small>{row.attachments?.length ? row.attachments.map((file) => file.name).join(", ") : row.evidenceMarked ? "Evidence marked" : "None"}</small>
        </div>)}
      </div>
    </section>)}
    {answerRows.length === 0 && <section className="detail-section empty-state"><ClipboardText weight="duotone" /><h2>No answers captured</h2><p>This report does not have question-level answers yet.</p></section>}
    <div className="modal-actions detail-footer"><button className="secondary" onClick={() => saveReview(false)}>Save review</button><button className="row-action" onClick={onPacket}><FilePdf /> View PDF</button><button className="primary" onClick={() => saveReview(true)}><Check /> Approve report</button></div>
  </div>;

  return <div className="form-panel review-panel">
    <div className="modal-heading"><span>Report review</span><h2>{report.code} {report.type}</h2><p>{report.location} • {report.date} • {report.creator}</p></div>
    <div className="review-alert"><WarningCircle weight="fill" /><div><strong>{report.status === "action" ? "Corrective action required" : "Verify report evidence"}</strong><span>Record: {report.reportId}. Tags: {report.evidenceTags.join(", ") || "none"}.</span></div></div>
    <div className="answers">
      <div><span>Report ID</span><b>{report.reportId}</b></div>
      <div><span>Primus evidence status</span><b className={report.status === "approved" ? "pass" : "fail"}>{statusCopy[report.status].label}</b></div>
      <div><span>Recommended action</span><b>{report.status === "approved" ? "Include in packet" : "Manager review"}</b></div>
      {review?.reviewedAt && <div><span>Last review</span><b>{new Date(review!.reviewedAt).toLocaleString("en-US")}</b></div>}
    </div>
    <label>Review notes<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a clear note for the audit packet..." /></label>
    <label>Corrective action<textarea value={correctiveAction} onChange={(event) => setCorrectiveAction(event.target.value)} placeholder="Describe root cause, correction, evidence, owner, and due date..." /></label>
    <div className="modal-actions"><button className="secondary" onClick={() => saveReview(false)}>Save notes</button><button className="primary" onClick={() => saveReview(true)}><Check /> Approve report</button></div>
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
