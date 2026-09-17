import { normalizeTeluguText, numberToTeluguWords } from "./normalizeTelugu";

console.log("--- Testing Telugu Normalizer ---");

const testCases = [
  {
    input: "మా కోర్సు ఫీజు ₹25,000 మాత్రమే.",
    expectedContains: "ఇరవై ఐదు వేల రూపాయలు",
  },
  {
    input: "రేపు ఉదయం 10:30 AM కి రండి.",
    expectedContains: "ఉదయం పది గంటల ముప్పై నిమిషాలకు",
  },
  {
    input: "మేము B2B మరియు B2C solutions అందిస్తాము.",
    expectedContains: "బీ టు బీ",
  },
  {
    input: "మా ఆఫీస్ Hyderabad లో ఉంది. మీ OTP చెప్పండి.",
    expectedContains: "హైదరాబాద్",
  },
  {
    input: "డిస్కౌంట్ 20% ఉంటుంది.",
    expectedContains: "ఇరవై శాతం",
  },
];

let allPassed = true;

for (const tc of testCases) {
  const result = normalizeTeluguText(tc.input);
  const passed = result.includes(tc.expectedContains);
  console.log(`Input: "${tc.input}"`);
  console.log(`Output: "${result}"`);
  console.log(`Result: ${passed ? "✅ PASS" : "❌ FAIL"}\n`);
  if (!passed) allPassed = false;
}

if (allPassed) {
  console.log("🎉 All Telugu normalization test cases passed!");
} else {
  console.error("❌ Some tests failed!");
  process.exit(1);
}
