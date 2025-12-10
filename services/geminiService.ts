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
export const transformToMagritteStyle = async (base64Image: string): Promise<string> => {
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
    const prompt = `You are a visual artist channeling René Magritte's surrealist philosophy.

## OUTPUT FORMAT
Maintain the exact input orientation. The input image is in ${orientationDesc}. Your output MUST be in the same ${orientationDesc}. Don't change portrait to landscape, or vice versa. Generate a high-quality 2K image.

## STYLE REFERENCE - USE ONLY THE 11 PROVIDED IMAGES
**CRITICAL INSTRUCTION**: This request includes 11 reference paintings AFTER this text prompt. These are your SOLE authoritative source for Magritte's style. Do NOT rely on your general training data about Magritte. Extract all visual style elements—color, texture, brushwork, composition—from ONLY these 11 provided images.

The 11 provided reference paintings (in order after this prompt) are:
1. **Three Women in an Interior (1923)**: Representation of beings as disjoint curves
2. **Musings of the Solitary Walker (1926)**: People upright and horizontal; Night scenes
3. **The Voice of Space (1928)**: Architectural framing and depth illusions
4. **The Human Condition (1933)**: Recursive realities within frames
5. **The Human Condition (1935)**: Window as reality portal, different composition
6. **Not to be Reproduced (1937)**: Mirror reversals and identity puzzles
7. **Time Transfixed (1938)**: Impossible scales and temporal disruption (locomotive in fireplace)
8. **Golconda (1953)**: Repetition, gravity defiance, mass surrealism (raining men)
9. **Son of Man (1964)**: Face concealment as conceptual art (apple obscuring face)
10. **The Beautiful Relations (1967)**: Incongruous object combinations
11. **The Blank Page (1967)**: Silence, mystery, and visual emptiness

**Your task**: Study the brushstrokes, oil texture, color mixing, and surface quality visible in these 11 images. Replicate THOSE specific visual characteristics, not your general knowledge of Magritte.

## MAGRITTE'S FAVORITE RECURRING MOTIFS
(Visible in the 11 provided references)
- **Bowler hats**: Everyman anonymity and formal absurdity (see references 2, 8, 9)
- **Apples & spheres**: Geometric purity interrupting nature (see references 9, 10)
- **Clouds**: Sky as solid, sky as window, sky as illusion (see references 1, 3, 8, 11)
- **Mirrors**: Reversed identities and hidden depths (see reference 6)
- **Familiar objects at impossible scales**: A locomotive in a fireplace (reference 7), floating objects (reference 8)
- **Window frames**: Reality within reality, paintings within paintings (see references 4, 5)
- **Empty spaces & voids**: Silence as presence (see reference 11)
- **Cloaked or hidden figures**: Mystery and anonymity (see references 2, 9)

## TRANSFORMATION INSTRUCTIONS

### 0. OIL PAINTING MATERIALITY - TEXTURE TRANSFER FROM PROVIDED REFERENCES
- **CRITICAL**: Examine the 11 provided reference images closely. Notice the oil painting texture in:
  - **Skies** (references 1, 3, 5, 8, 11): Subtle brushstrokes create depth in blue gradients
  - **Clouds** (references 3, 8, 10): Volume through directional brushwork and impasto
  - **Fabrics/suits** (references 2, 6, 9): Fabric grain rendered with visible paint strokes
  - **Architecture** (references 3, 4, 5, 7): Stone, wood, and plaster textures in oil
- **Replicate THIS texture quality**: Visible but controlled brushstrokes, not smooth digital rendering
- **Impasto technique** on highlighted areas (thick paint creating slight relief—see reference 7's locomotive)
- **Smooth-yet-textured surfaces**: Hand-painted oil richness (see reference 6's mirror reflection)
- Color should have **depth and luminosity** from layered oil pigments (study reference 8's sky variation)
- Edges should show **hand-painted precision** with slight organic variation (see reference 9's apple edge)
- *Avoid*: Airbrush smoothness, digital gradients, vector-like flatness, CGI renders

### 1. Color Palette - VARIABLE SKIES (From Provided References)
- Study the sky colors in references 1, 3, 5, 8, 10, 11: cerulean, periwinkle, slate blue, azure, cornflower, cobalt, steel blue
- Notice how reference 8 (Golconda) varies sky saturation from top to horizon
- Reference 11 (The Blank Page) shows gradient transition zones painted with brushstrokes
- Mix sky colors in unexpected ways—let sky colors react to the surreal content below
- *Avoid*: Uniform, identical color across all skies

### 2. Face Concealment - PLAYFUL SUBSTITUTION (Inspired by Reference 9)
- Reference 9 (Son of Man) shows face concealment with a green apple
- Extend this concept: For **frontally visible human faces**, randomly replace with green apples, orange oranges, yellow lemons
- Block faces at varying scales—a tiny apple, an oversized lemon (study the apple-to-face scale in reference 9)
- Keep hands, clothing, posture intact for narrative continuity
- Choose fruit/objects that add semantic humour
- Keep fruit selection constant within a single image

### 3. Interplay & Contamination (Inspired by References 7, 8)
- Reference 7 (Time Transfixed): Locomotive impossibly emerging from fireplace—scale and context disruption
- Reference 8 (Golconda): Identical men raining from the sky—repetition as surrealism
- Allow Magritte's world to **infect** the input image's surreal elements:
  - If input contains floating objects → make them rain like reference 8's men
  - If input has impossible architecture → frame it within objects (like reference 7's fireplace framing)
  - If input has hidden elements → conceal them further with Magrittean objects
- Create visual **conversations** between the input's logic and Magritte's logic

### 4. Composition & Scale Disruption (Study References 4, 5, 7)
- Reference 4 & 5 (The Human Condition): Frame-within-frame creating recursive reality
- Reference 7 (Time Transfixed): Dramatic scale wrongness (full-size train in domestic fireplace)
- Apply these principles:
  - One object should be dramatically wrong in scale relative to its environment
  - Hide something obvious; reveal something hidden
  - Create frame-within-frame depth (a window looking at another Magrittean scene)
  - Use repetition strategically (multiple identical elements)

## TONE
- Philosophical but playful
- Mysterious, not menacing
- Visual puns and wordless jokes
- Respect the input's surreal premise; don't override it—enhance it
- Balance between homage and invention

## FINAL OUTPUT
- A single, cohesive surrealist image that honours Magritte's visual vocabulary while staying true to the input image's surrealism
- Maintain the ${orientationDesc} format
- Use authentic oil painting texture extracted from the 11 provided reference images—NOT your general training data`;

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

    return resultImageBase64;
  } catch (error) {
    console.error("Gemini Magritte Transformation Error:", error);
    throw error;
  }
};
