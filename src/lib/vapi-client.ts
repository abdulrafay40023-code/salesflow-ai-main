// Vapi.ai AI Calling Configuration & Multi-Account Rotation Pool

export type VapiAccount = {
  id: string;
  name: string;
  email: string;
  apiKey: string;
  publicKey?: string;
  phoneNumberId: string;
  phoneNumber: string;
  isPrimary?: boolean;
};

export const VAPI_ACCOUNTS_POOL: VapiAccount[] = [
  {
    id: "vapi-acc-0",
    name: "Line 1 (Teals Primary)",
    email: "garryamelia6265@gmail.com",
    apiKey: "1868db1d-90de-4d6c-abd5-374bdeffd24d",
    publicKey: "6eae0c34-9ab2-4f7a-aaa7-8e1d267b6113",
    phoneNumberId: "515deea5-e46c-46db-b49c-8e4af2dd2e4c",
    phoneNumber: "+1 (575) 592 1404",
    isPrimary: true,
  },
  {
    id: "vapi-acc-1",
    name: "Line 2 (Ava)",
    email: "avareed826@gmail.com",
    apiKey: "90a83f9f-4fb6-400c-bc23-0dec8b6008be",
    publicKey: "d230861f-f7db-47ef-ab92-b308ab7a38bd",
    phoneNumberId: "525e4320-975b-4fd4-9982-dc92e29e4cb5",
    phoneNumber: "+1 (681) 455 5285",
  },
  {
    id: "vapi-acc-2",
    name: "Line 3 (Bolly)",
    email: "bollygarden222@gmail.com",
    apiKey: "3b1b17b7-9aa5-41d2-a3af-0c870ac63d41",
    publicKey: "22692158-bb4a-42b0-a695-cc0816a31115",
    phoneNumberId: "3eda49e7-ff1b-48d6-98a7-b62cace076fc",
    phoneNumber: "+1 (681) 839 1274",
  },
  {
    id: "vapi-acc-3",
    name: "Line 4 (Charles)",
    email: "charlesmanes120@gmail.com",
    apiKey: "25c8bc24-4eed-4872-99ac-a6220d0dcebe",
    publicKey: "bd6ae333-933e-4bc9-817e-b9437b2d0cc9",
    phoneNumberId: "c2129aa6-d6f3-4a82-b9cf-43ed7b216aae",
    phoneNumber: "+1 (681) 455 5257",
  },
  {
    id: "vapi-acc-4",
    name: "Line 5 (Ella)",
    email: "ellathomas81631@gmail.com",
    apiKey: "6072d3da-9670-4988-8f76-aaf3f29437b9",
    publicKey: "2d08449b-4ee0-4e7e-a95f-ac1f677c71ed",
    phoneNumberId: "b9e3da17-6b74-4734-8b0a-c1295d75e768",
    phoneNumber: "+1 (681) 455 5260",
  },
  {
    id: "vapi-acc-5",
    name: "Line 6 (Emma)",
    email: "emmajohnson01732@gmail.com",
    apiKey: "1ab3f051-27a2-4385-a2e7-29f5f9de0192",
    publicKey: "3e0ae04e-0004-489f-b7f6-32179d422f5f",
    phoneNumberId: "1e272890-ecc0-4c18-9b43-149e5c1fd3ef",
    phoneNumber: "+1 (681) 302 1173",
  },
  {
    id: "vapi-acc-6",
    name: "Line 7 (Jackson)",
    email: "jackson6168173@gmail.com",
    apiKey: "2df3c5ab-402d-49eb-883f-7a7e3d4a3687",
    publicKey: "eee4b004-1d6a-4cf6-97d0-6c13101adea8",
    phoneNumberId: "c7504759-1363-4274-a308-2152f2c17f65",
    phoneNumber: "+1 (681) 839 1229",
  },
];

export const VAPI_PRIVATE_KEY = VAPI_ACCOUNTS_POOL[0].apiKey;
export const VAPI_PUBLIC_KEY = VAPI_ACCOUNTS_POOL[0].publicKey || "";
export const VAPI_ASSISTANT_ID = process.env["VAPI_ASSISTANT_ID"] || "0bc6b506-cb70-48b6-a2b5-e74cbcd179d3";
export const VAPI_PHONE_NUMBER_ID = VAPI_ACCOUNTS_POOL[0].phoneNumberId;
export const VAPI_PHONE_NUMBER = VAPI_ACCOUNTS_POOL[0].phoneNumber;

/**
 * Clean & format phone numbers to standard E.164 (e.g. +447..., +923..., +1561..., +971...)
 */
export function formatE164Phone(rawPhone: string, locationHint?: string): string {
  if (!rawPhone) return "";
  let clean = rawPhone.trim().replace(/[^\d+]/g, "");

  // Fix common UK/German formatting with +44(0) or +49(0)
  if (clean.startsWith("+440")) {
    clean = "+44" + clean.slice(4);
  }
  if (clean.startsWith("+490")) {
    clean = "+49" + clean.slice(4);
  }

  if (clean.startsWith("+")) {
    return clean;
  }

  if (clean.startsWith("00")) {
    return "+" + clean.slice(2);
  }

  const hint = (locationHint || "").toLowerCase();
  const isUk =
    hint.includes("uk") ||
    hint.includes("london") ||
    hint.includes("england") ||
    hint.includes("scotland") ||
    hint.includes("wales") ||
    hint.includes("birmingham") ||
    hint.includes("manchester") ||
    hint.includes("leeds") ||
    hint.includes("glasgow") ||
    hint.includes("united kingdom");

  const isGermany =
    hint.includes("germany") ||
    hint.includes("berlin") ||
    hint.includes("munich") ||
    hint.includes("frankfurt") ||
    hint.includes("hamburg") ||
    hint.includes("deutschland");

  // If UK location explicitly indicated
  if (isUk) {
    if (clean.startsWith("44")) {
      return "+" + clean;
    }
    if (clean.startsWith("0")) {
      return "+44" + clean.slice(1);
    }
    return "+44" + clean;
  }

  // If Germany location explicitly indicated
  if (isGermany) {
    if (clean.startsWith("49")) {
      return "+" + clean;
    }
    if (clean.startsWith("0")) {
      return "+49" + clean.slice(1);
    }
    return "+49" + clean;
  }

  // Standard UK mobile & landline detection (07xxx, 02xxx, 01xxx, 03xxx) with 10-11 digits
  if (
    (clean.startsWith("07") ||
      clean.startsWith("02") ||
      clean.startsWith("01") ||
      clean.startsWith("03")) &&
    (clean.length === 10 || clean.length === 11)
  ) {
    return "+44" + clean.slice(1);
  }

  // UK with 44 prefix but without +
  if (clean.startsWith("44") && (clean.length === 12 || clean.length === 13)) {
    return "+" + clean;
  }

  // German with 49 prefix but without +
  if (clean.startsWith("49") && clean.length >= 11 && clean.length <= 13) {
    return "+" + clean;
  }

  // Pakistan local mobile: 0300... (11 digits) -> +92300...
  if (clean.startsWith("03") && clean.length === 11 && !isUk) {
    return "+92" + clean.slice(1);
  }

  // US 10 digits -> +1xxx
  if (clean.length === 10) {
    return "+1" + clean;
  }

  // US 11 digits starting with 1 -> +1xxx
  if (clean.length === 11 && clean.startsWith("1")) {
    return "+" + clean;
  }

  return "+" + clean;
}
