const fs = require('fs');

const leadsPath = 'src/routes/_app.leads.tsx';
let code = fs.readFileSync(leadsPath, 'utf8');

const oldButtonBlock = `{isAdmin && dbLeads.length > 0 && (
              <Button
                onClick={handleClearAllLeads}
                variant="outline"
                size="sm"
                className="rounded-xl gap-1.5 bg-rose-600/10 text-rose-300 border-rose-500/30 hover:bg-rose-600/20 hover:text-rose-200"
                title="Delete all leads and reset for testing"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear All Leads ({dbLeads.length})
              </Button>
            )}`;

const newButtonBlock = `{dbLeads.length > 0 && (
              <Button
                onClick={() => setIsClearDialogOpen(true)}
                variant="outline"
                size="sm"
                className="rounded-xl gap-1.5 bg-rose-600/10 text-rose-300 border-rose-500/30 hover:bg-rose-600/20 hover:text-white transition-all shadow-sm active:scale-95"
                title="Clear leads by date or rule"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear Leads ({dbLeads.length})
              </Button>
            )}`;

code = code.replace(oldButtonBlock, newButtonBlock);
fs.writeFileSync(leadsPath, code, 'utf8');
console.log('Fixed Clear Leads button in _app.leads.tsx to open ClearLeadsDialog!');