import {
  AgentLanguage,
  AgentStatus,
  CallDirection,
  CallStatus,
  IntegrationProvider,
  IntegrationStatus,
  MessageRole,
} from "@/lib/types/models";

export interface IntegrationItem {
  id: string;
  provider: IntegrationProvider;
  name: string;
  category: string;
  description: string;
  status: IntegrationStatus;
  apiKeyMasked?: string;
  secretMasked?: string;
  config?: Record<string, unknown>;
  lastCheckedAt?: string;
  errorMessage?: string;
}

export interface AgentItem {
  id: string;
  name: string;
  description: string;
  language: AgentLanguage;
  status: AgentStatus;
  systemPrompt: string;
  instructions?: string;
  businessContext?: string;
  cartesiaVoiceId: string;
  cartesiaVoiceName: string;
  cartesiaModel: string;
  llmModel: string;
  sarvamModel: string;
  sarvamLanguage: string;
  phoneNumber?: string;
  callsCount: number;
  totalMinutes: number;
  estimatedCost: number;
  lastActive: string;
  createdAt: string;
  tools: { name: string; description: string; isEnabled: boolean }[];
  cartesiaAgentId?: string; // Cartesia Conversational Agent ID (agent_xxx) — uses native Cartesia pipeline
  hasBackgroundSound?: boolean;
  backgroundSoundFileId?: string;
  backgroundSoundVolume?: number;
  backgroundSoundName?: string;
  businessProfile?: {
    businessName: string;
    description: string;
    productsServices: string;
    workingHours: string;
    location: string;
    contactInfo: string;
    faqs: { question: string; answer: string }[];
    policies?: {
      refundPolicy?: string;
      cancellationPolicy?: string;
      deliveryPolicy?: string;
      warrantyPolicy?: string;
    };
    trainingExamples?: { question: string; replay: string }[];
    toneGuidelines?: string;
  };
  initialMessage?: string;
  cartesiaVersionId?: string;
  lastSyncedAt?: string;
  lastSyncStatus?: "SYNCED" | "SYNC_REQUIRED" | "SYNC_FAILED" | "SYNCING";
  lastSyncError?: string;
  isDemo?: boolean;
}

export interface CallItem {
  id: string;
  callNumber: string;
  callerNumber: string;
  agentId: string;
  agentName: string;
  direction: CallDirection;
  status: CallStatus;
  startedAt: string;
  endedAt?: string;
  durationSeconds: number;
  language: string;
  estimatedCost: number;
  currency: string;
  summary?: {
    summary: string;
    customerIntent: string;
    outcome: string;
    importantInfo: string;
    followUpRequired: boolean;
    followUpDetails?: string;
    capturedDetails?: Record<string, string>;
  };
  transcripts: {
    id: string;
    role: MessageRole;
    content: string;
    normalizedText?: string;
    timestampMs: number;
    sttLatencyMs?: number;
    llmLatencyMs?: number;
    ttsLatencyMs?: number;
    wasInterrupted?: boolean;
  }[];
  usage?: {
    sttAudioSeconds: number;
    llmInputTokens: number;
    llmOutputTokens: number;
    ttsCharacters: number;
    vobizCost: number;
    sarvamCost: number;
    openaiCost: number;
    cartesiaCost: number;
    infraCost: number;
  };
  isDemo?: boolean;
  // Lifecycle & Diagnostic fields
  stage?: string;
  vobizCallId?: string;
  cartesiaAgentId?: string;
  hangupCause?: string;
  hangupSource?: string;
  terminationReason?: string;
  lastSuccessfulStage?: string;
  mediaConnected?: boolean;
  cartesiaConnected?: boolean;
  greetingStarted?: boolean;
  greetingCompleted?: boolean;
  audioFramesReceived?: number;
  campaignId?: string;
  leadId?: string;
  workspaceId?: string;
  cartesiaVoiceId?: string;
  dynamicVariables?: Record<string, string>;
  audioFramesSent?: number;
  bytesReceived?: number;
  bytesSent?: number;
  firstAudioTimestamp?: string;
  lastAudioTimestamp?: string;
}

export interface PhoneNumberItem {
  id: string;
  e164Number: string;
  provider: string;
  assignedAgentId?: string;
  assignedAgentName?: string;
  status: "Active" | "Inactive" | "Pending";
  createdAt: string;
  isDemo?: boolean;
}

// In-Memory store for MVP session management & local state
class DataStore {
  private integrations: IntegrationItem[] = [
    {
      id: "int_cartesia",
      provider: IntegrationProvider.CARTESIA,
      name: "Cartesia",
      category: "Text-to-Speech",
      description: "Ultra-low latency speech synthesis using your custom cloned Telugu voice.",
      status: IntegrationStatus.CONNECTED,
      config: {
        voiceName: "AD",
        voiceLanguage: "te",
        model: "sonic-3.6",
      },
      lastCheckedAt: new Date().toISOString(),
    },
    {
      id: "int_sarvam",
      provider: IntegrationProvider.SARVAM,
      name: "Sarvam AI",
      category: "Speech-to-Text",
      description: "Saaras Realtime streaming STT optimized for Indian languages, Telugu & Tenglish.",
      status: IntegrationStatus.CONNECTED,
      config: {
        languageCode: "te-IN",
        model: "saaras:v3-realtime",
      },
      lastCheckedAt: new Date().toISOString(),
    },
    {
      id: "int_openai",
      provider: IntegrationProvider.OPENAI,
      name: "Groq (Ultra-Low Latency LLM)",
      category: "Intelligence & Reasoning",
      description: "High-speed conversational LLM execution for natural Telugu turns (llama-3.3-70b-versatile).",
      status: IntegrationStatus.CONNECTED,
      config: {
        model: "llama-3.3-70b-versatile",
        temperature: 0.3,
      },
      lastCheckedAt: new Date().toISOString(),
    },
    {
      id: "int_vobiz",
      provider: IntegrationProvider.VOBIZ,
      name: "Vobiz Telephony",
      category: "Telephony & SIP Trunk",
      description: "Carrier telephony, Indian phone numbers, and bidirectional audio streaming.",
      status: IntegrationStatus.CONNECTED,
      config: {
        outboundNumber: "+91 80 7158 2667",
        audioFormat: "audio/x-l16",
        sampleRate: 16000,
      },
      lastCheckedAt: new Date().toISOString(),
    },
    {
      id: "int_postgres",
      provider: IntegrationProvider.POSTGRESQL,
      name: "PostgreSQL Database (Neon)",
      category: "Database & Storage",
      description: "Relational persistence for multi-tenant organizations, calls, and transcripts.",
      status: IntegrationStatus.CONNECTED,
      config: {
        host: "ep-lingering-fog-a5dgsn4s-pooler.us-east-2.aws.neon.tech",
        database: "neondb",
        schema: "public (Tables Synced)",
      },
      lastCheckedAt: new Date().toISOString(),
    },
  ];

  private phoneNumbers: PhoneNumberItem[] = [
    {
      id: "num_vobiz_live",
      e164Number: "+91 80 7158 2667",
      provider: "Vobiz",
      assignedAgentId: "agent_vDCfnuFdJokXJDVxgmHeZx",
      assignedAgentName: "College Attendance Notification (Active)",
      status: "Active",
      createdAt: new Date().toISOString(),
      isDemo: false,
    },
    {
      id: "num_1",
      e164Number: "+91 80 4735 9182",
      provider: "Vobiz",
      assignedAgentId: "agent_vDCfnuFdJokXJDVxgmHeZx",
      assignedAgentName: "College Attendance Notification (Active)",
      status: "Active",
      createdAt: "2026-09-10T10:00:00Z",
      isDemo: true,
    },
    {
      id: "num_2",
      e164Number: "+91 40 6829 4410",
      provider: "Vobiz",
      assignedAgentId: "agent_vDCfnuFdJokXJDVxgmHeZx",
      assignedAgentName: "College Attendance Notification (Active)",
      status: "Active",
      createdAt: "2026-09-12T14:30:00Z",
      isDemo: true,
    },
  ];

  private deletedAgentIds: Set<string> = new Set();
  private agents: AgentItem[] = [];

  private calls: CallItem[] = [];

  // Integration queries and mutations
  getIntegrations(): IntegrationItem[] {
    return this.integrations;
  }

  getIntegration(provider: IntegrationProvider): IntegrationItem | undefined {
    return this.integrations.find((i) => i.provider === provider);
  }

  updateIntegration(
    provider: IntegrationProvider,
    updates: Partial<IntegrationItem>
  ): IntegrationItem {
    const idx = this.integrations.findIndex((i) => i.provider === provider);
    if (idx !== -1) {
      this.integrations[idx] = {
        ...this.integrations[idx],
        ...updates,
        lastCheckedAt: new Date().toISOString(),
      };
      return this.integrations[idx];
    }
    throw new Error(`Integration ${provider} not found`);
  }

  // Agents
  getAgents(): AgentItem[] {
    return this.agents.filter(
      (a) => !this.deletedAgentIds.has(a.id) && (!a.cartesiaAgentId || !this.deletedAgentIds.has(a.cartesiaAgentId))
    );
  }

  setAgents(agents: AgentItem[]): void {
    this.agents = agents.filter(
      (a) => !this.deletedAgentIds.has(a.id) && (!a.cartesiaAgentId || !this.deletedAgentIds.has(a.cartesiaAgentId))
    );
  }

  getAgent(id: string): AgentItem | undefined {
    if (!id) return undefined;
    const cleanId = id.trim();
    if (this.deletedAgentIds.has(cleanId)) return undefined;
    return this.agents.find(
      (a) =>
        (a.id === cleanId || a.cartesiaAgentId === cleanId) &&
        !this.deletedAgentIds.has(a.id) &&
        (!a.cartesiaAgentId || !this.deletedAgentIds.has(a.cartesiaAgentId))
    );
  }

  createAgent(agent: Omit<AgentItem, "id" | "callsCount" | "totalMinutes" | "estimatedCost" | "lastActive" | "createdAt">): AgentItem {
    const newAgent: AgentItem = {
      ...agent,
      id: `agent_${Date.now()}`,
      callsCount: 0,
      totalMinutes: 0,
      estimatedCost: 0,
      lastActive: "Just now",
      createdAt: new Date().toISOString(),
      isDemo: false,
    };
    this.agents.unshift(newAgent);
    return newAgent;
  }

  createAgentWithId(agent: AgentItem): AgentItem {
    // If agent was explicitly deleted, permanently reject recreation/resurrection
    if (
      this.deletedAgentIds.has(agent.id) ||
      (agent.cartesiaAgentId && this.deletedAgentIds.has(agent.cartesiaAgentId))
    ) {
      console.log(`[DATASTORE_RESURRECTION_BLOCKED] Agent "${agent.id}" was explicitly deleted. Ignored.`);
      return agent;
    }

    const existing = this.agents.find((a) => a.id === agent.id);
    if (existing) {
      return Object.assign(existing, agent);
    }
    this.agents.unshift(agent);
    return agent;
  }

  updateAgent(id: string, updates: Partial<AgentItem>): AgentItem {
    if (this.deletedAgentIds.has(id)) {
      return {} as any;
    }
    const idx = this.agents.findIndex((a) => a.id === id);
    if (idx !== -1) {
      this.agents[idx] = { ...this.agents[idx], ...updates };
      return this.agents[idx];
    }
    // Resilient upsert: if agent was created in DB, don't crash
    const newAgent: AgentItem = {
      id,
      name: updates.name || "Telugu AI Agent",
      description: updates.description || "",
      language: updates.language || AgentLanguage.TELUGU_ENGLISH,
      status: updates.status || AgentStatus.ACTIVE,
      systemPrompt: updates.systemPrompt || "",
      businessContext: updates.businessContext || "",
      cartesiaVoiceId: updates.cartesiaVoiceId || "ff480e6e-3e79-4307-9889-d1d9feb8e20e",
      cartesiaVoiceName: updates.cartesiaVoiceName || "AD (Cloned Telugu Voice)",
      cartesiaModel: updates.cartesiaModel || "sonic-3.6",
      llmModel: updates.llmModel || "openai/gpt-oss-120b",
      sarvamModel: updates.sarvamModel || "saaras:v3-realtime",
      sarvamLanguage: updates.sarvamLanguage || "te-IN",
      phoneNumber: updates.phoneNumber || "+91 80 7158 2667",
      callsCount: 0,
      totalMinutes: 0,
      estimatedCost: 0,
      lastActive: "Just now",
      createdAt: new Date().toISOString(),
      tools: updates.tools || [
        { name: "end_call", description: "End call politely", isEnabled: true },
        { name: "transfer_call", description: "Transfer call to human manager", isEnabled: true },
        { name: "capture_customer_details", description: "Save caller details", isEnabled: true },
      ],
      businessProfile: updates.businessProfile,
      ...updates,
    };
    this.agents.unshift(newAgent);
    return newAgent;
  }

  deleteAgent(id: string): boolean {
    const target = this.agents.find((a) => a.id === id || a.cartesiaAgentId === id);
    this.deletedAgentIds.add(id);
    if (target?.id) this.deletedAgentIds.add(target.id);
    if (target?.cartesiaAgentId) this.deletedAgentIds.add(target.cartesiaAgentId);
    this.agents = this.agents.filter((a) => a.id !== id && a.cartesiaAgentId !== id);

    // Unassign any phone numbers pointing to this deleted agent
    this.phoneNumbers.forEach((p) => {
      if (p.assignedAgentId === id || (target?.cartesiaAgentId && p.assignedAgentId === target.cartesiaAgentId)) {
        p.assignedAgentId = undefined;
        p.assignedAgentName = undefined;
      }
    });

    return true;
  }

  markAgentDeleted(id: string): void {
    this.deletedAgentIds.add(id);
    this.agents = this.agents.filter((a) => a.id !== id && a.cartesiaAgentId !== id);
    this.phoneNumbers.forEach((p) => {
      if (p.assignedAgentId === id) {
        p.assignedAgentId = undefined;
        p.assignedAgentName = undefined;
      }
    });
  }

  isAgentDeleted(id: string): boolean {
    return this.deletedAgentIds.has(id);
  }

  clearAllAgents(): void {
    for (const a of this.agents) {
      this.deletedAgentIds.add(a.id);
      if (a.cartesiaAgentId) this.deletedAgentIds.add(a.cartesiaAgentId);
    }
    this.agents = [];
    this.phoneNumbers.forEach((p) => {
      p.assignedAgentId = undefined;
      p.assignedAgentName = undefined;
    });
  }

  // Calls
  getCalls(): CallItem[] {
    return this.calls;
  }

  getCall(id: string): CallItem | undefined {
    return this.calls.find((c) => c.id === id || c.callNumber === id);
  }

  addCall(call: CallItem): void {
    this.calls.unshift(call);
  }

  updateCall(id: string, updates: Partial<CallItem>): CallItem | undefined {
    const idx = this.calls.findIndex((c) => c.id === id || c.vobizCallId === id || c.callNumber === id);
    if (idx !== -1) {
      this.calls[idx] = { ...this.calls[idx], ...updates };
      return this.calls[idx];
    }
    return undefined;
  }

  findCallByProviderId(vobizCallId: string): CallItem | undefined {
    return this.calls.find((c) => c.vobizCallId === vobizCallId);
  }

  // Phone Numbers
  getPhoneNumbers(): PhoneNumberItem[] {
    return this.phoneNumbers;
  }

  addPhoneNumber(number: PhoneNumberItem): void {
    this.phoneNumbers.unshift(number);
  }

  updatePhoneNumber(id: string, updates: Partial<PhoneNumberItem>): PhoneNumberItem | undefined {
    const idx = this.phoneNumbers.findIndex((p) => p.id === id || p.e164Number === id);
    if (idx !== -1) {
      this.phoneNumbers[idx] = { ...this.phoneNumbers[idx], ...updates };
      return this.phoneNumbers[idx];
    }
    return undefined;
  }

  deletePhoneNumber(id: string): boolean {
    const prevLen = this.phoneNumbers.length;
    this.phoneNumbers = this.phoneNumbers.filter((p) => p.id !== id && p.e164Number !== id);
    return this.phoneNumbers.length < prevLen;
  }
}

export const dataStore = new DataStore();
