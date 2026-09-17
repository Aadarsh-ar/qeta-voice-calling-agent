"use client";
import React, { use, useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  PhoneCall,
  Clock,
  IndianRupee,
  Bot,
  User,
  CheckCircle2,
  Calendar,
  Sparkles,
  Zap,
  Volume2,
  FileCheck,
  Building,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { dataStore, CallItem } from "@/lib/db/store";

export default function CallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const callId = resolvedParams.id;
  const [call, setCall] = useState<CallItem | undefined>(dataStore.getCall(callId));
  const [isLoading, setIsLoading] = useState(!call);

  useEffect(() => {
    fetch(`/api/calls/${callId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.call) {
          setCall(data.call);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [callId]);

  if (isLoading && !call) {
    return (
      <div className="p-16 text-center space-y-4 max-w-md mx-auto bg-slate-50 min-h-screen">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-500 font-medium">Loading call transcript & telemetry...</p>
      </div>
    );
  }

  if (!call) {
    return (
      <div className="p-8 text-center space-y-4 bg-slate-50 min-h-screen">
        <h2 className="text-xl font-bold text-slate-900">Call not found</h2>
        <Link href="/calls" className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold">
          ← Back to Calls
        </Link>
      </div>
    );
  }

  const minutes = Math.floor(call.durationSeconds / 60);
  const seconds = String(call.durationSeconds % 60).padStart(2, "0");

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <Header
        title={`Call ${call.callNumber}`}
        subtitle={`Recorded on ${new Date(call.startedAt).toLocaleString()}`}
      />

      <div className="p-6 md:p-8 max-w-6xl w-full mx-auto space-y-6">
        <Link
          href="/calls"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Call History
        </Link>

        {/* Call Overview Header Box */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-900 font-mono">{call.callNumber}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ● {call.status}
                </span>
                {call.isDemo && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono border border-slate-200">
                    DEMO CALL
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Direction: {call.direction} • Telephony: Vobiz Carrier SIP Trunk
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Duration</span>
                <span className="text-sm font-bold text-slate-900 font-mono">
                  {minutes}:{seconds}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Customer Number</span>
                <span className="text-sm font-bold text-slate-900 font-mono">{call.callerNumber}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Assigned Agent</span>
                <span className="text-sm font-bold text-indigo-600">{call.agentName}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Estimated Cost</span>
                <span className="text-sm font-bold text-emerald-600 font-mono">
                  ₹{call.estimatedCost.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Granular Cost & Token Breakdown */}
          {call.usage && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 text-[11px]">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block font-medium">Vobiz PSTN:</span>
                <span className="font-mono text-slate-900 font-semibold">₹{call.usage.vobizCost.toFixed(2)}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block font-medium">Sarvam STT ({call.usage.sttAudioSeconds}s):</span>
                <span className="font-mono text-slate-900 font-semibold">₹{call.usage.sarvamCost.toFixed(3)}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block font-medium">Groq Tokens:</span>
                <span className="font-mono text-slate-900 font-semibold">₹{call.usage.openaiCost.toFixed(3)}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block font-medium">Cartesia Cloned TTS:</span>
                <span className="font-mono text-slate-900 font-semibold">₹{call.usage.cartesiaCost.toFixed(3)}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block font-medium">Infra Buffer:</span>
                <span className="font-mono text-slate-900 font-semibold">₹{call.usage.infraCost.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        {/* 2-Column Layout: Transcript (Left) + AI Summary (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Transcript Column (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Conversation Transcript
            </h3>

            <div className="space-y-3">
              {call.transcripts.map((t) => (
                <div
                  key={t.id}
                  className={`p-4 rounded-2xl text-xs space-y-2 border transition ${
                    t.role === "CALLER"
                      ? "bg-white border-slate-200 text-slate-800 shadow-xs"
                      : "bg-indigo-50/50 border-indigo-200 text-slate-900 shadow-xs"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5">
                      {t.role === "CALLER" ? (
                        <>
                          <User className="w-3.5 h-3.5 text-slate-500" />
                          <span className="text-slate-700">Customer ({call.callerNumber})</span>
                        </>
                      ) : (
                        <>
                          <Bot className="w-3.5 h-3.5 text-indigo-600" />
                          <span className="text-indigo-900">AI Voice Agent (AD Cloned Voice)</span>
                        </>
                      )}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      +{Math.floor(t.timestampMs / 1000)}s
                    </span>
                  </div>

                  <p className="text-sm font-sans leading-relaxed text-slate-900">{t.content}</p>

                  {/* Show Telugu normalizer output if modified */}
                  {t.normalizedText && t.normalizedText !== t.content && (
                    <div className="pt-2 border-t border-indigo-100 text-[11px] text-indigo-800">
                      <span className="text-[10px] text-slate-500 block font-medium">Spoken Telugu Phonetics:</span>
                      <p className="italic font-sans">{t.normalizedText}</p>
                    </div>
                  )}

                  {/* Latency markers */}
                  {(t.sttLatencyMs || t.llmLatencyMs || t.ttsLatencyMs) && (
                    <div className="pt-2 border-t border-slate-100 flex items-center gap-3 text-[10px] font-mono text-slate-400">
                      {t.sttLatencyMs && <span>STT: {t.sttLatencyMs}ms</span>}
                      {t.llmLatencyMs && <span>LLM: {t.llmLatencyMs}ms</span>}
                      {t.ttsLatencyMs && <span>TTS: {t.ttsLatencyMs}ms</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* AI Summary Column (1 col) */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-600" />
              AI Call Summary & Sentiment
            </h3>

            {call.summary ? (
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px] uppercase tracking-wider font-semibold mb-1">
                    Summary
                  </span>
                  <p className="text-slate-800 leading-relaxed font-sans">{call.summary.summary}</p>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-1">
                  <span className="text-slate-400 block text-[11px] uppercase tracking-wider font-semibold">
                    Customer Intent
                  </span>
                  <p className="text-indigo-700 font-semibold">{call.summary.customerIntent}</p>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-1">
                  <span className="text-slate-400 block text-[11px] uppercase tracking-wider font-semibold">
                    Outcome
                  </span>
                  <p className="text-emerald-700 font-semibold">{call.summary.outcome}</p>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-1">
                  <span className="text-slate-400 block text-[11px] uppercase tracking-wider font-semibold">
                    Important Information
                  </span>
                  <p className="text-slate-700">{call.summary.importantInfo}</p>
                </div>

                {call.summary.followUpRequired && (
                  <div className="pt-3 border-t border-slate-100 space-y-1">
                    <span className="text-amber-700 block text-[11px] uppercase tracking-wider font-semibold flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Follow-up Required
                    </span>
                    <p className="text-slate-700">{call.summary.followUpDetails}</p>
                  </div>
                )}

                {call.summary.capturedDetails && (
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <span className="text-slate-400 block text-[11px] uppercase tracking-wider font-semibold">
                      Captured Customer Details
                    </span>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                      {Object.entries(call.summary.capturedDetails).map(([k, v]) => (
                        <div key={k} className="flex justify-between">
                          <span className="text-slate-500 capitalize">{k}:</span>
                          <span className="text-slate-900 font-semibold">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center rounded-2xl bg-white border border-slate-200 text-slate-500 text-xs shadow-xs">
                No summary generated yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
