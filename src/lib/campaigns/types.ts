export type CampaignStatus = "DRAFT" | "RUNNING" | "PAUSED" | "COMPLETED" | "STOPPED";

export type ContactCallStatus =
  | "PENDING"
  | "QUEUED"
  | "DIALING"
  | "CONNECTED"
  | "NO_ANSWER"
  | "BUSY"
  | "FAILED"
  | "COMPLETED"
  | "RETRYING";

export type CallOutcome =
  | "Pending"
  | "Interested"
  | "Callback"
  | "Not Interested"
  | "No Answer"
  | "Busy"
  | "Failed"
  | "Completed";

export interface TranscriptEntry {
  id: string;
  role: "AI" | "CALLER" | "SYSTEM";
  content: string;
  timestampMs?: number;
  time?: string;
}

export interface CampaignContact {
  id: string;
  campaignId: string;
  name: string;
  phoneNumber: string; // Sanitized E.164 (e.g. +919876543210)
  rawPhoneNumber?: string;
  language: string;
  customData?: Record<string, any>;
  status: ContactCallStatus;
  callId?: string;
  vobizCallId?: string;
  durationSeconds: number;
  outcome: CallOutcome;
  retriesCount: number;
  maxRetries: number;
  nextRetryAt?: number; // Timestamp ms
  lastAttemptAt?: string;
  transcripts?: TranscriptEntry[];
  summary?: string;
  customerIntent?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignMetrics {
  total: number;
  completed: number;
  answered: number;
  noAnswer: number;
  busy: number;
  failed: number;
  interested: number;
  callbacks: number;
  inProgress: number;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  agentId: string;
  agentName?: string;
  agentVoice?: string;
  agentLanguage?: string;
  status: CampaignStatus;
  concurrency: number; // 1 to 10
  maxRetries: number; // 0 to 5
  retryDelaySeconds: number; // delay before retrying no-answer/busy
  callDelaySeconds: number; // spacing between initiating calls
  contacts: CampaignContact[];
  metrics: CampaignMetrics;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface ColumnMapping {
  nameColumn: string;
  phoneColumn: string;
  languageColumn?: string;
  customDataColumns: string[];
}

export interface ParsedContactPreview {
  index: number;
  name: string;
  rawPhone: string;
  cleanPhone: string;
  language: string;
  customData: Record<string, any>;
  isValid: boolean;
  validationError?: string;
  isDuplicate: boolean;
}
