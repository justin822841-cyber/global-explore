export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { origin, destination, date, adults, children, infants } = req.body;

  if (!origin || !destination || !date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const token = process.env.AVIASALES_TOKEN;
  const marker = process.env.AVIASALES_MARKER;

  // Search ±3 days around the requested date
  const dates = getDateRange(date, 3);
  
  try {
    const results = await Promise.all(
      dates.map(d => searchFlights({
        origin,
        destination,
        date: d,
        adults: adults || 1,
        children: children || 0,
        infants: infants || 0,
        token,
        marker
      }))
    );

    const allFlights = results
      .flat()
      .filter(Boolean)
      .sort((a, b) => a.price - b.price);

    return res.status(200).json({
      success: true,
      flights: allFlights,
      cheapest: allFlights[0] || null
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

function getDateRange(dateStr, days) {
  const base = new Date(dateStr);
  const range = [];
  for (let i = -days; i <= days; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    range.push(d.toISOString().split('T')[0]);
  }
  return range;
}

async function searchFlights({ origin, destination, date, adults, children, infants, token, marker }) {
  const params = new URLSearchParams({
    origin,
    destination,
    depart_date: date,
    adults,
    children,
    infants,
    currency: 'AUD',
    token
  });

  const response = await fetch(
    `https://api.travelpayouts.com/v1/prices/cheap?${params}`,
    {
      headers: {
        'X-Access-Token': token
      }
    }
  );

  if (!response.ok) return [];

  const data = await response.json();
  
  if (!data.success || !data.data) return [];

  return Object.entries(data.data).map(([airline, flights]) =>
    Object.entries(flights).map(([, flight]) => ({
      airline,
      date,
      price: flight.price,
      departure: flight.departure_at,
      return: flight.return_at,
      transfers: flight.transfers,
      direct: flight.transfers === 0,
      link: `https://www.aviasales.com/search/${origin}${date.replace(/-/g,'')}${destination}1?marker=${marker}`
    }))
  ).flat();
}
