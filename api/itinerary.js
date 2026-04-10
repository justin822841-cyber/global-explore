export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    origin, destination, departDate, returnDate,
    adults, children, infants, seniors,
    budget, flightPreference, accommodationLevel,
    travelStyle, pace, purpose, dietary,
    hasVisited, localTransport, crowdPreference,
    anchors, specialRequests
  } = req.body;

  const prompt = `You are an expert travel planner. Create a detailed, personalised day-by-day itinerary based on the following information:

TRIP DETAILS:
- Origin: ${origin}
- Destination: ${destination}
- Departure: ${departDate}
- Return: ${returnDate}
- Budget: ${budget} AUD total

TRAVELLERS:
- Adults: ${adults || 1}
- Children: ${children || 0}
- Infants: ${infants || 0}
- Seniors: ${seniors || 0}

PREFERENCES:
- Flight preference: ${flightPreference}
- Accommodation level: ${accommodationLevel}
- Travel pace: ${pace}
- Travel style: ${travelStyle?.join(', ')}
- Trip purpose: ${purpose}
- Dietary requirements: ${dietary}
- Has visited before: ${hasVisited}
- Local transport preference: ${localTransport}
- Crowd preference: ${crowdPreference}

${anchors && anchors.length > 0 ? `FIXED COMMITMENTS (plan around these):
${anchors.map(a => `- ${a.date}: ${a.type} in ${a.city} — ${a.notes}`).join('\n')}` : ''}

${specialRequests ? `SPECIAL REQUESTS: ${specialRequests}` : ''}

Please provide:
1. A complete day-by-day itinerary
2. 3 hotel recommendations per city with approximate price range
3. Must-try local food recommendations based on dietary requirements
4. Practical tips specific to this group's needs
5. Estimated daily budget breakdown

Format your response as JSON with this structure:
{
  "summary": "Brief trip overview",
  "days": [
    {
      "day": 1,
      "date": "YYYY-MM-DD",
      "city": "City name",
      "title": "Day theme",
      "morning": "Morning activities",
      "afternoon": "Afternoon activities", 
      "evening": "Evening activities",
      "meals": {
        "breakfast": "Recommendation",
        "lunch": "Recommendation",
        "dinner": "Recommendation"
      },
      "tips": "Practical tips for this day",
      "estimatedCost": 0
    }
  ],
  "hotels": [
    {
      "city": "City name",
      "recommendations": [
        {
          "name": "Hotel name",
          "level": "Budget/Comfort/Superior/Luxury",
          "pricePerNight": 0,
          "location": "Area description",
          "whyRecommended": "Reason",
          "bookingSearch": "https://www.agoda.com/search?city=CITYNAME&checkIn=CHECKIN&checkOut=CHECKOUT"
        }
      ]
    }
  ],
  "foodHighlights": ["Local dish 1", "Local dish 2"],
  "practicalTips": ["Tip 1", "Tip 2"],
  "budgetBreakdown": {
    "flights": 0,
    "accommodation": 0,
    "food": 0,
    "activities": 0,
    "transport": 0,
    "total": 0
  }
}

Respond with valid JSON only, no other text.`;

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
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return res.status(500).json({ error: error.message });
    }

    const data = await response.json();
    const text = data.content[0].text;
    
    // Parse JSON response
    const clean = text.replace(/```json|```/g, '').trim();
    const itinerary = JSON.parse(clean);

    return res.status(200).json({
      success: true,
      itinerary
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
