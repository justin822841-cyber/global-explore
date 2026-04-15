export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    origin, destination, departDate, returnDate,
    adults = 1, children = 0, infants = 0, seniors = 0,
    childAges = '', seniorAges = '',
    currency = 'AUD',
    lang = 'en',
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

  const prompt = `You are an expert travel planner with deep local knowledge of every destination worldwide. Create a warm, personalised, practical travel itinerary in PLAIN TEXT using the exact section markers below. Do NOT output JSON. Do NOT use markdown.

TRIP: ${origin} to ${destination} | ${departDate} to ${returnDate} | ${nights} nights
TRAVELLERS: ${adults} adults${hasChildren ? `, ${children} children (ages: ${childAges})` : ''}${hasInfants ? `, ${infants} infants` : ''}${hasSeniors ? `, ${seniors} seniors (ages: ${seniorAges})` : ''} | Total: ${totalPax} people
BUDGET: ${budget} ${currency} | CLASS: ${travelClass} | ACCOMMODATION: ${accommodationLevel} ${accommodationType} preferred
STYLE: ${Array.isArray(travelStyle) ? travelStyle.join(', ') : travelStyle} | PACE: ${pace} | PURPOSE: ${purpose}
DIETARY: ${dietary} | LOCAL TRANSPORT: ${localTransport} | VISITED BEFORE: ${hasVisited}
${anchors && anchors.length > 0 ? `FIXED COMMITMENTS (plan everything around these): ${anchors.map(a => `${a.date} in ${a.city} | type: ${a.type} | notes: ${a.notes} | nights: ${a.nights}`).join(' || ')}` : 'No fixed commitments'}
${specialRequests ? `SPECIAL REQUESTS (high priority): ${specialRequests}` : ''}

${nearbyCitiesInstruction}
VISITED GUIDANCE: ${visitedNote}
CURRENCY: All prices in ${currency} (${currSym})
${hasChildren ? `FAMILY NOTE: Include child-friendly options. Children ages: ${childAges}` : ''}
${hasSeniors ? `SENIORS NOTE: Include accessible venues, comfortable pace, senior discounts` : ''}

FLIGHT & ARRIVAL INTELLIGENCE:
Research the typical flight duration and most common departure/arrival times for ${origin} to ${destination}.
For Day 1 (arrival day), provide FOUR arrival scenarios. This is very important — travellers do not know their exact arrival time when planning.
Format Day 1 with these four arrival scenarios clearly labelled.

TRAVEL DAY RULES:
- Day 1 is ARRIVAL DAY: traveller has been flying. Never plan full sightseeing. Always gentle and practical.
- Any day involving city transfer (flights or long drives between anchor points): account for transit time first, only plan activities after accounting for travel.
- Last day (${returnDate}): morning only, allow 3 hours for international airport check-in.
- When anchors involve travel between cities, note the transport: flight/train/drive, duration, cost in ${currency}.

OUTPUT LANGUAGE: ${lang === 'zh' ? 
  'Write ALL content in Simplified Chinese (简体中文). Every word of every description, tip, meal recommendation, event, and analysis must be in Chinese. Restaurant names should include Chinese translation in brackets. Keep place names in original language followed by Chinese in brackets.' 
  : 'Write all content in English.'}

OUTPUT FORMAT — use these EXACT markers, one per line, no extra punctuation:

###SUMMARY###
3-4 sentences covering ALL cities visited, key highlights, and what makes this trip special for this specific group.

###DAY###
NUMBER: 1
DATE: ${departDate}
CITY: ${destination.replace(/\s*\([A-Z]+\)/, '').trim().split(',')[0].trim()}
TITLE: Arrival Day — Welcome to [City]
MORNING: [2 sentences for scenario: if arriving before noon — suggest 1 gentle activity near hotel after check-in]
AFTERNOON: [2 sentences for scenario: if arriving 12:00-15:00 — suggest 1 easy nearby activity, light lunch]
EVENING: [2 sentences for scenario: if arriving 15:00-18:00 — suggest short neighbourhood walk + nearby dinner]
LATE_ARRIVAL: [2 sentences for scenario: if arriving after 18:00 — hotel check-in, find nearby dinner, rest and recover]
TYPICAL_ARRIVAL: [1 sentence stating the most common arrival time window for ${origin} to ${destination} flights, e.g. "Most flights from Melbourne to Los Angeles arrive between 06:00-10:00 local time after a 15-hour overnight journey."]
BREAKFAST: Option 1: [near hotel, easy, no reservation needed] — [description]. Option 2: [hotel breakfast or nearby cafe]
LUNCH: Option 1: [casual, walkable from hotel] — [description]. Option 2: [quick easy option]
DINNER: Option 1: [relaxed, nearby, no late night] — [description]. Option 2: [hotel restaurant or delivery option]
TIPS: Tip 1: [jet lag recovery advice specific to this timezone change]. Tip 2: [how to get from airport to hotel with cost in ${currency}]
EVENTS: [Use web search to find 2-3 REAL events happening in ${destination.replace(/\s*\([A-Z]+\)/, '').trim()} during ${departDate} to ${returnDate}. Include actual event names, real dates, and booking websites. If no major events found, list 2 iconic regular experiences. Format: Event name (specific dates) — description — website]
COST: [estimated daily cost per person in ${currency}, number only]

[Repeat ###DAY### for each remaining day — NOT Day 1 format, use standard format below]

STANDARD DAY FORMAT (Day 2 onwards):
###DAY###
NUMBER: [day number]
DATE: [YYYY-MM-DD]
CITY: [city name]
TITLE: [evocative specific day title]
MORNING: [2 sentences — specific venue, what to do, insider tip]
AFTERNOON: [2 sentences — specific venue, what to do]
EVENING: [2 sentences — atmosphere, what to do, where to go]
BREAKFAST: Option 1: [Name] ([area]) — [description, approx price ${currSym}/person]. Option 2: [Name] — [description]
LUNCH: Option 1: [Name] ([area]) — [description]. Option 2: [Name] — [description]
DINNER: Option 1: [Name] ([area]) — [description]. Option 2: [Name] — [description]
TIPS: Tip 1: [transport or booking tip]. Tip 2: [money-saving or timing tip]
COST: [number only]

###HOTELS###
CITY: [city name]
NAME: [exact hotel name]
LEVEL: ${accommodationLevel}
PRICE: [number only, per night in ${currency}]
LOCATION: [neighbourhood — X min walk to key attraction]
WHY: [2 sentences specific to this group's needs and purpose]
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
YOUR_DATES: [1-2 sentences: are the travel dates low/typical/peak for ${origin} to ${destination} and why. Use web search to check for any major events during ${departDate} to ${returnDate} that affect prices]
LOW: [which months/periods have cheapest fares on this route and why]
TYPICAL: [normal pricing periods for this route]
PEAK: [most expensive periods — use web search to find: (1) school holiday dates for ${origin.match(/\(([A-Z]{3})\)/)?.[1]||origin} country in ${new Date(departDate).getFullYear()}, (2) major global events like World Cup/Olympics/major concerts near ${departDate} to ${returnDate}, (3) destination public holidays. List specific events and dates found]
CALENDAR: [generate 30 days starting 15 days before ${departDate}. Format: YYYY-MM-DD:level. Base on real school holidays, public holidays, and major events found via web search]

###FOOD###
[Name] at [Restaurant] ([Neighbourhood]) — [one sentence why unmissable]
[5 items total]

###TIPS###
[One specific actionable tip per line]
[6 tips total — transport apps, payment, cultural etiquette, booking, safety, family-specific if applicable]

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
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search'
          }
        ],
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
          // Handle text delta
          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
            fullText += parsed.delta.text || '';
          }
          // Handle tool result text (web search results incorporated into response)
          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'input_json_delta') {
            // tool input being built — ignore
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
  const calendarRaw = getField(text, 'CALENDAR');
  const calendar = {};
  if (calendarRaw) {
    calendarRaw.split(',').forEach(entry => {
      const [date, level] = entry.trim().split(':');
      if (date && level) calendar[date.trim()] = level.trim().toLowerCase();
    });
  }
  return {
    yourDates: getField(text, 'YOUR_DATES'),
    low:       getField(text, 'LOW'),
    typical:   getField(text, 'TYPICAL'),
    peak:      getField(text, 'PEAK'),
    calendar,
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
    const dayNum = parseInt(getField(block, 'NUMBER')) || (i + 1);
    const isArrivalDay = dayNum === 1;
    return {
      day:            dayNum,
      date:           getField(block, 'DATE'),
      city:           getField(block, 'CITY'),
      title:          getField(block, 'TITLE'),
      morning:        getField(block, 'MORNING'),
      afternoon:      getField(block, 'AFTERNOON'),
      evening:        getField(block, 'EVENING'),
      lateArrival:    isArrivalDay ? getField(block, 'LATE_ARRIVAL') : '',
      typicalArrival: isArrivalDay ? getField(block, 'TYPICAL_ARRIVAL') : '',
      isArrivalDay,
      meals,
      tips:           getField(block, 'TIPS'),
      events:         getField(block, 'EVENTS'),
      estimatedCost:  parseFloat(getField(block, 'COST')) || 0,
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
