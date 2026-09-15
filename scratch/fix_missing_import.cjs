const fs = require('fs');

const leadsPath = 'src/routes/_app.leads.tsx';
let code = fs.readFileSync(leadsPath, 'utf8');

code = code.replace(
  'import { detectCountryFromPhone, formatPhoneWithCountryCode, SUPPORTED_COUNTRIES, getCountryByCode, changeCountryOnPhone } from "@/lib/country-helper";',
  'import { detectCountryFromPhone, formatPhoneWithCountryCode, SUPPORTED_COUNTRIES, getCountryByCode, changeCountryOnPhone, parseCountryString } from "@/lib/country-helper";'
);

fs.writeFileSync(leadsPath, code, 'utf8');
console.log('Added missing parseCountryString import to _app.leads.tsx!');