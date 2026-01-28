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
- Identify only visible food items from the image.
- For each item, estimate approximate macros per typical serving (in grams for protein, carbs, fat).
- Use realistic estimates based on common knowledge (do NOT say zero unless truly zero).
- Do NOT explain anything or add extra text.
- Return ONLY valid JSON (no markdown, no code blocks, no extra characters).
- If confidence low, still include but set confidence < 0.6.
Strict JSON format:
{
  "items": [
    {
      "label": "Common food name",
      "confidence": 0.0,
      "protein_g": 0.0,
      "carbs_g": 0.0,
      "fat_g": 0.0
    }
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
          response_mime_type: "application/json",
          response_schema: {
    type: "OBJECT",
    properties: {
      items: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            label: { type: "STRING" },
            confidence: { type: "NUMBER" },
            protein_g: { type: "NUMBER" },
            carbs_g: { type: "NUMBER" },
            fat_g: { type: "NUMBER" }
          },
          required: ["label", "confidence", "protein_g", "carbs_g", "fat_g"]
        }
      }
    },
    required: ["items"]
  },
  temperature: 0.1  // low for consistency
            
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
