import type { Team } from "./types";

export function defaultTeams(): Team[] {
  return [
    {
      id: "team_mighty",
      name: "Mighty Molding Team",
      members: [
        {
          id: "saadi",
          name: "Saadi",
          role: "CPA",
          specialty: "Accounting, tax, quality of earnings",
        },
        {
          id: "steve",
          name: "Steve Clemmons",
          role: "Attorney",
          specialty: "Acquisition legal, contracts, environmental",
        },
        {
          id: "angela",
          name: "Angela Robinson",
          role: "Financial Planner",
          specialty: "Financing, debt service, returns",
        },
      ],
    },
    {
      id: "team_parallel",
      name: "Parallel Acquisition Team",
      members: [
        {
          id: "sari",
          name: "Sari",
          role: "CPA",
          specialty: "Accounting and tax",
        },
        {
          id: "kareem",
          name: "Kareem Hajjar",
          role: "Attorney",
          specialty: "Legal diligence and deal documents",
        },
        {
          id: "justin",
          name: "Justin",
          role: "Financial Diligence",
          specialty: "QoE, working capital, customer analysis",
        },
      ],
    },
  ];
}
