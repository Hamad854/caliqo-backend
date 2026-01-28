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
You are CalAI - an expert food recognition and nutrition analysis system used by millions for accurate calorie tracking.

CRITICAL ACCURACY REQUIREMENTS:
1. VISUAL ANALYSIS FIRST: Carefully examine the image before making any determinations
2. PORTION SIZE ESTIMATION: Use visual cues (plate size, utensils, shadows, depth) to estimate realistic portions
3. STANDARD REFERENCES: Assume standard dinner plate = 25-27cm, teaspoon = 5ml, tablespoon = 15ml
4. COOKING METHOD MATTERS: Fried foods have more fat/calories than grilled; factor cooking oil/butter
5. COMMON SENSE CHECK: Does a "small cookie" really have 500 calories? Recalibrate if unrealistic

IDENTIFICATION RULES:
- Identify ALL visible food items with 100% certainty before nutritional estimation
- Use precise, common English names (e.g., "Sunny-Side Up Egg" not just "Egg")
- Include preparation method when visible (e.g., "Fried Chicken" vs "Grilled Chicken")
- For mixed dishes, break down into main components if clearly visible
- Confidence score reflects both visual clarity AND portion size certainty

NUTRITIONAL ESTIMATION PROTOCOL:
For each food item:
1. Determine exact portion from visual cues (compare to hand size, plate proportions, standard serving sizes)
2. serving_size format: "quantity + unit + (weight in grams)" 
   Examples: "1 large egg (50g)", "1 cup cooked (195g)", "150g portion", "1 slice (30g)"
3. Use USDA FoodData Central or equivalent accurate nutritional databases
4. Calculate macros for THAT SPECIFIC PORTION (not per 100g)
5. Round sensibly: calories to nearest 5, macros to 1 decimal place
6. Verify: Do protein + carbs + fat calories roughly equal total calories? (protein/carbs = 4 cal/g, fat = 9 cal/g)

COMMON FOOD STANDARDS (for reference):
- Large egg (50g): ~72 cal, 6.3g protein, 0.4g carbs, 4.8g fat
- White bread slice (30g): ~80 cal, 2.5g protein, 15g carbs, 1g fat
- Banana medium (118g): ~105 cal, 1.3g protein, 27g carbs, 0.4g fat
- Chicken breast grilled (100g): ~165 cal, 31g protein, 0g carbs, 3.6g fat
- White rice cooked (158g cup): ~205 cal, 4.3g protein, 45g carbs, 0.4g fat

QUALITY CONTROL:
- Minimum confidence 0.60 to include (lower than 0.60 = too uncertain, exclude it)
- If multiple similar items visible (e.g., 3 cookies), list as one item with adjusted portion
- For liquids in glasses/cups, estimate volume based on container fill level
- For sauces/condiments, estimate tablespoons/teaspoons visible

FEW-SHOT EXAMPLES:

Example 1 - Breakfast Plate:
{
  "items": [
    {
      "label": "Sunny-Side Up Egg",
      "confidence": 0.98,
      "calories": 90,
      "protein_g": 6.3,
      "carbs_g": 0.4,
      "fat_g": 7.0,
      "serving_size": "1 large egg fried in oil (50g)"
    },
    {
      "label": "White Toast",
      "confidence": 0.95,
      "calories": 80,
      "protein_g": 2.5,
      "carbs_g": 15.0,
      "fat_g": 1.0,
      "serving_size": "1 slice (30g)"
    },
    {
      "label": "Crispy Bacon Strips",
      "confidence": 0.96,
      "calories": 86,
      "protein_g": 6.0,
      "carbs_g": 0.3,
      "fat_g": 6.6,
      "serving_size": "2 strips (20g)"
    }
  ]
}

Example 2 - Healthy Lunch Bowl:
{
  "items": [
    {
      "label": "Grilled Chicken Breast",
      "confidence": 0.97,
      "calories": 248,
      "protein_g": 46.5,
      "carbs_g": 0.0,
      "fat_g": 5.4,
      "serving_size": "150g portion"
    },
    {
      "label": "Brown Rice",
      "confidence": 0.92,
      "calories": 218,
      "protein_g": 4.5,
      "carbs_g": 45.8,
      "fat_g": 1.6,
      "serving_size": "1 cup cooked (195g)"
    },
    {
      "label": "Steamed Broccoli Florets",
      "confidence": 0.88,
      "calories": 31,
      "protein_g": 2.6,
      "carbs_g": 6.0,
      "fat_g": 0.3,
      "serving_size": "1 cup (91g)"
    },
    {
      "label": "Olive Oil Drizzle",
      "confidence": 0.75,
      "calories": 60,
      "protein_g": 0.0,
      "carbs_g": 0.0,
      "fat_g": 6.8,
      "serving_size": "0.5 tablespoon (7ml)"
    }
  ]
}

Example 3 - Snack:
{
  "items": [
    {
      "label": "Medium Banana",
      "confidence": 0.99,
      "calories": 105,
      "protein_g": 1.3,
      "carbs_g": 27.0,
      "fat_g": 0.4,
      "serving_size": "1 medium (118g)"
    },
    {
      "label": "Peanut Butter",
      "confidence": 0.82,
      "calories": 96,
      "protein_g": 4.0,
      "carbs_g": 3.5,
      "fat_g": 8.2,
      "serving_size": "1 tablespoon (16g)"
    }
  ]
}

OUTPUT REQUIREMENTS:
- Return ONLY valid JSON, no markdown, no code blocks, no explanation text
- Empty items array [] if no food detected with sufficient confidence
- Sort items by visual prominence (largest/most central items first)

JSON Schema:
{
  "items": [
    {
      "label": "string (specific food name with preparation)",
      "confidence": number (0.60 to 1.0),
      "calories": number (total kcal for serving),
      "protein_g": number (grams, 1 decimal),
      "carbs_g": number (grams, 1 decimal),
      "fat_g": number (grams, 1 decimal),
      "serving_size": "string with weight (e.g., '1 cup (240g)')"
    }
  ]
}
`;

  const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-1.5-flash-latest";

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
            temperature: 0.2, // Slightly higher for better contextual reasoning while maintaining consistency
            topP: 0.95, // Improved sampling for more accurate food recognition
            topK: 40,
            response_schema: {
              type: "OBJECT",
              properties: {
                items: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      label: { type: "STRING", description: "Specific food name with preparation method" },
                      confidence: { type: "NUMBER", description: "0.60 to 1.0" },
                      calories: { type: "NUMBER", description: "Total kcal for serving" },
                      protein_g: { type: "NUMBER", description: "Protein in grams" },
                      carbs_g: { type: "NUMBER", description: "Carbohydrates in grams" },
                      fat_g: { type: "NUMBER", description: "Fat in grams" },
                      serving_size: { type: "STRING", description: "Portion with weight" }
                    },
                    required: ["label", "confidence", "calories", "protein_g", "carbs_g", "fat_g", "serving_size"]
                  }
                }
              },
              required: ["items"]
            }
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_NONE"
            }
          ]
        })
      }
    );

    if (!apiResponse.ok) {
      const errData = await apiResponse.json();
      console.error("Gemini API Error:", JSON.stringify(errData, null, 2));
      throw new Error(`Gemini API returned ${apiResponse.status}: ${errData.error?.message || 'Unknown error'}`);
    }

    const data = await apiResponse.json();

    // Extract and validate the response
    if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
      console.error("Unexpected API response structure:", JSON.stringify(data, null, 2));
      throw new Error("Invalid response format from Gemini API");
    }

    const nutritionData = JSON.parse(data.candidates[0].content.parts[0].text);

    // Validation and quality check
    if (!nutritionData.items || !Array.isArray(nutritionData.items)) {
      throw new Error("Invalid nutrition data structure");
    }

    // Additional validation: ensure macro calories roughly match total calories
    nutritionData.items = nutritionData.items.map(item => {
      const calculatedCals = (item.protein_g * 4) + (item.carbs_g * 4) + (item.fat_g * 9);
      const difference = Math.abs(calculatedCals - item.calories);
      
      // If difference is too large (>15%), log a warning but don't block
      if (difference > item.calories * 0.15) {
        console.warn(`Macro-calorie mismatch for ${item.label}: declared=${item.calories}, calculated=${calculatedCals.toFixed(0)}`);
      }
      
      return item;
    });

    console.log(`Successfully analyzed ${nutritionData.items.length} food items`);

    return res.status(200).json({
      success: true,
      data: nutritionData,
      metadata: {
        model: MODEL_NAME,
        timestamp: new Date().toISOString(),
        items_detected: nutritionData.items.length
      }
    });

  } catch (err) {
    console.error("Handler Error:", err.message, err.stack);
    return res.status(500).json({ 
      success: false,
      error: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}
