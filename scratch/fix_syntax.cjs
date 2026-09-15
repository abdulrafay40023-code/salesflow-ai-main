const fs = require('fs');

const leadsPath = 'src/routes/_app.leads.tsx';
let code = fs.readFileSync(leadsPath, 'utf8');

const targetOld = `    setTimeout(() => {
      delete activeCallsRef.current[leadId];
      setActiveCalls((prev) => {
        const copy = { ...prev };
        delete copy[leadId];
        return copy;
      });
    }, 3000);
  });
    }, 4000);
  }`;

const targetNew = `    setTimeout(() => {
      delete activeCallsRef.current[leadId];
      setActiveCalls((prev) => {
        const copy = { ...prev };
        delete copy[leadId];
        return copy;
      });
    }, 3000);
  }`;

code = code.replace(targetOld, targetNew);
fs.writeFileSync(leadsPath, code, 'utf8');
console.log('Fixed trailing syntax error in _app.leads.tsx!');