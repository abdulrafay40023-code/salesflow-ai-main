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

export const agents = ["Garry Amelia"];

export const statusLabels: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  meeting: "Meeting Set",
  won: "Won",
  lost: "Lost",
};

export const seedLeads: Lead[] = [];

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

export const seedFollowUps: FollowUp[] = [];

export type Activity = {
  id: string;
  actor: string;
  action: string;
  target: string;
  time: string;
};

export const activities: Activity[] = [];

export type EmailRecord = {
  id: string;
  recipient: string;
  company: string;
  subject: string;
  template: "Welcome" | "Reminder" | "Follow-up" | "Proposal";
  state: "sent" | "pending" | "replied" | "no-response";
  sentAt: string;
};

export const emailHistory: EmailRecord[] = [];

export const monthlyLeads = [
  { month: "Feb", leads: 0, won: 0 },
  { month: "Mar", leads: 0, won: 0 },
  { month: "Apr", leads: 0, won: 0 },
  { month: "May", leads: 0, won: 0 },
  { month: "Jun", leads: 0, won: 0 },
  { month: "Jul", leads: 0, won: 0 },
];

export const conversionFunnel = [
  { stage: "New", count: 0 },
  { stage: "Contacted", count: 0 },
  { stage: "Qualified", count: 0 },
  { stage: "Meeting", count: 0 },
  { stage: "Won", count: 0 },
];

export const agentPerformance: { name: string; leads: number; won: number; rate: number }[] = [];

export const responseRate = [
  { week: "W1", rate: 0 },
  { week: "W2", rate: 0 },
  { week: "W3", rate: 0 },
  { week: "W4", rate: 0 },
  { week: "W5", rate: 0 },
  { week: "W6", rate: 0 },
];

export const sampleImportRows: string[][] = [];

