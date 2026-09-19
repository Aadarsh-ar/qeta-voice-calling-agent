"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  Bot,
  Languages,
  Mic2,
  FileText,
  Building2,
  Phone,
  Wrench,
  Plus,
  Trash2,
  CheckCircle2,
  PhoneCall,
  Calendar,
  Headphones,
  SlidersHorizontal,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { AgentLanguage } from "@/lib/types/models";

interface Preset {
  id: string;
  title: string;
  category: string;
  icon: React.ElementType;
  description: string;
  name: string;
  language: AgentLanguage;
  prompt: string;
}

const PRESETS: Preset[] = [
  {
    id: "sales",
    title: "Telugu Sales Executive",
    category: "Sales & Inbound Leads",
    icon: PhoneCall,
    description: "Greets customers warmly in Telugu/Tenglish, answers pricing questions, and qualifies sales leads.",
    name: "Telugu Sales Agent",
    language: AgentLanguage.TELUGU_ENGLISH,
    prompt: `మీరు Vaani AI సేల్స్ ప్రతినిధి. కస్టమర్‌తో ఎల్లప్పుడూ స్నేహపూర్వక మరియు గౌరవప్రదమైన టెంగ్లీష్/తెలుగులో మాట్లాడండి.
1. ప్రారంభంలో: "నమస్కారం అండి! Vaani AI కి స్వాగతం. మీ వ్యాపారం లేదా సేవల వివరాలు తెలుసుకోవచ్చా?" అని పలకరించండి.
2. సమాధానాలు ఎల్లప్పుడూ 1 లేదా 2 వాక్యాలకే పరిమితం చేయండి. పొడవైన ప్రసంగాలు వద్దు.
3. ఒకసారి ఒక ప్రశ్న మాత్రమే అడగండి.
4. కస్టమర్ వివరాలు తెలుసుకుని capture_customer_details టూల్ ఉపయోగించండి.
5. "అవునండి", "ఖచ్చితంగా అండి", "ధన్యవాదాలు అండి" వంటి సహజమైన మాటలు వాడండి.`,
  },
  {
    id: "support",
    title: "Customer Support Executive",
    category: "Customer Service",
    icon: Headphones,
    description: "Resolves customer account queries, login/OTP issues, and handles complaints politely.",
    name: "Customer Support Agent (Tenglish)",
    language: AgentLanguage.TELUGU_ENGLISH,
    prompt: `మీరు Vaani AI కస్టమర్ సపోర్ట్ ఎగ్జిక్యూటివ్. కస్టమర్లతో ఎల్లప్పుడూ వినయంగా, ఓపికగా మాట్లాడండి.
1. "నమస్కారం అండి! నేను మీ కస్టమర్ సపోర్ట్ అసిస్టెంట్ ని. మీకు ఎదురవుతున్న సమస్య ఏమిటో చెప్పండి, వెంటనే సహాయం చేస్తాను."
2. సమాధానం ఎల్లప్పుడూ 1-2 వాక్యాల్లోనే స్పష్టంగా ఇవ్వండి.
3. సాంకేతిక సమస్య ఉంటే వివరాలు నమోదు చేసుకుని అవసరమైతే transfer_call టూల్ వాడండి.`,
  },
  {
    id: "booking",
    title: "Appointment & Site Visits",
    category: "Real Estate & Clinics",
    icon: Calendar,
    description: "Books demo calls, clinic consultations, or real-estate site visits at caller's preferred time.",
    name: "Appointment Scheduler",
    language: AgentLanguage.TELUGU_ENGLISH,
    prompt: `మీరు అపాయింట్‌మెంట్ మరియు షెడ్యూలింగ్ అసిస్టెంట్.
1. "నమస్కారం అండి! మీరు ఏ తేదీ మరియు ఏ సమయంలో అపాయింట్‌మెంట్ లేదా డెమో తీసుకోవాలనుకుంటున్నారో చెప్పండి."
2. కస్టమర్ సమయం చెప్పిన తర్వాత కన్ఫర్మ్ చేసి capture_customer_details లో సేవ్ చేయండి.
3. సమాధానాలు 1-2 వాక్యాలకే పరిమితం చేయండి.`,
  },
  {
    id: "custom",
    title: "Custom Agent Persona",
    category: "Blank Canvas",
    icon: Bot,
    description: "Define your own business prompt, conversation guardrails, and role from scratch.",
    name: "My Custom Telugu Agent",
    language: AgentLanguage.TELUGU_ENGLISH,
    prompt: `మీరు వ్యాపార సహాయకుడిగా మాట్లాడండి. సహజమైన తెలుగు మరియు టెంగ్లీష్ లో 1-2 వాక్యాలలో సమాధానాలు ఇవ్వండి.`,
  },
];

export default function CreateAgentPage() {
  const router = useRouter();
  const [selectedPreset, setSelectedPreset] = useState("sales");
  const [name, setName] = useState("Telugu Sales Agent");
  const [description, setDescription] = useState("Inbound and outbound business conversations in natural Telugu & Tenglish.");
  const [language, setLanguage] = useState<AgentLanguage>(AgentLanguage.TELUGU_ENGLISH);
  const [systemPrompt, setSystemPrompt] = useState(PRESETS[0].prompt);
  const [cartesiaAgentId, setCartesiaAgentId] = useState("");
  const [cartesiaVoiceId, setCartesiaVoiceId] = useState("93d9c1de-e167-44c6-8e39-b4440c106a1d");
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState("+91 80 7158 2667");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveStep, setSaveStep] = useState<"idle" | "saving" | "syncing" | "ready" | "error">("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Tools state
  const [tools, setTools] = useState([
    { name: "end_call", label: "End Call", description: "End call politely when conversation finishes", isEnabled: true },
    { name: "transfer_call", label: "Transfer Call", description: "Transfer call to human executive", isEnabled: true },
    { name: "capture_customer_details", label: "Capture Customer Details", description: "Extract & store caller name, requirement & callback time", isEnabled: true },
  ]);

  const handleSelectPreset = (preset: Preset) => {
    setSelectedPreset(preset.id);
    setName(preset.name);
    setLanguage(preset.language);
    setSystemPrompt(preset.prompt);
    setDescription(preset.description);
    setFormError(null);
  };

  const handleToggleTool = (toolIndex: number) => {
    const updated = [...tools];
    updated[toolIndex].isEnabled = !updated[toolIndex].isEnabled;
    setTools(updated);
  };

  const handleCreateAgent = async () => {
    setFormError(null);
    if (!name.trim()) {
      setFormError("Please provide an agent name.");
      return;
    }
    if (!systemPrompt.trim()) {
      setFormError("System prompt and instructions cannot be empty.");
      return;
    }

    setIsSubmitting(true);
    setSaveStep("saving");
    setTimeout(() => {
      setSaveStep((cur) => (cur === "saving" ? "syncing" : cur));
    }, 250);

    const voiceName = cartesiaVoiceId === "93d9c1de-e167-44c6-8e39-b4440c106a1d"
      ? "Priya (Cloned Telugu Voice)"
      : cartesiaVoiceId === "41508a7d-4839-445f-ba7f-687f620ed0e7" || cartesiaVoiceId === "89907713-42ce-4ddd-8ff5-301211c564c1"
      ? "Harika (Telugu Faculty Voice)"
      : "AD (Cloned Telugu Voice)";

    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          language,
          cartesiaVoiceId,
          cartesiaVoiceName: voiceName,
          cartesiaAgentId: cartesiaAgentId.trim() || undefined,
          systemPrompt: systemPrompt.trim(),
          phoneNumber: selectedPhoneNumber,
          tools,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.agent) {
        setSaveStep("ready");
        setTimeout(() => {
          router.push(`/agents/${data.agent.id}`);
        }, 700);
      } else {
        setSaveStep("error");
        setFormError(data.error || "Could not sync agent with Cartesia: rejected configuration.");
      }
    } catch (err: unknown) {
      setSaveStep("error");
      setFormError(`Could not sync agent with Cartesia: ${err instanceof Error ? err.message : "Network error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#FAFAF8] min-h-screen text-slate-900">
      <Header
        title="Create Voice Agent"
        subtitle="Launch a natural Telugu & Tenglish conversational calling agent in seconds"
      />

      <div className="p-8 max-w-5xl w-full mx-auto space-y-6">
        {/* Back Link */}
        <Link
          href="/agents"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-emerald-800 transition font-semibold"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Agents
        </Link>

        {/* Validation / Form Error */}
        {formError && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>{formError}</span>
            </div>
            <button
              onClick={() => setFormError(null)}
              className="text-rose-400 hover:text-rose-700 p-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 1. Preset Selector Cards */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading text-base font-bold text-slate-900">Choose a Persona Preset</h2>
              <p className="text-xs text-slate-500">Pick a pre-tuned conversation template or customize freely.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PRESETS.map((preset) => {
              const Icon = preset.icon;
              const isSelected = selectedPreset === preset.id;
              return (
                <div
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset)}
                  className={`p-5 rounded-2xl border text-left cursor-pointer transition flex flex-col justify-between space-y-3 ${
                    isSelected
                      ? "bg-emerald-50/80 border-emerald-600 shadow-sm ring-2 ring-emerald-500/20"
                      : "bg-white border-[#EAEBE8] hover:border-slate-300 hover:bg-slate-50/50"
                  }`}
                >
                  <div className="space-y-2">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        isSelected ? "bg-emerald-800 text-white" : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 block">
                      {preset.category}
                    </span>
                    <h3 className="font-heading text-xs font-bold text-slate-900 leading-snug">{preset.title}</h3>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                      {preset.description}
                    </p>
                  </div>
                  {isSelected && (
                    <span className="text-[10px] font-bold text-emerald-800 flex items-center gap-1 pt-2 border-t border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" /> Selected Preset
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Main Agent Settings Form */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Agent Configuration</h3>
              <p className="text-xs text-slate-500">Customize the identity and conversational instructions.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Cartesia Cloned Voice AD Ready
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Agent Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Telugu Sales Executive"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Conversation Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as AgentLanguage)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value={AgentLanguage.TELUGU_ENGLISH}>Telugu + English Blend (Tenglish - Most Natural)</option>
                <option value={AgentLanguage.TELUGU}>Pure Telugu (తెలుగు)</option>
                <option value={AgentLanguage.ENGLISH}>Indian English</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-semibold mb-1">Description / Internal Role</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief purpose of this agent"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-700 font-semibold">
                  System Prompt & Conversational Persona
                </label>
                <span className="text-[11px] text-slate-500">1-2 sentences per turn enforced automatically</span>
              </div>
              <textarea
                rows={6}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 text-xs font-sans leading-relaxed focus:outline-none focus:border-indigo-500 focus:bg-white transition"
              />
            </div>
          </div>

          {/* Advanced / Telephony Toggle */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {showAdvanced ? "Hide Telephony & Tool Settings" : "Configure Telephony & Tools (Optional)"}
            </button>
          </div>

          {showAdvanced && (
            <div className="pt-4 border-t border-slate-100 space-y-4 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Assign Outbound Phone Line</label>
                  <select
                    value={selectedPhoneNumber}
                    onChange={(e) => setSelectedPhoneNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="+91 80 7158 2667">+91 80 7158 2667 (Vobiz Outbound Carrier)</option>
                    <option value="+91 80 4735 9182">+91 80 4735 9182 (Vobiz Line 2)</option>
                    <option value="+91 40 6829 4410">+91 40 6829 4410 (Hyderabad Line)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Voice & Persona Voice ID</label>
                  <select
                    value={cartesiaVoiceId}
                    onChange={(e) => setCartesiaVoiceId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs focus:outline-none focus:border-indigo-500 font-medium"
                  >
                    <option value="93d9c1de-e167-44c6-8e39-b4440c106a1d">
                      Priya (Cloned Telugu Voice - Female, Natural)
                    </option>
                    <option value="41508a7d-4839-445f-ba7f-687f620ed0e7">
                      Harika (Telugu Faculty Voice - Female)
                    </option>
                    <option value="f9945b75-0f3b-448d-ba9e-3d22c229a68e">
                      AD (Cloned Telugu Voice - Male)
                    </option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-semibold mb-1 flex items-center justify-between">
                    <span>Cartesia Agent ID</span>
                    <span className="text-[10px] text-slate-400 font-normal">Leave blank to auto-create, or enter existing ID</span>
                  </label>
                  <input
                    type="text"
                    value={cartesiaAgentId}
                    onChange={(e) => setCartesiaAgentId(e.target.value)}
                    placeholder="e.g. agent_vDCfnuFdJokXJDVxgmHeZx"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white font-mono text-slate-900 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-2">Enabled Tools</label>
                <div className="space-y-2">
                  {tools.map((t, idx) => (
                    <div
                      key={t.name}
                      onClick={() => handleToggleTool(idx)}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer text-xs transition ${
                        t.isEnabled ? "bg-indigo-50/60 border-indigo-200" : "bg-white border-slate-200 opacity-60"
                      }`}
                    >
                      <div>
                        <span className="font-bold text-slate-900">{t.label}</span>
                        <p className="text-[11px] text-slate-500">{t.description}</p>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${
                          t.isEnabled
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                      >
                        {t.isEnabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Action Toolbar */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <Link
              href="/agents"
              className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs font-semibold transition"
            >
              Cancel
            </Link>

            <button
              onClick={handleCreateAgent}
              disabled={isSubmitting}
              className={`btn-emerald-primary text-xs px-6 py-2.5 transition disabled:opacity-50 ${
                saveStep === "error" ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20" : ""
              }`}
            >
              {saveStep === "saving" ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : saveStep === "syncing" ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Syncing with Cartesia...
                </>
              ) : saveStep === "ready" ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Ready • Synchronized!
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create & Deploy Voice Agent
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
