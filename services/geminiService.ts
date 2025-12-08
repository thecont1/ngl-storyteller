import { GoogleGenAI } from "@google/genai";

/**
 * Uses Gemini to extract the significant object from an image.
 * Strategy: Ask Gemini for a binary mask (Black and White).
 */
export const extractObjectFromImage = async (base64Image: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const base64Data = base64Image.split(',')[1];
    const mimeType = base64Image.substring(base64Image.indexOf(':') + 1, base64Image.indexOf(';'));

    const model = 'gemini-3-pro-image-preview';

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: base64Data } },
          { text: "Image Editing Task: Create a high-contrast binary segmentation mask for the main significant foreground object (or group of objects) in this image. The object(s) should be pure WHITE (#FFFFFF) and the background should be pure BLACK (#000000). Ensure the edges are precise and the mask is solid." }
        ]
      }
    });

    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) throw new Error("No response from Gemini");

    const parts = candidates[0].content.parts;
    let resultImageBase64 = '';

    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        resultImageBase64 = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!resultImageBase64) throw new Error("Gemini did not return an image mask.");
    return resultImageBase64;

  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    throw error;
  }
};