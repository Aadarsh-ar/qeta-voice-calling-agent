import { ColumnMapping, ParsedContactPreview } from "./types";

/**
 * Parses a CSV string according to RFC 4180 (handling quoted fields with commas and newlines)
 */
export function parseCSV(csvText: string): { headers: string[]; rows: string[][] } {
  const cleanText = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let insideQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote: "" -> "
        currentField += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
    } else if (char === "\n" && !insideQuotes) {
      currentRow.push(currentField.trim());
      if (currentRow.some((field) => field.length > 0)) {
        lines.push(currentRow);
      }
      currentRow = [];
      currentField = "";
    } else {
      currentField += char;
    }
  }

  // Last field/row if any
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((field) => field.length > 0)) {
      lines.push(currentRow);
    }
  }

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = lines[0].map((h) => h.replace(/^\uFEFF/, "").trim()); // Strip UTF-8 BOM
  const rows = lines.slice(1);

  return { headers, rows };
}

/**
 * Normalizes and validates Indian phone numbers into E.164 format (+91XXXXXXXXXX)
 */
export function sanitizePhoneNumber(phone: string): {
  cleanNumber: string;
  isValid: boolean;
  error?: string;
} {
  if (!phone || typeof phone !== "string") {
    return { cleanNumber: "", isValid: false, error: "Phone number is empty" };
  }

  // Strip spaces, dashes, dots, brackets, plus
  let digitsOnly = phone.replace(/[\s\-\(\)\.\+]/g, "").trim();

  // Strip leading zero if 11 digits (e.g. 09876543210 -> 9876543210)
  if (digitsOnly.length === 11 && digitsOnly.startsWith("0")) {
    digitsOnly = digitsOnly.slice(1);
  }

  // If starts with 91 and is 12 digits (e.g. 919876543210)
  if (digitsOnly.length === 12 && digitsOnly.startsWith("91")) {
    digitsOnly = digitsOnly.slice(2);
  }

  // Indian mobile numbers must be 10 digits and generally start with 6, 7, 8, or 9
  if (digitsOnly.length !== 10) {
    return {
      cleanNumber: phone,
      isValid: false,
      error: `Must be a 10-digit number (found ${digitsOnly.length} digits)`,
    };
  }

  if (!/^[6-9]\d{9}$/.test(digitsOnly)) {
    return {
      cleanNumber: `+91${digitsOnly}`,
      isValid: false,
      error: "Indian mobile numbers must start with 6, 7, 8, or 9",
    };
  }

  return {
    cleanNumber: `+91${digitsOnly}`,
    isValid: true,
  };
}

/**
 * Automatically guesses best column mappings based on header names
 */
export function autoDetectColumnMapping(headers: string[]): ColumnMapping {
  const lowerHeaders = headers.map((h) => h.toLowerCase());

  // Detect Phone column
  let phoneCol = "";
  const phonePatterns = ["phone", "mobile", "contact", "number", "cell", "tel", "phone number", "mobile number"];
  for (const pattern of phonePatterns) {
    const idx = lowerHeaders.findIndex((h) => h === pattern || h.includes(pattern));
    if (idx !== -1) {
      phoneCol = headers[idx];
      break;
    }
  }

  // Detect Name column
  let nameCol = "";
  const namePatterns = ["name", "full name", "first name", "customer", "lead", "client", "contact name"];
  for (const pattern of namePatterns) {
    const idx = lowerHeaders.findIndex((h) => h === pattern || h.includes(pattern));
    if (idx !== -1 && headers[idx] !== phoneCol) {
      nameCol = headers[idx];
      break;
    }
  }

  // Detect Language column
  let langCol = "";
  const langPatterns = ["lang", "language", "dialect", "bhasha"];
  for (const pattern of langPatterns) {
    const idx = lowerHeaders.findIndex((h) => h === pattern || h.includes(pattern));
    if (idx !== -1 && headers[idx] !== phoneCol && headers[idx] !== nameCol) {
      langCol = headers[idx];
      break;
    }
  }

  // Any remaining columns are treated as potential custom data
  const customDataCols = headers.filter((h) => h !== phoneCol && h !== nameCol && h !== langCol);

  return {
    nameColumn: nameCol || (headers[0] || ""),
    phoneColumn: phoneCol || (headers[1] || ""),
    languageColumn: langCol || undefined,
    customDataColumns: customDataCols,
  };
}

/**
 * Extracts Google Sheet CSV export URL from various Google Sheets URL formats
 */
export function extractGoogleSheetExportUrl(url: string): { exportUrl?: string; error?: string } {
  if (!url || !url.includes("docs.google.com/spreadsheets")) {
    return { error: "Please enter a valid Google Sheets URL (docs.google.com/spreadsheets/...)" };
  }

  // Match spreadsheet ID: /spreadsheets/d/([a-zA-Z0-9-_]+)
  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch || !idMatch[1]) {
    return { error: "Could not find a valid Spreadsheet ID in the provided URL." };
  }
  const sheetId = idMatch[1];

  // Match gid if present: gid=([0-9]+)
  const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
  const gid = gidMatch && gidMatch[1] ? gidMatch[1] : "0";

  const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  return { exportUrl };
}

/**
 * Validates and transforms parsed rows into preview contacts, highlighting duplicates and errors
 */
export function processContactRows(
  headers: string[],
  rows: string[][],
  mapping: ColumnMapping,
  defaultLanguage: string = "Telugu + English"
): {
  previews: ParsedContactPreview[];
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
} {
  const nameIdx = headers.indexOf(mapping.nameColumn);
  const phoneIdx = headers.indexOf(mapping.phoneColumn);
  const langIdx = mapping.languageColumn ? headers.indexOf(mapping.languageColumn) : -1;

  const seenNumbers = new Set<string>();
  const previews: ParsedContactPreview[] = [];
  let validCount = 0;
  let invalidCount = 0;
  let duplicateCount = 0;

  rows.forEach((row, index) => {
    const rawName = nameIdx !== -1 && row[nameIdx] ? row[nameIdx].trim() : `Contact #${index + 1}`;
    const rawPhone = phoneIdx !== -1 && row[phoneIdx] ? row[phoneIdx].trim() : "";
    const rawLang = langIdx !== -1 && row[langIdx] ? row[langIdx].trim() : defaultLanguage;

    const customData: Record<string, any> = {};
    mapping.customDataColumns.forEach((colName) => {
      const colIdx = headers.indexOf(colName);
      if (colIdx !== -1 && row[colIdx]) {
        customData[colName] = row[colIdx].trim();
      }
    });

    const { cleanNumber, isValid, error } = sanitizePhoneNumber(rawPhone);
    let isDuplicate = false;

    if (isValid) {
      if (seenNumbers.has(cleanNumber)) {
        isDuplicate = true;
        duplicateCount++;
      } else {
        seenNumbers.add(cleanNumber);
        validCount++;
      }
    } else {
      invalidCount++;
    }

    previews.push({
      index: index + 1,
      name: rawName || `Contact #${index + 1}`,
      rawPhone,
      cleanPhone: cleanNumber || rawPhone,
      language: rawLang || defaultLanguage,
      customData,
      isValid: isValid && !isDuplicate,
      validationError: isDuplicate ? "Duplicate phone number in list" : error,
      isDuplicate,
    });
  });

  return {
    previews,
    validCount,
    invalidCount,
    duplicateCount,
  };
}
