export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "meeting"
  | "won"
  | "lost";

export type Lead = {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  status: LeadStatus;
  agent: string;
  lastContact: string;
  nextFollowUp: string;
  notes: string[];
  value: number;
};

export const agents = [
  "Amara Okafor",
  "Daniel Reyes",
  "Priya Nair",
  "Lukas Berg",
  "Sofia Marchetti",
];

export const statusLabels: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  meeting: "Meeting Set",
  won: "Won",
  lost: "Lost",
};

const companies = [
  ["Northwind Logistics", "Ops"],
  ["Lumen Health", "Clinical"],
  ["Vertex Robotics", "Automation"],
  ["Brightpath Finance", "Treasury"],
  ["Kestrel Media", "Growth"],
  ["Atlas Manufacturing", "Plant"],
  ["Cobalt Energy", "Grid"],
  ["Halcyon Travel", "Bookings"],
  ["Ironleaf Retail", "Stores"],
  ["Solstice Labs", "R&D"],
  ["Meridian Legal", "Counsel"],
  ["Peregrine Foods", "Supply"],
];

const firstNames = [
  "Elena",
  "Marcus",
  "Yuki",
  "Tomas",
  "Aisha",
  "Ben",
  "Clara",
  "Dmitri",
  "Farah",
  "Grant",
  "Hana",
  "Ivan",
  "Julia",
  "Kwame",
  "Lena",
  "Mateo",
  "Nadia",
  "Omar",
  "Petra",
  "Quinn",
  "Rosa",
  "Sven",
  "Tara",
  "Ugo",
];
const lastNames = [
  "Vasquez",
  "Hall",
  "Tanaka",
  "Novak",
  "Rahman",
  "Cole",
  "Whitfield",
  "Sokolov",
  "Haddad",
  "Pierce",
  "Sato",
  "Petrov",
  "Moreau",
  "Mensah",
  "Ostrom",
  "Delgado",
  "Aslan",
  "Farouk",
  "Kovacs",
  "Doyle",
];

const statuses: LeadStatus[] = [
  "new",
  "new",
  "contacted",
  "contacted",
  "qualified",
  "meeting",
  "won",
  "lost",
];

function iso(offsetDays: number, hour = 10, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export const seedLeads: Lead[] = Array.from({ length: 42 }, (_, i) => {
  const first = firstNames[i % firstNames.length]!;
  const last = lastNames[(i * 3) % lastNames.length]!;
  const [company, dept] = companies[i % companies.length]! as [string, string];
  const status = statuses[i % statuses.length]!;
  return {
    id: `LD-${1000 + i}`,
    name: `${first} ${last}`,
    company,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@${company
      .split(" ")[0]!
      .toLowerCase()}.com`,
    phone: `+1 (415) ${200 + i} ${1000 + i * 7}`,
    status,
    agent: agents[i % agents.length]!,
    lastContact: iso(-((i % 12) + 1), 9 + (i % 6)),
    nextFollowUp: iso((i % 9) - 1, 9 + (i % 8), (i % 4) * 15),
    notes: [
      `${dept} team evaluating a Q3 rollout.`,
      i % 3 === 0 ? "Asked for pricing breakdown by seat." : "Budget confirmed with finance.",
    ],
    value: 4000 + ((i * 1370) % 46000),
  };
});

export type FollowUp = {
  id: string;
  leadId: string;
  leadName: string;
  company: string;
  type: "call" | "meeting" | "email";
  title: string;
  datetime: string;
  agent: string;
  completed: boolean;
};

export const seedFollowUps: FollowUp[] = [
  { offset: 0, h: 9, type: "meeting", title: "Discovery call — product walkthrough" },
  { offset: 0, h: 11, type: "call", title: "Pricing follow-up" },
  { offset: 0, h: 15, type: "email", title: "Send security questionnaire" },
  { offset: 1, h: 10, type: "meeting", title: "Technical deep dive with IT" },
  { offset: 1, h: 14, type: "call", title: "Check-in after trial week 1" },
  { offset: 3, h: 13, type: "meeting", title: "Executive alignment" },
  { offset: 4, h: 16, type: "call", title: "Contract questions" },
  { offset: 6, h: 10, type: "email", title: "Renewal proposal" },
  { offset: -2, h: 11, type: "call", title: "Intro call" },
  { offset: -5, h: 15, type: "meeting", title: "Demo session" },
].map((f, i) => {
  const lead = seedLeads[i * 2]!;
  return {
    id: `FU-${200 + i}`,
    leadId: lead.id,
    leadName: lead.name,
    company: lead.company,
    type: f.type as FollowUp["type"],
    title: f.title,
    datetime: iso(f.offset, f.h),
    agent: lead.agent,
    completed: f.offset < 0,
  };
});

export type Activity = {
  id: string;
  actor: string;
  action: string;
  target: string;
  time: string;
};

export const activities: Activity[] = ([
  { actor: "Amara Okafor", action: "moved to Qualified", target: "Elena Vasquez", time: "12m ago" },
  { actor: "AI Assistant", action: "sent welcome email to", target: "Marcus Hall", time: "38m ago" },
  { actor: "Daniel Reyes", action: "logged a call with", target: "Yuki Tanaka", time: "1h ago" },
  { actor: "Priya Nair", action: "scheduled a meeting with", target: "Tomas Novak", time: "2h ago" },
  { actor: "AI Assistant", action: "detected a reply from", target: "Aisha Rahman", time: "3h ago" },
  { actor: "Lukas Berg", action: "added a note on", target: "Ben Cole", time: "5h ago" },
  { actor: "Sofia Marchetti", action: "closed as Won", target: "Clara Whitfield", time: "Yesterday" },
] as Omit<Activity, "id">[]).map((a, i) => ({ id: `AC-${i}`, ...a }));

export type EmailRecord = {
  id: string;
  recipient: string;
  company: string;
  subject: string;
  template: "Welcome" | "Reminder" | "Follow-up" | "Proposal";
  state: "sent" | "pending" | "replied" | "no-response";
  sentAt: string;
};

export const emailHistory: EmailRecord[] = seedLeads.slice(0, 18).map((lead, i) => ({
  id: `EM-${500 + i}`,
  recipient: lead.name,
  company: lead.company,
  subject: [
    "Welcome to Nexa CRM",
    "Quick reminder about our call",
    "Following up on your demo",
    "Your tailored proposal inside",
  ][i % 4]!,
  template: (["Welcome", "Reminder", "Follow-up", "Proposal"] as const)[i % 4]!,
  state: (["sent", "replied", "pending", "no-response"] as const)[i % 4]!,
  sentAt: iso(-(i % 10), 8 + (i % 9)),
}));

export const monthlyLeads = [
  { month: "Feb", leads: 148, won: 32 },
  { month: "Mar", leads: 176, won: 41 },
  { month: "Apr", leads: 162, won: 38 },
  { month: "May", leads: 203, won: 54 },
  { month: "Jun", leads: 231, won: 61 },
  { month: "Jul", leads: 258, won: 74 },
];

export const conversionFunnel = [
  { stage: "New", count: 258 },
  { stage: "Contacted", count: 194 },
  { stage: "Qualified", count: 121 },
  { stage: "Meeting", count: 78 },
  { stage: "Won", count: 42 },
];

export const agentPerformance = agents.map((name, i) => ({
  name: name.split(" ")[0]!,
  leads: 38 + i * 9,
  won: 9 + i * 3,
  rate: 24 + i * 6,
}));

export const responseRate = [
  { week: "W1", rate: 42 },
  { week: "W2", rate: 51 },
  { week: "W3", rate: 47 },
  { week: "W4", rate: 63 },
  { week: "W5", rate: 68 },
  { week: "W6", rate: 74 },
];

export const sampleImportRows = [
  ["Nina Alvarez", "Redstone Capital", "nina@redstone.com", "+1 (212) 555 0142", "New", "Amara Okafor"],
  ["Owen Fletcher", "Bluewave Marine", "owen@bluewave.io", "+1 (312) 555 0177", "New", "Daniel Reyes"],
  ["Sara Lindqvist", "Norrsken AB", "sara@norrsken.se", "+46 8 555 0192", "Contacted", "Priya Nair"],
  ["Hugo Martin", "Ateliers Martin", "hugo@ateliers.fr", "+33 1 55 50 21", "New", "Lukas Berg"],
  ["Ravi Chandra", "Tessera Cloud", "ravi@tessera.dev", "+91 80 5550 118", "Qualified", "Sofia Marchetti"],
  ["Мaya Duval", "Corvid Studio", "maya@corvid.studio", "+1 (646) 555 0155", "New", "Amara Okafor"],
];
