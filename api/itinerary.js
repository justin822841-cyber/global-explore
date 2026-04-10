export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    origin, destination, departDate, returnDate,
    adults, children, infants, seniors,
    budget, flightPreference, travelClass,
    accommodationLevel, accommodationType, accommodationLocation,
    travelStyle, pace, purpose, dietary,
    hasVisited, localTransport, crowdPreference,
    shoppingFocus, nearbyCity, childAges, seniorAges,
    anchors, specialRequests
  } = req.body;

  if (!origin || !destination) {
    return res.status(400).json({ error: 'Missing origin or destination' });
  }

  // Calculate number of nights
  const nights = departDate && returnDate
    ? Math.max(1, Math.round((new Date(returnDate) - new Date(departDate)) / (1000 * 60 * 60 * 24)))
    : 7;

  // Determine if family trip
  const hasChildren = (parseInt(children) || 0) > 0;
  const hasInfants  = (parseInt(infants)  || 0) > 0;
  const hasSeniors  = (parseInt(seniors)  || 0) > 0;
  const totalPax    = (parseInt(adults) || 1) + (parseInt(children) || 0);

  // Affiliate base URLs with Travelpayouts marker
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
    aviasales:      `https://www.aviasales.com/?marker=${MARKER}`,
    compensair:     `https://compensair.com/?ref=${MARKER}`,
  };

  const prompt = `You are an expert luxury travel planner with deep local knowledge of every destination worldwide. You know the hidden gems, the best local restaurants, the most efficient transport routes, and the insider tips that make a trip truly memorable.

Create an exceptionally detailed, warm, and personalised day-by-day itinerary. Write like a knowledgeable friend who has lived in each city — not a generic travel guide.

TRIP DETAILS:
- Origin: ${origin}
- Destination(s): ${destination}
- Departure: ${departDate}
- Return: ${returnDate}
- Duration: ${nights} nights
- Total Budget: ${budget} AUD
- Travel Class: ${travelClass || 'Economy'}

TRAVELLERS:
- Adults: ${adults || 1}
- Children: ${children || 0}${hasChildren ? ' (ages: ' + (childAges || 'not specified') + ')' : ''}
- Infants: ${infants || 0}${hasInfants ? ' — needs pram-friendly venues and baby facilities' : ''}
- Seniors: ${seniors || 0}${hasSeniors ? ' (ages: ' + (seniorAges || 'not specified') + ') — needs accessible venues and comfortable pace' : ''}
- Total travellers: ${totalPax}

PREFERENCES:
- Flight preference: ${flightPreference || 'Best value'}
- Accommodation level: ${accommodationLevel || 'Comfort'}
- Accommodation type: ${accommodationType || 'No preference'}
- Preferred location: ${accommodationLocation || 'No preference'}
- Daily pace: ${pace || 'Balanced'}
- Travel styles: ${Array.isArray(travelStyle) ? travelStyle.join(', ') : travelStyle || 'General sightseeing'}
- Trip purpose: ${purpose || 'Holiday'}
- Dietary requirements: ${dietary || 'No restrictions'}
- Previous visits: ${hasVisited || 'First time'}
- Local transport: ${localTransport || 'Public transport'}
- Crowd preference: ${crowdPreference || 'Mix'}
- Shopping focus: ${shoppingFocus || 'Not a priority'}
- Nearby city suggestions: ${nearbyCity || 'No'}

${anchors && anchors.length > 0 ? `
FIXED COMMITMENTS — you MUST plan everything around these anchor points:
${anchors.map(a => `- DATE: ${a.date} | CITY: ${a.city} | TYPE: ${a.type} | NOTES: ${a.notes}${a.days ? ' | STAYING: ' + a.days + ' days' : ''}`).join('\n')}
` : ''}

${specialRequests ? `SPECIAL REQUESTS (treat these as high priority): ${specialRequests}` : ''}

QUALITY REQUIREMENTS — every day must meet these standards:

1. MORNING/AFTERNOON/EVENING: Each must be 4-6 sentences minimum. Include:
   - Specific venue/neighbourhood names
   - What makes this place special or unique
   - Best time to arrive and why
   - A local tip most tourists don't know
   ${hasChildren ? '- Child-friendly aspect or activity for kids' : ''}
   ${hasSeniors ? '- Accessibility note or pace consideration' : ''}

2. MEALS: Give exactly 2 options per meal:
   - Format: "Option 1: [Restaurant Name] ([neighbourhood]) — [2 sentence description of atmosphere, signature dish, price range]. Option 2: [Restaurant Name] — [description]"
   - Include actual restaurant names, not generic descriptions
   - Match dietary requirements: ${dietary}
   - ${hasChildren ? 'At least one option per meal should be family/child-friendly' : ''}

3. TIPS: Give 2-3 specific, actionable tips per day:
   - Transport card names, booking links, reservation requirements
   - Time-specific advice (e.g. "arrive before 9am to avoid queues")
   - Money-saving tips relevant to the budget level
   - Safety or cultural etiquette notes where relevant

4. HOTELS: For each city, recommend exactly 3 hotels that genuinely match the accommodation level (${accommodationLevel}):
   - Must be real hotels that exist
   - Explain specifically why each suits THIS group (${totalPax} people, ${purpose})
   - Include the neighbourhood and walking distance to key attractions
   - Realistic price range in AUD per night

5. FOOD HIGHLIGHTS: 8-10 items, each with specific restaurant and 1-sentence description of why it's unmissable

6. PRACTICAL TIPS: 10-12 highly specific tips including:
   - Local transport app names
   - Currency/payment advice
   - Cultural etiquette
   - ${hasChildren ? 'Family-specific tips (stroller access, baby facilities, kid-friendly hours)' : ''}
   - ${hasSeniors ? 'Senior-friendly access tips' : ''}
   - Booking requirements for popular attractions
   - Best apps to download

7. BUDGET BREAKDOWN: Calculate for ${totalPax} people total (round trip):
   - Flights: based on ${travelClass || 'Economy'} class for ${adults || 1} adults + ${children || 0} children
   - Accommodation: based on ${accommodationLevel} level for ${nights} nights
   - Food: realistic daily food budget × ${nights} days × ${totalPax} people
   - Activities: estimated costs for typical activities
   - Transport: local transport for ${nights} days
   - Total: sum of all above
   - Make sure budget is realistic for ${travelClass || 'Economy'} class and ${accommodationLevel} accommodation

RESPOND WITH VALID JSON ONLY. No markdown, no explanation, just the JSON object:

{
  "summary": "4-5 warm, specific sentences describing what makes this particular trip special for this group. Mention specific highlights they will experience.",
  "days": [
    {
      "day": 1,
      "date": "YYYY-MM-DD",
      "city": "City Name",
      "title": "Evocative, specific day theme (not generic like Day 1)",
      "morning": "4-6 sentence detailed description with specific venues, insider tips, and what makes each place special",
      "afternoon": "4-6 sentence detailed description",
      "evening": "4-6 sentence detailed description",
      "meals": {
        "breakfast": "Option 1: [Name] ([area]) — [description, atmosphere, price range]. Option 2: [Name] — [description]",
        "lunch": "Option 1: [Name] ([area]) — [description]. Option 2: [Name] — [description]",
        "dinner": "Option 1: [Name] ([area]) — [description, why special]. Option 2: [Name] — [description]"
      },
      "tips": "Tip 1: [specific actionable advice]. Tip 2: [transport/booking/timing advice]. Tip 3: [local insider tip]",
      "estimatedCost": 150
    }
  ],
  "hotels": [
    {
      "city": "City Name",
      "recommendations": [
        {
          "name": "Exact Hotel Name",
          "level": "${accommodationLevel}",
          "pricePerNight": 200,
          "location": "Specific neighbourhood — [X] min walk to [key attraction]",
          "whyRecommended": "2-3 sentences specifically about why this hotel suits ${totalPax} travellers doing ${purpose}",
          "bookingSearch": "https://www.agoda.com/search?city=CITY&checkIn=${departDate}&checkOut=${returnDate}&adults=${adults || 1}&children=${children || 0}&lang=en-us"
        }
      ]
    }
  ],
  "foodHighlights": [
    "Dish Name at Restaurant Name (Neighbourhood) — one sentence on why this is unmissable"
  ],
  "practicalTips": [
    "Specific actionable tip with all necessary details"
  ],
  "affiliateRecommendations": {
    "activities": {
      "title": "Book Activities & Attractions",
      "description": "Save time and skip queues by booking in advance",
      "platforms": [
        {"name": "Klook", "url": "${affiliates.klook}", "description": "Best for Asia activities, theme parks and day tours"},
        {"name": "Tiqets", "url": "${affiliates.tiqets}", "description": "Instant mobile tickets for museums and attractions"},
        {"name": "WeGoTrip", "url": "${affiliates.wegotrip}", "description": "Self-guided audio tours with entry tickets included"}
      ]
    },
    "airportTransfers": {
      "title": "Airport Transfers",
      "description": "Reliable door-to-door transfers",
      "platforms": [
        {"name": "Welcome Pickups", "url": "${affiliates.welcomePickups}", "description": "Professional drivers, fixed prices, meet & greet"},
        {"name": "Kiwitaxi", "url": "${affiliates.kiwitaxi}", "description": "Airport transfers in 100+ countries"}
      ]
    },
    "esim": {
      "title": "Stay Connected — Travel eSIM",
      "description": "Avoid expensive roaming charges",
      "platforms": [
        {"name": "Airalo", "url": "${affiliates.airalo}", "description": "World's largest eSIM store — activate before you fly"},
        {"name": "Yesim", "url": "${affiliates.yesim}", "description": "Premium eSIM with data in 200+ countries"}
      ]
    },
    "insurance": {
      "title": "Travel Insurance",
      "description": "Travel with peace of mind",
      "platforms": [
        {"name": "EKTA Insurance", "url": "${affiliates.ekta}", "description": "Comprehensive travel insurance with fast claims"}
      ]
    },
    "flightProtection": {
      "title": "Flight Delay Compensation",
      "description": "Get compensated if your flight is delayed or cancelled",
      "platforms": [
        {"name": "AirHelp", "url": "${affiliates.airhelp}", "description": "Claim up to €600 for flight delays — free to check eligibility"},
        {"name": "Compensair", "url": "${affiliates.compensair}", "description": "Fast compensation for disrupted flights"}
      ]
    }${localTransport === 'Rental car — I prefer to drive' ? `,
    "carRental": {
      "title": "Car Rental",
      "description": "Best rates from local and international companies",
      "platforms": [
        {"name": "GetRentacar", "url": "${affiliates.getRentacar}", "description": "Compare prices from 800+ car rental companies worldwide"}
      ]
    }` : ''}${anchors?.some(a => a.type?.includes('Concert') || a.type?.includes('event')) ? `,
    "events": {
      "title": "Event Tickets",
      "description": "Find tickets for concerts, sports and shows",
      "platforms": [
        {"name": "TicketNetwork", "url": "${affiliates.ticketNetwork}", "description": "Official tickets for thousands of events worldwide"}
      ]
    }` : ''}
  },
  "budgetBreakdown": {
    "flights": 0,
    "accommodation": 0,
    "food": 0,
    "activities": 0,
    "transport": 0,
    "total": 0
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
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return res.status(500).json({ error: error.message || 'Claude API error' });
    }

    const data = await response.json();
    const text = data.content[0].text;

    // Clean and parse JSON
    const clean = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    let itinerary;
    try {
      itinerary = JSON.parse(clean);
    } catch (parseErr) {
      // Try to extract JSON from response
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) {
        itinerary = JSON.parse(match[0]);
      } else {
        throw new Error('Could not parse itinerary response');
      }
    }

    return res.status(200).json({
      success: true,
      itinerary
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
