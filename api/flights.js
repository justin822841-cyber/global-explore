export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    origin,
    destination,
    date,
    adults = 1,
    children = 0,
    infants = 0,
    travelClass = 'Economy',
    currency = 'AUD'
  } = req.body;

  if (!origin || !destination || !date) {
    return res.status(400).json({ error: 'Missing required fields: origin, destination, date' });
  }

  const token  = process.env.AVIASALES_TOKEN;
  const marker = process.env.AVIASALES_MARKER || '717078';

  if (!token) {
    return res.status(500).json({ error: 'Missing AVIASALES_TOKEN' });
  }

  const classCodes = {
    'Economy': 0, 'economy': 0,
    'Premium Economy': 1, 'premium': 1,
    'Business': 2, 'business': 2,
    'First Class': 3, 'first': 3,
  };
  const tripClass = classCodes[travelClass] ?? 0;
  const classUrlMap = { 0:'Y', 1:'W', 2:'C', 3:'F' };
  const classUrlCode = classUrlMap[tripClass] || 'Y';

  const dates = buildDateRange(date, 15);
  const allFares = [];

  await Promise.allSettled(
    dates.map(async (d) => {
      try {
        const url = new URL('https://api.travelpayouts.com/v1/prices/calendar');
        url.searchParams.set('origin',      origin.toUpperCase());
        url.searchParams.set('destination', destination.toUpperCase());
        url.searchParams.set('depart_date', d);
        url.searchParams.set('currency',    currency);
        url.searchParams.set('trip_class',  String(tripClass));
        url.searchParams.set('token',       token);

        const response = await fetch(url.toString(), {
          headers: { 'X-Access-Token': token },
          signal: AbortSignal.timeout(8000)
        });

        if (!response.ok) return;
        const json = await response.json();
        if (!json.success || !json.data) return;

        Object.values(json.data).forEach(entry => {
          if (!entry.price) return;
          const dateFormatted = d.replace(/-/g, '');
          allFares.push({
            date:      d,
            price:     entry.price,
            airline:   entry.airline || '',
            transfers: entry.transfers ?? 1,
            direct:    (entry.transfers ?? 1) === 0,
            currency,
            travelClass,
            link: buildAviasalesLink(origin, destination, dateFormatted, adults, children, infants, classUrlCode, marker),
          });
        });
      } catch (_) {}
    })
  );

  if (allFares.length === 0) {
    return res.status(200).json({
      success: true,
      message: 'No cached fares found. Click search to see live prices.',
      flights: [], calendar: {}, top5: [], cheapest: null,
      searchLink: buildAviasalesLink(origin, destination, date.replace(/-/g,''), adults, children, infants, classUrlCode, marker),
      requested_date: date, currency, travelClass,
    });
  }

  const calendarMap = {};
  allFares.forEach(f => {
    if (!calendarMap[f.date] || calendarMap[f.date].price > f.price) {
      calendarMap[f.date] = f;
    }
  });

  const top5 = Object.values(calendarMap)
    .sort((a, b) => a.price - b.price)
    .slice(0, 5);

  return res.status(200).json({
    success: true,
    flights: allFares,
    calendar: calendarMap,
    top5,
    cheapest: top5[0] || null,
    requested_date: date,
    currency,
    travelClass,
    totalPassengers: Number(adults) + Number(children),
  });
}

function buildDateRange(baseDate, days) {
  const base = new Date(baseDate);
  const result = [];
  const today = new Date();
  for (let i = -days; i <= days; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    if (d < today) continue;
    result.push(d.toISOString().split('T')[0]);
  }
  return result;
}

function buildAviasalesLink(origin, dest, dateStr, adults, children, infants, classCode, marker) {
  const base = `https://www.aviasales.com/search/${origin.toUpperCase()}${dateStr}${dest.toUpperCase()}${adults}`;
  const params = new URLSearchParams({ marker });
  if (Number(children) > 0) params.set('children', String(children));
  if (Number(infants)  > 0) params.set('infants',  String(infants));
  if (classCode !== 'Y')    params.set('class',     classCode);
  return `${base}?${params.toString()}`;
}
