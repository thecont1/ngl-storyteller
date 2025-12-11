import { GoogleGenAI } from "@google/genai";
import { OBJECT_EXTRACTION_PROMPT, MAGRITTE_TRANSFORM_PROMPT, CAPTION_GENERATION_PROMPT } from '../constants/prompts';

/**
 * Uses Gemini to extract the significant object from an image.
 * Strategy: Ask Gemini for a binary mask (Black and White).
 */
export const extractObjectFromImage = async (base64Image: string): Promise<{ result: string, usage: any }> => {
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
          { text: OBJECT_EXTRACTION_PROMPT }
        ]
      }
    });

    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) throw new Error("No response from Gemini");

    // Log usage metadata if available
    if (response.usageMetadata) {
        console.log("Gemini Usage:", response.usageMetadata);
    }

    const parts = candidates[0].content.parts;
    let resultImageBase64 = '';

    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        resultImageBase64 = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!resultImageBase64) throw new Error("Gemini did not return an image mask.");

    return { result: resultImageBase64, usage: response.usageMetadata };
  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    throw error;
  }
};

/**
 * Lazy-load Magritte reference images
 */
async function getMagritteReferences(): Promise<string[]> {
  const { MAGRITTE_REFERENCE_ARRAY } = await import(
    /* webpackChunkName: "magritte-refs" */
    '../constants/magritteReferences'
  );
  return MAGRITTE_REFERENCE_ARRAY;
}

/**
 * Get image dimensions from base64 data URI
 */
async function getImageDimensions(base64Image: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = reject;
    img.src = base64Image;
  });
}

/**
 * Determine orientation description for prompt
 */
function getOrientationDescription(width: number, height: number): string {
  const ratio = width / height;
  if (Math.abs(ratio - 1) < 0.1) {
    return "square format (1:1 aspect ratio)";
  } else if (width > height) {
    // Landscape
    if (ratio > 1.7) return "wide landscape format (16:9 aspect ratio)";
    if (ratio > 1.4) return "landscape format (3:2 aspect ratio)";
    return "landscape format (4:3 aspect ratio)";
  } else {
    // Portrait
    if (ratio < 0.6) return "tall portrait format (9:16 aspect ratio)";
    if (ratio < 0.7) return "portrait format (2:3 aspect ratio)";
    return "portrait format (3:4 aspect ratio)";
  }
}

/**
 * Uses Gemini to transform the ngl-storyteller collage in the style of René Magritte,
 * using 11 reference paintings for authentic style transfer.
 * Output maintains the same aspect ratio and orientation as the input collage.
 */
export const transformToMagritteStyle = async (base64Image: string): Promise<{ result: string, usage: any }> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const base64Data = base64Image.split(',')[1];
    const mimeType = base64Image.substring(base64Image.indexOf(':') + 1, base64Image.indexOf(';'));

    // Get input image dimensions
    const { width, height } = await getImageDimensions(base64Image);
    const orientationDesc = getOrientationDescription(width, height);

    console.log(`Input: ${width}×${height} → ${orientationDesc}`);

    // Load Magritte reference images
    const magritteReferences = await getMagritteReferences();

    const model = 'gemini-3-pro-image-preview';

    // Enhanced prompt with explicit reference image binding
    const prompt = MAGRITTE_TRANSFORM_PROMPT(orientationDesc);

    const parts = [
      { inlineData: { mimeType: mimeType, data: base64Data } },
      { text: prompt },
      ...magritteReferences.map(refBase64 => ({
        inlineData: {
          mimeType: 'image/jpeg',
          data: refBase64.split(',')[1]
        }
      }))
    ];

    const response = await ai.models.generateContent({
      model: model,
      contents: { parts }
    });

    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) throw new Error("No response from Gemini");

    // Log usage metadata if available
    if (response.usageMetadata) {
        console.log("Gemini Usage (Magritte):", response.usageMetadata);
    }

    const responseParts = candidates[0].content.parts;
    let resultImageBase64 = '';

    for (const part of responseParts) {
      if (part.inlineData && part.inlineData.data) {
        resultImageBase64 = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!resultImageBase64) throw new Error("Gemini did not return a transformed image.");

    // Verify output dimensions match input orientation
    const outputDims = await getImageDimensions(resultImageBase64);
    console.log(`Output: ${outputDims.width}×${outputDims.height}`);

    return { result: resultImageBase64, usage: response.usageMetadata };
  } catch (error) {
    console.error("Gemini Magritte Transformation Error:", error);
    throw error;
  }
};

/**
 * Uses Gemini to generate a witty, surreal caption for the image.
 */
export const generateCaption = async (base64Image: string): Promise<{ result: string, usage: any }> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const base64Data = base64Image.split(',')[1];
    const mimeType = base64Image.substring(base64Image.indexOf(':') + 1, base64Image.indexOf(';'));

    const model = 'gemini-3-pro-preview'; // Use text/multimodal model

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: base64Data } },
          { text: CAPTION_GENERATION_PROMPT }
        ]
      }
    });

    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) throw new Error("No response from Gemini");

    // Log usage metadata if available
    if (response.usageMetadata) {
        console.log("Gemini Usage (Caption):", response.usageMetadata);
    }

    const caption = candidates[0].content.parts[0].text;
    if (!caption) throw new Error("Gemini did not return a caption.");

    return { result: caption.trim(), usage: response.usageMetadata };
  } catch (error) {
    console.error("Gemini Caption Generation Error:", error);
    throw error;
  }
};
