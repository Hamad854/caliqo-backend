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
You are an expert food nutrition AI for a mobile app.
Analyze the image and identify ONLY visible food items.
For each item:
- Use common English name as "label"
- Give confidence score (0.0 to 1.0)
- Estimate realistic macros per typical serving: protein_g, carbs_g, fat_g (in grams)
- Estimate calories (kcal) for that serving
- Add typical serving size description (e.g. "150g", "1 cup")
Do NOT explain anything. Do NOT add extra text or markdown.
If confidence is low (<0.7), still include the item.
Return ONLY valid JSON matching the schema below.
`;

  const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-3-flash-preview";  // Latest Gemini 3 Flash (preview as of Jan 2026)

  try {
    const apiResponse = await fetch(
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
            temperature: 0.2,  // Balanced for realistic estimates + consistency
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
                      calories: { type: "NUMBER" },
                      protein_g: { type: "NUMBER" },
                      carbs_g: { type: "NUMBER" },
                      fat_g: { type: "NUMBER" },
                      serving_size: { type: "STRING" }
                    },
                    required: ["label", "confidence", "calories", "protein_g", "carbs_g", "fat_g", "serving_size"]
                  }
                }
              },
              required: ["items"]
            }
          }
        })
      }
    );

    if (!apiResponse.ok) {
      const errData = await apiResponse.json();
      console.error("Gemini API Error:", errData);
      throw new Error(`Gemini API error: ${apiResponse.status} - ${JSON.stringify(errData)}`);
    }

    const data = await apiResponse.json();

    // Optional: Log for debugging (remove in production)
    console.log("Gemini Response:", JSON.stringify(data, null, 2));

    return res.status(200).json(data);
  } catch (err) {
    console.error("Handler Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
