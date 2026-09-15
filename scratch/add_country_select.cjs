const fs = require('fs');

const importPath = 'src/components/crm/ImportLeadsDialog.tsx';
let importCode = fs.readFileSync(importPath, 'utf8');

// 1. Add state for defaultCountryCode
if (!importCode.includes('const [defaultPhoneCountry, setDefaultPhoneCountry]')) {
  importCode = importCode.replace(
    'const [customBatchInput, setCustomBatchInput] = useState("");',
    `const [customBatchInput, setCustomBatchInput] = useState("");
  const [defaultPhoneCountry, setDefaultPhoneCountry] = useState<string>("AUTO");`
  );

  // 2. Use defaultPhoneCountry when formatting raw phone
  importCode = importCode.replace(
    'phone: cleanPhone ? formatPhoneWithCountryCode(cleanPhone) : "",',
    `phone: cleanPhone 
          ? formatPhoneWithCountryCode(cleanPhone, defaultPhoneCountry !== "AUTO" ? defaultPhoneCountry : undefined) 
          : "",`
  );

  // 3. Add UI selector for Phone Country Format right before Batch Distribution tools
  const uiSelector = `
                {/* Default Phone Country Setting */}
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900/60 border border-slate-700/60 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🌐</span>
                    <div>
                      <span className="font-semibold text-white">Default Phone Country:</span>
                      <p className="text-[10px] text-slate-400">Apply country code to sheet numbers without a '+' sign</p>
                    </div>
                  </div>
                  <Select value={defaultPhoneCountry} onValueChange={setDefaultPhoneCountry}>
                    <SelectTrigger className="h-7 w-48 rounded-lg text-xs bg-slate-800 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AUTO">🤖 Smart Auto-Detect</SelectItem>
                      <SelectItem value="US">🇺🇸 USA / Canada (+1)</SelectItem>
                      <SelectItem value="PK">🇵🇰 Pakistan (+92 / 03xx)</SelectItem>
                      <SelectItem value="GB">🇬🇧 United Kingdom (+44)</SelectItem>
                      <SelectItem value="AE">🇦🇪 UAE (+971)</SelectItem>
                      <SelectItem value="SA">🇸🇦 Saudi Arabia (+966)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
`;

  importCode = importCode.replace(
    '{/* 1. Assigned Agent Selector (Admin Only) */}',
    `${uiSelector}\n\n                {/* 1. Assigned Agent Selector (Admin Only) */}`
  );

  fs.writeFileSync(importPath, importCode, 'utf8');
  console.log('ImportLeadsDialog.tsx updated with Default Phone Country dropdown!');
}