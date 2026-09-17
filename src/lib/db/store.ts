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
      assignedAgentId: "agent_GaiYMgB9Bj9kaKW1tUgqSQ",
      assignedAgentName: "ABC Support (Active)",
      status: "Active",
      createdAt: new Date().toISOString(),
      isDemo: false,
    },
    {
      id: "num_1",
      e164Number: "+91 80 4735 9182",
      provider: "Vobiz",
      assignedAgentId: "agent_GaiYMgB9Bj9kaKW1tUgqSQ",
      assignedAgentName: "ABC Support (Active)",
      status: "Active",
      createdAt: "2026-09-10T10:00:00Z",
      isDemo: true,
    },
    {
      id: "num_2",
      e164Number: "+91 40 6829 4410",
      provider: "Vobiz",
      assignedAgentId: "agent_GaiYMgB9Bj9kaKW1tUgqSQ",
      assignedAgentName: "ABC Support (Active)",
      status: "Active",
      createdAt: "2026-09-12T14:30:00Z",
      isDemo: true,
    },
  ];

  private agents: AgentItem[] = [
    {
      id: "agent_minb6qwKNfwWXLV8gyRfRq",
      name: "College Attendance Notification (COMPLAINT)",
      description: "College Faculty attendance notification voice agent communicating with parents in polite natural Telugu.",
      language: AgentLanguage.TELUGU,
      status: AgentStatus.ACTIVE,
      systemPrompt: `# పాత్ర (Role)\n\nనువ్వు College లో పనిచేసే ఒక కాలేజ్ లెక్చరర్ / ఫ్యాకల్టీ మెంబర్‌గా విద్యార్థి తల్లిదండ్రులకు ఫోన్ చేసే AI Voice Agent.\n\nనీ ప్రధాన ఉద్దేశ్యం విద్యార్థి attendance తక్కువగా ఉందని తల్లిదండ్రులకు మర్యాదగా తెలియజేయడం.\n\nGreeting: “హలో అండి, నేను Naresh గారి పేరెంట్స్‌తో మాట్లాడుతున్నానా?”`,
      businessContext: "College of Engineering — Department of Computer Science & Engineering.",
      cartesiaVoiceId: "89907713-42ce-4ddd-8ff5-301211c564c1",
      cartesiaAgentId: "agent_minb6qwKNfwWXLV8gyRfRq",
      cartesiaVoiceName: "Telugu Female Faculty Voice",
      cartesiaModel: "sonic-3.6",
      llmModel: "gemini-2.5-flash",
      sarvamModel: "saaras:v3-realtime",
      sarvamLanguage: "te-IN",
      phoneNumber: "+91 80 7158 2667",
      callsCount: 0,
      totalMinutes: 0,
      estimatedCost: 0,
      lastActive: "Active & Deployed",
      createdAt: new Date().toISOString(),
      tools: [
        { name: "end_call", description: "End call politely when conversation concludes", isEnabled: true },
        { name: "transfer_call", description: "Transfer to department head (+916305367443)", isEnabled: true },
      ],
      businessProfile: {
        businessName: "College of Engineering",
        description: "Premier engineering college and academic institution.",
        productsServices: "Computer Science & Engineering, Academic Programs, Attendance Management",
        workingHours: "Monday to Friday 9:00 AM - 5:00 PM IST",
        location: "College Campus, Department of CSE",
        contactInfo: "+91 80 7158 2667",
        faqs: [
          { question: "Required attendance ఎంత?", answer: "కాలేజ్ attendance requirement 75 శాతం సార్." },
        ],
        toneGuidelines: "Polite, caring, respectful, natural spoken Telugu.",
        trainingExamples: [],
      },
      initialMessage: "“హలో అండి, నేను Naresh గారి పేరెంట్స్‌తో మాట్లాడుతున్నానా?”",
      lastSyncedAt: new Date().toISOString(),
      lastSyncStatus: "SYNCED",
      isDemo: false,
    },
    {
      id: "agent_GaiYMgB9Bj9kaKW1tUgqSQ",
      name: "ABC Support (Active)",
      description: "Published native Cartesia conversational voice agent powered by Gemini 2.5 Flash and cloned Telugu voice. End-to-end voice intelligence.",
      language: AgentLanguage.TELUGU_ENGLISH,
      status: AgentStatus.ACTIVE,
      systemPrompt: `Your name is Aadarsh (ఆదర్శ్). You are a professional, friendly AI voice assistant for ABC Electronics.\nSpeak in natural Tenglish (Telugu + English mix). Keep responses to 1-2 sentences. Ask one question at a time.\nGreeting: "హలో అండి! నేను Aadarsh మాట్లాడుతున్నాను, ABC Electronics నుంచి call చేస్తున్నాను. మీకు ఎలా సహాయం చేయగలను?"`,
      businessContext: "ABC Electronics — Retail and home appliances customer service.",
      cartesiaVoiceId: "f9945b75-0f3b-448d-ba9e-3d22c229a68e",
      cartesiaAgentId: "agent_GaiYMgB9Bj9kaKW1tUgqSQ",
      cartesiaVoiceName: "AD (Cloned Telugu Voice)",
      cartesiaModel: "sonic-3.6",
      llmModel: "gemini-2.5-flash",
      sarvamModel: "saaras:v3-realtime",
      sarvamLanguage: "te-IN",
      phoneNumber: "+91 80 7158 2667",
      callsCount: 14,
      totalMinutes: 32,
      estimatedCost: 73.6,
      lastActive: "Active & Deployed",
      createdAt: new Date().toISOString(),
      tools: [
        { name: "end_call", description: "End call politely when caller hangs up", isEnabled: true },
        { name: "transfer_call", description: "Transfer call to human executive", isEnabled: true },
        { name: "capture_customer_details", description: "Save caller name and requirements", isEnabled: true },
      ],
      businessProfile: {
        businessName: "ABC Electronics",
        description: "Retail and home appliances customer service.",
        productsServices: "Consumer electronics, home appliances, customer support",
        workingHours: "Monday to Saturday 9:00 AM - 7:00 PM IST",
        location: "Hitec City, Hyderabad",
        contactInfo: "+91 80 7158 2667",
        faqs: [
          { question: "మీ refund policy ఏంటి?", answer: "డెలివరీ అయిన 7 రోజులలోపు రీఫండ్ అభ్యర్థించవచ్చు అండి." },
          { question: "మీరు ఎక్కడ ఉన్నారు?", answer: "మా ABC Electronics షోరూమ్ హైదరాబాద్ హైటెక్ సిటీ లో ఉంది అండి." },
        ],
        toneGuidelines: "Warm, professional, crisp Telugu and Tenglish.",
        trainingExamples: [],
      },
      initialMessage: "హలో అండి! నేను Aadarsh మాట్లాడుతున్నాను, ABC Electronics నుంచి call చేస్తున్నాను. మీకు ఎలా సహాయం చేయగలను?",
      lastSyncedAt: new Date().toISOString(),
      lastSyncStatus: "SYNCED",
      isDemo: false,
    },
  ];

  private calls: CallItem[] = [
    {
      id: "call_10284",
      callNumber: "#10284",
      callerNumber: "+91 98490 12345",
      agentId: "agent_telugu_sales",
      agentName: "Telugu Sales Agent",
      direction: CallDirection.INBOUND,
      status: CallStatus.COMPLETED,
      startedAt: "2026-09-16T09:45:12Z",
      endedAt: "2026-09-16T09:47:46Z",
      durationSeconds: 154,
      language: "Telugu + English",
      estimatedCost: 5.82,
      currency: "INR",
      summary: {
        summary: "కస్టమర్ AI వాయిస్ ఏజెంట్ సేవల ధరలు మరియు డెమో గురించి విచారించారు. హైదరాబాద్ ఆఫీస్ వివరాలు అడిగారు.",
        customerIntent: "ధరల వివరాలు & డెమో అభ్యర్థన",
        outcome: "రేపు మధ్యాహ్నం 3:00 PM కి కాల్ బ్యాక్ కోరారు.",
        importantInfo: "కస్టమర్ పేరు శ్రీకాంత్ రెడ్డి. రియల్ ఎస్టేట్ బిజినెస్ కోసం నెలకు 5,000 కాల్స్ అవసరం.",
        followUpRequired: true,
        followUpDetails: "రేపు మధ్యాహ్నం 3:00 PM కి సేల్స్ ఎగ్జిక్యూటివ్ కాల్ చేసి డెమో అందించాలి.",
        capturedDetails: {
          callerName: "శ్రీకాంత్ రెడ్డి",
          businessType: "Real Estate Agency",
          expectedVolume: "5,000 calls / month",
          preferredCallback: "రేపు మధ్యాహ్నం 3:00 PM",
        },
      },
      transcripts: [
        {
          id: "t_1",
          role: MessageRole.AI,
          content: "నమస్కారం అండి! QETADOTIN కి స్వాగతం. నేను మీకు ఏ విధంగా సహాయపడగలను?",
          normalizedText: "నమస్కారం అండి! QETADOTIN కి స్వాగతం. నేను మీకు ఏ విధంగా సహాయపడగలను?",
          timestampMs: 1200,
          ttsLatencyMs: 110,
        },
        {
          id: "t_2",
          role: MessageRole.CALLER,
          content: "మీ AI కాలింగ్ సర్వీసెస్ గురించి తెలుసుకోవాలని కాల్ చేశానండి.",
          timestampMs: 3800,
          sttLatencyMs: 240,
        },
        {
          id: "t_3",
          role: MessageRole.AI,
          content: "తప్పకుండా అండి! మేము తెలుగు మరియు టెంగ్లీష్‌లో సహజంగా మాట్లాడే వాయిస్ ఏజెంట్లను అందిస్తున్నాము. మీ బిజినెస్ ఏమిటో తెలుసుకోవచ్చా?",
          normalizedText: "తప్పకుండా అండి! మేము తెలుగు మరియు టెంగ్లీష్‌లో సహజంగా మాట్లాడే వాయిస్ ఏజెంట్లను అందిస్తున్నాము. మీ బిజినెస్ ఏమిటో తెలుసుకోవచ్చా?",
          timestampMs: 5100,
          llmLatencyMs: 310,
          ttsLatencyMs: 115,
        },
        {
          id: "t_4",
          role: MessageRole.CALLER,
          content: "మాది హైదరాబాద్ లో రియల్ ఎస్టేట్ కన్సల్టెన్సీ. లీడ్స్ కి కాల్ చేయడానికి కావాలి. నెలకు ఫీజు ఎంత ఉంటుంది?",
          timestampMs: 11200,
          sttLatencyMs: 260,
        },
        {
          id: "t_5",
          role: MessageRole.AI,
          content: "మా స్టార్టర్ ప్లాన్ నెలకు ₹15,000 మాత్రమే అండి. ఇందులో 2,000 కాలింగ్ మినిట్స్ మరియు మీ సొంత క్లోన్డ్ వాయిస్ సెటప్ లభిస్తుంది.",
          normalizedText: "మా స్టార్టర్ ప్లాన్ నెలకు పదిహేను వేల రూపాయలు మాత్రమే అండి. ఇందులో రెండు వేల కాలింగ్ మినిట్స్ మరియు మీ సొంత క్లోన్డ్ వాయిస్ సెటప్ లభిస్తుంది.",
          timestampMs: 13500,
          llmLatencyMs: 330,
          ttsLatencyMs: 120,
        },
        {
          id: "t_6",
          role: MessageRole.CALLER,
          content: "చాలా బాగుంది. రేపు 3:00 PM కి డెమో ఇవ్వగలరా?",
          timestampMs: 21000,
          sttLatencyMs: 230,
        },
        {
          id: "t_7",
          role: MessageRole.AI,
          content: "తప్పకుండా శ్రీకాంత్ గారు! రేపు మధ్యాహ్నం 3:00 PM కి మా సేల్స్ టీమ్ మీకు కాల్ చేసి లైవ్ డెమో చూపిస్తారు. థాంక్యూ!",
          normalizedText: "తప్పకుండా శ్రీకాంత్ గారు! రేపు మధ్యాహ్నం మూడు గంటలకు మా సేల్స్ టీమ్ మీకు కాల్ చేసి లైవ్ డెమో చూపిస్తారు. థాంక్యూ!",
          timestampMs: 23200,
          llmLatencyMs: 290,
          ttsLatencyMs: 110,
        },
      ],
      usage: {
        sttAudioSeconds: 42,
        llmInputTokens: 820,
        llmOutputTokens: 290,
        ttsCharacters: 360,
        vobizCost: 1.95,
        sarvamCost: 0.336,
        openaiCost: 0.024,
        cartesiaCost: 0.023,
        infraCost: 0.45,
      },
      isDemo: true,
    },
    {
      id: "call_10283",
      callNumber: "#10283",
      callerNumber: "+91 97012 34567",
      agentId: "agent_tenglish_support",
      agentName: "Customer Support Agent (Tenglish)",
      direction: CallDirection.INBOUND,
      status: CallStatus.COMPLETED,
      startedAt: "2026-09-16T08:12:00Z",
      endedAt: "2026-09-16T08:14:15Z",
      durationSeconds: 135,
      language: "Telugu + English",
      estimatedCost: 4.65,
      currency: "INR",
      summary: {
        summary: "కస్టమర్ అకౌంట్ లాగిన్ లో OTP రావడం లేదని సమస్య చెప్పారు. సపోర్ట్ ఏజెంట్ సమస్యను పరిష్కరించారు.",
        customerIntent: "టెక్నికల్ సపోర్ట్ (OTP)",
        outcome: "సమస్య పరిష్కరించబడింది.",
        importantInfo: "SMS గేట్‌వే డిలే కారణం. 2 నిమిషాల్లో OTP అందింది.",
        followUpRequired: false,
      },
      transcripts: [
        {
          id: "t_101",
          role: MessageRole.AI,
          content: "హలో అండి, QETADOTIN సపోర్ట్ కి కాల్ చేసినందుకు ధన్యవాదాలు. మీకు ఎలా సహాయపడాలి?",
          normalizedText: "హలో అండి, QETADOTIN సపోర్ట్ కి కాల్ చేసినందుకు ధన్యవాదాలు. మీకు ఎలా సహాయపడాలి?",
          timestampMs: 1000,
          ttsLatencyMs: 105,
        },
        {
          id: "t_102",
          role: MessageRole.CALLER,
          content: "నాకు లాగిన్ చేయడానికి OTP రావడం లేదండి.",
          timestampMs: 3200,
          sttLatencyMs: 210,
        },
        {
          id: "t_103",
          role: MessageRole.AI,
          content: "దయచేసి 30 సెకన్లు ఆగండి అండి, సిస్టమ్ లో రీసెంట్ గా నెట్‌వర్క్ రద్దీ ఉంది. మళ్ళీ రిసెండ్ OTP నొక్కండి.",
          normalizedText: "దయచేసి ముప్పై సెకన్లు ఆగండి అండి, సిస్టమ్ లో రీసెంట్ గా నెట్‌వర్క్ రద్దీ ఉంది. మళ్ళీ రిసెండ్ ఓ టీ పీ నొక్కండి.",
          timestampMs: 4800,
          llmLatencyMs: 280,
          ttsLatencyMs: 110,
        },
      ],
      usage: {
        sttAudioSeconds: 35,
        llmInputTokens: 640,
        llmOutputTokens: 180,
        ttsCharacters: 210,
        vobizCost: 1.95,
        sarvamCost: 0.28,
        openaiCost: 0.016,
        cartesiaCost: 0.014,
        infraCost: 0.45,
      },
      isDemo: true,
    },
  ];

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
    return this.agents;
  }

  getAgent(id: string): AgentItem | undefined {
    if (!id) return undefined;
    const cleanId = id.trim();
    return this.agents.find((a) => a.id === cleanId || a.cartesiaAgentId === cleanId);
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
    const existing = this.agents.find((a) => a.id === agent.id);
    if (existing) {
      return Object.assign(existing, agent);
    }
    this.agents.unshift(agent);
    return agent;
  }

  updateAgent(id: string, updates: Partial<AgentItem>): AgentItem {
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
    this.agents = this.agents.filter((a) => a.id !== id);
    return true;
  }

  clearAllAgents(): void {
    this.agents = [];
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
