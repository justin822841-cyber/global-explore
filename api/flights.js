export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { origin, destination, date, adults, children, infants } = req.body;

  if (!origin || !destination || !date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const token = process.env.AVIASALES_TOKEN;

  // Generate ±3 days date range
  const dates = getDateRange(date, 3);

  try {
    const allResults = [];

    for (const d of dates) {
      const params = new URLSearchParams({
        origin,
        destination,
        depart_date: d,
        one_way: true,
        currency: 'AUD',
        sorting: 'price',
        adults: adults || 1,
        children: children || 0,
        infants: infants || 0,
        limit: 3,
        token
      });

      const response = await fetch(
        `https://api.travelpayouts.com/v1/prices/calendar?${params}`,
        {
          headers: { 'X-Access-Token': token }
        }
      );

      if (!response.ok) continue;

      const data = await response.json();

      if (data.success && data.data) {
        Object.values(data.data).forEach(flight => {
          allResults.push({
            date: d,
            price: flight.price,
            airline: flight.airline,
            transfers: flight.transfers,
            direct: flight.transfers === 0,
            departure: flight.departure_at,
            duration: flight.duration,
            link: `https://www.aviasales.com/search/${origin}${d.replace(/-/g,'')}${destination}1?marker=${process.env.AVIASALES_MARKER}`
          });
        });
      }
    }

    // Sort by price
    allResults.sort((a, b) => a.price - b.price);

    // Group by date for calendar view
    const calendar = {};
    allResults.forEach(f => {
      if (!calendar[f.date] || calendar[f.date].price > f.price) {
        calendar[f.date] = f;
      }
    });

    return res.status(200).json({
      success: true,
      flights: allResults,
      calendar,
      cheapest: allResults[0] || null,
      requested_date: date
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
