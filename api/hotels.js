export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { hotelName, city, checkIn, checkOut } = req.body;

  if (!city || !checkIn || !checkOut) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Step 1: Search for hotel to get hotel_key
    const searchResponse = await fetch(
      `https://data.xotelo.com/api/list?location=${encodeURIComponent(city + ' ' + hotelName)}&limit=3`
    );

    if (!searchResponse.ok) {
      return res.status(500).json({ error: 'Hotel search failed' });
    }

    const searchData = await searchResponse.json();

    if (!searchData.result || searchData.result.length === 0) {
      return res.status(200).json({ 
        success: false, 
        message: 'No hotels found',
        hotels: [] 
      });
    }

    // Step 2: Get prices for each hotel found
    const hotelPrices = await Promise.all(
      searchData.result.slice(0, 3).map(async (hotel) => {
        try {
          const priceResponse = await fetch(
            `https://data.xotelo.com/api/rates?hotel_key=${hotel.key}&chk_in=${checkIn}&chk_out=${checkOut}`
          );

          if (!priceResponse.ok) return { ...hotel, rates: [] };

          const priceData = await priceResponse.json();

          const rates = priceData.result?.rates
            ?.filter(r => r.rate > 0)
            ?.sort((a, b) => a.rate - b.rate) || [];

          return {
            name: hotel.name,
            key: hotel.key,
            location: hotel.location_string,
            rating: hotel.rating,
            rates,
            cheapest: rates[0] || null
          };
        } catch {
          return { name: hotel.name, rates: [] };
        }
      })
    );

    return res.status(200).json({
      success: true,
      hotels: hotelPrices
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
