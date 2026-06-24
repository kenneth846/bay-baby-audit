import { AuditApp } from "@/components/audit-app";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseLoadResult = {
  connected: boolean;
  error: string | null;
  reports: AppReport[];
  locations: AppLocation[];
  teamMembers: AppTeamMember[];
  templates: AppTemplate[];
};

export type AppReport = {
  id: string;
  reportId: string;
  type: string;
  code: string;
  location: string;
  date: string;
  creator: string;
  status: "approved" | "review" | "action" | "submitted";
  severity: "Good" | "Attention" | "Issue";
  sourceFile: string;
  evidenceTags: string[];
};

export type AppLocation = {
  id: string;
  code: string;
  name: string;
  active: boolean;
};

export type AppTeamMember = {
  id: string;
  initials: string;
  name: string;
  role: string;
  status: string;
};

export type AppTemplate = {
  id: string;
  key: string;
  code: string;
  name: string;
  category: string;
  status: "ready" | "needs_options_review";
  source: string;
  moduleTargets: string[];
  sections: {
    title: string;
    questions: {
      label: string;
      type: string;
      required: boolean;
    }[];
  }[];
};

function formatInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

function mapReportStatus(status: string): AppReport["status"] {
  if (status === "approved") return "approved";
  if (status === "corrective_action") return "action";
  if (status === "submitted") return "submitted";
  return "review";
}

function mapSeverity(severity: string): AppReport["severity"] {
  if (severity === "issue") return "Issue";
  if (severity === "attention") return "Attention";
  return "Good";
}

function formatReportDate(date?: string | null, time?: string | null) {
  if (!date) return "No date recorded";
  return time ? `${date} ${time.slice(0, 5)}` : date;
}

async function loadAuditData(): Promise<SupabaseLoadResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const [reportsResult, locationsResult, teamResult, templatesResult] = await Promise.all([
      supabase
        .from("reports")
        .select(`
          id,
          report_date,
          report_time,
          status,
          severity,
          notes,
          created_at,
          report_types:report_type_id(code,name),
          locations:location_id(code,name),
          creator:creator_id(full_name)
        `)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("locations").select("id,code,name,active").order("name"),
      supabase.from("users_profile").select("id,full_name,role,created_at").order("full_name"),
      supabase
        .from("report_templates")
        .select(`
          id,
          version,
          published,
          source,
          report_types:report_type_id(code,name,category),
          report_template_questions(id,section,prompt,answer_type,required,sort_order)
        `)
        .order("version", { ascending: false }),
    ]);

    const firstError = reportsResult.error ?? locationsResult.error ?? teamResult.error ?? templatesResult.error;
    if (firstError) {
      return {
        connected: false,
        error: firstError.message,
        reports: [],
        locations: [],
        teamMembers: [],
        templates: [],
      };
    }

    const reports: AppReport[] = (reportsResult.data ?? []).map((report) => {
      const reportType = Array.isArray(report.report_types) ? report.report_types[0] : report.report_types;
      const location = Array.isArray(report.locations) ? report.locations[0] : report.locations;
      const creator = Array.isArray(report.creator) ? report.creator[0] : report.creator;

      return {
        id: report.id,
        reportId: report.id.slice(0, 8),
        type: reportType?.name ?? "Unassigned report type",
        code: reportType?.code ?? "LOG",
        location: location?.name ?? "No location recorded",
        date: formatReportDate(report.report_date, report.report_time),
        creator: creator?.full_name ?? "Unknown user",
        status: mapReportStatus(report.status),
        severity: mapSeverity(report.severity),
        sourceFile: "Supabase",
        evidenceTags: [],
      };
    });

    const locations: AppLocation[] = (locationsResult.data ?? []).map((location) => ({
      id: location.id,
      code: location.code,
      name: location.name,
      active: location.active,
    }));

    const teamMembers: AppTeamMember[] = (teamResult.data ?? []).map((member) => ({
      id: member.id,
      initials: formatInitials(member.full_name),
      name: member.full_name,
      role: member.role,
      status: "Active",
    }));

    const templates: AppTemplate[] = (templatesResult.data ?? []).map((template) => {
      const reportType = Array.isArray(template.report_types) ? template.report_types[0] : template.report_types;
      const questions = [...(template.report_template_questions ?? [])].sort((a, b) => a.sort_order - b.sort_order);
      const sections = Array.from(new Set(questions.map((question) => question.section))).map((section) => ({
        title: section,
        questions: questions
          .filter((question) => question.section === section)
          .map((question) => ({
            label: question.prompt,
            type: question.answer_type,
            required: question.required,
          })),
      }));

      return {
        id: template.id,
        key: template.id,
        code: reportType?.code ?? "LOG",
        name: reportType?.name ?? "Untitled template",
        category: reportType?.category ?? "Uncategorized",
        status: template.published ? "ready" : "needs_options_review",
        source: template.source ?? "Supabase",
        moduleTargets: [],
        sections,
      };
    });

    return {
      connected: true,
      error: null,
      reports,
      locations,
      teamMembers,
      templates,
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : "Unable to load Supabase data",
      reports: [],
      locations: [],
      teamMembers: [],
      templates: [],
    };
  }
}

export default async function Page() {
  const auditData = await loadAuditData();
  return <AuditApp initialData={auditData} />;
}
