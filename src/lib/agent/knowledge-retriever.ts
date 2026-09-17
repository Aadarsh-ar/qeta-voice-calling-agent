/**
 * Semantic & Intent-based Knowledge Retriever for Autonomous Voice Agents
 *
 * Scans:
 *  1. Business Profile (Name, Type, Description, Working Hours, Locations, Contact)
 *  2. Products, Services & Pricing Tiers
 *  3. Policies (Refund, Cancellation, Delivery, Warranty)
 *  4. FAQs & Structured Q&A pairs
 *  5. Custom Knowledge Documents / Chunks
 *
 * Strictly scoped per agent / organization to guarantee multi-tenant data isolation.
 */

export interface KnowledgeSnippet {
  source: string;
  category: "policy" | "faq" | "pricing" | "service" | "hours" | "location" | "general";
  title: string;
  content: string;
  score: number;
}

export interface AgentKnowledgeContext {
  businessName: string;
  businessType?: string;
  description?: string;
  productsServices?: string;
  workingHours?: string;
  location?: string;
  contactInfo?: string;
  pricing?: Array<{ planName: string; price: string; features: string }>;
  policies?: {
    refundPolicy?: string;
    cancellationPolicy?: string;
    deliveryPolicy?: string;
    warrantyPolicy?: string;
  };
  faqs?: Array<{ question: string; answer: string }>;
  documents?: Array<{ title: string; content: string; category?: string }>;
}

export class KnowledgeRetriever {
  /**
   * Retrieves the most relevant grounded knowledge chunks for a caller's utterance
   */
  retrieveRelevantKnowledge(
    utterance: string,
    knowledgeContext?: AgentKnowledgeContext,
    maxSnippets: number = 3
  ): { snippets: KnowledgeSnippet[]; isGroundedTopic: boolean } {
    if (!knowledgeContext || !utterance || utterance.trim().length === 0) {
      return { snippets: [], isGroundedTopic: false };
    }

    const trimmed = utterance.trim().toLowerCase();
    // Fast short-circuit on pure greetings and conversational acknowledgments (0ms overhead)
    const conversationalOnly = new Set([
      "hello", "hi", "hey", "hola", "namaste", "namaskaram",
      "హలో", "హాయ్", "నమస్కారం", "నమస్తే", "చెప్పండి",
      "ok", "okay", "yes", "yeah", "yep", "no", "nah", "sure", "fine",
      "thanks", "thank you", "ధన్యవాదాలు", "థాంక్స్",
      "సరే", "అవును", "లేదు", "హా", "వింటున్నాను",
    ]);

    if (conversationalOnly.has(trimmed) || (trimmed.split(/\s+/).length <= 2 && conversationalOnly.has(trimmed.split(/\s+/)[0]))) {
      return { snippets: [], isGroundedTopic: false };
    }

    const lowerQuery = utterance.toLowerCase();
    const queryTokens = this.tokenize(lowerQuery);
    const candidateSnippets: KnowledgeSnippet[] = [];

    // 1. Index Policies
    if (knowledgeContext.policies) {
      const { refundPolicy, cancellationPolicy, deliveryPolicy, warrantyPolicy } =
        knowledgeContext.policies;

      if (refundPolicy) {
        candidateSnippets.push({
          source: "Refund Policy",
          category: "policy",
          title: "రీఫండ్ విధానం (Refund Policy)",
          content: refundPolicy,
          score: this.calculateRelevance(queryTokens, [
            "refund",
            "return",
            "money back",
            "రీఫండ్",
            "రిటర్న్",
            "డబ్బులు",
            "వాపస్",
            "పాలసీ",
            "రద్దు",
          ]),
        });
      }

      if (cancellationPolicy) {
        candidateSnippets.push({
          source: "Cancellation Policy",
          category: "policy",
          title: "రద్దు విధానం (Cancellation Policy)",
          content: cancellationPolicy,
          score: this.calculateRelevance(queryTokens, [
            "cancel",
            "cancellation",
            "stop",
            "రద్దు",
            "కాన్సిల్",
            "ఆపివేయండి",
            "పాలసీ",
          ]),
        });
      }

      if (deliveryPolicy) {
        candidateSnippets.push({
          source: "Delivery Policy",
          category: "policy",
          title: "డెలివరీ సమయం & విధానం (Delivery Policy)",
          content: deliveryPolicy,
          score: this.calculateRelevance(queryTokens, [
            "delivery",
            "shipping",
            "reach",
            "arrive",
            "డెలివరీ",
            "చేరుతుంది",
            "షిప్పింగ్",
            "ఎప్పుడు",
            "రోజులు",
          ]),
        });
      }

      if (warrantyPolicy) {
        candidateSnippets.push({
          source: "Warranty Policy",
          category: "policy",
          title: "వారంటీ & గ్యారంటీ (Warranty Policy)",
          content: warrantyPolicy,
          score: this.calculateRelevance(queryTokens, [
            "warranty",
            "guarantee",
            "repair",
            "damage",
            "వారంటీ",
            "గ్యారంటీ",
            "రిపేర్",
          ]),
        });
      }
    }

    // 2. Index Working Hours & Operations
    if (knowledgeContext.workingHours) {
      candidateSnippets.push({
        source: "Working Hours",
        category: "hours",
        title: "పని వేళలు (Working Hours)",
        content: `పని వేళలు: ${knowledgeContext.workingHours}`,
        score: this.calculateRelevance(queryTokens, [
          "hours",
          "time",
          "timing",
          "open",
          "close",
          "schedule",
          "వేళలు",
          "సమయం",
          "ఓపెన్",
          "ఎప్పుడు",
          "టైమింగ్స్",
          "క్లోజ్",
        ]),
      });
    }

    // 3. Index Location & Address
    // 3. Index Location (Only if inquiry is about company premises, not order shipment)
    const isOrderInquiry = lowerQuery.includes("ఆర్డర్") || lowerQuery.includes("order") || lowerQuery.includes("ord-");
    if (knowledgeContext.location && !isOrderInquiry) {
      candidateSnippets.push({
        source: "Office Location",
        category: "location",
        title: "కార్యాలయ చిరునామా (Office Address)",
        content: `కార్యాలయం: ${knowledgeContext.location}. సంప్రదించండి: ${knowledgeContext.contactInfo || "N/A"}`,
        score: this.calculateRelevance(queryTokens, [
          "location",
          "address",
          "office",
          "branch",
          "city",
          "ఆఫీస్",
          "చిరునామా",
          "లొకేషన్",
          "బ్రాంచ్",
          "హైదరాబాద్",
        ]),
      });
    }

    // 4. Index Products & Services
    if (knowledgeContext.productsServices) {
      candidateSnippets.push({
        source: "Products & Services",
        category: "service",
        title: "సేవలు & ఉత్పత్తులు (Products & Services)",
        content: knowledgeContext.productsServices,
        score: this.calculateRelevance(queryTokens, [
          "service",
          "services",
          "product",
          "products",
          "provide",
          "offer",
          "సేవలు",
          "సర్వీస్",
          "ప్రొడక్ట్",
          "ఏమిటి",
          "ఏం చేస్తారు",
        ]),
      });
    }

    // 5. Index Pricing & Packages
    if (knowledgeContext.pricing && knowledgeContext.pricing.length > 0) {
      const pricingSummary = knowledgeContext.pricing
        .map((p) => `${p.planName}: ${p.price} (${p.features})`)
        .join("\n");
      candidateSnippets.push({
        source: "Pricing Plans",
        category: "pricing",
        title: "ధరలు & ప్యాకేజీలు (Pricing & Packages)",
        content: pricingSummary,
        score: this.calculateRelevance(queryTokens, [
          "price",
          "pricing",
          "cost",
          "rate",
          "package",
          "fee",
          "ధర",
          "కాస్ట్",
          "ఫీజు",
          "రేటు",
          "ఖర్చు",
          "ఎంత",
          "ప్లాన్స్",
        ]),
      });
    }

    // 6. Index FAQs
    if (knowledgeContext.faqs && Array.isArray(knowledgeContext.faqs)) {
      for (const faq of knowledgeContext.faqs) {
        if (faq.question && faq.answer) {
          const faqTokens = this.tokenize(faq.question.toLowerCase());
          const overlap = this.calculateOverlapScore(queryTokens, faqTokens);
          candidateSnippets.push({
            source: "FAQ",
            category: "faq",
            title: faq.question,
            content: faq.answer,
            score: overlap,
          });
        }
      }
    }

    // 7. Index Custom Documents
    if (knowledgeContext.documents && Array.isArray(knowledgeContext.documents)) {
      for (const doc of knowledgeContext.documents) {
        if (doc.title && doc.content) {
          const docTokens = this.tokenize(`${doc.title} ${doc.content}`.toLowerCase());
          const score = this.calculateOverlapScore(queryTokens, docTokens);
          candidateSnippets.push({
            source: doc.title,
            category: "general",
            title: doc.title,
            content: doc.content,
            score,
          });
        }
      }
    }

    // Filter by threshold score (score >= 2.0 indicates meaningful semantic match)
    const filtered = candidateSnippets
      .filter((s) => s.score >= 2.0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSnippets);

    // Topic grounding detection: Does the query ask about a specific business topic?
    const isGroundedTopic = candidateSnippets.some((s) => s.score >= 2.5);

    return {
      snippets: filtered,
      isGroundedTopic,
    };
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s\u0C00-\u0C7F]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1);
  }

  private calculateRelevance(queryTokens: string[], keywords: string[]): number {
    const STOPWORDS = new Set(["can", "you", "the", "and", "with", "are", "for", "from", "how", "what", "when", "where", "who", "why", "this", "that", "call"]);
    let score = 0;
    for (const q of queryTokens) {
      if (STOPWORDS.has(q) || q.length < 3) continue;
      for (const kw of keywords) {
        if (q === kw) {
          score += 3.0; // exact match
        } else if (q.length >= 4 && kw.length >= 4 && (q.startsWith(kw.slice(0, 4)) || kw.startsWith(q.slice(0, 4)))) {
          score += 1.5; // legitimate stem prefix match
        }
      }
    }
    return score;
  }

  private calculateOverlapScore(queryTokens: string[], docTokens: string[]): number {
    let matches = 0;
    const docSet = new Set(docTokens);
    for (const qt of queryTokens) {
      if (docSet.has(qt)) matches += 2.0;
    }
    return matches;
  }
}

export const knowledgeRetriever = new KnowledgeRetriever();
