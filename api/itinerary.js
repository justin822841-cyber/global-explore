function cleanJSON(raw) {
  // Step 1: Remove markdown fences
  let text = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // Step 2: Extract outermost { }
  const start = text.indexOf('{');
  const end   = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found');
  text = text.slice(start, end + 1);

  // Step 3: Fix control characters inside JSON strings
  // Scan char by char, track string context
  let result = '';
  let inString = false;
  let escaped = false;
  
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const code = text.charCodeAt(i);
    
    if (escaped) {
      escaped = false;
      result += ch;
      continue;
    }
    
    if (ch === '\\') {
      escaped = true;
      result += ch;
      continue;
    }
    
    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }
    
    if (inString) {
      // Replace bare control characters with their escape sequences
      if (code === 0x0A) { result += '\\n'; continue; }  // newline
      if (code === 0x0D) { result += '\\r'; continue; }  // carriage return
      if (code === 0x09) { result += '\\t'; continue; }  // tab
      if (code < 0x20)   { result += ' '; continue; }      // other control chars
    }
    
    result += ch;
  }

  // Step 4: Fix trailing commas before ] or }
  result = result
    .replace(/,\s*}/g, '}')
    .replace(/,\s*]/g, ']');

  return result;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    origin, destination, departDate, returnDate,
    adults = 1, children = 0, infants = 0, seniors = 0,
    childAges = '', seniorAges = '',
    currency = 'AUD',
    budget = '', travelClass = 'Economy',
    flightPreference = '', accommodationLevel = 'Comfort',
    accommodationType = 'any', accommodationLocation = 'any',
    travelStyle = [], pace = 'Balanced', purpose = '',
    dietary = 'none', hasVisited = 'never',
    localTransport = '', crowdPreference = '',
    shoppingFocus = 'no', nearbyCity = 'No',
    specialRequests = '', anchors = []
  } = req.body;

  if (!origin || !destination) {
    return res.status(400).json({ error: 'Missing origin or destination' });
  }

  const nights = departDate && returnDate
    ? Math.max(1, Math.round((new Date(returnDate) - new Date(departDate)) / 86400000))
    : 7;

  const hasChildren = parseInt(children) > 0;
  const hasInfants  = parseInt(infants) > 0;
  const hasSeniors  = parseInt(seniors) > 0;
  const totalPax    = parseInt(adults) + parseInt(children);

  const currencySymbols = {
    AUD:'A$', USD:'$', GBP:'£', EUR:'€', CNY:'¥',
    SGD:'S$', JPY:'¥', HKD:'HK$', CAD:'C$', NZD:'NZ$'
  };
  const currSymbol = currencySymbols[currency] || currency;

  const MARKER = process.env.AVIASALES_MARKER || '717078';

  const affiliates = {
    klook:          `https://www.klook.com/en-AU/?aid=tp${MARKER}`,
    tiqets:         `https://www.tiqets.com/en/?partner=globalexplore`,
    wegotrip:       `https://wegotrip.com/?ref=globalexplore`,
    welcomePickups: `https://www.welcomepickups.com/?affiliate_id=${MARKER}`,
    kiwitaxi:       `https://kiwitaxi.com/?marker=${MARKER}`,
    getRentacar:    `https://www.getrentacar.com/?marker=${MARKER}`,
    airalo:         `https://www.airalo.com/?partner=${MARKER}`,
    yesim:          `https://yesim.app/?ref=${MARKER}`,
    airhelp:        `https://www.airhelp.com/en-au/?partner=${MARKER}`,
    ekta:           `https://ekta.app/?ref=${MARKER}`,
    ticketNetwork:  `https://www.ticketnetwork.com/?ref=${MARKER}`,
    compensair:     `https://compensair.com/?ref=${MARKER}`,
  };

  // Nearby cities logic based on trip duration
  let nearbyCitiesInstruction = '';
  const wantsNearby = nearbyCity && nearbyCity.toLowerCase().includes('yes');

  if (wantsNearby) {
    if (nights <= 5) {
      nearbyCitiesInstruction = `
NEARBY CITIES: The traveller wants nearby suggestions.
Trip is ${nights} nights — focus primarily on the main destination.
At the END of the itinerary (final day or practical tips), add a short section:
"If you have extra time: [1-2 nearby cities within 1-2 hours, with transport time and why worth visiting]"
Do NOT dedicate full days to nearby cities for a short trip.`;
    } else if (nights <= 10) {
      nearbyCitiesInstruction = `
NEARBY CITIES: The traveller wants nearby suggestions. Trip is ${nights} nights.
After covering the main destination thoroughly (first 4-5 days minimum), include 1 nearby city:
- Dedicate 1-2 days to it in the itinerary
- Include specific transport: how to get there, journey time, cost
- Explain what makes it worth the side trip
- Return to main city or continue journey from there`;
    } else {
      nearbyCitiesInstruction = `
NEARBY CITIES: The traveller wants nearby suggestions. Trip is ${nights} nights — this is a long trip.
After covering the main destination (first 5-6 days), include 2-3 nearby cities or regions:
- Dedicate 2-3 days to each nearby destination
- Include specific transport details (train/bus/car, journey time, cost in ${currency})
- Each nearby city should have its own mini-itinerary with morning/afternoon/evening
- Include hotel recommendations for each city
- The nearby cities should flow logically (circular route or linear progression)`;
    }
  } else {
    nearbyCitiesInstruction = `
NEARBY CITIES: The traveller does NOT want nearby city suggestions.
Focus entirely on the specified destination(s). Do not suggest day trips to other cities.`;
  }

  const prompt = `You are an expert luxury travel planner with intimate local knowledge of every destination worldwide. You know the hidden gems, the best local restaurants, the most efficient routes, and the insider tips that make a trip truly memorable.

Create an exceptionally detailed, warm, and personalised day-by-day itinerary. Write like a knowledgeable friend who has lived in each city — specific, warm, and genuinely helpful.

TRIP DETAILS:
- From: ${origin}
- To: ${destination}
- Departure: ${departDate}
- Return: ${returnDate}
- Duration: ${nights} nights
- Total Budget: ${budget} ${currency} (${currSymbol})
- Travel Class: ${travelClass}
- Currency for all prices: ${currency} (${currSymbol})

TRAVELLERS (${totalPax} total):
- Adults: ${adults}
- Children: ${children}${hasChildren ? ` (ages: ${childAges || 'not specified'})` : ''}
- Infants: ${infants}${hasInfants ? ' — needs baby-friendly venues, cots, changing facilities' : ''}
- Seniors: ${seniors}${hasSeniors ? ` (ages: ${seniorAges || 'not specified'}) — needs accessible venues, comfortable pace, step-free routes` : ''}

PREFERENCES:
- Accommodation: ${accommodationLevel} level, ${accommodationType} type, ${accommodationLocation} location
- Daily pace: ${pace}
- Travel styles: ${Array.isArray(travelStyle) ? travelStyle.join(', ') : travelStyle || 'General'}
- Purpose: ${purpose || 'Holiday'}
- Dietary: ${dietary}
- Previous visits: ${hasVisited}
- Local transport: ${localTransport}
- Crowd preference: ${crowdPreference}
- Shopping: ${shoppingFocus}
- Flight preference: ${flightPreference}

${anchors && anchors.length > 0 ? `
FIXED COMMITMENTS — plan everything around these:
${anchors.map(a => `- ${a.date}${a.nights ? ` (${a.nights} nights)` : ''} | ${a.city} | ${a.type} | ${a.notes}`).join('\n')}
` : ''}

${specialRequests ? `SPECIAL REQUESTS (high priority): ${specialRequests}` : ''}

${nearbyCitiesInstruction}

VISITED BEFORE GUIDANCE:
${hasVisited === 'never' ? '- First time visitor: include iconic must-see attractions but explain what makes each special beyond the obvious' : ''}
${hasVisited === 'once' ? '- Been once: skip the most obvious tourist spots, go one layer deeper — lesser-known neighbourhoods, local restaurants, second-tier attractions that are just as rewarding' : ''}
${hasVisited === 'multiple' ? '- Multiple visits: avoid all tourist trails entirely. Focus on hyper-local experiences, niche museums, neighbourhood markets, off-the-beaten-path areas that even many locals overlook' : ''}

QUALITY STANDARDS — every day must meet these:

1. MORNING/AFTERNOON/EVENING: 4-6 sentences each with:
   - Specific venue/neighbourhood names and why each is special
   - Best time to arrive, what to look for, insider knowledge
   - Practical details (transport, booking needed, dress code)
   ${hasChildren ? '   - Child-friendly aspects for kids' : ''}
   ${hasSeniors ? '   - Accessibility and pace notes for seniors' : ''}

2. MEALS — exactly 2 options per meal:
   Format: "Option 1: [Name] ([neighbourhood]) — [2 sentences on atmosphere, signature dishes, price range ${currSymbol}]. Option 2: [Name] — [description]"
   - Real restaurant names that exist
   - Match dietary requirement: ${dietary}
   ${hasChildren ? '   - At least one child-friendly option per meal' : ''}

3. TIPS: 2-3 specific actionable tips per day including transport cards, booking links, timing, money-saving advice

4. HOTELS: 3 real hotels per city matching ${accommodationLevel} level:
   - Explain specifically why each suits ${totalPax} people for ${purpose}
   - Include neighbourhood and walking distance to key attractions
   - Price in ${currSymbol} per night

5. FOOD HIGHLIGHTS: 8-10 items, each with specific restaurant name

6. PRACTICAL TIPS: 10-12 highly specific tips including transport apps, payment advice, cultural etiquette, booking requirements
   ${hasChildren ? '   - Include family-specific tips (stroller access, kid hours, family discounts)' : ''}
   ${hasSeniors ? '   - Include senior-friendly access and discount information' : ''}

7. BUDGET: Calculate for ${totalPax} people total return trip in ${currency}:
   - Flights: ${travelClass} for ${adults} adult(s) + ${children} child(ren) return
   - Accommodation: ${accommodationLevel} for ${nights} nights
   - Food: realistic daily budget × ${nights} days × ${totalPax} people
   - Activities and transport costs
   All amounts in ${currency}

CRITICAL JSON RULES — you MUST follow these exactly:
- Output ONLY valid JSON, no markdown, no explanation, no code fences
- Do NOT use apostrophes (') in any string value — use (') or rewrite without them
- Do NOT use unescaped double quotes inside string values
- Do NOT use line breaks inside string values — write everything on one line per field
- Do NOT add trailing commas after the last item in arrays or objects
- Keep all string values simple and clean

RESPOND WITH VALID JSON ONLY:

{
  "summary": "4-5 warm specific sentences about what makes this trip special for this group",
  "days": [
    {
      "day": 1,
      "date": "YYYY-MM-DD",
      "city": "City Name",
      "title": "Evocative specific day theme",
      "morning": "4-6 sentence description with specific venues and insider tips",
      "afternoon": "4-6 sentence description",
      "evening": "4-6 sentence description",
      "meals": {
        "breakfast": "Option 1: [Name] ([area]) — [description, price ${currSymbol}]. Option 2: [Name] — [description]",
        "lunch": "Option 1: [Name] ([area]) — [description]. Option 2: [Name] — [description]",
        "dinner": "Option 1: [Name] ([area]) — [description]. Option 2: [Name] — [description]"
      },
      "tips": "Tip 1: [specific]. Tip 2: [transport/booking]. Tip 3: [insider]",
      "estimatedCost": 0
    }
  ],
  "hotels": [
    {
      "city": "City Name",
      "recommendations": [
        {
          "name": "Exact Hotel Name",
          "level": "${accommodationLevel}",
          "pricePerNight": 0,
          "currency": "${currency}",
          "location": "Neighbourhood — X min walk to [key attraction]",
          "whyRecommended": "2-3 sentences specific to this group's needs"
        }
      ]
    }
  ],
  "foodHighlights": [
    "Dish at Restaurant (Neighbourhood) — why unmissable"
  ],
  "practicalTips": [
    "Specific actionable tip with all details"
  ],
  "affiliateRecommendations": {
    "activities": {
      "title": "Book Activities & Skip the Queue",
      "description": "Pre-book to guarantee entry and avoid long waits",
      "platforms": [
        {"name": "Klook", "url": "${affiliates.klook}", "description": "Best for Asia activities, theme parks and day tours"},
        {"name": "Tiqets", "url": "${affiliates.tiqets}", "description": "Instant mobile tickets for museums and attractions"},
        {"name": "WeGoTrip", "url": "${affiliates.wegotrip}", "description": "Self-guided audio tours with entry tickets included"}
      ]
    },
    "airportTransfers": {
      "title": "Airport Transfers",
      "description": "Door-to-door with professional drivers — no taxi queues",
      "platforms": [
        {"name": "Welcome Pickups", "url": "${affiliates.welcomePickups}", "description": "Fixed prices, meet & greet, available worldwide"},
        {"name": "Kiwitaxi", "url": "${affiliates.kiwitaxi}", "description": "Transfers in 100+ countries, various vehicle types"}
      ]
    },
    "esim": {
      "title": "Stay Connected — Travel eSIM",
      "description": "Avoid expensive roaming — activate before you fly",
      "platforms": [
        {"name": "Airalo", "url": "${affiliates.airalo}", "description": "World's largest eSIM store — data in 200+ countries"},
        {"name": "Yesim", "url": "${affiliates.yesim}", "description": "Premium Swiss eSIM with global coverage"}
      ]
    },
    "insurance": {
      "title": "Travel Insurance",
      "description": "Travel with peace of mind",
      "platforms": [
        {"name": "EKTA Insurance", "url": "${affiliates.ekta}", "description": "Comprehensive cover with fast online claims"}
      ]
    },
    "flightProtection": {
      "title": "Flight Delay Compensation",
      "description": "Free to check — claim up to €600 if your flight is disrupted",
      "platforms": [
        {"name": "AirHelp", "url": "${affiliates.airhelp}", "description": "Largest flight compensation service worldwide"},
        {"name": "Compensair", "url": "${affiliates.compensair}", "description": "Fast compensation for delayed or cancelled flights"}
      ]
    }${localTransport && localTransport.toLowerCase().includes('rental') ? `,
    "carRental": {
      "title": "Car Rental",
      "description": "Best rates from local and international companies",
      "platforms": [
        {"name": "GetRentacar", "url": "${affiliates.getRentacar}", "description": "Compare 800+ car rental companies worldwide"}
      ]
    }` : ''}${anchors && anchors.some(a => a.type && (a.type.toLowerCase().includes('concert') || a.type.toLowerCase().includes('show') || a.type.toLowerCase().includes('event'))) ? `,
    "events": {
      "title": "Event & Concert Tickets",
      "description": "Find and book tickets for live events worldwide",
      "platforms": [
        {"name": "TicketNetwork", "url": "${affiliates.ticketNetwork}", "description": "Official tickets for concerts, sports and theatre"}
      ]
    }` : ''}
  },
  "budgetBreakdown": {
    "flights": 0,
    "accommodation": 0,
    "food": 0,
    "activities": 0,
    "transport": 0,
    "total": 0,
    "currency": "${currency}"
  }
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        stream: true,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(500).json({ error: err.error?.message || 'Claude API error' });
    }

    // Set streaming headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Transfer-Encoding', 'chunked');

    // Read Claude SSE stream and accumulate full text
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let sseBuffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      sseBuffer += decoder.decode(value, { stream: true });
      const lines = sseBuffer.split('\n');
      sseBuffer = lines.pop() || ''; // keep incomplete line

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          // Claude streaming event types
          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
            fullText += parsed.delta.text || '';
          } else if (parsed.type === 'message_delta' && parsed.usage) {
            // Message complete signal
          }
        } catch(_) {}
      }
    }

    // Parse the complete JSON response
    let itinerary;
    try {
      const clean = cleanJSON(fullText);
      itinerary = JSON.parse(clean);
    } catch (parseErr) {
      // Log what we got for debugging
      console.error('JSON parse error:', parseErr.message);
      console.error('fullText length:', fullText.length);
      console.error('fullText end:', fullText.slice(-200));
      throw new Error('Could not parse itinerary: ' + parseErr.message);
    }

    // Send final result - simple data line for easy parsing
    res.write('data: ' + JSON.stringify({ success: true, itinerary }) + '\n\n');
    res.end();

  } catch (error) {
    if (!res.headersSent) {
      return res.status(500).json({ error: error.message });
    }
    res.write('data: ' + JSON.stringify({ error: error.message }) + '\n\n');
    res.end();
  }
}
