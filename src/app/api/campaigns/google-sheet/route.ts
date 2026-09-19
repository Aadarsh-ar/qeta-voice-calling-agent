import { NextResponse } from "next/server";
import { extractGoogleSheetExportUrl, parseCSV } from "@/lib/campaigns/sheetParser";

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { success: false, error: "Google Sheet URL is required." },
        { status: 400 }
      );
    }

    const { exportUrl, error } = extractGoogleSheetExportUrl(url.trim());
    if (error || !exportUrl) {
      return NextResponse.json(
        { success: false, error: error || "Invalid Google Sheet URL format." },
        { status: 400 }
      );
    }

    console.log(`[GOOGLE_SHEET_FETCH] Fetching export from: ${exportUrl}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const sheetRes = await fetch(exportUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
      },
    }).catch((err) => {
      clearTimeout(timeout);
      throw new Error(`Failed to connect to Google Sheets: ${err.message}`);
    });

    clearTimeout(timeout);

    if (!sheetRes.ok) {
      if (sheetRes.status === 404) {
        return NextResponse.json(
          {
            success: false,
            error: "Google Sheet not found. Please verify the URL and ensure link sharing is set to 'Anyone with the link can view'.",
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        {
          success: false,
          error: `Google Sheets returned HTTP ${sheetRes.status}. Please make sure the sheet is public or shared as 'Anyone with the link can view'.`,
        },
        { status: 400 }
      );
    }

    const csvText = await sheetRes.text();

    // Verify it's actually CSV and not an HTML login/redirect page
    if (csvText.includes("<html") || csvText.includes("<!DOCTYPE html") || csvText.includes("accounts.google.com")) {
      return NextResponse.json(
        {
          success: false,
          error: "Google Sheet is private. In Google Sheets, click 'Share' -> 'General access' -> set to 'Anyone with the link can view', then try again.",
        },
        { status: 400 }
      );
    }

    const { headers, rows } = parseCSV(csvText);

    if (headers.length === 0 || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "The Google Sheet contains no data or could not be parsed." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      headers,
      rows,
      sampleRows: rows.slice(0, 5),
      totalRows: rows.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to import Google Sheet" },
      { status: 500 }
    );
  }
}
