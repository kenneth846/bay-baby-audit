export const BAY_BABY_ROLES = ["admin", "manager", "reviewer", "auditor", "operator"] as const;

export type BayBabyRole = (typeof BAY_BABY_ROLES)[number];

export const ROLE_PERMISSIONS: Record<BayBabyRole, string[]> = {
  admin: [
    "Manage users and roles",
    "Manage templates",
    "Review and approve reports",
    "Generate audit packets",
    "View all evidence",
  ],
  manager: [
    "Create and edit reports",
    "Review and approve reports",
    "Create corrective actions",
    "Generate audit packets",
    "View all evidence",
  ],
  reviewer: [
    "Review and approve reports",
    "Create corrective actions",
    "View all evidence",
  ],
  auditor: [
    "View approved reports",
    "View generated audit packets",
    "Export packet evidence",
  ],
  operator: [
    "Create draft reports",
    "Submit own reports",
    "Upload report attachments",
  ],
};

export function canApproveReports(role: BayBabyRole) {
  return role === "admin" || role === "manager" || role === "reviewer";
}

export function canGenerateAuditPackets(role: BayBabyRole) {
  return role === "admin" || role === "manager";
}
