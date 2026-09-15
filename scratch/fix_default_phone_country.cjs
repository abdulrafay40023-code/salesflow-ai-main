const fs = require('fs');

const importDialogPath = 'src/components/crm/ImportLeadsDialog.tsx';
let importCode = fs.readFileSync(importDialogPath, 'utf8');

// Add defaultPhoneCountry state
importCode = importCode.replace(
  'const [customBatchInput, setCustomBatchInput] = useState<string>("");',
  `const [customBatchInput, setCustomBatchInput] = useState<string>("");
  const [defaultPhoneCountry, setDefaultPhoneCountry] = useState<string>("AUTO");`
);

fs.writeFileSync(importDialogPath, importCode, 'utf8');
console.log('Added defaultPhoneCountry state to ImportLeadsDialog.tsx!');