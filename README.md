# QETADOTIN — Autonomous AI Voice Intelligence & Telephony SaaS

> **"Conversations that move business forward."**  
> Autonomous AI voice agents that call, answer, qualify, book, and support — with sub-150ms latency, native Cartesia voice runtime, and carrier-grade PSTN telephony.

---

## 🌟 Overview

**QETADOTIN** is an enterprise-grade AI voice calling SaaS platform designed for high-volume customer interactions across Telugu, Tenglish, and English. Built around a clean, minimal design system with soft ivory surfaces, deep emerald green accents, and editorial typography, QETADOTIN couples a high-performance control plane with native Cartesia realtime conversational voice intelligence.

### Key Capabilities

- **Sub-150ms Response Latency**: Near instantaneous conversational turn-taking with streaming WebSocket audio.
- **Native Cartesia Agent Runtime**: Full conversational pipeline with cloned neural voices (`Sonic-3.6`) and bidirectional interruption detection (barge-in).
- **Carrier-Grade Telephony**: Direct Vobiz SIP trunking with Indian DID numbers (`+91 80 7158 2667`) and automated call qualification.
- **Multilingual Excellence**: Native fluency in Telugu, Tenglish (Telugu + English blend), and English with automated phonetic normalization.
- **Unified SaaS Dashboard**: Live agent monitoring, interactive browser voice audition, call recordings, PSTN usage metrics, and webhook integrations.

---

## 🏗 Architecture Overview

```
[ Inbound / Outbound PSTN Caller ]
              │
              ▼ (Carrier Telephony Trunk)
      [ Vobiz SIP Trunk ]
              │
              ▼ (Bidirectional WebSocket Stream: audio/x-l16 @ 16kHz)
      [ QETADOTIN Control Plane ]
              ├── Inbound Telemetry & VAD Interruption Engine
              ├── Neon PostgreSQL Persistent Agent & Call Store
              ├── Sarvam AI Realtime STT (te-IN)
              └── Cartesia Native Realtime Agent (`agent_GaiYMgB9Bj9kaKW1tUgqSQ`)
              │
              ▼ (Synthesized Neural Audio Stream)
[ Caller Hears AI Agent in Natural Spoken Voice ]
```

---

## 🛠 Tech Stack

- **Frontend**: Next.js 16 (App Router, Turbopack, React 19, TypeScript)
- **Styling**: Vanilla CSS & Tailwind CSS tokens (`#FAFAF8` ivory, `#0A0D12` near-black, `#059669` emerald)
- **Backend Runtime**: Node.js + Custom WebSocket Telephony Gateway (`server.js`)
- **Voice Intelligence**: Cartesia Voice Agent API (`Sonic-3.6` Cloned Voice)
- **Speech-to-Text**: Sarvam AI (`saaras:v3-realtime`)
- **Database**: PostgreSQL (Prisma ORM & Neon Serverless)
- **Telephony Provider**: Vobiz SIP Trunking & Indian DID Routing

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database (or Neon serverless instance)
- Cartesia API key
- Vobiz Telephony credentials (optional for PSTN trunking)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Aadarsh-ar/qeta-voice-calling-agent.git
   cd qeta-voice-calling-agent
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   Fill in your API keys in `.env.local`.

4. **Initialize Database:**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Start Development Server:**
   ```bash
   npm run dev
   ```

6. **Start Custom Voice Gateway (Production):**
   ```bash
   node server.js
   ```

---

## 🧪 Verification & Testing

Run the automated test suites:

```bash
# Core REST APIs, external provider health checks & Cartesia TTS synthesis
node scratch/test_suite.mjs

# Comprehensive 7/7 End-to-End System Integration Test
node scratch/test_everything_e2e.js
```

---

## 📄 License

Proprietary — All Rights Reserved © 2026 QETADOTIN
