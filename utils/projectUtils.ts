
import { AppState } from '../types';

const SEPARATOR = "NGL_PROJECT_DATA_v1::";

const generateFilename = (extension: string, stateFilename?: string): string => {
  // If we already have a filename, preserve the timestamp but ensure it has the correct extension
  if (stateFilename) {
      return stateFilename.replace(/\.(json|ngl|png)$/, extension);
  }
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `nglstory-${dateStr}T${timeStr}${extension}`;
};

/**
 * Saves the project as a Polyglot PNG.
 * The file is a valid PNG image (for Finder thumbnails) with the compressed project data appended to the end.
 */
export const saveProject = async (state: AppState, imageBlob: Blob): Promise<string> => {
  let filename = generateFilename('.png', state.filename);

  // 1. Prepare State Data
  const projectData = {
    ...state,
    filename, 
    version: '1.2', 
    timestamp: new Date().toISOString(),
    thumbnail: undefined, // No need to store internal thumbnail if the file itself is one
    items: state.items.map(item => ({
      ...item,
      isProcessing: false
    }))
  };

  const jsonString = JSON.stringify(projectData);

  // 2. Compress State Data (Gzip)
  const stream = new Blob([jsonString], { type: 'application/json' }).stream();
  const compressedReadableStream = stream.pipeThrough(new CompressionStream('gzip'));
  const compressedStateBlob = await new Response(compressedReadableStream).blob();

  // 3. Create Separator
  // We use a specific string sequence to mark where the image ends and data begins
  const separatorBlob = new Blob([SEPARATOR]);

  // 4. Combine: [Image PNG] + [Separator] + [Compressed Data]
  // OS Image viewers stop reading after the PNG IEND chunk, so the extra data is ignored visually but preserved physically.
  const finalBlob = new Blob([imageBlob, separatorBlob, compressedStateBlob], { type: 'image/png' });

  // 5. Download
  const url = URL.createObjectURL(finalBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return filename;
};

/**
 * Saves the project as a compressed NGL file (Gzipped JSON).
 * Used for raw data transport or future viewer extensions.
 */
export const saveProjectNGL = async (state: AppState): Promise<string> => {
  let filename = generateFilename('.ngl', state.filename);

  const projectData = {
    ...state,
    filename,
    version: '1.2',
    timestamp: new Date().toISOString(),
    thumbnail: undefined,
    items: state.items.map(item => ({
      ...item,
      isProcessing: false
    }))
  };

  const jsonString = JSON.stringify(projectData);
  
  // Compress using Gzip
  const stream = new Blob([jsonString], { type: 'application/json' }).stream();
  const compressedReadableStream = stream.pipeThrough(new CompressionStream('gzip'));
  const compressedBlob = await new Response(compressedReadableStream).blob();

  const url = URL.createObjectURL(compressedBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return filename;
}

/**
 * Loads a project. 
 * Can handle:
 * 1. Polyglot PNGs (extracts hidden data)
 * 2. Legacy .ngl (Gzip)
 * 3. Legacy .json (Plaintext)
 */
export const loadProject = async (file: File): Promise<AppState> => {
  // Helper to decode Gzip blob
  const decompressBlob = async (blob: Blob): Promise<string> => {
      const ds = new DecompressionStream('gzip');
      const stream = blob.stream().pipeThrough(ds);
      return await new Response(stream).text();
  };

  let jsonString = '';

  try {
      if (file.type === 'image/png' || file.name.endsWith('.png')) {
          // STRATEGY: Find the Separator in the binary data
          const buffer = await file.arrayBuffer();
          const uint8 = new Uint8Array(buffer);
          const separatorBytes = new TextEncoder().encode(SEPARATOR);
          
          let foundIndex = -1;
          
          // Search for the separator sequence
          // Optimization: Search from the end backwards could be faster, but forward is safer for varied file structures
          for(let i = 0; i < uint8.length - separatorBytes.length; i++) {
              // Quick check first byte
              if (uint8[i] === separatorBytes[0]) {
                  let match = true;
                  for(let j = 1; j < separatorBytes.length; j++) {
                      if (uint8[i+j] !== separatorBytes[j]) {
                          match = false;
                          break;
                      }
                  }
                  if (match) {
                      foundIndex = i;
                      break;
                  }
              }
          }

          if (foundIndex !== -1) {
              // Extract data after separator
              const dataStart = foundIndex + separatorBytes.length;
              const dataBytes = uint8.slice(dataStart);
              const dataBlob = new Blob([dataBytes]);
              jsonString = await decompressBlob(dataBlob);
          } else {
              throw new Error("This PNG does not contain ngl project data.");
          }

      } else if (file.name.endsWith('.ngl')) {
          // Compressed Format
          jsonString = await decompressBlob(file);
      } else if (file.name.endsWith('.json')) {
          // Legacy Plaintext JSON
          jsonString = await file.text();
      } else {
          // Not a recognizable project file.
          // Throw immediately so we don't try to JSON.parse binary data (like JPGs)
          throw new Error("File format not recognized as project.");
      }

      // Parse and Validate
      const projectData = JSON.parse(jsonString);
      
      if (!projectData.items || !Array.isArray(projectData.items)) {
        throw new Error("Invalid project structure");
      }

      return {
        baseImage: projectData.baseImage || null,
        items: projectData.items,
        selectedItemId: null,
        isExporting: false,
        filename: projectData.filename || file.name.replace(/\.(json|ngl)$/, '.png')
      };

  } catch (error) {
    // We suppress the console error here because it's normal for users to drop
    // regular JPGs/PNGs, which triggers this error before falling back to the image loader.
    // console.error("Load failed:", error);
    throw error;
  }
};
