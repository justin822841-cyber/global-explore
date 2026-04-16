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
    specialRequests = '', anchors = [],
    returnCity = ''
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


  // Pre-compute dynamic content depth based on trip length
  let contentDepthNote, morningFmt, afternoonFmt, eveningFmt, mealFmt, tipsFmt;

  if (nights <= 14) {
    contentDepthNote = 'CONTENT DEPTH: FULL — 2 sentences per time slot, 2 meal options per meal, 2 tips per day';
    morningFmt   = 'MORNING: [2 sentences — specific venue, what to do, insider tip]';
    afternoonFmt = 'AFTERNOON: [2 sentences — specific venue, what to do]';
    eveningFmt   = 'EVENING: [2 sentences — atmosphere, what to do, where to go]';
    mealFmt      = 'BREAKFAST: Option 1: [Name] ([area]) — [description, price ' + currSym + '/person]. Option 2: [Name] — [description]\nLUNCH: Option 1: [Name] ([area]) — [description]. Option 2: [Name] — [description]\nDINNER: Option 1: [Name] ([area]) — [description]. Option 2: [Name] — [description]';
    tipsFmt      = 'TIPS: Tip 1: [transport or booking tip]. Tip 2: [money-saving or timing tip]';
  } else if (nights <= 20) {
    contentDepthNote = 'CONTENT DEPTH: STANDARD — 2 sentences per time slot, 1 meal option per meal, 1 tip per day';
    morningFmt   = 'MORNING: [2 sentences — specific venue and what to do]';
    afternoonFmt = 'AFTERNOON: [2 sentences — specific venue and what to do]';
    eveningFmt   = 'EVENING: [2 sentences — where to go and what to do]';
    mealFmt      = 'BREAKFAST: [Name] ([area]) — [description, price ' + currSym + '/person]\nLUNCH: [Name] ([area]) — [description]\nDINNER: [Name] ([area]) — [description]';
    tipsFmt      = 'TIPS: [1 practical tip]';
  } else if (nights <= 30) {
    contentDepthNote = 'CONTENT DEPTH: COMPACT — 1 sentence per time slot, breakfast and dinner only, 1 tip per day';
    morningFmt   = 'MORNING: [1 sentence — specific venue and activity]';
    afternoonFmt = 'AFTERNOON: [1 sentence — specific venue and activity]';
    eveningFmt   = 'EVENING: [1 sentence — dinner area and atmosphere]';
    mealFmt      = 'BREAKFAST: [Name] ([area]) — [brief description]\nDINNER: [Name] ([area]) — [brief description]';
    tipsFmt      = 'TIPS: [1 short tip]';
  } else {
    contentDepthNote = 'CONTENT DEPTH: BRIEF — 1 short sentence per time slot, breakfast only, 1 tip per day';
    morningFmt   = 'MORNING: [1 short sentence covering morning and afternoon combined]';
    afternoonFmt = 'AFTERNOON: [1 short sentence]';
    eveningFmt   = 'EVENING: [1 short sentence covering evening and dinner]';
    mealFmt      = 'BREAKFAST: [Name] — [one brief description]';
    tipsFmt      = 'TIPS: [1 short tip]';
  }

  const langInstruction = lang === 'zh'
    ? 'Write ALL content in Simplified Chinese (简体中文). Every word of every description, tip, meal recommendation, event, and analysis must be in Chinese. Restaurant names should include Chinese translation in brackets. Keep place names in original language followed by Chinese in brackets.'
    : 'Write all content in English.';

  const prompt = `You are an expert travel planner with deep local knowledge of every destination worldwide. Create a warm, personalised, practical travel itinerary in PLAIN TEXT using the exact section markers below. Do NOT output JSON. Do NOT use markdown.

TRIP: ${origin} to ${destination} | ${departDate} to ${returnDate} | ${nights} nights
RETURN FLIGHT FROM: ${returnCity && returnCity !== destination ? returnCity.replace(/\s*\([A-Z]+\)/, '').trim() : destination.replace(/\s*\([A-Z]+\)/, '').trim().split(',')[0].trim()} back to ${origin}
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

TRAVEL DAY RULES — follow these precisely:

1. DAY 1 (ARRIVAL DAY from ${origin}):
   Research typical ${origin} to ${destination} flight duration and common arrival times.
   Provide 4 arrival scenarios (morning/midday/afternoon/evening) as instructed in the format below.
   Never plan full sightseeing on arrival day.

2. CITY TRANSFER DAYS (any day travelling between cities mid-trip):
   When the itinerary moves from one city to another (e.g. LA to Houston, or any anchor point requiring travel):
   - MORNING of that day: describe checking out of hotel, transport to airport/station, and flight/train details
     Example: "Check out by 10:00, rideshare to LAX (45 min, A$55). Fly [City A] to [City B] — approx [X] hours flight, departs around [typical time]. Allow 2 hours for domestic check-in or 3 hours for international."
   - AFTERNOON/EVENING: plan activities only AFTER accounting for arrival time in the new city
     If flight takes 3+ hours, only plan gentle activities for the remainder of the day
   - Always state: departure city, transport method, journey time, estimated cost in ${currency}, arrival city
   - Never plan a full day of sightseeing on a transfer day

3. LAST DAY (${returnDate}):
   - The return flight departs from: ${returnCity && returnCity !== destination ? returnCity.replace(/\s*\([A-Z]+\)/, '').trim() : destination.replace(/\s*\([A-Z]+\)/, '').trim().split(',')[0].trim()}
   - If this is different from other cities visited, ensure the itinerary brings the traveller back to this city BEFORE the last day
   - MORNING: gentle final activity near the departure city, breakfast, pack and check out
   - AFTERNOON: transfer to airport — allow 3 hours before international departure, state rideshare cost
   - EVENING: on the plane back to ${origin}
   - MEALS: still provide breakfast and lunch options (airport dining), dinner = in-flight meal
   - TIPS: airport check-in timing and duty-free tips

4. ANCHOR POINT TRAVEL DAYS:
   For each anchor in the itinerary that requires travel from the previous city:
   - The day of arrival at the anchor city must follow rule 2 above
   - Account for check-in time at anchor hotel
   - Only schedule anchor commitment AFTER arrival and check-in if timing allows

OUTPUT LANGUAGE: ${langInstruction}

HOTEL REFERENCE RULE — follow precisely:
- In daily itinerary descriptions, ALWAYS say "your hotel" — never mention a specific hotel name
- All days except Day 1: just say "your hotel" with no extra details
- The ###HOTELS### section provides full recommendations separately

DAY 1 ARRIVAL FORMAT — use this two-paragraph structure in EVERY arrival scenario:

Paragraph 1 (completely generic — do NOT mention any specific street, landmark or location near the hotel):
"Check into your hotel and take some time to settle in and freshen up after your long journey. Spend the rest of the day gently exploring your immediate surroundings at a relaxed pace — a short neighbourhood walk, a nearby café, or simply resting at the hotel to recover from the flight and prepare for tomorrow."

Paragraph 2 (our recommendation, on a new line, clearly separated):
"— Our ${accommodationLevel} recommendation: [Hotel Name] — [one sentence: location benefit and one standout feature specific to this group's needs]"

Example:
"Check into your hotel and take some time to settle in and freshen up after your long journey. Spend the rest of the day gently exploring your immediate surroundings at a relaxed pace — a short neighbourhood walk, a nearby café, or simply resting at the hotel to recover from the flight and prepare for tomorrow.

— Our Luxury recommendation: The Beverly Hills Hotel — iconic pink palace 5 min walk to Rodeo Drive, with the legendary Polo Lounge downstairs perfect for a relaxed first dinner."

IMPORTANT: Paragraph 1 must work for ANY hotel in ANY city. Never assume location. Keep two paragraphs clearly separated.

CRITICAL MARKER RULE: ALL section markers and field labels (###DAY###, NUMBER:, DATE:, CITY:, MORNING:, AFTERNOON:, EVENING:, LATE_ARRIVAL:, TYPICAL_ARRIVAL:, TIPS:, EVENTS:, COST:, NAME:, PRICE:, LOCATION:, WHY:, LEVEL:, YOUR_DATES:, LOW:, TYPICAL:, PEAK:, CALENDAR:, FLIGHTS:, ACCOMMODATION:, FOOD:, ACTIVITIES:, TRANSPORT:, TOTAL:, BREAKFAST:, LUNCH:, DINNER:) MUST ALWAYS be written in ENGLISH regardless of output language. Only the VALUES after the colon should be in Chinese when Chinese is selected.

OUTPUT FORMAT — use these EXACT markers, one per line, no extra punctuation:

###SUMMARY###
3-4 sentences covering ONLY the cities that actually appear in the itinerary below. 
STRICT RULE: Do NOT mention any city not explicitly in the day-by-day plan.
The cities in this trip are: ${destination.replace(/\s*\([A-Z]+\)/,'').trim()}${anchors && anchors.length > 0 ? ' and ' + [...new Set(anchors.map(a => a.city))].join(', ') : ''}.
Cover key highlights and what makes this trip special for this specific group.

###BUDGET###
Calculate realistic estimates in ${currency} for ALL ${totalPax} travellers for the ENTIRE trip.
Use these formulas strictly:
FLIGHTS: estimated per-person ${travelClass} fare × ${totalPax} people × 2 (return)
ACCOMMODATION: estimated nightly rate × ${nights} nights (NOT multiplied by people)
FOOD: realistic daily spend per person × ${nights} days × ${totalPax} people
ACTIVITIES: entry fees + tours for ${totalPax} people over ${nights} days
TRANSPORT: local transport + airport transfers for ${totalPax} people
TOTAL: sum of all above

CRITICAL OUTPUT RULE: Each line must contain ONLY a plain integer. No symbols, no commas, no text after the number.
FLIGHTS: [integer only]
ACCOMMODATION: [integer only]
FOOD: [integer only]
ACTIVITIES: [integer only]
TRANSPORT: [integer only]
TOTAL: [integer only]
###FLIGHTPRICE###
YOUR_DATES: [IMPORTANT: This field label must stay as "YOUR_DATES:" even in Chinese output]
Write ONLY these 3 points in ${lang === 'zh' ? 'Chinese' : 'English'}. Do NOT start with an introductory sentence about "analysing dates":
1. Origin school holidays: exact dates for ${origin} country/state near the travel window
2. Destination school holidays: exact break dates for ${destination} area near the travel window
3. One-sentence conclusion: low/typical/peak season and roughly how much more expensive vs shoulder season (%)
Start directly with point 1. No preamble.
LOW: [which months/periods have cheapest fares on this route and why]
TYPICAL: [normal pricing periods for this route]
PEAK: [most expensive periods — include: school holiday dates for both countries (be specific about months), peak summer/winter seasons, major public holidays. Note that periods coinciding with major international sporting events hosted at the destination (Olympics, FIFA World Cup, etc.) also see significant price spikes — mention this as a general pattern without specifying exact event dates]
CALENDAR: [OUTPUT EXACTLY 30 date:level pairs, comma-separated, on a SINGLE LINE, NO spaces anywhere]
Format: YYYY-MM-DD:level,YYYY-MM-DD:level,...
Level must be: low OR typical OR peak
Start date: 15 days before ${departDate}
Example: 2026-06-01:typical,2026-06-02:low,2026-06-03:peak,2026-06-04:typical,2026-06-05:low
WRONG: "2026-06-01: typical" (space after colon)
WRONG: "typical 2026-06-02" (wrong order)
WRONG: putting multiple entries on separate lines

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
EVENTS: [List 2-3 notable events, sports seasons, festivals or experiences in ${destination.replace(/\s*\([A-Z]+\)/, '').trim()} during ${departDate} to ${returnDate}. Include any major known events (World Cup, Olympics, major festivals) plus regular iconic experiences. Format: Event name (dates if known) — description — booking website]
COST: [estimated daily cost per person in ${currency}, number only]

[Repeat ###DAY### for each remaining day — NOT Day 1 format, use standard format below]

STANDARD DAY FORMAT (Day 2 onwards):
${contentDepthNote}

###DAY###
NUMBER: [day number]
DATE: [YYYY-MM-DD]
CITY: [city name]
TITLE: [evocative specific day title]
${morningFmt}
${afternoonFmt}
${eveningFmt}
${mealFmt}
${tipsFmt}
COST: [number only]

###FOOD###
[MUST provide exactly 5 items. Format each on its own line:]
[Dish name] at [Restaurant name] ([Neighbourhood]) — [one sentence why unmissable]
[Dish name] at [Restaurant name] ([Neighbourhood]) — [one sentence why unmissable]
[Dish name] at [Restaurant name] ([Neighbourhood]) — [one sentence why unmissable]
[Dish name] at [Restaurant name] ([Neighbourhood]) — [one sentence why unmissable]
[Dish name] at [Restaurant name] ([Neighbourhood]) — [one sentence why unmissable]

###TIPS###
[One specific actionable tip per line]
[6 tips total — transport apps, payment, cultural etiquette, booking, safety, family-specific if applicable]
`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 10000,
        stream: true,

        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
              cache_control: { type: 'ephemeral' }
            }
          ]
        }]
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
    const itinerary = parsePlainText(sanitizedText, affiliates, localTransport, anchors, currency, lang);

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
    // Extract all YYYY-MM-DD:level patterns from anywhere in the string
    const pattern = /(\d{4}-\d{2}-\d{2})\s*[:]\s*(low|typical|peak)/gi;
    let match;
    while ((match = pattern.exec(calendarRaw)) !== null) {
      const date = match[1].trim();
      const level = match[2].trim().toLowerCase();
      if (['low','typical','peak'].includes(level)) {
        calendar[date] = level;
      }
    }
  }
  return {
    yourDates: getField(text, 'YOUR_DATES'),
    low:       getField(text, 'LOW'),
    typical:   getField(text, 'TYPICAL'),
    peak:      getField(text, 'PEAK'),
    calendar,
  };
}

function parsePlainText(text, affiliates, localTransport, anchors, currency, lang) {
  const sections = splitSections(text);

  return {
    summary:    sections.SUMMARY || '',
    days:       parseDays(sections.DAYS || []),
    hotels:     parseHotels(sections.HOTELS || ''),
    foodHighlights: parseList(sections.FOOD || ''),
    practicalTips:  parseList(sections.TIPS || ''),
    budgetBreakdown: parseBudget(sections.BUDGET || '', currency),
    flightPriceAnalysis: parseFlightPrice(sections.FLIGHTPRICE || ''),
    affiliateRecommendations: buildAffiliates(affiliates, localTransport, anchors, lang),
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
      const priceRaw = getField(h, 'PRICE') || '';
      const price = parseFloat(priceRaw.replace(/[^0-9.]/g, '')) || 0;
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
  if (!text) return { flights:0, accommodation:0, food:0, activities:0, transport:0, total:0, currency };

  // Extract first number found on same line as key (very aggressive)
  function extractNum(t, ...keys) {
    for (const key of keys) {
      // Try exact field match first
      const lines = t.split('\n');
      for (const line of lines) {
        const lineLower = line.toLowerCase();
        const keyLower = key.toLowerCase();
        if (lineLower.includes(keyLower + ':') || lineLower.startsWith(keyLower)) {
          // Extract all numbers from this line
          const nums = line.match(/\d[\d,.]*/g);
          if (nums) {
            for (const n of nums) {
              const val = parseFloat(n.replace(/,/g, ''));
              if (val >= 100) return val; // budget values should be at least 100
            }
          }
        }
      }
    }
    return 0;
  }

  const flights       = extractNum(text, 'FLIGHTS', 'flights', '机票', 'Flight');
  const accommodation = extractNum(text, 'ACCOMMODATION', 'accommodation', '住宿', 'Hotel', 'Accommodation');
  const food          = extractNum(text, 'FOOD', 'food', '餐饮', '饮食', 'Dining', 'Meals');
  const activities    = extractNum(text, 'ACTIVITIES', 'activities', '活动', 'Activity', 'Entertainment');
  const transport     = extractNum(text, 'TRANSPORT', 'transport', '交通', 'Transportation');
  const totalRaw      = extractNum(text, 'TOTAL', 'total', '总计', '合计', 'Total');
  const total         = totalRaw || (flights + accommodation + food + activities + transport);

  return { flights, accommodation, food, activities, transport, total, currency };
}

function buildAffiliates(affiliates, localTransport, anchors, lang) {
  const isZh = lang === 'zh';
  const hasCarRental = localTransport && localTransport.toLowerCase().includes('rental');
  const hasEvent = anchors && anchors.some(a => a.type && (a.type.toLowerCase().includes('concert') || a.type.toLowerCase().includes('show')));

  return {
    activities: {
      title: isZh ? '预订活动 & 跳过排队' : 'Book Activities & Skip the Queue',
      description: isZh ? '提前预订保证入场，避免长时间等待' : 'Pre-book to guarantee entry and avoid long waits',
      platforms: [
        { name: 'Klook',    url: affiliates.klook,    description: isZh ? '亚洲活动、主题公园和一日游首选' : 'Best for Asia activities, theme parks and day tours' },
        { name: 'Tiqets',   url: affiliates.tiqets,   description: isZh ? '博物馆和景点即时手机票' : 'Instant mobile tickets for museums and attractions' },
        { name: 'WeGoTrip', url: affiliates.wegotrip, description: isZh ? '含门票的自助语音导览' : 'Self-guided audio tours with entry tickets included' },
      ]
    },
    airportTransfers: {
      title: isZh ? '机场接送服务' : 'Airport Transfers',
      description: isZh ? '专业司机点对点接送，无需排队等出租车' : 'Door-to-door with professional drivers — no taxi queues',
      platforms: [
        { name: 'Welcome Pickups', url: affiliates.welcomePickups, description: isZh ? '固定价格，接机举牌，全球服务' : 'Fixed prices, meet & greet, available worldwide' },
        { name: 'Kiwitaxi',        url: affiliates.kiwitaxi,       description: isZh ? '100+国家接送，多种车型可选' : 'Transfers in 100+ countries, various vehicle types' },
      ]
    },
    esim: {
      title: isZh ? '保持网络畅通 — 旅行eSIM' : 'Stay Connected — Travel eSIM',
      description: isZh ? '避免昂贵漫游费，登机前激活' : 'Avoid expensive roaming — activate before you fly',
      platforms: [
        { name: 'Airalo', url: affiliates.airalo, description: isZh ? '全球最大eSIM商店，覆盖200+国家' : 'World largest eSIM store — data in 200+ countries' },
        { name: 'Yesim',  url: affiliates.yesim,  description: isZh ? '瑞士优质eSIM，全球覆盖' : 'Premium Swiss eSIM with global coverage' },
      ]
    },
    insurance: {
      title: isZh ? '旅行保险' : 'Travel Insurance',
      description: isZh ? '安心出行，全程保障' : 'Travel with peace of mind',
      platforms: [
        { name: 'EKTA Insurance', url: affiliates.ekta, description: isZh ? '全面保障，快速在线理赔' : 'Comprehensive cover with fast online claims' },
      ]
    },
    flightProtection: {
      title: isZh ? '航班延误赔偿' : 'Flight Delay Compensation',
      description: isZh ? '免费查询，航班受影响最高赔600欧元' : 'Free to check — claim up to EUR600 if your flight is disrupted',
      platforms: [
        { name: 'AirHelp',    url: affiliates.airhelp,    description: isZh ? '全球最大航班赔偿服务' : 'Largest flight compensation service worldwide' },
        { name: 'Compensair', url: affiliates.compensair, description: isZh ? '快速处理延误和取消航班赔偿' : 'Fast compensation for delayed or cancelled flights' },
      ]
    },
    ...(hasCarRental ? { carRental: {
      title: isZh ? '租车服务' : 'Car Rental',
      description: isZh ? '比较本地和国际公司的最优价格' : 'Best rates from local and international companies',
      platforms: [{ name: 'GetRentacar', url: affiliates.getRentacar, description: isZh ? '对比全球800+租车公司' : 'Compare 800+ car rental companies worldwide' }]
    }} : {}),
    ...(hasEvent ? { events: {
      title: isZh ? '活动与演唱会门票' : 'Event & Concert Tickets',
      description: isZh ? '全球现场活动门票预订' : 'Find and book tickets for live events worldwide',
      platforms: [{ name: 'TicketNetwork', url: affiliates.ticketNetwork, description: isZh ? '演唱会、体育和剧院官方门票' : 'Official tickets for concerts, sports and theatre' }]
    }} : {}),
  };
}
