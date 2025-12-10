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
 * Calculate closest supported aspect ratio from image dimensions
 * Respects orientation (landscape vs portrait)
 */
function getClosestAspectRatio(width: number, height: number): string {
  const ratio = width / height;
  const isLandscape = width >= height;
  
  const supportedRatios = [
    { value: '1:1', numeric: 1.0, orientation: 'both' },
    { value: '16:9', numeric: 16/9, orientation: 'landscape' },
    { value: '9:16', numeric: 9/16, orientation: 'portrait' },
    { value: '4:3', numeric: 4/3, orientation: 'landscape' },
    { value: '3:4', numeric: 3/4, orientation: 'portrait' },
    { value: '3:2', numeric: 3/2, orientation: 'landscape' },
    { value: '2:3', numeric: 2/3, orientation: 'portrait' }
  ];
  
  // Filter to matching orientation (or square)
  const candidateRatios = supportedRatios.filter(r => 
    r.orientation === 'both' || 
    (isLandscape && r.orientation === 'landscape') ||
    (!isLandscape && r.orientation === 'portrait')
  );
  
  // Find closest match
  let closest = candidateRatios[0];
  let minDiff = Math.abs(ratio - closest.numeric);
  
  for (const supported of candidateRatios) {
    const diff = Math.abs(ratio - supported.numeric);
    if (diff < minDiff) {
      minDiff = diff;
      closest = supported;
    }
  }
  
  return closest.value;
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
 * Uses Gemini to transform the ngl-storyteller collage in the style of René Magritte,
 * using 11 reference paintings for authentic style transfer.
 * Output maintains the same aspect ratio and orientation as the input collage.
 */
export const transformToMagritteStyle = async (base64Image: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const base64Data = base64Image.split(',')[1];
    const mimeType = base64Image.substring(base64Image.indexOf(':') + 1, base64Image.indexOf(';'));

    // Get input image dimensions to match aspect ratio AND orientation
    const { width, height } = await getImageDimensions(base64Image);
    const aspectRatio = getClosestAspectRatio(width, height);

    console.log(`Input: ${width}×${height} → Using aspect ratio: ${aspectRatio}`);

    // Load Magritte reference images
    const magritteReferences = await getMagritteReferences();

    const model = 'gemini-3-pro-image-preview';

    const prompt = `Transform this layered photographic collage into a René Magritte surrealist painting. Preserve the dreamlike juxtaposition and impossible spatial relationships of the collage while applying Magritte's signature aesthetic: Replace all human faces with precisely painted green apples. Paint the sky as deep cerulean blue with volumetric white clouds. Render each collage element with hyper-realistic detail and crisp edges as if oil-painted. Maintain the surreal scale distortions and spatial impossibilities. Use flat, bold colors with sharp boundaries between elements. The final image should feel like a discovered Magritte masterpiece—mysterious, precise, and reality-defying.`;

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
      contents: { parts },
      generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio: aspectRatio,  // Now respects orientation
          imageSize: '1K'
        }
      }
    });

    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) throw new Error("No response from Gemini");

    const responseParts = candidates[0].content.parts;
    let resultImageBase64 = '';

    for (const part of responseParts) {
      if (part.inlineData && part.inlineData.data) {
        resultImageBase64 = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!resultImageBase64) throw new Error("Gemini did not return a transformed image.");
    return resultImageBase64;

  } catch (error) {
    console.error("Gemini Magritte Transformation Error:", error);
    throw error;
  }
};

