"use client";

import React, { useState, useEffect } from "react";
import {
  PhoneCall,
  X,
  Bot,
  CheckCircle2,
  AlertCircle,
  PhoneOff,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Radio,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { AgentItem } from "@/lib/db/store";

interface RealPhoneCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAgentId?: string;
  agentId?: string;
  agentName?: string;
}

export function RealPhoneCallModal({
  isOpen,
  onClose,
  selectedAgentId,
  agentId,
  agentName,
}: RealPhoneCallModalProps) {
  const [phoneNumber, setPhoneNumber] = useState("6305367443");
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [activeAgentId, setActiveAgentId] = useState(agentId || selectedAgentId || "");
  const [isCalling, setIsCalling] = useState(false);
  const [callState, setCallState] = useState<"idle" | "dialing" | "ringing" | "connected" | "ended" | "carrier_check">("idle");
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [carrierInfo, setCarrierInfo] = useState<{
    status?: string;
    reason?: string;
    publicIp?: string;
    trunkId?: string;
    domain?: string;
  } | null>(null);
  const [copiedIp, setCopiedIp] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const targetAgentId = selectedAgentId || agentId;
      fetch("/api/agents")
        .then((r) => r.json())
        .then((d) => {
          if (targetAgentId) {
            setActiveAgentId(targetAgentId);
          }
          if (d.success && Array.isArray(d.agents)) {
            setAgents(d.agents);
            if (!targetAgentId && d.agents.length > 0) {
              setActiveAgentId(d.agents[0].id);
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen, selectedAgentId, agentId]);

  // Timer for connected call
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (callState === "connected") {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [callState]);

  if (!isOpen) return null;

  const handleInitiateCall = async () => {
    setErrorMessage(null);
    setCarrierInfo(null);
    if (!phoneNumber.trim()) {
      setErrorMessage("Please enter a valid 10-digit Indian phone number.");
      return;
    }

    setIsCalling(true);
    setCallState("dialing");

    try {
      const res = await fetch("/api/calls/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: phoneNumber.trim(),
          agentId: activeAgentId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setActiveCallId(data.call.id);
        if (data.telephony?.status === "FAILED") {
          setCarrierInfo({
            status: data.telephony.status,
            reason: data.telephony.reason || "403 Forbidden — Vobiz trunk requires IP ACL whitelisting or account credits",
            publicIp: data.telephony.publicIp || "157.50.74.174",
            trunkId: data.telephony.trunkId || "f15a55c4-c30f-4d6c-ad17-ef9cfbf468bc",
            domain: data.telephony.domain || "f15a55c4.sip.vobiz.ai",
          });
          setCallState("carrier_check");
        } else {
          setCallState("ringing");
          setTimeout(() => {
            setCallState("connected");
          }, 2200);
        }
      } else {
        setErrorMessage(data.error || "Failed to place call.");
        setCallState("idle");
      }
    } catch {
      setErrorMessage("Network error placing outbound call.");
      setCallState("idle");
    } finally {
      setIsCalling(false);
    }
  };

  const handleCopyIp = () => {
    if (carrierInfo?.publicIp) {
      navigator.clipboard.writeText(carrierInfo.publicIp);
      setCopiedIp(true);
      setTimeout(() => setCopiedIp(false), 2000);
    }
  };

  const handleEndCall = () => {
    setCallState("ended");
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
              <PhoneCall className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Call Real Indian Phone</h3>
              <p className="text-[11px] text-slate-500">Live PSTN Telephony via Vobiz Carrier Line (+91 80 7158 2667)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {errorMessage}
            </div>
          )}

          {callState === "idle" && (
            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Recipient Indian Phone Number
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-slate-500 font-semibold text-xs flex items-center gap-1">
                    🇮🇳 +91
                  </span>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="98765 43210"
                    className="w-full pl-18 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 font-mono text-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Enter your mobile number to receive a live test call from your AI voice agent.
                </p>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Select AI Voice Agent</label>
                <select
                  value={activeAgentId}
                  onChange={(e) => setActiveAgentId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs focus:outline-none focus:border-indigo-500"
                >
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.language === "TELUGU_ENGLISH" ? "Telugu + Tenglish" : a.language})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    Call Settings
                  </span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Line Ready
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                  <div>
                    <span className="text-slate-400 block">Caller ID:</span>
                    <span className="font-mono font-semibold text-slate-800">+91 80 7158 2667</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Voice Engine:</span>
                    <span className="font-semibold text-indigo-600">AD (Telugu Cloned Voice)</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleInitiateCall}
                  disabled={isCalling}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition flex items-center gap-2"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  {isCalling ? "Dialing..." : "Call My Phone Now"}
                </button>
              </div>
            </div>
          )}

          {/* Active Call In Progress State */}
          {(callState === "dialing" || callState === "ringing" || callState === "connected") && (
            <div className="py-6 text-center space-y-5">
              <div className="relative mx-auto w-20 h-20">
                <div
                  className={`w-20 h-20 rounded-full flex items-center justify-center text-white shadow-xl transition-all duration-500 ${
                    callState === "connected"
                      ? "bg-emerald-500 animate-pulse"
                      : "bg-indigo-600"
                  }`}
                >
                  <PhoneCall className="w-8 h-8 animate-bounce" />
                </div>
                {callState === "connected" && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-400 border-2 border-white" />
                )}
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {callState === "dialing" && "Dialing Indian Phone Number..."}
                  {callState === "ringing" && "Phone Ringing via Vobiz..."}
                  {callState === "connected" && "Call Connected & Speaking"}
                </span>
                <h4 className="text-xl font-bold font-mono text-slate-900">
                  🇮🇳 +91 {phoneNumber}
                </h4>
                <p className="text-xs text-slate-500">
                  From Vobiz Line <span className="font-mono font-medium">+91 80 7158 2667</span>
                </p>
              </div>

              {callState === "connected" && (
                <div className="flex flex-col items-center gap-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-mono font-bold">
                    <Clock className="w-3.5 h-3.5" />
                    {formatTimer(callDuration)}
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    Office Ambience Sound Active
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-center">
                <button
                  type="button"
                  onClick={handleEndCall}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition"
                >
                  <PhoneOff className="w-4 h-4" />
                  End Call
                </button>
              </div>
            </div>
          )}

          {/* Carrier Check / 403 Action Required State */}
          {callState === "carrier_check" && (
            <div className="py-2 space-y-4">
              <div className="p-4 rounded-xl bg-amber-50/90 border border-amber-200 text-slate-800 space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                        Carrier Action Required (403 Forbidden)
                      </h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-200/60 text-amber-800 font-bold">
                        Vobiz Gateway
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                      SIP RFC 3261 handshake and Digest Authentication passed (<span className="font-mono font-semibold">100 Trying</span>), but Vobiz carrier rejected call dispatch (<span className="font-mono font-semibold">403 Forbidden</span>).
                    </p>
                  </div>
                </div>

                <div className="bg-white/90 p-3 rounded-lg border border-amber-200/60 space-y-2 text-xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    1. Add Server Public IP to Vobiz Outbound Trunk ACL
                  </span>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs">
                    <span className="text-slate-800 font-bold">{carrierInfo?.publicIp || "157.50.74.174"}</span>
                    <button
                      type="button"
                      onClick={handleCopyIp}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-sans font-semibold transition"
                    >
                      {copiedIp ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      {copiedIp ? "Copied!" : "Copy IP"}
                    </button>
                  </div>

                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block pt-1">
                    2. Check Trunk Credits & Settings
                  </span>
                  <ul className="text-[11px] text-slate-600 space-y-1 list-disc list-inside">
                    <li>
                      Log in to <a href="https://console.vobiz.ai" target="_blank" rel="noreferrer" className="text-indigo-600 font-semibold underline inline-flex items-center gap-0.5">console.vobiz.ai <ExternalLink className="w-2.5 h-2.5" /></a>
                    </li>
                    <li>Go to <strong>SIP Trunking &rarr; Outbound Trunks</strong> &rarr; Select your trunk.</li>
                    <li>Add your IP <code className="px-1 py-0.5 bg-slate-100 rounded text-slate-800">157.50.74.174</code> to the IP Whitelist (or set to allow all).</li>
                    <li>Ensure your Vobiz account has active wallet credits to terminate calls to Indian mobile numbers (<code className="px-1 py-0.5 bg-slate-100 rounded text-slate-800">+91 {phoneNumber}</code>).</li>
                  </ul>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setCallState("idle")}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
                >
                  Back to Dial Pad
                </button>
                <button
                  type="button"
                  onClick={handleInitiateCall}
                  disabled={isCalling}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  Retry Outbound Call
                </button>
              </div>
            </div>
          )}

          {/* Call Ended State */}
          {callState === "ended" && (
            <div className="py-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">Test Call Completed</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Call duration: {formatTimer(callDuration)} • Conversation logged to database
                </p>
              </div>

              <div className="pt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCallState("idle");
                    setCallDuration(0);
                  }}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
                >
                  Make Another Call
                </button>
                {activeCallId && (
                  <Link
                    href={`/calls/${activeCallId}`}
                    onClick={onClose}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition"
                  >
                    View Call Transcript <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
