// Vapi.ai AI Calling Configuration

export const VAPI_PRIVATE_KEY =
  process.env["VAPI_PRIVATE_KEY"] || "1868db1d-90de-4d6c-abd5-374bdeffd24d";

export const VAPI_PUBLIC_KEY =
  process.env["VITE_VAPI_PUBLIC_KEY"] ||
  process.env["VAPI_PUBLIC_KEY"] ||
  "6eae0c34-9ab2-4f7a-aaa7-8e1d267b6113";

export const VAPI_ASSISTANT_ID =
  process.env["VAPI_ASSISTANT_ID"] || "0bc6b506-cb70-48b6-a2b5-e74cbcd179d3";

export const VAPI_PHONE_NUMBER_ID =
  process.env["VAPI_PHONE_NUMBER_ID"] || "515deea5-e46c-46db-b49c-8e4af2dd2e4c";

export const VAPI_PHONE_NUMBER = "+1 (575) 592 1404";

/**
 * Clean & format phone numbers to standard E.164 (e.g. +92342..., +1561...)
 */
export function formatE164Phone(rawPhone: string): string {
  if (!rawPhone) return "";
  let clean = rawPhone.trim().replace(/[^\d+]/g, "");

  if (clean.startsWith("+")) {
    return clean;
  }

  if (clean.startsWith("00")) {
    return "+" + clean.slice(2);
  }

  if (clean.startsWith("03") && clean.length === 11) {
    return "+92" + clean.slice(1);
  }

  if (clean.length === 10) {
    return "+1" + clean;
  }

  if (clean.length === 11 && clean.startsWith("1")) {
    return "+" + clean;
  }

  return "+" + clean;
}
