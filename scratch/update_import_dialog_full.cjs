const fs = require('fs');

const importPath = 'src/components/crm/ImportLeadsDialog.tsx';
let code = fs.readFileSync(importPath, 'utf8');

// 1. Import parseCountryString
code = code.replace(
  'import { detectCountryFromPhone, formatPhoneWithCountryCode } from "@/lib/country-helper";',
  'import { detectCountryFromPhone, formatPhoneWithCountryCode, parseCountryString } from "@/lib/country-helper";'
);

// 2. Add file-name auto-detection in handleFileUpload
const oldFileReadStart = `    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });`;

const newFileReadStart = `    try {
      // Auto-detect default country from file name
      const fn = file.name.toLowerCase();
      if (fn.includes("usa") || fn.includes("us_") || fn.includes("_us") || fn.includes("america") || fn.includes("us leads")) {
        setDefaultPhoneCountry("US");
      } else if (fn.includes("pakistan") || fn.includes("pak")) {
        setDefaultPhoneCountry("PK");
      } else if (fn.includes("uk") || fn.includes("united kingdom") || fn.includes("england") || fn.includes("london")) {
        setDefaultPhoneCountry("GB");
      } else if (fn.includes("uae") || fn.includes("dubai")) {
        setDefaultPhoneCountry("AE");
      } else if (fn.includes("saudi")) {
        setDefaultPhoneCountry("SA");
      } else if (fn.includes("canada")) {
        setDefaultPhoneCountry("CA");
      } else if (fn.includes("australia")) {
        setDefaultPhoneCountry("AU");
      }

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });`;

code = code.replace(oldFileReadStart, newFileReadStart);

// 3. Update parseRow to detect row-level country column
const oldParseRow = `    return {
      name: foundName.trim() || (lowerEmail ? lowerEmail.split("@")[0] : "") || (foundPhone.trim() ? \`Lead \${foundPhone.trim()}\` : \`Lead #\${i + 1}\`),
      email: lowerEmail,
      phone: foundPhone.trim(),
      statusCell,
      sourceDate,
    };`;

const newParseRow = `    // Country: check if any cell matches a country name or alias
    let rowCountryInfo: ReturnType<typeof parseCountryString> = null;
    for (const cell of r) {
      if (cell === foundEmail || cell === foundPhone || cell === foundName) continue;
      const parsedC = parseCountryString(cell);
      if (parsedC) {
        rowCountryInfo = parsedC;
        break;
      }
    }

    return {
      name: foundName.trim() || (lowerEmail ? lowerEmail.split("@")[0] : "") || (foundPhone.trim() ? \`Lead \${foundPhone.trim()}\` : \`Lead #\${i + 1}\`),
      email: lowerEmail,
      phone: foundPhone.trim(),
      statusCell,
      sourceDate,
      rowCountryInfo,
    };`;

code = code.replace(oldParseRow, newParseRow);

// 4. Update row formatting in handleImport to prioritize rowCountryInfo
const oldRowFormat = `      const { name, email, phone, statusCell, sourceDate } = parseRow(r, i);
      const cleanEmail = (email || "").trim().toLowerCase();
      const cleanPhone = (phone || "").trim();
      const cleanName = (name || "").trim();`;

const newRowFormat = `      const { name, email, phone, statusCell, sourceDate, rowCountryInfo } = parseRow(r, i);
      const cleanEmail = (email || "").trim().toLowerCase();
      const cleanPhone = (phone || "").trim();
      const cleanName = (name || "").trim();

      // Prioritize: 1. Row-level Country column -> 2. Modal Default Dropdown -> 3. Auto-detect
      const effectiveCountryCode = rowCountryInfo 
        ? rowCountryInfo.code 
        : (defaultPhoneCountry !== "AUTO" ? defaultPhoneCountry : undefined);`;

code = code.replace(oldRowFormat, newRowFormat);

// Update phone formatting call
code = code.replace(
  `phone: cleanPhone 
          ? formatPhoneWithCountryCode(cleanPhone, defaultPhoneCountry !== "AUTO" ? defaultPhoneCountry : undefined) 
          : "",`,
  `phone: cleanPhone 
          ? formatPhoneWithCountryCode(cleanPhone, effectiveCountryCode) 
          : "",`
);

fs.writeFileSync(importPath, code, 'utf8');
console.log('ImportLeadsDialog.tsx updated with column-level & file-name country detection!');