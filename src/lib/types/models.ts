// Pure TypeScript Enums and Types decoupled from @prisma/client for browser/client safety

export enum Role {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  MEMBER = "MEMBER",
}

export enum IntegrationProvider {
  VOBIZ = "VOBIZ",
  SARVAM = "SARVAM",
  OPENAI = "OPENAI",
  CARTESIA = "CARTESIA",
  POSTGRESQL = "POSTGRESQL",
}

export enum IntegrationStatus {
  CONNECTED = "CONNECTED",
  NOT_CONNECTED = "NOT_CONNECTED",
  ERROR = "ERROR",
}

export enum AgentLanguage {
  TELUGU = "TELUGU",
  TELUGU_ENGLISH = "TELUGU_ENGLISH",
  ENGLISH = "ENGLISH",
}

export enum AgentStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  DRAFT = "DRAFT",
  ARCHIVED = "ARCHIVED",
}

export enum CallDirection {
  INBOUND = "INBOUND",
  OUTBOUND = "OUTBOUND",
}

export enum CallStatus {
  INITIALIZING = "INITIALIZING",
  CONNECTING = "CONNECTING",
  ACTIVE = "ACTIVE",
  LISTENING = "LISTENING",
  THINKING = "THINKING",
  SPEAKING = "SPEAKING",
  INTERRUPTED = "INTERRUPTED",
  ENDING = "ENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export enum MessageRole {
  CALLER = "CALLER",
  AI = "AI",
  SYSTEM = "SYSTEM",
  USER = "USER",
  ASSISTANT = "ASSISTANT",
  TOOL = "TOOL",
}
