import { AppState } from '../types';

/**
 * Downloads the current application state as a JSON file.
 * This acts as saving the project state including all assets and metadata.
 */
export const saveProject = (state: AppState) => {
  // Create a clean copy of the state for saving
  const projectData = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    baseImage: state.baseImage,
    items: state.items.map(item => ({
      ...item,
      // Ensure we don't save ephemeral states
      isProcessing: false
    }))
  };

  const jsonString = JSON.stringify(projectData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `ngl-story-${timestamp}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Loads a project from a JSON file and returns the AppState.
 */
export const loadProject = (file: File): Promise<AppState> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const json = e.target?.result as string;
        const projectData = JSON.parse(json);
        
        // Basic validation
        if (!projectData.items || !Array.isArray(projectData.items)) {
          throw new Error("Invalid project file format");
        }

        // Construct AppState
        const loadedState: AppState = {
          baseImage: projectData.baseImage || null,
          items: projectData.items,
          selectedItemId: null,
          isExporting: false
        };

        resolve(loadedState);
      } catch (error) {
        console.error("Failed to parse project file", error);
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
};