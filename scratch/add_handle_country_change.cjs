const fs = require('fs');

const leadsPath = 'src/routes/_app.leads.tsx';
let code = fs.readFileSync(leadsPath, 'utf8');

const handleCountryChangeCode = `
  async function handleCountryChange(leadId: string, newCountryCode: string) {
    const targetLead = dbLeads.find((l) => l.id === leadId);
    if (!targetLead) return;

    const newCountry = getCountryByCode(newCountryCode);
    const updatedPhone = changeCountryOnPhone(targetLead.phone, newCountryCode);

    // Optimistically update state
    setDbLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              country: newCountry.name,
              country_code: newCountry.code,
              country_flag: newCountry.flag,
              phone: updatedPhone,
            }
          : l
      )
    );

    try {
      const { error } = await supabase
        .from("leads")
        .update({ phone: updatedPhone })
        .eq("id", leadId);

      if (error) {
        toast.error("Failed to update country in database: " + error.message);
      } else {
        toast.success(\`Updated \${targetLead.name || "lead"} to \${newCountry.flag} \${newCountry.name}\`);
      }
    } catch (err: any) {
      toast.error("Error updating country: " + err?.message);
    }
  }
`;

if (!code.includes('function handleCountryChange')) {
  code = code.replace(
    'async function handleBulkAssignLeads() {',
    `${handleCountryChangeCode}\n  async function handleBulkAssignLeads() {`
  );
  fs.writeFileSync(leadsPath, code, 'utf8');
  console.log('Added handleCountryChange to _app.leads.tsx!');
}