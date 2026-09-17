import { NextResponse } from "next/server";
import { dataStore } from "@/lib/db/store";
import { cartesiaClient } from "@/lib/cartesia/client";
import { IntegrationProvider, IntegrationStatus } from "@/lib/types/models";

export async function GET() {
  const integrations = dataStore.getIntegrations();
  return NextResponse.json({ success: true, integrations });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { provider, apiKey, secret, config } = body;

    if (!provider) {
      return NextResponse.json(
        { success: false, error: "Provider is required." },
        { status: 400 }
      );
    }

    let status: IntegrationStatus = IntegrationStatus.CONNECTED;
    let errorMessage: string | undefined;

    // Validate provider credentials
    if (provider === "CARTESIA") {
      try {
        const testClient = new (await import("@/lib/cartesia/client")).CartesiaClient(apiKey);
        const voices = await testClient.listVoices();
        const cloned = voices.filter((v) => !v.is_public);
        status = IntegrationStatus.CONNECTED;
        dataStore.updateIntegration(IntegrationProvider.CARTESIA, {
          status,
          apiKeyMasked: apiKey ? `${apiKey.slice(0, 7)}••••••••${apiKey.slice(-4)}` : undefined,
          config: {
            ...config,
            clonedVoicesCount: cloned.length,
            discoveredVoices: cloned.map((v) => ({ id: v.id, name: v.name, language: v.language })),
          },
        });
      } catch (err: unknown) {
        status = IntegrationStatus.ERROR;
        errorMessage = err instanceof Error ? err.message : "Failed to connect to Cartesia";
      }
    } else if (provider === "OPENAI") {
      try {
        const testRes = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!testRes.ok) throw new Error("Invalid OpenAI API key");
        status = IntegrationStatus.CONNECTED;
        dataStore.updateIntegration(IntegrationProvider.OPENAI, {
          status,
          apiKeyMasked: apiKey ? `${apiKey.slice(0, 7)}••••••••${apiKey.slice(-4)}` : undefined,
          config: { ...config, model: "gpt-4o-mini" },
        });
      } catch (err: unknown) {
        status = IntegrationStatus.ERROR;
        errorMessage = err instanceof Error ? err.message : "Invalid OpenAI API key";
      }
    } else if (provider === "SARVAM") {
      // Validate Sarvam key format or test ping
      if (!apiKey || apiKey.length < 8) {
        status = IntegrationStatus.ERROR;
        errorMessage = "Invalid Sarvam API subscription key format.";
      } else {
        status = IntegrationStatus.CONNECTED;
        dataStore.updateIntegration(IntegrationProvider.SARVAM, {
          status,
          apiKeyMasked: `${apiKey.slice(0, 4)}••••••••${apiKey.slice(-4)}`,
          config: { ...config, languageCode: "te-IN", model: "saaras:v3-realtime" },
        });
      }
    } else if (provider === "VOBIZ") {
      if (!apiKey || !secret) {
        status = IntegrationStatus.ERROR;
        errorMessage = "Both Vobiz API Key and Secret are required.";
      } else {
        status = IntegrationStatus.CONNECTED;
        dataStore.updateIntegration(IntegrationProvider.VOBIZ, {
          status,
          apiKeyMasked: `${apiKey.slice(0, 4)}••••••••${apiKey.slice(-3)}`,
          secretMasked: "••••••••••••",
          config: { ...config, audioFormat: "audio/x-l16", sampleRate: 16000 },
        });
      }
    }

    const updated = dataStore.getIntegration(provider as IntegrationProvider);
    return NextResponse.json({
      success: status === IntegrationStatus.CONNECTED,
      integration: updated,
      error: errorMessage,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
