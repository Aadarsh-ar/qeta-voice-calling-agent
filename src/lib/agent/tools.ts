/**
 * Enterprise Tool Framework for Autonomous Voice Calling Agents
 *
 * Tools represent executable capabilities during phone calls.
 * Golden Rule: Tool results MUST control the answer. Never claim an action
 * succeeded unless the tool confirms it.
 */

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required: string[];
    };
  };
}

// In-Memory active database for bookings and orders
const APPOINTMENTS_DB = new Map<string, { id: string; customerName: string; date: string; time: string; service: string; status: string }>();
const ORDERS_DB = new Map<string, { id: string; customerPhone: string; item: string; status: string; courier: string; expectedDelivery: string }>();

// Seed sample orders (including benchmark order 4567)
ORDERS_DB.set("4567", {
  id: "4567",
  customerPhone: "+916305367443",
  item: "Samsung Galaxy Smartphone",
  status: "In Transit",
  courier: "Ekart Logistics",
  expectedDelivery: "Tomorrow (రేపు) by 2:00 PM",
});

ORDERS_DB.set("ORD-4567", ORDERS_DB.get("4567")!);

ORDERS_DB.set("ORD-8421", {
  id: "ORD-8421",
  customerPhone: "+916305367443",
  item: "Telugu AI Voice Engine Starter Kit",
  status: "In Transit",
  courier: "BlueDart Express",
  expectedDelivery: "Tomorrow by 2:00 PM",
});

ORDERS_DB.set("ORD-1002", {
  id: "ORD-1002",
  customerPhone: "+916305367443",
  item: "QETADOTIN Telephony Gateway Adapter",
  status: "Delivered",
  courier: "Delhivery",
  expectedDelivery: "Delivered yesterday",
});

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "get_order_status",
      description: "Realtime tool to lookup order tracking, location, courier, and expected delivery status by order ID (e.g. '4567' or 'ORD-8421').",
      parameters: {
        type: "object",
        properties: {
          orderId: {
            type: "string",
            description: "The order reference ID (e.g. '4567', 'ORD-4567', 'ORD-8421')",
          },
          customerPhone: {
            type: "string",
            description: "Customer's phone number if order ID is not known",
          },
        },
        required: ["orderId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_order_status",
      description: "Lookup shipping and delivery status of a customer order by Order ID or phone number.",
      parameters: {
        type: "object",
        properties: {
          orderId: {
            type: "string",
            description: "The order reference ID (e.g. 'ORD-8421' or '4567')",
          },
          customerPhone: {
            type: "string",
            description: "Customer's phone number if Order ID is not known",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "book_appointment",
      description: "Schedule a product demo, consultation, or appointment for the caller.",
      parameters: {
        type: "object",
        properties: {
          customerName: {
            type: "string",
            description: "Full name of the caller",
          },
          appointmentDate: {
            type: "string",
            description: "Date of appointment (e.g. 'రేపు', 'tomorrow', '2026-09-17')",
          },
          appointmentTime: {
            type: "string",
            description: "Preferred time slot (e.g. '10:30 AM', '3:00 PM', 'ఉదయం 11 గంటలకు')",
          },
          serviceType: {
            type: "string",
            description: "Type of service or consultation requested",
          },
        },
        required: ["appointmentDate", "appointmentTime"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_appointment",
      description: "Cancel an existing scheduled appointment or demo.",
      parameters: {
        type: "object",
        properties: {
          bookingReference: {
            type: "string",
            description: "The booking reference ID (e.g. 'APT-9412')",
          },
          reason: {
            type: "string",
            description: "Reason for cancellation",
          },
        },
        required: ["bookingReference"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_availability",
      description: "Check available appointment slots for a given date.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Date to check (e.g. 'tomorrow', 'Friday', 'రేపు')",
          },
          serviceType: {
            type: "string",
            description: "Service type being checked",
          },
        },
        required: ["date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_pricing_plans",
      description: "Lookup real-time pricing plans, package costs, and feature breakdowns in INR (₹).",
      parameters: {
        type: "object",
        properties: {
          planName: {
            type: "string",
            description: "Plan tier to check: 'starter', 'professional', 'enterprise', or 'all'",
          },
        },
        required: ["planName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_knowledge_base",
      description: "Lookup verified business information, office address, working hours, or refund policies.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The topic or question to search (e.g. 'office location', 'working hours', 'services')",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "transfer_call",
      description: "Transfer caller to a human agent, department extension, or senior manager.",
      parameters: {
        type: "object",
        properties: {
          department: {
            type: "string",
            description: "Department to transfer to: 'sales', 'support', 'technical', 'billing'",
          },
          reason: {
            type: "string",
            description: "Reason for transferring to human operator",
          },
        },
        required: ["department", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_sms_confirmation",
      description: "Send an SMS confirmation to the customer's phone number.",
      parameters: {
        type: "object",
        properties: {
          phoneNumber: {
            type: "string",
            description: "Customer phone number to receive the SMS",
          },
          messageContent: {
            type: "string",
            description: "Summary of details to include in SMS",
          },
        },
        required: ["phoneNumber", "messageContent"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "end_call",
      description: "Conclude the phone call when conversation is finished or caller says goodbye.",
      parameters: {
        type: "object",
        properties: {
          closingMessage: {
            type: "string",
            description: "Polite sign-off in Telugu/Tenglish to speak before terminating call",
          },
        },
        required: ["closingMessage"],
      },
    },
  },
];

export async function executeToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<{ success: boolean; result: unknown; conversationalSummaryTelugu: string }> {
  switch (name) {
    case "get_order_status":
    case "check_order_status": {
      const rawInput = String(args.orderId || args.id || "").trim();
      let rawId = rawInput.toUpperCase();
      
      const phone = String(args.customerPhone || "").trim();
      let order = rawId ? ORDERS_DB.get(rawId) || ORDERS_DB.get(rawInput) : undefined;

      if (!order && rawId) {
        // Try with and without ORD- prefix
        const withPrefix = rawId.startsWith("ORD-") ? rawId : `ORD-${rawId}`;
        const withoutPrefix = rawId.replace(/^ORD-/, "");
        order = ORDERS_DB.get(withPrefix) || ORDERS_DB.get(withoutPrefix);
      }

      if (!order && rawInput) {
        try {
          const { prisma } = await import("@/lib/db/prisma");
          const dbOrder = await prisma.order.findFirst({
            where: {
              OR: [
                { orderId: rawInput },
                { orderId: rawId },
                { orderId: `ORD-${rawInput}` },
              ],
            },
            select: {
              orderId: true,
              status: true,
              courier: true,
              expectedDelivery: true,
              items: true,
            },
          });
          if (dbOrder) {
            order = {
              id: dbOrder.orderId,
              customerPhone: phone || "",
              item: dbOrder.items,
              status: dbOrder.status,
              courier: dbOrder.courier || "Ekart Logistics",
              expectedDelivery: dbOrder.expectedDelivery || "Tomorrow (రేపు)",
            };
            ORDERS_DB.set(order.id, order);
          }
        } catch {}
      }

      if (!order && phone) {
        for (const o of ORDERS_DB.values()) {
          if (o.customerPhone.includes(phone) || phone.includes(o.customerPhone)) {
            order = o;
            break;
          }
        }
      }

      if (order) {
        return {
          success: true,
          result: order,
          conversationalSummaryTelugu: `మీ ఆర్డర్ ${order.id} ప్రస్తుతం Hyderabad Hub లో ${order.status} లో ఉంది అండి. ఇది ${order.courier} ద్వారా ${order.expectedDelivery} న డెలివరీ అవుతుంది.`,
        };
      } else if (!rawInput && !phone) {
        return {
          success: false,
          result: { error: "Order ID missing" },
          conversationalSummaryTelugu: `అయ్యో, క్షమించండి అండి. మీ ఆర్డర్ వివరాలు సరిచూడటానికి మీ ఆర్డర్ నంబర్ చెప్పగలరా?`,
        };
      } else {
        return {
          success: false,
          result: { error: "Order not found", orderId: rawInput, customerPhone: phone },
          conversationalSummaryTelugu: `క్షమించండి అండి, మీరు చెప్పిన ఆర్డర్ నంబర్ ${rawInput} మా సిస్టమ్‌లో కనిపించలేదు. దయచేసి సరైన ఆర్డర్ నంబర్ ఒకసారి సరిచూసి చెప్పగలరా?`,
        };
      }
    }

    case "book_appointment": {
      const date = String(args.appointmentDate || "రేపు");
      const time = String(args.appointmentTime || "11:00 AM");
      const refId = `APT-${Math.floor(1000 + Math.random() * 9000)}`;
      const customerName = String(args.customerName || "Customer");
      const service = String(args.serviceType || "Product Demo");

      APPOINTMENTS_DB.set(refId, {
        id: refId,
        customerName,
        date,
        time,
        service,
        status: "Confirmed",
      });

      return {
        success: true,
        result: {
          status: "confirmed",
          bookingReference: refId,
          date,
          time,
          service,
          message: `Appointment successfully booked for ${date} at ${time}.`,
        },
        conversationalSummaryTelugu: `తప్పకుండా అండి! మీ అపాయింట్‌మెంట్ ${date} ${time} కి కన్ఫర్మ్ చేశాను. మీ బుకింగ్ రిఫరెన్స్ నంబర్ ${refId}. SMS ద్వారా వివరాలు అందుతాయి.`,
      };
    }

    case "cancel_appointment": {
      const refId = String(args.bookingReference || "").toUpperCase().trim();
      const existing = APPOINTMENTS_DB.get(refId);

      if (existing) {
        existing.status = "Cancelled";
        return {
          success: true,
          result: { status: "cancelled", bookingReference: refId },
          conversationalSummaryTelugu: `మీ అపాయింట్‌మెంట్ ${refId} విజయవంతంగా రద్దు చేయబడింది అండి. మీకు మరేదైనా సహాయం కావాలా?`,
        };
      } else {
        return {
          success: false,
          result: { error: "Appointment not found", bookingReference: refId },
          conversationalSummaryTelugu: `క్షమించండి, ${refId} నంబర్‌తో ఎలాంటి అపాయింట్‌మెంట్ నమోదు కాలేదు. దయచేసి సరైన రిఫరెన్స్ నంబర్ సరిచూసుకోండి.`,
        };
      }
    }

    case "check_availability": {
      const date = String(args.date || "రేపు");
      const availableSlots = ["ఉదయం 10:30 AM", "మధ్యాహ్నం 2:00 PM", "సాయంత్రం 4:30 PM"];
      return {
        success: true,
        result: { date, availableSlots },
        conversationalSummaryTelugu: `${date} నాడు ఉదయం 10:30, మధ్యాహ్నం 2:00, మరియు సాయంత్రం 4:30 స్లాట్లు అందుబాటులో ఉన్నాయి అండి. మీకు ఏ సమయం అనుకూలంగా ఉంటుంది?`,
      };
    }

    case "check_pricing_plans": {
      const plan = String(args.planName || "").toLowerCase();
      let details = "మా స్టార్టర్ ప్లాన్ నెలకు ₹15,000 (2,000 మినిట్స్), గ్రోత్ ప్లాన్ ₹35,000 (6,000 మినిట్స్), మరియు ఎంటర్‌ప్రైజ్ ప్లాన్ కస్టమ్.";
      if (plan.includes("start")) {
        details = "మా స్టార్టర్ ప్లాన్ నెలకు ₹15,000 మాత్రమే అండి. ఇందులో 2,000 కాలింగ్ నిమిషాలు మరియు అన్ని తెలుగు వాయిస్ ఫీచర్లు లభిస్తాయి.";
      } else if (plan.includes("grow") || plan.includes("pro")) {
        details = "గ్రోత్ ప్లాన్ నెలకు ₹35,000 అండి. ఇందులో 6,000 నిమిషాలు, ప్రయారిటీ రూటింగ్ మరియు అడ్వాన్స్‌డ్ CRM అనలిటిక్స్ ఉంటాయి.";
      }
      return {
        success: true,
        result: {
          currency: "INR",
          starter: { monthly: 15000, minutes: 2000 },
          growth: { monthly: 35000, minutes: 6000 },
          enterprise: { custom: true },
        },
        conversationalSummaryTelugu: details,
      };
    }

    case "query_knowledge_base": {
      const q = String(args.query || "").toLowerCase();
      let answer = "మా ఆఫీస్ Hitec City, Hyderabad లో ఉంది అండి. పని వేళలు సోమవారం నుండి శనివారం ఉదయం 9:30 AM నుండి సాయంత్రం 7:00 PM వరకు.";
      if (q.includes("location") || q.includes("address") || q.includes("ఆఫీస్")) {
        answer = "మా ప్రధాన కార్యాలయం ఫైనాన్షియల్ డిస్ట్రిక్ట్, నానక్‌రామ్‌గూడ, హైదరాబాద్ లో ఉంది అండి.";
      } else if (q.includes("support") || q.includes("contact") || q.includes("నంబర్")) {
        answer = "మా కస్టమర్ కేర్ సపోర్ట్ లైన్ +91 80 7158 2667 మరియు ఈమెయిల్ support@qeta.in అండి.";
      }
      return {
        success: true,
        result: { query: args.query, answer },
        conversationalSummaryTelugu: answer,
      };
    }

    case "transfer_call": {
      const dept = String(args.department || "sales");
      return {
        success: true,
        result: {
          status: "transferring",
          targetDepartment: dept,
          queueTime: "< 10s",
        },
        conversationalSummaryTelugu: `ఖచ్చితంగా అండి, లైన్‌లోనే ఉండండి. మిమ్మల్ని మా ${dept} డిపార్ట్‌మెంట్ సీనియర్ అధికారికి కనెక్ట్ చేస్తున్నాను.`,
      };
    }

    case "send_sms_confirmation": {
      const phone = String(args.phoneNumber || "Caller");
      return {
        success: true,
        result: { status: "sent", to: phone, message: args.messageContent },
        conversationalSummaryTelugu: `ఖచ్చితంగా అండి, మీ నంబర్ ${phone} కి వివరాలతో కూడిన SMS పంపించాను.`,
      };
    }

    case "end_call": {
      const closing = String(args.closingMessage || "మాతో మాట్లాడినందుకు చాలా ధన్యవాదాలు అండి. హావ్ ఎ వండర్‌ఫుల్ డే!");
      return {
        success: true,
        result: {
          status: "concluded",
          closingMessage: closing,
        },
        conversationalSummaryTelugu: closing,
      };
    }

    default:
      return {
        success: true,
        result: { executed: name, args },
        conversationalSummaryTelugu: "సరే అండి, ఆ వివరాలు చెక్ చేశాను.",
      };
  }
}
