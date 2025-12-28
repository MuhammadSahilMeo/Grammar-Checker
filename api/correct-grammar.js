export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    const MODEL_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent?key=${API_KEY}`;
    
    const prompt = `Correct the grammar, punctuation, and sentence structure of the following text while keeping its meaning the same. Return only the corrected version:\n\n${text}`;

    const response = await fetch(MODEL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });

    const data = await response.json();
    
    if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      const correctedText = data.candidates[0].content.parts[0].text.trim();
      res.json({ correctedText });
    } else {
      throw new Error("Unexpected Gemini API response.");
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: 'Failed to correct grammar' });
  }
}