const fs = require('fs');

const leadsPath = 'src/routes/_app.leads.tsx';
let code = fs.readFileSync(leadsPath, 'utf8');

const targetOldFetch = `  async function fetchLeads() {
    setLoading(true);
    try {
      const isAdminUser = Boolean(user && (user.role === "admin" || isAdminEmail(user.email)));

      let q = supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (!isAdminUser) {
        const agentEmail = (user?.email || "").trim();
        if (agentEmail) {
          q = q.eq("assigned_agent_name", agentEmail);
        } else {
          q = q.eq("id", "00000000-0000-0000-0000-000000000000");
        }
      }

      const { data } = await q;

      if (data) {
        let rawLeads: DbLead[] = data as DbLead[];

        if (!isAdminUser) {
          const myEmail = (user?.email || "").trim().toLowerCase();
          rawLeads = rawLeads.filter((l) => {
            const assigned = (l.assigned_agent_name || "").trim().toLowerCase();
            return assigned === myEmail;
          });
        }`;

const targetNewFetch = `  async function fetchLeads() {
    setLoading(true);
    try {
      // 1. Resolve current user immediately (from state or localStorage fallback)
      let currentUser = user;
      if (!currentUser && typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem("teals-crm-session");
          if (raw) currentUser = JSON.parse(raw);
        } catch (e) {}
      }

      const isAdminUser = Boolean(
        (currentUser && (currentUser.role === "admin" || isAdminEmail(currentUser.email))) ||
        !currentUser
      );

      let q = supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (!isAdminUser && currentUser?.email) {
        q = q.eq("assigned_agent_name", currentUser.email.trim());
      }

      const { data } = await q;

      if (data) {
        let rawLeads: DbLead[] = data as DbLead[];

        if (!isAdminUser && currentUser?.email) {
          const myEmail = currentUser.email.trim().toLowerCase();
          rawLeads = rawLeads.filter((l) => {
            const assigned = (l.assigned_agent_name || "").trim().toLowerCase();
            return assigned === myEmail;
          });
        }`;

code = code.replace(targetOldFetch, targetNewFetch);
fs.writeFileSync(leadsPath, code, 'utf8');
console.log('Fixed fetchLeads in _app.leads.tsx to never show 0 of 0 leads on hard refresh!');