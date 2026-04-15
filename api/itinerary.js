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

  const totalPax = parseInt(adults) + parseInt(children);
  const hasChildren = parseInt(children) > 0;
  const hasInfants  = parseInt(infants)  > 0;
  const hasSeniors  = parseInt(seniors)  > 0;

  const currencySymbols = {
    AUD:'A$', USD:'$', GBP:'£', EUR:'€', CNY:'¥',
    SGD:'S$', JPY:'¥', HKD:'HK$', CAD:'C$', NZD:'NZ$'
  };
  const currSym = currencySymbols[currency] || currency;

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

  // Nearby cities logic
  let nearbyCitiesInstruction = '';
  const wantsNearby = nearbyCity && nearbyCity.toLowerCase().includes('yes');
  if (wantsNearby) {
    if (nights <= 5) {
      nearbyCitiesInstruction = `NEARBY: Trip is ${nights} nights. At the end of PRACTICAL TIPS, add 1-2 nearby city suggestions with transport time only.`;
    } else if (nights <= 10) {
      nearbyCitiesInstruction = `NEARBY: Trip is ${nights} nights. Include 1 nearby city as a DAY section with transport details.`;
    } else {
      nearbyCitiesInstruction = `NEARBY: Trip is ${nights} nights. Include 2-3 nearby cities as DAY sections with transport and mini-itinerary.`;
    }
  } else {
    nearbyCitiesInstruction = `NEARBY: Focus only on ${destination}. No nearby city suggestions.`;
  }

  const visitedNote = hasVisited === 'never'
    ? 'First visit: include iconic highlights and explain what makes each special.'
    : hasVisited === 'once'
    ? 'Been once: skip obvious tourist spots, go deeper into local neighbourhoods and second-tier attractions.'
    : 'Multiple visits: avoid all tourist trails, focus on hyper-local experiences and hidden gems only.';

  const prompt = `You are an expert travel planner. Create a detailed, warm, personalised travel itinerary in PLAIN TEXT using the exact section markers below. Do NOT output JSON. Do NOT use quotes around values.

TRIP: ${origin} to ${destination} | ${departDate} to ${returnDate} | ${nights} nights
TRAVELLERS: ${adults} adults${hasChildren ? `, ${children} children (${childAges})` : ''}${hasInfants ? `, ${infants} infants` : ''}${hasSeniors ? `, ${seniors} seniors (${seniorAges})` : ''} | Total: ${totalPax}
BUDGET: ${budget} ${currency} | CLASS: ${travelClass} | ACCOMMODATION: ${accommodationLevel} ${accommodationType}
STYLE: ${Array.isArray(travelStyle) ? travelStyle.join(', ') : travelStyle} | PACE: ${pace} | PURPOSE: ${purpose}
DIETARY: ${dietary} | TRANSPORT: ${localTransport} | VISITED: ${hasVisited}
${anchors && anchors.length > 0 ? `FIXED PLANS: ${anchors.map(a => `${a.date} ${a.city} (${a.type}) ${a.notes}`).join(' | ')}` : ''}
${specialRequests ? `SPECIAL: ${specialRequests}` : ''}
${nearbyCitiesInstruction}
VISITED GUIDANCE: ${visitedNote}
CURRENCY: Always show prices in ${currency} (${currSym})
${hasChildren ? 'FAMILY: Include child-friendly options for every activity and meal.' : ''}
${hasSeniors ? 'SENIORS: Include accessible venues and comfortable pace.' : ''}

OUTPUT FORMAT — use these exact markers, one per line:

###SUMMARY###
Write 3-4 warm sentences about what makes this trip special for this group.

###DAY###
NUMBER: 1
DATE: ${departDate}
CITY: [city name]
TITLE: [evocative day title]
MORNING: [2-3 sentences — specific venues, insider tips, what to see/do]
AFTERNOON: [2-3 sentences — specific venues, insider tips]
EVENING: [2-3 sentences — specific venues, atmosphere, what to do]
BREAKFAST: Option 1: [Restaurant name] ([area]) — [description, price ${currSym}]. Option 2: [Restaurant name] — [description]
LUNCH: Option 1: [Restaurant name] ([area]) — [description]. Option 2: [Restaurant name] — [description]
DINNER: Option 1: [Restaurant name] ([area]) — [description]. Option 2: [Restaurant name] — [description]
TIPS: [2-3 specific tips: transport cards, booking advice, timing, money-saving]
COST: [estimated daily cost per person in ${currency}, number only]
EVENTS: [For Day 1 ONLY: list 2-4 must-see local events, sports games, concerts, shows, or festivals happening during the trip dates in this city. Format: Event name (date/timing) — brief description — where to book. If none known, list 2 iconic regular experiences like NBA games, Broadway shows, local festivals]

[Repeat ###DAY### section for each day of the trip — EVENTS field only needed for Day 1]

###HOTELS###
CITY: [city name]
NAME: [exact hotel name]
LEVEL: ${accommodationLevel}
PRICE: [price per night in ${currency}, number only]
LOCATION: [neighbourhood — X min walk to main attraction]
WHY: [2 sentences why this suits this specific group]
---
NAME: [second hotel]
PRICE: [number only]
LOCATION: [neighbourhood]
WHY: [2 sentences]
---
NAME: [third hotel]
PRICE: [number only]
LOCATION: [neighbourhood]
WHY: [2 sentences]

###FLIGHTPRICE###
YOUR_DATES: [Describe whether the travel dates fall in low/typical/peak season and why in 1-2 sentences]
LOW: [Describe what months/periods have cheapest flights on this route and why — school holidays, off-peak season etc]
TYPICAL: [Describe normal/shoulder season periods for this route]
PEAK: [Describe most expensive periods — school holidays, major events, festivals, sports seasons that affect this route. Mention any major events like World Cup, Olympics, major concerts if relevant]

###FOOD###
[Dish name] at [Restaurant] ([Neighbourhood]) — [one sentence why unmissable]
[Repeat for 6-8 items]

###TIPS###
[One specific, actionable tip per line — transport apps, payment, cultural etiquette, booking, safety]
[Write 8-10 tips, one per line]

###BUDGET###
FLIGHTS: [number only in ${currency}]
ACCOMMODATION: [number only]
FOOD: [number only]
ACTIVITIES: [number only]
TRANSPORT: [number only]
TOTAL: [number only]`;

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
        max_tokens: 10000,
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

    // Accumulate full text from Claude SSE stream
    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText  = '';
    let sseBuffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      sseBuffer += decoder.decode(value, { stream: true });
      const lines = sseBuffer.split('\n');
      sseBuffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
            fullText += parsed.delta.text || '';
          }
        } catch(_) {}
      }
    }

    // Pre-process: fix smart quotes that could cause issues
    const sanitizedText = fullText
      .replace(/\u2018|\u2019/g, "'")
      .replace(/\u201C|\u201D/g, '"')
      .replace(/\u2026/g, '...')
      .replace(/\u2013|\u2014/g, '-');

    // Parse plain text into structured JSON
    const itinerary = parsePlainText(sanitizedText, affiliates, localTransport, anchors, currency);

    // Send result
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

// ── PLAIN TEXT PARSER ──

function parseFlightPrice(text) {
  if (!text) return null;
  return {
    yourDates: getField(text, 'YOUR_DATES'),
    low:       getField(text, 'LOW'),
    typical:   getField(text, 'TYPICAL'),
    peak:      getField(text, 'PEAK'),
  };
}

function parsePlainText(text, affiliates, localTransport, anchors, currency) {
  const sections = splitSections(text);

  return {
    summary:    sections.SUMMARY || '',
    days:       parseDays(sections.DAYS || []),
    hotels:     parseHotels(sections.HOTELS || ''),
    foodHighlights: parseList(sections.FOOD || ''),
    practicalTips:  parseList(sections.TIPS || ''),
    budgetBreakdown: parseBudget(sections.BUDGET || '', currency),
    flightPriceAnalysis: parseFlightPrice(sections.FLIGHTPRICE || ''),
    affiliateRecommendations: buildAffiliates(affiliates, localTransport, anchors),
  };
}

function splitSections(text) {
  const result = { DAYS: [] };
  const lines  = text.split('\n');
  let current  = null;
  let buf      = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '###SUMMARY###') {
      if (current && current !== 'DAY') flush(result, current, buf);
      current = 'SUMMARY'; buf = [];
    } else if (trimmed === '###DAY###') {
      if (current === 'DAY') result.DAYS.push(buf.join('\n'));
      else if (current) flush(result, current, buf);
      current = 'DAY'; buf = [];
    } else if (trimmed === '###HOTELS###') {
      if (current === 'DAY') result.DAYS.push(buf.join('\n'));
      else if (current) flush(result, current, buf);
      current = 'HOTELS'; buf = [];
    } else if (trimmed === '###FLIGHTPRICE###') {
      if (current === 'DAY') result.DAYS.push(buf.join('\n'));
      else if (current) flush(result, current, buf);
      current = 'FLIGHTPRICE'; buf = [];
    } else if (trimmed === '###FOOD###') {
      if (current === 'DAY') result.DAYS.push(buf.join('\n'));
      else if (current) flush(result, current, buf);
      current = 'FOOD'; buf = [];
    } else if (trimmed === '###TIPS###') {
      if (current === 'DAY') result.DAYS.push(buf.join('\n'));
      else if (current) flush(result, current, buf);
      current = 'TIPS'; buf = [];
    } else if (trimmed === '###BUDGET###') {
      if (current === 'DAY') result.DAYS.push(buf.join('\n'));
      else if (current) flush(result, current, buf);
      current = 'BUDGET'; buf = [];
    } else if (current) {
      buf.push(line);
    }
  }

  // flush last section
  if (current === 'DAY') result.DAYS.push(buf.join('\n'));
  else if (current) flush(result, current, buf);

  return result;
}

function flush(result, key, buf) {
  result[key] = buf.join('\n').trim();
}

function getField(text, key) {
  const re = new RegExp('^' + key + ':\\s*(.+)$', 'm');
  const m  = text.match(re);
  return m ? m[1].trim() : '';
}

function parseDays(dayBlocks) {
  return dayBlocks.map((block, i) => {
    const meals = {
      breakfast: getField(block, 'BREAKFAST'),
      lunch:     getField(block, 'LUNCH'),
      dinner:    getField(block, 'DINNER'),
    };
    return {
      day:       parseInt(getField(block, 'NUMBER')) || (i + 1),
      date:      getField(block, 'DATE'),
      city:      getField(block, 'CITY'),
      title:     getField(block, 'TITLE'),
      morning:   getField(block, 'MORNING'),
      afternoon: getField(block, 'AFTERNOON'),
      evening:   getField(block, 'EVENING'),
      meals,
      tips:      getField(block, 'TIPS'),
      events:    getField(block, 'EVENTS'),
      estimatedCost: parseFloat(getField(block, 'COST')) || 0,
    };
  }).filter(d => d.morning || d.title);
}

function parseHotels(text) {
  if (!text) return [];
  // Find all CITY: lines and group hotels under them
  const result = [];
  const cityBlocks = text.split(/^CITY:/m).filter(Boolean);

  for (const block of cityBlocks) {
    const lines  = block.trim().split('\n');
    const city   = lines[0].trim();
    const rest   = lines.slice(1).join('\n');
    const hotels = rest.split('---').map(h => {
      const name  = getField(h, 'NAME');
      const price = parseFloat(getField(h, 'PRICE')) || 0;
      if (!name) return null;
      return {
        name,
        level:          getField(h, 'LEVEL') || 'Comfort',
        pricePerNight:  price,
        location:       getField(h, 'LOCATION'),
        whyRecommended: getField(h, 'WHY'),
      };
    }).filter(Boolean);

    if (city && hotels.length > 0) {
      result.push({ city, recommendations: hotels });
    }
  }
  return result;
}

function parseList(text) {
  if (!text) return [];
  return text.split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));
}

function parseBudget(text, currency) {
  // Try multiple field name variations Claude might use
  function getBudgetField(t, ...keys) {
    for (const key of keys) {
      const val = parseFloat(getField(t, key));
      if (val > 0) return val;
    }
    // Also try extracting any number after the key on the same line
    for (const key of keys) {
      const re = new RegExp(key + '[^\\d]*(\\d[\\d,]*)', 'im');
      const m = t.match(re);
      if (m) {
        const val = parseFloat(m[1].replace(/,/g, ''));
        if (val > 0) return val;
      }
    }
    return 0;
  }
  const flights       = getBudgetField(text, 'FLIGHTS', 'Flight', 'Flights');
  const accommodation = getBudgetField(text, 'ACCOMMODATION', 'Accommodation', 'Hotel', 'Hotels');
  const food          = getBudgetField(text, 'FOOD', 'Food', 'Dining', 'Meals');
  const activities    = getBudgetField(text, 'ACTIVITIES', 'Activities', 'Activity', 'Entertainment');
  const transport     = getBudgetField(text, 'TRANSPORT', 'Transport', 'Transportation', 'Local transport');
  const total         = getBudgetField(text, 'TOTAL', 'Total') || (flights + accommodation + food + activities + transport);
  return { flights, accommodation, food, activities, transport, total, currency };
}

function buildAffiliates(affiliates, localTransport, anchors) {
  const hasCarRental = localTransport && localTransport.toLowerCase().includes('rental');
  const hasEvent = anchors && anchors.some(a => a.type && (a.type.toLowerCase().includes('concert') || a.type.toLowerCase().includes('show')));

  return {
    activities: {
      title: 'Book Activities & Skip the Queue',
      description: 'Pre-book to guarantee entry and avoid long waits',
      platforms: [
        { name: 'Klook',     url: affiliates.klook,    description: 'Best for Asia activities, theme parks and day tours' },
        { name: 'Tiqets',    url: affiliates.tiqets,   description: 'Instant mobile tickets for museums and attractions' },
        { name: 'WeGoTrip',  url: affiliates.wegotrip, description: 'Self-guided audio tours with entry tickets included' },
      ]
    },
    airportTransfers: {
      title: 'Airport Transfers',
      description: 'Door-to-door with professional drivers — no taxi queues',
      platforms: [
        { name: 'Welcome Pickups', url: affiliates.welcomePickups, description: 'Fixed prices, meet & greet, available worldwide' },
        { name: 'Kiwitaxi',        url: affiliates.kiwitaxi,       description: 'Transfers in 100+ countries, various vehicle types' },
      ]
    },
    esim: {
      title: 'Stay Connected — Travel eSIM',
      description: 'Avoid expensive roaming — activate before you fly',
      platforms: [
        { name: 'Airalo', url: affiliates.airalo, description: 'World largest eSIM store — data in 200+ countries' },
        { name: 'Yesim',  url: affiliates.yesim,  description: 'Premium Swiss eSIM with global coverage' },
      ]
    },
    insurance: {
      title: 'Travel Insurance',
      description: 'Travel with peace of mind',
      platforms: [
        { name: 'EKTA Insurance', url: affiliates.ekta, description: 'Comprehensive cover with fast online claims' },
      ]
    },
    flightProtection: {
      title: 'Flight Delay Compensation',
      description: 'Free to check — claim up to EUR600 if your flight is disrupted',
      platforms: [
        { name: 'AirHelp',    url: affiliates.airhelp,    description: 'Largest flight compensation service worldwide' },
        { name: 'Compensair', url: affiliates.compensair, description: 'Fast compensation for delayed or cancelled flights' },
      ]
    },
    ...(hasCarRental ? { carRental: {
      title: 'Car Rental',
      description: 'Best rates from local and international companies',
      platforms: [{ name: 'GetRentacar', url: affiliates.getRentacar, description: 'Compare 800+ car rental companies worldwide' }]
    }} : {}),
    ...(hasEvent ? { events: {
      title: 'Event & Concert Tickets',
      description: 'Find and book tickets for live events worldwide',
      platforms: [{ name: 'TicketNetwork', url: affiliates.ticketNetwork, description: 'Official tickets for concerts, sports and theatre' }]
    }} : {}),
  };
}
