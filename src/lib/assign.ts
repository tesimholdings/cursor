import type { Role, Deal, AssignedQuestion } from "./types";
import { id } from "./format";

export function roleForQuestion(q: string): Role {
  const s = q.toLowerCase();
  if (/(revenue|sde|ebitda|p&l|tax|add-back|add back|payroll|bank statement|working capital|qoe|financial)/.test(s))
    return "CPA";
  if (/(loan|dscr|debt|financing|sba|structure|interest|return)/.test(s))
    return "Financial Planner";
  if (/(ar aging|customer revenue|quality of earnings|gl |general ledger)/.test(s))
    return "Financial Diligence";
  if (/(contract|attorney|legal|environmental|lease|litigation|nda|change-of-control|permit)/.test(s))
    return "Attorney";
  return "CPA";
}

export function autoAssign(deal: Deal, questions: string[]): AssignedQuestion[] {
  const team = deal.teamId;
  // members resolved later by UI; store assignee by role preference using member ids if present on deal later
  return questions.map((question) => {
    const role = roleForQuestion(question);
    return {
      id: id("q"),
      question,
      assigneeId: `${role}::${team || "unassigned"}`,
      status: "open" as const,
    };
  });
}

export function resolveAssigneeName(
  assigneeId: string,
  teams: { id: string; members: { id: string; name: string; role: Role }[] }[],
  teamId?: string
) {
  const [role] = assigneeId.split("::") as [Role, string];
  const team = teams.find((t) => t.id === teamId) || teams[0];
  const member = team?.members.find((m) => m.role === role) || team?.members[0];
  return member ? `${member.name} — ${member.role}` : role;
}
