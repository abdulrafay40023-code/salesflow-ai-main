const fs = require('fs');

const leadsPath = 'src/routes/_app.leads.tsx';
let code = fs.readFileSync(leadsPath, 'utf8');

// 1. Add ClearLeadsDialog import
if (!code.includes('ClearLeadsDialog')) {
  code = code.replace(
    'import { CountryCombobox } from "@/components/crm/CountryCombobox";',
    `import { CountryCombobox } from "@/components/crm/CountryCombobox";
import { ClearLeadsDialog } from "@/components/crm/ClearLeadsDialog";`
  );
}

// 2. Add isClearDialogOpen state
if (!code.includes('isClearDialogOpen')) {
  code = code.replace(
    'const [isRecordingsDialogOpen, setIsRecordingsDialogOpen] = useState(false);',
    `const [isRecordingsDialogOpen, setIsRecordingsDialogOpen] = useState(false);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);`
  );
}

// 3. Update the Clear Leads button in header
const oldClearButton = `{isAdmin && dbLeads.length > 0 && (
              <Button
                onClick={handleClearAllLeads}
                variant="outline"
                size="sm"
                className="rounded-xl gap-1.5 bg-rose-600/10 text-rose-300 border-rose-500/30 hover:bg-rose-600/20 hover:text-white"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear All Leads ({dbLeads.length})
              </Button>
            )}`;

const newClearButton = `{dbLeads.length > 0 && (
              <Button
                onClick={() => setIsClearDialogOpen(true)}
                variant="outline"
                size="sm"
                className="rounded-xl gap-1.5 bg-rose-600/10 text-rose-300 border-rose-500/30 hover:bg-rose-600/20 hover:text-white transition-all shadow-sm active:scale-95"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear Leads ({dbLeads.length})
              </Button>
            )}`;

if (code.includes(oldClearButton)) {
  code = code.replace(oldClearButton, newClearButton);
}

// 4. Add ClearLeadsDialog to the footer
const oldFooterEnd = `<AllCallRecordingsDialog
        open={isRecordingsDialogOpen}
        onOpenChange={setIsRecordingsDialogOpen}
      />
    </div>`;

const newFooterEnd = `<AllCallRecordingsDialog
        open={isRecordingsDialogOpen}
        onOpenChange={setIsRecordingsDialogOpen}
      />

      <ClearLeadsDialog
        open={isClearDialogOpen}
        onOpenChange={setIsClearDialogOpen}
        leads={dbLeads}
        isAdmin={isAdmin}
        userEmail={user?.email}
        onCleared={fetchLeads}
      />
    </div>`;

if (code.includes(oldFooterEnd)) {
  code = code.replace(oldFooterEnd, newFooterEnd);
}

fs.writeFileSync(leadsPath, code, 'utf8');
console.log('src/routes/_app.leads.tsx updated with ClearLeadsDialog!');