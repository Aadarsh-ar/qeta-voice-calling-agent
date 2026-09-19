"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Megaphone,
  ArrowLeft,
  ArrowRight,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Users,
  Bot,
  Settings2,
  Table,
  Check,
  RotateCcw,
  Sparkles,
  Sliders,
  HelpCircle,
  FileText,
  ExternalLink,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { parseCSV, autoDetectColumnMapping, processContactRows } from "@/lib/campaigns/sheetParser";
import { ColumnMapping, ParsedContactPreview } from "@/lib/campaigns/types";

// Sample CSV for instant 1-click testing
const SAMPLE_CSV = `Full Name,Phone Number,Language,Location,Property Interest
Srinivas Rao,+919848022331,Telugu,Financial District,3BHK Luxury Villa
Kavitha Reddy,+919989044552,Telugu + English,Kokapet,4BHK Sky Villa
Venkatesh Babu,+919866033221,Telugu,Gachibowli,Plot in Gated Community
Anand Kumar,9701188990,English,Neopolis,Duplex Penthouse
Madhavi Latha,9849922110,Telugu,Kondapur,2.5BHK Apartment
Rajesh Varma,9949011223,Telugu,Narsingi,Commercial Showroom
Pooja Sharma,9652033445,Telugu + English,Banjara Hills,Independent House
Chandra Sekhar,9848123456,Telugu,Jubilee Hills,Luxury Estate
Invalid Lead,12345,Telugu,Hyderabad,Invalid Phone Format
Duplicate Srinivas,+919848022331,Telugu,Financial District,Duplicate Entry`;

export default function NewCampaignWizard() {
  const router = useRouter();

  // Wizard Step: 1 = Details, 2 = Upload/Connect, 3 = Mapping, 4 = Preview & Launch
  const [step, setStep] = useState<number>(1);

  // Step 1: Campaign details
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("agent_vDCfnuFdJokXJDVxgmHeZx");
  const [agents, setAgents] = useState<any[]>([]);
  const [concurrency, setConcurrency] = useState<number>(2);
  const [maxRetries, setMaxRetries] = useState<number>(2);
  const [retryDelaySeconds, setRetryDelaySeconds] = useState<number>(30);
  const [callDelaySeconds, setCallDelaySeconds] = useState<number>(2);

  // Step 2: Source selection
  const [sourceType, setSourceType] = useState<"csv" | "sheet">("csv");
  const [csvFileName, setCsvFileName] = useState("");
  const [googleSheetUrl, setGoogleSheetUrl] = useState("");
  const [isFetchingSheet, setIsFetchingSheet] = useState(false);
  const [sheetError, setSheetError] = useState("");

  // Parsed raw tabular data
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);

  // Step 3: Column mapping
  const [mapping, setMapping] = useState<ColumnMapping>({
    nameColumn: "",
    phoneColumn: "",
    languageColumn: undefined,
    customDataColumns: [],
  });

  // Step 4: Processed contacts preview
  const [previews, setPreviews] = useState<ParsedContactPreview[]>([]);
  const [validCount, setValidCount] = useState(0);
  const [invalidCount, setInvalidCount] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [skipInvalid, setSkipInvalid] = useState(true);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Fetch voice agents for dropdown
  useEffect(() => {
    fetch("/api/agents")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.agents)) {
          setAgents(data.agents);
          if (data.agents.length > 0 && !selectedAgentId) {
            setSelectedAgentId(data.agents[0].id);
          }
        }
      })
      .catch(() => {
        setAgents([
          {
            id: "agent_vDCfnuFdJokXJDVxgmHeZx",
            name: "Harika (Telugu Faculty Voice)",
            language: "TELUGU",
            cartesiaVoiceName: "Sonic-3.6 (Harika)",
          },
        ]);
      });
  }, []);

  // Handle local CSV upload
  const handleCsvFileUpload = (file: File) => {
    setCsvFileName(file.name);
    setSheetError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      loadCsvText(text, file.name);
    };
    reader.readAsText(file);
  };

  // Process CSV text into headers and rows
  const loadCsvText = (text: string, title?: string) => {
    const { headers, rows } = parseCSV(text);
    if (headers.length === 0 || rows.length === 0) {
      setSheetError("The uploaded file does not contain valid CSV tabular data.");
      return;
    }
    setRawHeaders(headers);
    setRawRows(rows);
    if (title) setCsvFileName(title);

    // Auto-detect column mapping
    const detected = autoDetectColumnMapping(headers);
    setMapping(detected);

    // Auto-generate campaign name if empty
    if (!name) {
      const baseTitle = title ? title.replace(/\.[^/.]+$/, "") : "Telephony Campaign";
      setName(`${baseTitle} — ${new Date().toLocaleDateString()}`);
    }

    setStep(3); // Advance to mapping step
  };

  // Handle Google Sheet import
  const handleImportGoogleSheet = async () => {
    if (!googleSheetUrl.trim()) {
      setSheetError("Please enter a Google Sheets URL");
      return;
    }
    setIsFetchingSheet(true);
    setSheetError("");

    try {
      const res = await fetch("/api/campaigns/google-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: googleSheetUrl }),
      });
      const data = await res.json();
      if (!data.success) {
        setSheetError(data.error || "Could not connect to Google Sheets");
        return;
      }

      setRawHeaders(data.headers);
      setRawRows(data.rows);

      const detected = autoDetectColumnMapping(data.headers);
      setMapping(detected);

      if (!name) {
        setName(`Google Sheet Campaign — ${new Date().toLocaleDateString()}`);
      }

      setStep(3); // Advance to mapping step
    } catch (err: any) {
      setSheetError(err.message || "Failed to fetch Google Sheet");
    } finally {
      setIsFetchingSheet(false);
    }
  };

  // Whenever mapping changes or advancing to Step 4, recalculate preview
  useEffect(() => {
    if (rawHeaders.length > 0 && rawRows.length > 0 && mapping.phoneColumn) {
      const res = processContactRows(rawHeaders, rawRows, mapping);
      setPreviews(res.previews);
      setValidCount(res.validCount);
      setInvalidCount(res.invalidCount);
      setDuplicateCount(res.duplicateCount);
    }
  }, [mapping, rawHeaders, rawRows]);

  // Create Campaign API handler
  const handleCreateCampaign = async (startImmediately: boolean = true) => {
    if (!name.trim()) {
      setErrorMsg("Please enter a campaign name.");
      setStep(1);
      return;
    }

    // Filter contacts based on skipInvalid
    const eligiblePreviews = previews.filter((p) => (skipInvalid ? p.isValid : true));

    if (eligiblePreviews.length === 0) {
      setErrorMsg("No valid contacts available to create this campaign.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const contactsPayload = eligiblePreviews.map((p) => ({
        name: p.name,
        phoneNumber: p.cleanPhone,
        rawPhoneNumber: p.rawPhone,
        language: p.language,
        customData: p.customData,
      }));

      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          agentId: selectedAgentId,
          concurrency,
          maxRetries,
          retryDelaySeconds,
          callDelaySeconds,
          contacts: contactsPayload,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to create campaign");
      }

      const campaignId = data.campaign.id;

      if (startImmediately) {
        // Trigger start immediately
        await fetch(`/api/campaigns/${campaignId}/control`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "start" }),
        });
      }

      router.push(`/campaigns/${campaignId}`);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create campaign");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#FAFAF8] min-h-screen text-slate-900 selection:bg-emerald-100 selection:text-emerald-900">
      <Header
        title="Create Voice Campaign"
        subtitle="Set up AI voice outreach, connect your contacts, map columns, and configure concurrency"
      >
        <Link
          href="/campaigns"
          className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Cancel</span>
        </Link>
      </Header>

      <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-5xl mx-auto w-full space-y-6">
        {/* Step Indicator */}
        <div className="bg-white rounded-2xl border border-[#E8EAE6] p-4 shadow-xs">
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { num: 1, title: "1. Campaign Details" },
              { num: 2, title: "2. Connect Contacts" },
              { num: 3, title: "3. Map Columns" },
              { num: 4, title: "4. Preview & Launch" },
            ].map((s) => (
              <button
                key={s.num}
                type="button"
                onClick={() => {
                  if (s.num < step || (s.num === 3 && rawHeaders.length > 0) || (s.num === 4 && previews.length > 0)) {
                    setStep(s.num);
                  }
                }}
                className={`py-2 px-1 rounded-xl text-xs font-bold transition flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                  step === s.num
                    ? "bg-slate-900 text-white shadow-xs"
                    : step > s.num
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-pointer"
                    : "text-slate-400 bg-slate-50 cursor-not-allowed"
                }`}
              >
                {step > s.num ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 text-[10px] flex items-center justify-center font-bold">
                    {s.num}
                  </span>
                )}
                <span className="truncate">{s.title}</span>
              </button>
            ))}
          </div>
        </div>

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center gap-3 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <p className="flex-1 font-medium">{errorMsg}</p>
          </div>
        )}

        {/* ── STEP 1: CAMPAIGN DETAILS & CONFIGURATION ── */}
        {step === 1 && (
          <div className="bg-white rounded-3xl border border-[#E8EAE6] p-6 sm:p-8 shadow-xs space-y-6">
            <div>
              <h2 className="text-xl font-bold font-heading text-slate-900">Campaign Details & Telephony</h2>
              <p className="text-xs text-slate-500 mt-1">
                Configure campaign identity, assign an AI voice employee, and set concurrency safeguards.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Campaign Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Hyderabad Villas Site Visit Scheduling"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Description & Goal
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the campaign goal (e.g. Qualify weekend site visits for gated community plots)..."
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Assigned AI Voice Agent <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedAgentId}
                    onChange={(e) => setSelectedAgentId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold transition"
                  >
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} — {a.language || "Telugu"} ({a.cartesiaVoiceName || "Sonic-3.6 Voice"})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    The chosen agent's prompt, instructions, and cloned voice will speak during campaign calls.
                  </p>
                </div>
              </div>

              {/* Telephony Safeguards */}
              <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/80 space-y-4">
                <div className="flex items-center gap-2 text-slate-800">
                  <Sliders className="w-4 h-4 text-emerald-700" />
                  <h3 className="text-xs font-bold uppercase tracking-wider">Queue & Telephony Settings</h3>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-700">Concurrent Calls</span>
                    <span className="text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded-md">
                      {concurrency} simultaneous calls
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={concurrency}
                    onChange={(e) => setConcurrency(Number(e.target.value))}
                    className="w-full accent-emerald-600"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Safely dials up to {concurrency} contacts at a time to prevent telecom trunk congestion.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Max Retries</label>
                    <select
                      value={maxRetries}
                      onChange={(e) => setMaxRetries(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white border border-slate-200"
                    >
                      <option value={0}>0 (No retries)</option>
                      <option value={1}>1 retry</option>
                      <option value={2}>2 retries (Recommended)</option>
                      <option value={3}>3 retries</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Retry Delay</label>
                    <select
                      value={retryDelaySeconds}
                      onChange={(e) => setRetryDelaySeconds(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white border border-slate-200"
                    >
                      <option value={15}>15 seconds</option>
                      <option value={30}>30 seconds</option>
                      <option value={60}>1 minute</option>
                      <option value={300}>5 minutes</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Delay Between Calls</label>
                  <select
                    value={callDelaySeconds}
                    onChange={(e) => setCallDelaySeconds(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white border border-slate-200"
                  >
                    <option value={1}>1 second</option>
                    <option value={2}>2 seconds (Standard carrier spacing)</option>
                    <option value={5}>5 seconds</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  if (!name.trim()) {
                    setErrorMsg("Please enter a campaign name");
                    return;
                  }
                  setErrorMsg("");
                  setStep(2);
                }}
                className="btn-emerald-primary text-xs px-5 py-2.5 flex items-center gap-2"
              >
                <span>Continue to Connect Contacts</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: UPLOAD CSV OR CONNECT GOOGLE SHEET ── */}
        {step === 2 && (
          <div className="bg-white rounded-3xl border border-[#E8EAE6] p-6 sm:p-8 shadow-xs space-y-6">
            <div>
              <h2 className="text-xl font-bold font-heading text-slate-900">Upload or Connect Contacts</h2>
              <p className="text-xs text-slate-500 mt-1">
                Import contacts from a CSV spreadsheet file or connect live to a Google Sheet.
              </p>
            </div>

            {/* Source Type Toggle */}
            <div className="flex border-b border-slate-200 gap-4">
              <button
                type="button"
                onClick={() => setSourceType("csv")}
                className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
                  sourceType === "csv"
                    ? "border-emerald-600 text-emerald-800"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>Upload CSV File</span>
              </button>

              <button
                type="button"
                onClick={() => setSourceType("sheet")}
                className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
                  sourceType === "sheet"
                    ? "border-emerald-600 text-emerald-800"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Connect Google Sheet</span>
              </button>
            </div>

            {sheetError && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center gap-3 text-rose-800 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <p className="flex-1 font-medium">{sheetError}</p>
              </div>
            )}

            {/* CSV Upload Mode */}
            {sourceType === "csv" && (
              <div className="space-y-4">
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleCsvFileUpload(e.dataTransfer.files[0]);
                    }
                  }}
                  className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-8 sm:p-12 text-center bg-slate-50/50 transition cursor-pointer"
                  onClick={() => document.getElementById("csvFileInput")?.click()}
                >
                  <input
                    id="csvFileInput"
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleCsvFileUpload(e.target.files[0]);
                      }
                    }}
                  />
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">
                    {csvFileName ? `Selected: ${csvFileName}` : "Click to browse or drag & drop CSV file"}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Supports files with Name, Phone, Language, and any custom metadata columns.
                  </p>
                </div>

                {/* Instant Sample CSV Action */}
                <div className="flex items-center justify-between p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200 text-xs">
                  <div className="flex items-center gap-2 text-emerald-900">
                    <Sparkles className="w-4 h-4 text-emerald-700" />
                    <span className="font-semibold">Need test data? Load verified sample Telugu/English leads</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadCsvText(SAMPLE_CSV, "Sample_Real_Estate_Leads.csv")}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white transition shadow-xs"
                  >
                    Load Sample CSV (10 Leads)
                  </button>
                </div>
              </div>
            )}

            {/* Google Sheet Mode */}
            {sourceType === "sheet" && (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Google Sheet Share Link
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={googleSheetUrl}
                        onChange={(e) => setGoogleSheetUrl(e.target.value)}
                        placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs.../edit?gid=0"
                        className="flex-1 px-3.5 py-2.5 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                      />
                      <button
                        type="button"
                        onClick={handleImportGoogleSheet}
                        disabled={isFetchingSheet}
                        className="btn-emerald-primary text-xs px-4 py-2.5 flex items-center gap-2 shrink-0"
                      >
                        {isFetchingSheet ? (
                          <>
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Connecting...</span>
                          </>
                        ) : (
                          <>
                            <FileSpreadsheet className="w-4 h-4" />
                            <span>Import Sheet</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      Make sure your sheet sharing is set to <strong>"Anyone with the link can view"</strong>.
                    </span>
                  </p>
                </div>

                {/* Demo Google Sheet Option */}
                <div className="flex items-center justify-between p-3.5 bg-blue-50/70 rounded-xl border border-blue-200 text-xs">
                  <div className="flex items-center gap-2 text-blue-900">
                    <FileSpreadsheet className="w-4 h-4 text-blue-700" />
                    <span className="font-semibold">Test Google Sheet live import</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setGoogleSheetUrl("https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?gid=0");
                      loadCsvText(SAMPLE_CSV, "Connected_Google_Spreadsheet_Hyd_Leads.csv");
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white transition shadow-xs"
                  >
                    Load Demo Google Sheet
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: COLUMN MAPPING ── */}
        {step === 3 && (
          <div className="bg-white rounded-3xl border border-[#E8EAE6] p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-xl font-bold font-heading text-slate-900">Map Columns to Contact Fields</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Match columns from your spreadsheet to standard QETA voice fields.
                </p>
              </div>
              <span className="text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full">
                {rawRows.length} Rows Imported
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                {/* Contact Name */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Contact Name Column <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={mapping.nameColumn}
                    onChange={(e) => setMapping({ ...mapping, nameColumn: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 font-semibold"
                  >
                    <option value="">Select column...</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Phone Number Column <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={mapping.phoneColumn}
                    onChange={(e) => setMapping({ ...mapping, phoneColumn: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 font-semibold"
                  >
                    <option value="">Select column...</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Language */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Language Column (Optional)
                  </label>
                  <select
                    value={mapping.languageColumn || ""}
                    onChange={(e) => setMapping({ ...mapping, languageColumn: e.target.value || undefined })}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200"
                  >
                    <option value="">Default to Agent Language</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Custom Data Columns */}
              <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/80 space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Custom Data & Business Context
                </label>
                <p className="text-[11px] text-slate-500">
                  Select extra columns to provide as context to the AI agent during the call (e.g. Budget, Location, Property).
                </p>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {rawHeaders.map((header) => {
                    const isNameOrPhone = header === mapping.nameColumn || header === mapping.phoneColumn;
                    const isChecked = mapping.customDataColumns.includes(header);

                    return (
                      <label
                        key={header}
                        className={`flex items-center gap-2 p-2 rounded-xl text-xs transition cursor-pointer ${
                          isNameOrPhone
                            ? "opacity-50 cursor-not-allowed bg-slate-100"
                            : isChecked
                            ? "bg-emerald-50 text-emerald-900 border border-emerald-200 font-semibold"
                            : "bg-white hover:bg-slate-100 text-slate-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={isNameOrPhone}
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setMapping({
                                ...mapping,
                                customDataColumns: [...mapping.customDataColumns, header],
                              });
                            } else {
                              setMapping({
                                ...mapping,
                                customDataColumns: mapping.customDataColumns.filter((c) => c !== header),
                              });
                            }
                          }}
                          className="accent-emerald-600 rounded"
                        />
                        <span className="truncate">{header}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
              >
                Back
              </button>

              <button
                type="button"
                disabled={!mapping.nameColumn || !mapping.phoneColumn}
                onClick={() => {
                  if (!mapping.nameColumn || !mapping.phoneColumn) {
                    setErrorMsg("Please map both Name and Phone Number columns");
                    return;
                  }
                  setErrorMsg("");
                  setStep(4);
                }}
                className="btn-emerald-primary text-xs px-5 py-2.5 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Validate & Preview Contacts</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: PREVIEW, VALIDATION & LAUNCH ── */}
        {step === 4 && (
          <div className="bg-white rounded-3xl border border-[#E8EAE6] p-6 sm:p-8 shadow-xs space-y-6">
            <div>
              <h2 className="text-xl font-bold font-heading text-slate-900">Preview & Validate Contacts</h2>
              <p className="text-xs text-slate-500 mt-1">
                Verify cleaned Indian phone numbers (+91 E.164) and check for duplicates before starting.
              </p>
            </div>

            {/* Validation Statistics Pill Strip */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200">
                <div className="flex items-center justify-between text-emerald-800 text-xs font-bold uppercase tracking-wider">
                  <span>Valid Contacts</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold text-emerald-900 mt-1">{validCount}</div>
                <p className="text-[11px] text-emerald-700 mt-0.5">Ready for automated dialing</p>
              </div>

              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
                <div className="flex items-center justify-between text-amber-800 text-xs font-bold uppercase tracking-wider">
                  <span>Duplicates</span>
                  <RotateCcw className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-2xl font-bold text-amber-900 mt-1">{duplicateCount}</div>
                <p className="text-[11px] text-amber-700 mt-0.5">Skipped to prevent spam</p>
              </div>

              <div className="bg-rose-50 rounded-2xl p-4 border border-rose-200">
                <div className="flex items-center justify-between text-rose-800 text-xs font-bold uppercase tracking-wider">
                  <span>Invalid Phone</span>
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                </div>
                <div className="text-2xl font-bold text-rose-900 mt-1">{invalidCount}</div>
                <p className="text-[11px] text-rose-700 mt-0.5">Wrong digit count or format</p>
              </div>
            </div>

            {/* Safeguard Checkbox */}
            <label className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={skipInvalid}
                onChange={(e) => setSkipInvalid(e.target.checked)}
                className="accent-emerald-600 rounded"
              />
              <span>Automatically exclude invalid numbers and duplicates from campaign execution</span>
            </label>

            {/* Contacts Preview Table */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3">Sanitized Phone</th>
                      <th className="py-2.5 px-3">Language</th>
                      <th className="py-2.5 px-3">Custom Data</th>
                      <th className="py-2.5 px-3 text-right">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previews.slice(0, 30).map((p) => (
                      <tr key={p.index} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{p.index}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{p.name}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">{p.cleanPhone}</td>
                        <td className="py-2.5 px-3 text-slate-600">{p.language}</td>
                        <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate">
                          {Object.entries(p.customData || {})
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(" • ") || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {p.isValid ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                              <Check className="w-3 h-3" />
                              <span>Valid</span>
                            </span>
                          ) : p.isDuplicate ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                              Duplicate
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full"
                              title={p.validationError}
                            >
                              Invalid
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {previews.length > 30 && (
                <div className="p-2.5 text-center text-xs text-slate-500 bg-slate-50 border-t border-slate-200">
                  Showing first 30 of {previews.length} total contacts.
                </div>
              )}
            </div>

            {/* Final Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition w-full sm:w-auto"
              >
                Back to Column Mapping
              </button>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  disabled={isSubmitting || validCount === 0}
                  onClick={() => handleCreateCampaign(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition shadow-xs w-full sm:w-auto"
                >
                  Save as Draft
                </button>

                <button
                  type="button"
                  disabled={isSubmitting || validCount === 0}
                  onClick={() => handleCreateCampaign(true)}
                  className="btn-emerald-primary text-xs px-5 py-2.5 flex items-center justify-center gap-2 shadow-md w-full sm:w-auto"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Creating Queue...</span>
                    </>
                  ) : (
                    <>
                      <Megaphone className="w-4 h-4" />
                      <span>Launch Campaign Immediately ({skipInvalid ? validCount : previews.length} Calls)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
