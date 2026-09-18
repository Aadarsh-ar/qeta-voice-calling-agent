"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  PhoneCall,
  Calendar,
  Headphones,
  UtensilsCrossed,
  CreditCard,
  GraduationCap,
  Sparkles,
  Play,
  Copy,
  ArrowRight,
  Bot,
  CheckCircle2,
  Mic,
  Search,
  ChevronRight,
  Wrench,
  BookOpen,
  X,
  Volume2,
  ShieldCheck,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { TestAgentModal } from "@/components/testing/TestAgentModal";
import { LiveAgentAudioModal } from "@/components/landing/LiveAgentAudioModal";

interface AgentTemplate {
  id: string;
  name: string;
  badge?: string;
  category: string;
  icon: React.ElementType;
  description: string;
  language: string;
  voiceName: string;
  voiceId: string;
  openingGreeting: string;
  systemPrompt: string;
  businessProfile: {
    name: string;
    description: string;
    operatingHours?: string;
    contactInformation?: string;
    address?: string;
    information?: string;
  };
  tools: string[];
  recommendedFor: string;
  sampleQuestions: string[];
}

const TEMPLATES: AgentTemplate[] = [
  {
    id: "college-attendance",
    name: "College Academic & Attendance Counselor",
    badge: "Most Popular",
    category: "Education & Academics",
    icon: GraduationCap,
    description: "Proactively alerts parents and engineering students about semester attendance shortages, lab exam eligibility, fee payment deadlines, and hall ticket release schedules.",
    language: "Telugu & Tenglish",
    voiceName: "AD Cloned Neural Voice (8kHz / 16kHz)",
    voiceId: "f9945b75-0f3b-448d-ba9e-3d22c229a68e",
    openingGreeting: "నమస్కారం అండి, నేను ఇంజనీరింగ్ కాలేజ్ అడ్మినిస్ట్రేషన్ నుంచి మాట్లాడుతున్నాను. మీ అబ్బాయి/అమ్మాయి అటెండెన్స్ మరియు సెమిస్టర్ ఎగ్జామ్ ఫీజు వివరాల గురించి మాట్లాడటానికి కాల్ చేశాను. మీరు వినగలరా?",
    systemPrompt: `మీరు ఇంజనీరింగ్ కాలేజ్ అధికారిక AI వాయిస్ కౌన్సెలర్.
లక్ష్యం:
1. విద్యార్థులు మరియు వారి తల్లిదండ్రులకు సెమిస్టర్ అటెండెన్స్ వివరాలు (75% కంటే తక్కువ ఉంటే కండోనేషన్ ఫీజు రూ. 1,500), మరియు ల్యాబ్/థియరీ ఎగ్జామ్ ఫీజు డెడ్‌లైన్ తెలియజేయడం.
2. తల్లిదండ్రులు అడిగే ప్రశ్నలకు మర్యాదగా మరియు సూటిగా తెలుగు లేదా టెంగ్లీష్ లో సమాధానం ఇవ్వండి.
3. ఏదైనా సందేహం ఉంటే లేదా మార్కులు అడిగితే 'transfer_to_academic_dean' లేదా 'get_student_marks' టూల్ వాడండి.
ముగింపు: 'ధన్యవాదాలు అండి, కాలేజ్ యాజమాన్యం ఎల్లప్పుడూ విద్యార్థి భవిష్యత్తు కోసం కట్టుబడి ఉంది' అని శుభం పలకండి.`,
    businessProfile: {
      name: "College of Engineering",
      description: "Premier autonomous engineering college affiliated to JNTUA, Tirupati, Andhra Pradesh.",
      operatingHours: "Monday to Saturday: 9:00 AM - 5:00 PM",
      contactInformation: "Phone: +91 877 228 8888 | Email: exambranch@college.edu.in",
      address: "Karakambadi Road, Tirupati, Andhra Pradesh 517507",
      information: "Semester Exam Fee: ₹1,500. Minimum attendance required for hall ticket: 75%. Medical condonation threshold: 65% with certificate.",
    },
    tools: ["query_student_attendance", "fee_balance_check", "transfer_to_academic_dean"],
    recommendedFor: "Autonomous Engineering Colleges, Universities, Coaching Institutes",
    sampleQuestions: [
      "మా అబ్బాయి అటెండెన్స్ ఎంత శాతం ఉంది?",
      "ఎగ్జామ్ ఫీజు కట్టడానికి లాస్ట్ డేట్ ఎప్పుడు?",
      "కండోనేషన్ ఫీజు ఎంత కట్టాలి?",
    ],
  },
  {
    id: "luxury-real-estate",
    name: "Luxury Villa & Gated Community Sales Agent",
    badge: "High Conversion",
    category: "Real Estate & Construction",
    icon: Building2,
    description: "Calls inbound property inquiries within 10 seconds, answers pricing, RERA status, and floor plans, and schedules weekend VIP site visits with Google Maps directions.",
    language: "Telugu & English",
    voiceName: "AD Cloned Neural Voice",
    voiceId: "f9945b75-0f3b-448d-ba9e-3d22c229a68e",
    openingGreeting: "నమస్కారం అండి! QETADOTIN ప్రైమ్ విల్లాస్ నుంచి మాట్లాడుతున్నాను. మన కొత్త గేటెడ్ కమ్యూనిటీ విల్లా ప్రాజెక్ట్ బ్రోచర్ డౌన్‌లోడ్ చేశారు కదా, ఈ వీకెండ్ సైట్ విజిట్ కోసం స్లాట్ బుక్ చేయమంటారా?",
    systemPrompt: `మీరు QETADOTIN Prime Villas కు చెందిన అధికారిక లగ్జరీ రియల్ ఎస్టేట్ సేల్స్ కన్సల్టెంట్.
లక్ష్యం:
1. కొత్త విల్లా ప్రాజెక్ట్ (3BHK & 4BHK Luxury Villas, 2,800 to 3,600 sq ft, ధర ₹1.45 Cr నుండి ప్రారంభం) గురించి కస్టమర్ కి వివరించడం.
2. HMDA మరియు RERA అప్రూవల్స్, క్లబ్‌హౌస్, స్విమ్మింగ్ పూల్, 100% వాస్తు వివరాలు తెలియజేయడం.
3. ఈ శనివారం లేదా ఆదివారం ఉచిత పికప్ అండ్ డ్రాప్ తో కూడిన సైట్ విజిట్ బుక్ చేసుకోవడానికి ఒప్పించడం.
4. 'book_site_visit' లేదా 'send_brochure_whatsapp' టూల్స్ ను సముచితంగా అమలు చేయండి.`,
    businessProfile: {
      name: "QETADOTIN Prime Properties",
      description: "HMDA & RERA Approved Luxury Villa & Open Plot Developer.",
      operatingHours: "Open Daily 8:00 AM - 8:00 PM",
      contactInformation: "Sales: +91 80 7158 2667 | WhatsApp: +91 6305367443",
      address: "Financial District, Nanakramguda, Hyderabad, Telangana",
      information: "Starting price ₹1.45 Crores. Bank loan available from SBI, HDFC, ICICI up to 80%. RERA No: P02400007891.",
    },
    tools: ["book_site_visit", "send_brochure_whatsapp", "request_callback"],
    recommendedFor: "Real Estate Developers, Builders, Commercial Brokers",
    sampleQuestions: [
      "విల్లాస్ స్టార్టింగ్ ప్రైస్ ఎంతండి?",
      "ప్రాజెక్ట్ కి RERA మరియు HMDA అప్రూవల్ ఉందా?",
      "రేపు ఉదయం సైట్ విజిట్ కి రావొచ్చా?",
    ],
  },
  {
    id: "ecommerce-cod",
    name: "E-Commerce Cash-on-Delivery (COD) Verifier",
    badge: "Reduces RTO by 42%",
    category: "Retail & E-Commerce",
    icon: PhoneCall,
    description: "Calls online buyers immediately to verify shipping address landmarks, confirm Cash-on-Delivery readiness, and reschedule or cancel duplicate orders before dispatch.",
    language: "Telugu & Tenglish",
    voiceName: "AD Cloned Neural Voice",
    voiceId: "f9945b75-0f3b-448d-ba9e-3d22c229a68e",
    openingGreeting: "హలో అండి! మీ ఆన్‌లైన్ క్యాష్-ఆన్-డెలివరీ ఆర్డర్ కన్ఫర్మేషన్ కోసం కాల్ చేస్తున్నాను. రూ. 1,499 ఆర్డర్ రేపు డెలివరీకి రెడీగా ఉంది, మీరు అడ్రస్ వద్ద అందుబాటులో ఉంటారా?",
    systemPrompt: `మీరు ఈ-కామర్స్ డెలివరీ నెట్‌వర్క్ కు చెందిన అఫీషియల్ వెరిఫికేషన్ అసిస్టెంట్.
లక్ష్యం:
1. కస్టమర్ ఆర్డర్ చేసిన COD ప్రాడక్ట్ డెలివరీని కన్ఫర్మ్ చేయడం.
2. ఆర్డర్ మొత్తం అమౌంట్ క్యాష్ సిద్ధంగా ఉంచుకోమని చెప్పడం, లేదా డెలివరీ బాయ్ వద్ద UPI/QR ద్వారా పే చేయవచ్చని సూచించడం.
3. కస్టమర్ వేరే ఊరిలో ఉంటే లేదా తేదీ మార్చాలనుకుంటే 'reschedule_delivery' టూల్ వాడండి. ఆర్డర్ రద్దు చేయాలనుకుంటే 'cancel_order' వాడండి.`,
    businessProfile: {
      name: "FastCart Logistics & Retail",
      description: "Direct-to-Consumer rapid fulfillment and COD delivery network.",
      operatingHours: "24/7 Automated Dispatch",
      contactInformation: "Support: support@fastcart.in | Phone: 1800-419-9000",
      information: "Standard delivery time 24-48 hours. Mode: Cash on Delivery or UPI on arrival.",
    },
    tools: ["verify_delivery_address", "confirm_cod_order", "reschedule_delivery_slot"],
    recommendedFor: "Shopify Brands, D2C Sellers, Logistics & Courier Aggregators",
    sampleQuestions: [
      "రేపు కాకుండా ఎల్లుండి డెలివరీ చేయగలరా?",
      "నేను ఆన్‌లైన్ లో లేదా GPay ద్వారా పే చేయవచ్చా?",
      "ఆర్డర్ ని క్యాన్సిల్ చేయాలనుకుంటున్నాను.",
    ],
  },
  {
    id: "healthcare-scheduler",
    name: "Multispeciality Clinic Appointment Scheduler",
    badge: "24/7 Patient Care",
    category: "Healthcare & Clinics",
    icon: Calendar,
    description: "Handles patient phone inquiries 24/7, checks doctor schedules, books consultation slots, and sends WhatsApp confirmation tokens with clinic Google Maps directions.",
    language: "Telugu & English",
    voiceName: "AD Cloned Neural Voice",
    voiceId: "f9945b75-0f3b-448d-ba9e-3d22c229a68e",
    openingGreeting: "నమస్కారం అండి, సిటీ కేర్ సూపర్ స్పెషాలిటీ క్లినిక్ కి స్వాగతం. మీరు ఏ డాక్టర్ గారికి అపాయింట్‌మెంట్ తీసుకోవాలనుకుంటున్నారో చెప్పగలరా?",
    systemPrompt: `మీరు సిటీ కేర్ హాస్పిటల్ కు చెందిన దయగల మరియు సమర్థవంతమైన క్లినిక్ రిసెప్షనిస్ట్.
లక్ష్యం:
1. పేషెంట్ లేదా వారి బంధువులు అడిగే డాక్టర్ స్పెషాలిటీ (కార్డియాలజీ, గైనకాలజీ, పీడియాట్రిక్స్, జనరల్ మెడిసిన్) వివరాలు తెలుసుకోవడం.
2. కన్సల్టేషన్ ఫీజు (రూ. 500) మరియు ఓపీడీ సమయాలు (ఉదయం 9 నుండి రాత్రి 8 వరకు) వివరించడం.
3. పేషెంట్ పేరు, మొబైల్ నంబర్ మరియు ప్రాధాన్య సమయం నమోదు చేసి 'book_appointment_slot' అమలు చేయడం.`,
    businessProfile: {
      name: "CityCare Multispeciality Clinic",
      description: "Comprehensive outpatient clinic and diagnostic center.",
      operatingHours: "Mon-Sat: 8:00 AM - 9:00 PM | Sun: 9:00 AM - 2:00 PM",
      contactInformation: "Emergency: 108 | Appointments: +91 80 7158 2667",
      address: "Main Road, Near RTC Bus Stand, Tirupati, AP",
      information: "General OPD ₹500. Super-speciality ₹800. Digital X-Ray, ECG, Pathology 24/7.",
    },
    tools: ["check_doctor_availability", "book_appointment_slot", "send_whatsapp_token"],
    recommendedFor: "Hospitals, Diagnostic Centers, Dental Clinics, Doctors",
    sampleQuestions: [
      "ఈ రోజు సాయంత్రం డాక్టర్ గారు అందుబాటులో ఉంటారా?",
      "కన్సల్టేషన్ ఫీజు ఎంత ఉంటుంది?",
      "నాకు రేపు ఉదయం 11 గంటలకు స్లాట్ కావాలి.",
    ],
  },
  {
    id: "restaurant-table-booking",
    name: "Dine-In Table Reservation & Catering Hostess",
    badge: "Zero Waiting Time",
    category: "Hospitality & Dining",
    icon: UtensilsCrossed,
    description: "Takes incoming table reservations during peak rush hours, provides menu recommendations (Thalis, Biryanis), and manages family banquet hall bookings.",
    language: "Telugu & English",
    voiceName: "AD Cloned Neural Voice",
    voiceId: "f9945b75-0f3b-448d-ba9e-3d22c229a68e",
    openingGreeting: "నమస్కారం! రాయలసీమ రుచులు రెస్టారెంట్ కి స్వాగతం. ఈ రోజు లంచ్ లేదా డిన్నర్ కోసం టేబుల్ రిజర్వేషన్ చేయమంటారా?",
    systemPrompt: `మీరు రాయలసీమ రుచులు సాంప్రదాయ రెస్టారెంట్ యొక్క హోస్టెస్.
లక్ష్యం:
1. కస్టమర్ యొక్క గెస్ట్ కౌంట్ (ఎంతమంది వస్తున్నారు) మరియు సమయం అడిగి తెలుసుకోవడం.
2. స్పెషల్ ఐటమ్స్ (రాగి సంకటి, నాటుకోడి పులుసు, ఉలవచారు బిర్యానీ, గోంగూర మటన్) మరియు వెజ్/నాన్-వెజ్ ఆప్షన్స్ గురించి వివరించడం.
3. టేబుల్ కన్ఫర్మ్ చేసి WhatsApp లో లొకేషన్ పంపడం.`,
    businessProfile: {
      name: "Rayalaseema Ruchulu Restaurant",
      description: "Authentic Andhra & Rayalaseema culinary dining experience.",
      operatingHours: "Lunch: 11:30 AM - 4:00 PM | Dinner: 7:00 PM - 11:00 PM",
      contactInformation: "Reservations: +91 80 7158 2667",
      address: "Jubilee Hills, Road No. 36, Hyderabad",
      information: "Valet parking available. 100% Halal certified. Banquet hall capacity up to 120 guests.",
    },
    tools: ["check_table_availability", "reserve_table", "send_menu_pdf"],
    recommendedFor: "Fine Dining Restaurants, Buffet Venues, Cafes, Cloud Kitchens",
    sampleQuestions: [
      "ఈ రోజు రాత్రి 8 గంటలకు 6 మందికి టేబుల్ దొరుకుతుందా?",
      "మీ దగ్గర స్పెషల్ ఐటమ్స్ ఏమిటి?",
      "పార్టీ హాల్ లేదా బర్త్‌డే బుకింగ్స్ ఉన్నాయా?",
    ],
  },
  {
    id: "fintech-emi-reminder",
    name: "Fintech EMI Reminder & Instant UPI Payment Link",
    badge: "Courteous & Compliant",
    category: "Banking & Fintech",
    icon: CreditCard,
    description: "Politely informs borrowers 2-3 days prior to monthly EMI auto-debit dates, answers query on interest calculations, and dispatches direct UPI deep-links to prevent bounce penalties.",
    language: "Telugu & English",
    voiceName: "AD Cloned Neural Voice",
    voiceId: "f9945b75-0f3b-448d-ba9e-3d22c229a68e",
    openingGreeting: "నమస్కారం అండి, మీ లోన్ EMI పేమెంట్ గడువు రేపటితో ముగుస్తుంది. ఆన్‌లైన్ పేమెంట్ లింక్ ద్వారా సులభంగా పే చేయడానికి సహాయపడమంటారా?",
    systemPrompt: `మీరు ప్రముఖ ఫిన్‌టెక్ లోన్ ప్లాట్‌ఫారమ్ యొక్క మర్యాదపూర్వక మరియు కంప్లైంట్ EMI అసిస్టెంట్.
లక్ష్యం:
1. కస్టమర్ కు వారి నెలవారీ లోన్ డ్యూ డేట్ గురించి గుర్తుచేయడం (రూ. 4,500 EMI).
2. బౌన్స్ ఛార్జీలు (రూ. 590) మరియు CIBIL స్కోర్ తగ్గకుండా ఉండటానికి సమయానికి పే చేయడం ఎంత ముఖ్యమో సున్నితంగా వివరించడం.
3. కస్టమర్ అంగీకరిస్తే 'send_upi_payment_link' ద్వారా Google Pay/PhonePe లింక్ పంపడం.`,
    businessProfile: {
      name: "QetaFin Micro-Lending Services",
      description: "RBI-registered NBFC digital credit platform.",
      operatingHours: "Support: 8:00 AM - 7:00 PM",
      contactInformation: "Toll Free: 1800-200-5555 | WhatsApp: +91 6305367443",
      information: "Zero bounce charges if paid before 5:00 PM on due date. Instant NOC on full closure.",
    },
    tools: ["check_emi_due", "generate_upi_link", "request_grace_period"],
    recommendedFor: "NBFCs, Fintech Apps, Micro-Finance Institutions, Vehicle Loan Companies",
    sampleQuestions: [
      "నా EMI డ్యూ అమౌంట్ ఎంత ఉంది?",
      "పేమెంట్ చేయడానికి UPI లింక్ పంపగలరా?",
      "రెండు రోజులు టైమ్ కావాలంటే ఏం చేయాలి?",
    ],
  },
];

export default function TemplatesPage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [cloningTemplateId, setCloningTemplateId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<AgentTemplate | null>(null);
  const [isAudioModalOpen, setIsAudioModalOpen] = useState<boolean>(false);

  // Live Mic Voice Test Modal state
  const [isVoiceTestOpen, setIsVoiceTestOpen] = useState<boolean>(false);
  const [voiceTestAgent, setVoiceTestAgent] = useState<{
    name: string;
    greeting: string;
    systemPrompt?: string;
    cartesiaVoiceId?: string;
    id?: string;
  }>({
    name: "College Academic Counselor",
    greeting: TEMPLATES[0].openingGreeting,
    systemPrompt: TEMPLATES[0].systemPrompt,
    cartesiaVoiceId: TEMPLATES[0].voiceId,
  });

  const categories = [
    "ALL",
    "Education & Academics",
    "Real Estate & Construction",
    "Retail & E-Commerce",
    "Healthcare & Clinics",
    "Hospitality & Dining",
    "Banking & Fintech",
  ];

  const filteredTemplates = TEMPLATES.filter((t) => {
    const matchesCat = selectedCategory === "ALL" || t.category === selectedCategory;
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.recommendedFor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  // 1-Click Clone to Workspace
  const handleCloneTemplate = async (template: AgentTemplate) => {
    try {
      setCloningTemplateId(template.id);

      const payload = {
        name: template.name,
        description: template.description,
        language: "TELUGU_ENGLISH",
        systemPrompt: template.systemPrompt,
        instructions: template.systemPrompt,
        businessContext: JSON.stringify(template.businessProfile),
        businessProfile: template.businessProfile,
        cartesiaVoiceId: template.voiceId,
        cartesiaVoiceName: template.voiceName,
        tools: template.tools.map((toolName) => ({
          name: toolName,
          description: `Auto-generated tool capability for ${template.name}`,
          isEnabled: true,
        })),
      };

      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success && data.agent) {
        setToastMessage(`✓ Cloned "${template.name}"! Redirecting to agent console...`);
        setTimeout(() => {
          router.push(`/agents/${data.agent.id}`);
        }, 1000);
      } else {
        alert(data.error || "Failed to clone agent template. Please try again.");
        setCloningTemplateId(null);
      }
    } catch (err) {
      console.error("Error cloning template:", err);
      alert("Network error cloning template.");
      setCloningTemplateId(null);
    }
  };

  // Open interactive mic-only voice test directly with this template persona
  const handleTestTemplateInBrowser = (template: AgentTemplate) => {
    setVoiceTestAgent({
      name: template.name,
      greeting: template.openingGreeting,
      systemPrompt: template.systemPrompt,
      cartesiaVoiceId: template.voiceId,
    });
    setIsVoiceTestOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#FAFAF8] text-slate-900 selection:bg-emerald-100 selection:text-emerald-900">
      <Header
        title="Agent Templates"
        subtitle="Pre-configured voice agents for Telugu & English. 1-click clone to your workspace, test via mic, or deploy to telephony."
      />

      {/* Celebratory Clone Toast Banner */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-emerald-900 text-white shadow-2xl border border-emerald-700 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Banner Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-900 text-white p-6 sm:p-10 mb-8 shadow-xl border border-emerald-800/40">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold uppercase tracking-wider mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Production Voice Blueprints</span>
            </div>
            <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight mb-3">
              Deploy battle-tested voice agents in seconds.
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-6">
              Skip complex prompt engineering. Choose any template below to test it instantly with your microphone or clone it directly into your live workspace with pre-configured greetings, Cartesia neural voice IDs, and tools.
            </p>

            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 border border-white/10">
                <Mic className="w-3.5 h-3.5 text-emerald-400" />
                <span>Hands-free Browser Mic Testing</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 border border-white/10">
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>AD Cloned Voice Integrated</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 border border-white/10">
                <Wrench className="w-3.5 h-3.5 text-emerald-400" />
                <span>Pre-attached Tools & RAG</span>
              </div>
            </div>
          </div>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-8">
          {/* Category Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? "bg-emerald-900 text-white shadow-xs"
                    : "bg-white border border-[#EAEBE8] text-slate-600 hover:text-slate-900 hover:border-slate-300"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[260px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates, use cases..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-[#EAEBE8] text-xs font-medium text-slate-900 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition"
            />
          </div>
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((tpl) => {
            const Icon = tpl.icon;
            const isCloning = cloningTemplateId === tpl.id;

            return (
              <div
                key={tpl.id}
                className="bg-white rounded-3xl border border-[#EAEBE8] p-6 shadow-xs hover:shadow-md hover:border-emerald-200 transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Top Bar: Icon, Category & Badge */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                      <Icon className="w-6 h-6" />
                    </div>
                    {tpl.badge && (
                      <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-100/80 text-emerald-800 font-bold border border-emerald-200 uppercase tracking-wider">
                        {tpl.badge}
                      </span>
                    )}
                  </div>

                  {/* Title & Description */}
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    {tpl.category}
                  </span>
                  <h3 className="font-heading text-lg font-bold text-slate-900 tracking-tight mb-2 group-hover:text-emerald-950 transition">
                    {tpl.name}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed mb-4 line-clamp-3">
                    {tpl.description}
                  </p>

                  {/* Spoken Telugu Greeting Box */}
                  <div className="p-3.5 rounded-2xl bg-[#FAFAF8] border border-slate-100 mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                        <Volume2 className="w-3 h-3" />
                        Opening Voice Greeting
                      </span>
                      <button
                        onClick={() => setIsAudioModalOpen(true)}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                      >
                        <Play className="w-2.5 h-2.5 fill-current" />
                        Audition
                      </button>
                    </div>
                    <p className="text-xs font-medium text-slate-800 italic leading-relaxed line-clamp-2">
                      "{tpl.openingGreeting}"
                    </p>
                  </div>

                  {/* Badges & Tools */}
                  <div className="flex flex-wrap gap-1.5 mb-6 text-[11px] font-medium">
                    <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700">
                      🗣️ {tpl.language}
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                      🎙️ AD Cloned Voice
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700">
                      ⚡ {tpl.tools.length} Tools
                    </span>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    {/* Interactive Mic Testing Button */}
                    <button
                      onClick={() => handleTestTemplateInBrowser(tpl)}
                      className="flex-1 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition flex items-center justify-center gap-1.5"
                    >
                      <Mic className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Test via Mic</span>
                    </button>

                    {/* Preview Prompt & Context */}
                    <button
                      onClick={() => setPreviewTemplate(tpl)}
                      className="px-3 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-1"
                      title="Inspect System Prompt & Tools"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Inspect</span>
                    </button>
                  </div>

                  {/* 1-Click Clone to Workspace Button */}
                  <button
                    onClick={() => handleCloneTemplate(tpl)}
                    disabled={isCloning}
                    className="w-full btn-emerald-primary text-xs py-2.5 flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-60"
                  >
                    {isCloning ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Cloning to Workspace...</span>
                      </>
                    ) : (
                      <>
                        <span>Use Template</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Interactive Hands-Free Voice Test Modal */}
      <TestAgentModal
        isOpen={isVoiceTestOpen}
        onClose={() => setIsVoiceTestOpen(false)}
        agentName={voiceTestAgent.name}
        cartesiaVoiceId={voiceTestAgent.cartesiaVoiceId}
        initialGreeting={voiceTestAgent.greeting}
        systemPrompt={voiceTestAgent.systemPrompt}
        instructions={voiceTestAgent.systemPrompt}
      />

      {/* Greeting Audio Audition Modal */}
      <LiveAgentAudioModal
        isOpen={isAudioModalOpen}
        onClose={() => setIsAudioModalOpen(false)}
        agentId="agent_WzcEn6kkRmPxAfBNHzvpa1"
        agentName="Sam (Voice Intelligence Agent)"
      />

      {/* Inspect Template System Prompt & Tools Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4 border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                  {previewTemplate.category}
                </span>
                <h3 className="font-heading text-xl font-bold text-slate-900">
                  {previewTemplate.name}
                </h3>
              </div>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-1.5">
                  Opening Voice Greeting:
                </h4>
                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl text-emerald-950 italic">
                  "{previewTemplate.openingGreeting}"
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-1.5">
                  System Instructions & Guardrails:
                </h4>
                <pre className="p-4 bg-slate-900 text-slate-100 rounded-2xl font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                  {previewTemplate.systemPrompt}
                </pre>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-1.5">
                  Pre-configured Business Context:
                </h4>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-slate-700">
                  <p><strong>Entity:</strong> {previewTemplate.businessProfile.name}</p>
                  <p><strong>Description:</strong> {previewTemplate.businessProfile.description}</p>
                  {previewTemplate.businessProfile.operatingHours && (
                    <p><strong>Hours:</strong> {previewTemplate.businessProfile.operatingHours}</p>
                  )}
                  {previewTemplate.businessProfile.contactInformation && (
                    <p><strong>Contact:</strong> {previewTemplate.businessProfile.contactInformation}</p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-1.5">
                  Attached Function Tools:
                </h4>
                <div className="flex flex-wrap gap-2">
                  {previewTemplate.tools.map((t) => (
                    <span
                      key={t}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-[10px] font-bold"
                    >
                      ⚡ {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setPreviewTemplate(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const tpl = previewTemplate;
                  setPreviewTemplate(null);
                  handleCloneTemplate(tpl);
                }}
                className="btn-emerald-primary text-xs px-5 py-2"
              >
                <span>Clone This Template</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
