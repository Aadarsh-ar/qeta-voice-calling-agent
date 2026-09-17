/**
 * Telugu & Tenglish Speech Normalizer
 * Converts numerals, currencies, times, percentages, and business acronyms
 * into natural spoken Telugu phonetics before passing to Cartesia Sonic TTS.
 */

// Telugu digit and number words
const TELUGU_UNITS: Record<number, string> = {
  0: "సున్నా",
  1: "ఒకటి",
  2: "రెండు",
  3: "మూడు",
  4: "నాలుగు",
  5: "ఐదు",
  6: "ఆరు",
  7: "ఏడు",
  8: "ఎనిమిది",
  9: "తొమ్మిది",
  10: "పది",
  11: "పదకొండు",
  12: "పన్నెండు",
  13: "పదమూడు",
  14: "పద్నాలుగు",
  15: "పదిహేను",
  16: "పదహారు",
  17: "పదిహేడు",
  18: "పద్దెనిమిది",
  19: "పంతొమ్మిది",
};

const TELUGU_TENS: Record<number, string> = {
  20: "ఇరవై",
  30: "ముప్పై",
  40: "నలభై",
  50: "యాభై",
  60: "అరవై",
  70: "డెబ్బై",
  80: "ఎనభై",
  90: "తొంభై",
};

/**
 * Converts numbers up to 99 to spoken Telugu
 */
function convertUnder100(num: number): string {
  if (num < 20) return TELUGU_UNITS[num] || "";
  const tens = Math.floor(num / 10) * 10;
  const rem = num % 10;
  if (rem === 0) return TELUGU_TENS[tens] || "";
  return `${TELUGU_TENS[tens]} ${TELUGU_UNITS[rem]}`;
}

/**
 * Converts an integer into standard Indian numbering system spoken Telugu words
 * (1,00,00,000 = కోటి, 1,00,000 = లక్ష, 1,000 = వేలు, 100 = వంద)
 */
export function numberToTeluguWords(num: number): string {
  if (isNaN(num)) return "";
  if (num === 0) return TELUGU_UNITS[0];
  if (num < 0) return `మైనస్ ${numberToTeluguWords(Math.abs(num))}`;

  const parts: string[] = [];

  // Crores (కోట్లు)
  if (num >= 10000000) {
    const crores = Math.floor(num / 10000000);
    num %= 10000000;
    parts.push(`${numberToTeluguWords(crores)} ${crores === 1 ? "కోటి" : "కోట్లు"}`);
  }

  // Lakhs (లక్షలు)
  if (num >= 100000) {
    const lakhs = Math.floor(num / 100000);
    num %= 100000;
    parts.push(`${numberToTeluguWords(lakhs)} ${lakhs === 1 ? "లక్ష" : "లక్షలు"}`);
  }

  // Thousands (వేలు)
  if (num >= 1000) {
    const thousands = Math.floor(num / 1000);
    num %= 1000;
    parts.push(`${thousands === 1 ? "వెయ్యి" : `${numberToTeluguWords(thousands)} వేల`}`);
  }

  // Hundreds (వందలు)
  if (num >= 100) {
    const hundreds = Math.floor(num / 100);
    num %= 100;
    parts.push(`${hundreds === 1 ? "వంద" : `${numberToTeluguWords(hundreds)} వందల`}`);
  }

  if (num > 0) {
    parts.push(convertUnder100(num));
  }

  return parts.join(" ");
}

/**
 * Common Acronyms and Technical abbreviations spoken in Telugu / Tenglish phonetics
 */
export const DEFAULT_PRONUNCIATION_DICTIONARY: Record<string, string> = {
  // Business & Tech
  "B2B": "బీ టు బీ",
  "b2b": "బీ టు బీ",
  "B2C": "బీ టు సీ",
  "b2c": "బీ టు సీ",
  "AI": "ఏ ఐ",
  "OTP": "ఓ టీ పీ",
  "GST": "జీ ఎస్ టీ",
  "SMS": "ఎస్ ఎమ్ ఎస్",
  "CEO": "సీ ఈ ఓ",
  "CRM": "సీ ఆర్ ఎమ్",
  "API": "ఏ పీ ఐ",
  "URL": "యూ ఆర్ ఎల్",
  "PDF": "పీ డీ ఎఫ్",
  "KYC": "కే వై సీ",
  "UPI": "యూ పీ ఐ",
  "POS": "పీ ఓ ఎస్",
  "HR": "హెచ్ ఆర్",
  "FAQ": "ఎఫ్ ఏ క్యూ",
  "SIM": "సిమ్",

  // Major Telugu locations / cities
  "Hyderabad": "హైదరాబాద్",
  "hyderabad": "హైదరాబాద్",
  "Secunderabad": "సికింద్రాబాద్",
  "Vijayawada": "విజయవాడ",
  "Visakhapatnam": "విశాఖపట్నం",
  "Vizag": "వైజాగ్",
  "Tirupati": "తిరుపతి",
  "Warangal": "వరంగల్",
  "Guntur": "గుంటూరు",
  "Rajahmundry": "రాజమండ్రి",
  "Nellore": "నెల్లూరు",
  "Kurnool": "కర్నూలు",
  "Bangalore": "బెంగళూరు",
  "Chennai": "చెన్నై",

  // Currency & measurements
  "Rs": "రూపాయలు",
  "Rs.": "రూపాయలు",
  "INR": "రూపాయలు",
  "km": "కిలోమీటర్లు",
  "kg": "కిలోలు",
};

/**
 * Normalizes Indian Currencies (e.g., ₹25,000, Rs 500, 1500/-)
 */
function normalizeCurrencies(text: string): string {
  // Match ₹25,000 or ₹ 25,000 or Rs. 25,000 or 25,000/-
  const currencyRegex = /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d+)?)|([\d,]+(?:\.\d+)?)\s*(?:\/-\s*|rupees|రూపాయలు)/gi;

  return text.replace(currencyRegex, (match, p1, p2) => {
    const rawNumStr = (p1 || p2 || "").replace(/,/g, "");
    const num = parseFloat(rawNumStr);
    if (isNaN(num)) return match;

    const words = numberToTeluguWords(Math.floor(num));
    const paise = Math.round((num % 1) * 100);

    if (paise > 0) {
      return `${words} రూపాయల ${numberToTeluguWords(paise)} పైసలు`;
    }
    return `${words} రూపాయలు`;
  });
}

/**
 * Normalizes Times (e.g. 10:30 AM, 4:00 PM, 9:15 pm)
 * Prompt example: 10:30 AM -> ఉదయం పది గంటల ముప్పై నిమిషాలకు
 */
function normalizeTime(text: string): string {
  const timeRegex = /(?:(ఉదయం|మధ్యాహ్నం|సాయంత్రం|రాత్రి)\s+)?\b(0?[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM|am|pm)\b/gi;

  return text.replace(timeRegex, (_match, existingPrefix, hStr, mStr, periodStr) => {
    const hours = parseInt(hStr, 10);
    const minutes = parseInt(mStr, 10);
    const period = periodStr.toUpperCase();

    let prefix = existingPrefix;
    if (!prefix) {
      if (period === "PM") {
        if (hours === 12 || hours < 4) {
          prefix = "మధ్యాహ్నం";
        } else if (hours >= 4 && hours < 8) {
          prefix = "సాయంత్రం";
        } else {
          prefix = "రాత్రి";
        }
      } else {
        if (hours === 12 || hours < 4) {
          prefix = "రాత్రి";
        } else {
          prefix = "ఉదయం";
        }
      }
    }

    const hourWords = numberToTeluguWords(hours);

    let timeText = "";
    if (minutes === 0) {
      timeText = `${hourWords} గంటలకు`;
    } else {
      const minWords = numberToTeluguWords(minutes);
      timeText = `${hourWords} గంటల ${minWords} నిమిషాలకు`;
    }

    return prefix ? `${prefix} ${timeText}` : timeText;
  });
}

/**
 * Normalizes Percentages (e.g. 25%, 5.5%)
 */
function normalizePercentages(text: string): string {
  const pctRegex = /([\d,]+(?:\.\d+)?)\s*%/g;
  return text.replace(pctRegex, (_match, numStr) => {
    const num = parseFloat(numStr.replace(/,/g, ""));
    if (isNaN(num)) return _match;
    return `${numberToTeluguWords(Math.floor(num))} శాతం`;
  });
}

/**
 * Normalizes standalone phone numbers by speaking digit-by-digit or two-digit groups
 */
function normalizePhoneNumbers(text: string): string {
  // 10-digit mobile number starting with 6, 7, 8, 9 with optional +91 or 0
  const phoneRegex = /(?:\+91[-\s]?)?[6-9]\d{9}\b/g;
  return text.replace(phoneRegex, (phone) => {
    const cleanDigits = phone.replace(/[^\d]/g, "");
    return cleanDigits
      .split("")
      .map((d) => TELUGU_UNITS[parseInt(d, 10)])
      .join(" ");
  });
}

/**
 * Applies custom dictionary overrides
 */
function applyPronunciationDictionary(
  text: string,
  customDict?: Record<string, string>
): string {
  const combinedDict = { ...DEFAULT_PRONUNCIATION_DICTIONARY, ...(customDict || {}) };

  // Sort keys by descending length so "B2B sales" matches before "B2B"
  const sortedKeys = Object.keys(combinedDict).sort((a, b) => b.length - a.length);

  let result = text;
  for (const key of sortedKeys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "g");
    result = result.replace(regex, combinedDict[key]);
  }

  return result;
}

/**
 * Main normalization pipeline for Telugu & Tenglish text before Cartesia TTS
 */
export function normalizeTeluguText(
  text: string,
  options?: {
    customDictionary?: Record<string, string>;
    keepEnglishNumerals?: boolean;
  }
): string {
  if (!text || typeof text !== "string") return "";

  let processed = text.trim();

  // 1. Normalize currency formats (e.g. ₹25,000 -> ఇరవై ఐదు వేల రూపాయలు)
  processed = normalizeCurrencies(processed);

  // 2. Normalize times (e.g. 10:30 AM -> ఉదయం పది గంటల ముప్పై నిమిషాలకు)
  processed = normalizeTime(processed);

  // 3. Normalize percentages
  processed = normalizePercentages(processed);

  // 4. Normalize standalone numbers with commas (e.g. 1,500 -> పదిహేను వందలు లేదా వెయ్యి ఐదు వందలు)
  processed = processed.replace(/\b\d{1,3}(?:,\d{3})+\b/g, (match) => {
    const n = parseInt(match.replace(/,/g, ""), 10);
    return isNaN(n) ? match : numberToTeluguWords(n);
  });

  // 5. Apply Business Acronyms & Pronunciation Dictionary
  processed = applyPronunciationDictionary(processed, options?.customDictionary);

  // 6. Clean up whitespace
  processed = processed.replace(/\s+/g, " ").trim();

  return processed;
}
