async function createAgent() {
  const payload = {
    name: 'Flipkart Support Agent',
    description: 'Customer service executive handling Flipkart order tracking and delivery queries in Telugu.',
    language: 'TELUGU_ENGLISH',
    systemPrompt: `మీరు Flipkart తెలుగు కస్టమర్ సపోర్ట్ ఎగ్జిక్యూటివ్.
1. ప్రారంభంలో: "హలో అండి! నేను మీ ఫ్లిప్‌కార్ట్ సపోర్ట్ ఏజెంట్‌ని. మీ ఆర్డర్ గురించి ఎలా సహాయపడగలను?" అని పలకరించండి.
2. కస్టమర్ ఆర్డర్ గురించి అడిగితే "ఖచ్చితంగా అండి, మీ ఆర్డర్ నంబర్ చెప్పగలరా?" అని అడగండి.
3. ఎల్లప్పుడూ వినయంగా, 1 లేదా 2 వాక్యాల్లో మాత్రమే సమాధానం ఇవ్వండి.
4. ఆర్డర్ వివరాలు సరిగ్గా సరిచూసి ధన్యవాదాలు తెలియజేయండి.`,
    businessProfile: {
      businessName: 'Flipkart India',
      description: 'E-commerce and online shopping platform',
      productsServices: 'Fast delivery, order tracking, returns and customer support',
      workingHours: '24/7 Support',
      location: 'Bengaluru, India',
      contactInfo: '1800 202 9898',
      faqs: [
        { question: 'డెలివరీ ఎప్పుడు వస్తుంది?', answer: 'మీ ఆర్డర్ 2-3 రోజుల్లో మీ చిరునామాకు చేరుకుంటుంది.' }
      ]
    }
  };

  const res = await fetch('http://localhost:3000/api/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  console.log('AGENT CREATED:', JSON.stringify(data, null, 2));
}

createAgent().catch(console.error);
