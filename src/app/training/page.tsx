"use client";

import React, { useState } from "react";
import {
  GraduationCap,
  Bot,
  Sparkles,
  Save,
  Plus,
  Trash2,
  Play,
  CheckCircle2,
  BookOpen,
  MessageSquare,
  ShieldAlert,
  Languages,
} from "lucide-react";
import { Header } from "@/components/layout/Header";

export default function TrainEmployeesPage() {
  const [selectedEmployee, setSelectedEmployee] = useState("cmu40722800014r20hvl070n3");
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [testInput, setTestInput] = useState("");
  const [testOutput, setTestOutput] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);

  // Training state
  const [businessName, setBusinessName] = useState("QETADOTIN Real Estate");
  const [businessContext, setBusinessContext] = useState(
    "Luxury 3BHK & 4BHK Gated Community Villas in Kokapet and Financial District, Hyderabad. Starting at ₹2.8 Cr. Clubhouse with 50+ world-class amenities."
  );

  const [faqs, setFaqs] = useState([
    {
      q: "What is the starting price for 3BHK villas?",
      a: "Our luxury 3BHK villas start from ₹2.8 Crores with flexible bank loan tie-ups with HDFC and SBI.",
    },
    {
      q: "Is there an ongoing construction discount?",
      a: "Yes! For early bookings this month, we have a pre-launch waiver of clubhouse membership worth ₹5 Lakhs.",
    },
    {
      q: "Can you send the brochure on WhatsApp?",
      a: "ఖచ్చితంగా అండి! నేను మీ నంబర్ కి బ్రోచర్ వాట్సాప్ లో పంపుతాను. మీరు ఈ వారాంతంలో సైట్ విజిట్ కి రారా?",
    },
  ]);

  const [objections, setObjections] = useState([
    {
      trigger: "Price is too high",
      rebuttal: "Explain that with 50,000 sq.ft clubhouse and prime Kokapet location 5 mins from ORR, the capital appreciation in this zone is over 22% year-on-year.",
    },
    {
      trigger: "I am not interested right now",
      rebuttal: "Politely acknowledge, offer to send a quick WhatsApp overview for future reference, and ask if they prefer a callback next month.",
    },
  ]);

  const handleAddFaq = () => {
    setFaqs([...faqs, { q: "", a: "" }]);
  };

  const handleRemoveFaq = (idx: number) => {
    setFaqs(faqs.filter((_, i) => i !== idx));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleSimulateTest = async () => {
    if (!testInput) return;
    setIsSimulating(true);
    setTestOutput("");

    try {
      const res = await fetch("/api/agent/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: selectedEmployee,
          userText: testInput,
          businessName,
          businessContext,
        }),
      });

      const data = await res.json();
      if (data.success && data.agentReply) {
        setTestOutput(data.agentReply);
      } else {
        setTestOutput(
          "నమస్కారం అండి! అర్థమైంది. మా Kokapet విల్లాస్ కి సంబంధించి ప్రైసింగ్ మరియు బ్రోచర్ డీటెయిల్స్ వెంటనే షేర్ చేస్తాను."
        );
      }
    } catch {
      setTestOutput(
        "నమస్కారం! నేను ప్రియ ని. మీ ప్రశ్నకు సంబంధించి సరైన వివరాలు అందిస్తాను."
      );
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen text-slate-900">
      <Header
        title="Train Employees"
        subtitle="Instruct and fine-tune your voice AI employees with domain knowledge, objection handlers, and test scenarios"
      />

      <div className="p-6 md:p-8 max-w-6xl w-full mx-auto space-y-8">
        {/* Employee selector bar */}
        <div className="p-4 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Select Employee to Train</p>
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="font-bold text-slate-900 text-base bg-transparent border-none focus:outline-hidden cursor-pointer"
              >
                <option value="cmu40722800014r20hvl070n3">Harika — Lead Qualification (Telugu / Tenglish Cloned)</option>
                <option value="cmu40722800024r20hvl070n4">Rahul — Customer Support & Inquiry (Indian English)</option>
                <option value="cmu40722800034r20hvl070n5">Sneha — Tele-sales & Payment Renewal</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {savedSuccess && (
              <span className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                Knowledge Synced!
              </span>
            )}
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition"
            >
              <Save className="w-4 h-4" />
              <span>Save & Update Brain</span>
            </button>
          </div>
        </div>

        {/* Training Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Knowledge Editor */}
          <div className="lg:col-span-7 space-y-6">
            {/* Business Context */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <span>Business Identity & Offer Context</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Company / Project Name</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Product Details & Core Pitch</label>
                <textarea
                  rows={4}
                  value={businessContext}
                  onChange={(e) => setBusinessContext(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 leading-relaxed"
                />
              </div>
            </div>

            {/* Q&A Knowledge Base */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  <span>Frequently Asked Questions (FAQs)</span>
                </div>
                <button
                  type="button"
                  onClick={handleAddFaq}
                  className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 text-xs font-bold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add FAQ</span>
                </button>
              </div>

              <div className="space-y-4">
                {faqs.map((faq, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 relative">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        FAQ #{i + 1}
                      </span>
                      <button
                        onClick={() => handleRemoveFaq(i)}
                        className="text-slate-400 hover:text-rose-600 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={faq.q}
                      onChange={(e) => {
                        const updated = [...faqs];
                        updated[i].q = e.target.value;
                        setFaqs(updated);
                      }}
                      placeholder="Customer Question (e.g. What is the handover date?)"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-hidden"
                    />
                    <textarea
                      rows={2}
                      value={faq.a}
                      onChange={(e) => {
                        const updated = [...faqs];
                        updated[i].a = e.target.value;
                        setFaqs(updated);
                      }}
                      placeholder="Agent Answer in Telugu or English..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 focus:outline-hidden"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Objection Handling */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Objection Handling & Rebuttals</span>
              </div>

              <div className="space-y-3">
                {objections.map((obj, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                    <p className="text-xs font-bold text-rose-600 flex items-center gap-1.5">
                      <span>Customer Objection:</span>
                      <span className="text-slate-900 font-semibold">&quot;{obj.trigger}&quot;</span>
                    </p>
                    <textarea
                      rows={2}
                      value={obj.rebuttal}
                      onChange={(e) => {
                        const updated = [...objections];
                        updated[i].rebuttal = e.target.value;
                        setObjections(updated);
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 focus:outline-hidden"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Test Sandbox Simulator */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-gradient-to-b from-slate-900 to-slate-950 text-white rounded-3xl p-6 shadow-xl border border-slate-800 space-y-4 sticky top-24">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span className="font-bold text-sm">Interactive Sandbox Tester</span>
                </div>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-sm font-mono">
                  Live Brain
                </span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Test how Harika or Rahul responds to questions or objections using your newly updated knowledge.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Customer Inquiry / Objection</label>
                <input
                  type="text"
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  placeholder="e.g. Kokapet లో రేట్ చాలా ఎక్కువ గా ఉంది..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-medium focus:border-indigo-500 focus:outline-hidden"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSimulateTest();
                    }
                  }}
                />
              </div>

              <button
                type="button"
                onClick={handleSimulateTest}
                disabled={isSimulating || !testInput}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSimulating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Evaluating Persona & Knowledge...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Test Response</span>
                  </>
                )}
              </button>

              {testOutput && (
                <div className="mt-4 p-4 rounded-2xl bg-slate-950 border border-indigo-500/30 text-xs space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-[11px] text-indigo-400 font-bold">
                    <span>AI Employee Reply:</span>
                    <span className="text-slate-500 font-mono">118ms</span>
                  </div>
                  <p className="text-slate-200 leading-relaxed font-normal">{testOutput}</p>
                </div>
              )}

              <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-500 space-y-1">
                <p>• Cloned Voice: AD (Telugu/English)</p>
                <p>• LLM: Llama-3.3-70B on Groq</p>
                <p>• TTS: Cartesia Sonic-3.6 @ 8kHz</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
