const fs = require('fs');

const path = 'src/lib/country-helper.ts';
let code = fs.readFileSync(path, 'utf8');

const parseCountryFn = `
/**
 * Parse any country name, abbreviation, or alias into standard CountryInfo
 */
export function parseCountryString(str?: string | null): CountryInfo | null {
  if (!str) return null;
  const s = str.trim().toLowerCase();
  if (["us", "usa", "united states", "united states of america", "america"].includes(s)) return getCountryByCode("US");
  if (["pk", "pak", "pakistan"].includes(s)) return getCountryByCode("PK");
  if (["gb", "uk", "united kingdom", "england", "britain", "great britain"].includes(s)) return getCountryByCode("GB");
  if (["ae", "uae", "united arab emirates", "dubai", "abu dhabi"].includes(s)) return getCountryByCode("AE");
  if (["sa", "ksa", "saudi", "saudi arabia"].includes(s)) return getCountryByCode("SA");
  if (["ca", "canada"].includes(s)) return getCountryByCode("CA");
  if (["au", "australia"].includes(s)) return getCountryByCode("AU");
  if (["in", "india"].includes(s)) return getCountryByCode("IN");
  if (["de", "germany"].includes(s)) return getCountryByCode("DE");
  if (["fr", "france"].includes(s)) return getCountryByCode("FR");
  if (["ng", "nigeria"].includes(s)) return getCountryByCode("NG");
  if (["sg", "singapore"].includes(s)) return getCountryByCode("SG");
  return null;
}
`;

if (!code.includes('parseCountryString')) {
  code += `\n${parseCountryFn}`;
  fs.writeFileSync(path, code, 'utf8');
  console.log('src/lib/country-helper.ts updated with parseCountryString!');
}