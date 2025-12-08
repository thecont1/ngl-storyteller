export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Crop {
  top: number;    // percentage 0-100
  bottom: number; // percentage 0-100
  left: number;   // percentage 0-100
  right: number;  // percentage 0-100
}

export interface CollageItem {
  id: string;
  originalSrc: string; // The raw uploaded image
  aiOutputSrc: string | null; // The raw output from Gemini
  processedSrc: string | null; // The final composited image
  
  showCutout: boolean; // Toggle: True = Show processed (cutout), False = Show original
  invertMask: boolean; // Toggle state for mask inversion
  isMirrored: boolean; // Toggle state for horizontal flip
  
  isProcessing: boolean;
  position: Position;
  size: Size;
  crop: Crop; // Inset percentages
  
  zIndex: number;
  rotation: number;
  name: string;
}

export enum DragMode {
  NONE,
  DRAG,
  RESIZE_TL, // Top Left
  RESIZE_TR, // Top Right
  RESIZE_BL, // Bottom Left
  RESIZE_BR, // Bottom Right - Restored
  
  ROTATE,
  
  CROP_T, // Top Edge
  CROP_B, // Bottom Edge
  CROP_L, // Left Edge
  CROP_R  // Right Edge
}

export interface AppState {
  baseImage: string | null;
  items: CollageItem[];
  selectedItemId: string | null;
  isExporting: boolean;
}

// Extend Window interface for AI Studio API
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}