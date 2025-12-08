/**
 * Converts a File object to a Base64 string.
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Loads an image from a source URL.
 */
export const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
  });
};

/**
 * Analyzes an image to check if it's likely a B/W mask.
 * Checks for:
 * 1. Grayscale (R is close to G and B)
 * 2. High Contrast (Pixels are mostly Black or White)
 */
export const analyzeImageContent = async (imageSrc: string): Promise<{ isMask: boolean }> => {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  // Sample a smaller version for performance
  canvas.width = 100;
  canvas.height = 100;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { isMask: false };

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  let colorPixelCount = 0;
  let grayPixelCount = 0;
  let extremeValueCount = 0; // Pixels close to 0 or 255

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // Ignore fully transparent pixels
    if (a < 10) continue;

    // 1. Check Grayscale: R, G, and B should be very close
    const diff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(b - r));
    
    if (diff > 10) {
      // It has color
      colorPixelCount++;
    } else {
      grayPixelCount++;
      // 2. Check Contrast: Is it Black or White?
      const brightness = (r + g + b) / 3;
      if (brightness < 30 || brightness > 225) {
        extremeValueCount++;
      }
    }
  }

  const totalPixels = colorPixelCount + grayPixelCount;
  if (totalPixels === 0) return { isMask: false };

  const grayRatio = grayPixelCount / totalPixels;
  const contrastRatio = extremeValueCount / totalPixels;

  // It's a mask if it's mostly grayscale AND has high contrast (mostly black/white)
  // We accept > 90% gray pixels and > 40% extreme values (to account for the object shape vs background ratio)
  return { isMask: grayRatio > 0.9 && contrastRatio > 0.4 };
};

/**
 * Applies a binary mask to an original image.
 * 
 * @param imageSrc The original full-color image
 * @param maskSrc The black and white mask image
 * @param invert If true, black becomes opaque and white becomes transparent
 */
export const applyMask = async (imageSrc: string, maskSrc: string, invert: boolean = false): Promise<string> => {
  const [img, mask] = await Promise.all([loadImage(imageSrc), loadImage(maskSrc)]);
  
  const canvas = document.createElement('canvas');
  // Use the dimensions of the original image
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error("Could not get canvas context");

  // 1. Draw the mask first to get its pixel data
  // We draw it stretched to fit the original image (Gemini aspect ratio preservation)
  ctx.drawImage(mask, 0, 0, img.width, img.height);
  const maskData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  // 2. Clear canvas and draw the original image
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  
  // 3. Get original image data to manipulate alpha
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  const mData = maskData.data;

  // 4. Loop through pixels and apply mask to alpha channel
  for (let i = 0; i < data.length; i += 4) {
    // Get luminosity of mask pixel (it should be grayscale, so R=G=B)
    // We use Red channel as proxy for luminosity
    const maskVal = mData[i]; 
    
    // Standard: White (255) = Keep, Black (0) = Remove
    // Invert: White (255) = Remove, Black (0) = Keep
    
    let alphaVal = maskVal;
    if (invert) {
      alphaVal = 255 - maskVal;
    }
    
    // STRICT BINARY ALPHA: 1 or 0
    // If the mask value is > 50% gray (127), it is fully opaque. Otherwise fully transparent.
    // This creates hard edges without anti-aliasing or feathering.
    data[i + 3] = alphaVal > 127 ? 255 : 0; 
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
};

/**
 * Scales an item to fit within a default size while maintaining aspect ratio.
 */
export const calculateInitialSize = (imgWidth: number, imgHeight: number, targetSize: number = 300) => {
  const aspectRatio = imgWidth / imgHeight;
  if (aspectRatio > 1) {
    return { width: targetSize, height: targetSize / aspectRatio };
  } else {
    return { width: targetSize * aspectRatio, height: targetSize };
  }
};