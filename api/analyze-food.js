import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  const { base64Image } = req.body;

  if (!base64Image) {
    return res.status(400).json({ error: "base64Image missing" });
  }

const prompt = `
You are an AI food recognition engine used by a mobile nutrition app.
Rules:
- Identify only visible food items
- Do NOT estimate calories or macros
- Do NOT explain anything
- Return ONLY valid JSON
- Do NOT include any markdown, code blocks, or extra text
Format (strict JSON):
{
  "items": [
    { "label": "Food name", "confidence": 0.0 }
  ]
}
`;

const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  try {
    const response = await fetch(
   `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: "image/jpeg",
                    data: base64Image
                  }
                }
              ]
            }
          ],
          generationConfig: {
          response_mime_type: "application/json"   // <--- Yeh add karo (sabse important)
          // Optional: temperature low rakh sakte ho for consistency
          // temperature: 0.2,
        }
        })
      }
    );
if (!response.ok) {
    const errData = await response.json();
    throw new Error(`API error: ${response.status} - ${JSON.stringify(errData)}`);
  }
    const data = await response.json();
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
