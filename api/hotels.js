export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { hotelId, checkIn, checkOut } = req.body;

  if (!hotelId || !checkIn || !checkOut) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const response = await fetch(
      `https://data.xotelo.com/api/rates?hotel_key=${hotelId}&chk_in=${checkIn}&chk_out=${checkOut}`
    );

    if (!response.ok) {
      return res.status(500).json({ error: 'Hotel API error' });
    }

    const data = await response.json();

    if (data.error) {
      return res.status(400).json({ error: data.error });
    }

    // Sort by price
    const rates = data.result.rates
      .filter(r => r.rate > 0)
      .sort((a, b) => a.rate - b.rate);

    return res.status(200).json({
      success: true,
      hotel: hotelId,
      checkIn,
      checkOut,
      rates,
      cheapest: rates[0] || null
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
