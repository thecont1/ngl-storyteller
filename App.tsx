import React, { useState, useRef, useEffect } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { Canvas } from './components/Canvas';
import { extractObjectFromImage } from './services/geminiService';
import { applyMask, analyzeImageContent, loadImage, calculateInitialSize, fileToBase64 } from './utils/imageUtils';
import { saveProject, loadProject, saveProjectNGL } from './utils/projectUtils';
import { CollageItem, AppState, LayerStyle } from './types';
import { TrashIcon, InvertIcon, MirrorIcon, GripVerticalIcon, StyleIcon, ScissorsIcon, GeminiIcon, SaveDiskIcon, FileImageIcon, FileCodeIcon, FileJsonIcon } from './components/Icons';
import { Logo } from './components/Logo';
import html2canvas from 'html2canvas';

const App: React.FC = () => {
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [apiKeyLoading, setApiKeyLoading] = useState<boolean>(true);
  const [notification, setNotification] = useState<{message: string, isError: boolean} | null>(null);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

  const [state, setState] = useState<AppState>({
    baseImage: null,
    items: [],
    selectedItemId: null,
    isExporting: false,
    filename: undefined,
    thumbnail: undefined,
    canvasDimensions: undefined
  });

  const exportContainerRef = useRef<HTMLDivElement>(null);
  const draggingItemRef = useRef<number | null>(null);
  const dragOverItemRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkKey = async () => {
      try {
        if (window.aistudio && window.aistudio.hasSelectedApiKey) {
          const hasKey = await window.aistudio.hasSelectedApiKey();
          setHasApiKey(hasKey);
        } else {
          setHasApiKey(true);
        }
      } catch (e) {
        console.error("Error checking API key", e);
      } finally {
        setApiKeyLoading(false);
      }
    };
    checkKey();
  }, []);

  // Clear notification after 4 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showToast = (message: string, isError: boolean = false) => {
    setNotification({ message, isError });
  };

  const handleConnectApiKey = async () => {
    try {
      if (window.aistudio && window.aistudio.openSelectKey) {
        await window.aistudio.openSelectKey();
        setHasApiKey(true);
      }
    } catch (e) {
      console.error("Error selecting API key", e);
      showToast("Failed to select API key. Please try again.", true);
    }
  };

  const handleBaseImageUpload = (base64: string) => {
    setState(prev => ({ ...prev, baseImage: base64 }));
  };

  const handleCanvasDimensions = (width: number, height: number) => {
      setState(prev => ({ ...prev, canvasDimensions: { width, height } }));
  };

  const processLayer = async (itemId: string, originalSrc: string) => {
    setState(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === itemId ? { ...item, isProcessing: true } : item)
    }));

    try {
      const aiResponseImage = await extractObjectFromImage(originalSrc);
      const { isMask } = await analyzeImageContent(aiResponseImage);
      
      let processedImage = aiResponseImage;
      if (isMask) {
         processedImage = await applyMask(originalSrc, aiResponseImage, false);
      }

      setState(prev => ({
        ...prev,
        items: prev.items.map(item => 
          item.id === itemId 
            ? { 
                ...item, 
                aiOutputSrc: aiResponseImage,
                processedSrc: processedImage, 
                showCutout: true, 
                invertMask: false,
                isProcessing: false,
              }
            : item
        )
      }));

    } catch (error: any) {
      console.error("Processing failed", error);
      setState(prev => ({
        ...prev,
        items: prev.items.map(item => 
          item.id === itemId 
            ? { ...item, isProcessing: false }
            : item
        )
      }));
      
      const errorMessage = error?.message || JSON.stringify(error);
      if (errorMessage.includes('503') || errorMessage.includes('overloaded')) {
         showToast("The AI model is currently overloaded. Please wait a moment and try again later.", true);
      } else {
         showToast("Extraction failed. Please check your connection or try again.", true);
      }
    }
  };

  const handleSourceImageUpload = async (base64: string) => {
    const newId = Date.now().toString();
    const maxZ = state.items.length > 0 ? Math.max(...state.items.map(i => i.zIndex)) : 0;
    const objectCount = state.items.length + 1;

    let initialWidth = 200;
    let initialHeight = 200;
    
    // Default to center if dimensions unknown
    let startX = 200;
    let startY = 200;
    
    if (state.canvasDimensions) {
        // Target size increased to 0.9 (90%) of the smaller dimension
        const targetSize = Math.min(state.canvasDimensions.width, state.canvasDimensions.height) * 0.9;
        
        try {
          const img = await loadImage(base64);
          const size = calculateInitialSize(img.width, img.height, targetSize);
          initialWidth = size.width;
          initialHeight = size.height;
        } catch (e) {
            console.error("Failed to load source image for dimensions", e);
             initialWidth = targetSize;
             initialHeight = targetSize;
        }

        // STRICT BOUNDARY LOGIC
        // Ensure the object is strictly within the canvas with padding
        const padding = 50;
        
        // Calculate max allowed positions
        const maxX = Math.max(padding, state.canvasDimensions.width - initialWidth - padding);
        const maxY = Math.max(padding, state.canvasDimensions.height - initialHeight - padding);
        const minX = padding;
        const minY = padding;

        // Randomize within legal bounds
        startX = Math.random() * (maxX - minX) + minX;
        startY = Math.random() * (maxY - minY) + minY;
    }

    const newItem: CollageItem = {
      id: newId,
      originalSrc: base64,
      aiOutputSrc: null,
      processedSrc: null,
      showCutout: true, 
      invertMask: false,
      isMirrored: false,
      style: 'normal',
      isProcessing: true,
      position: { x: startX, y: startY },
      size: { width: initialWidth, height: initialHeight },
      crop: { top: 0, bottom: 0, left: 0, right: 0 },
      zIndex: maxZ + 1,
      rotation: 0,
      name: `Object ${objectCount}`
    };

    setState(prev => ({ 
      ...prev, 
      items: [...prev.items, newItem],
      selectedItemId: newId 
    }));

    await processLayer(newId, base64);
  };

  const handleRetry = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const item = state.items.find(i => i.id === id);
    if (!item) return;
    await processLayer(id, item.originalSrc);
  };

  const updateCompositing = async (id: string, invert: boolean) => {
    const item = state.items.find(i => i.id === id);
    if (!item || !item.aiOutputSrc) {
        setState(prev => ({
            ...prev,
            items: prev.items.map(i => i.id === id ? { ...i, invertMask: invert } : i)
        }));
        return;
    }

    let newProcessedSrc = await applyMask(item.originalSrc, item.aiOutputSrc, invert);

    setState(prev => ({
      ...prev,
      items: prev.items.map(i => 
        i.id === id 
          ? { 
              ...i, 
              processedSrc: newProcessedSrc, 
              invertMask: invert 
            }
          : i
      )
    }));
  };

  const updateItem = (id: string, updates: Partial<CollageItem>) => {
    setState(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === id ? { ...item, ...updates } : item)
    }));
  };

  const removeItem = (id: string) => {
    setState(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id),
      selectedItemId: null
    }));
  };

  const selectItem = (id: string | null) => {
    setState(prev => ({ ...prev, selectedItemId: id }));
  };

  const handleSort = () => {
    const _items = [...state.items];
    if (draggingItemRef.current === null || dragOverItemRef.current === null) return;
    
    const count = _items.length;
    const fromArrayIndex = count - 1 - draggingItemRef.current;
    const toArrayIndex = count - 1 - dragOverItemRef.current;
    
    const draggedItemContent = _items.splice(fromArrayIndex, 1)[0];
    _items.splice(toArrayIndex, 0, draggedItemContent);
    
    const reorderedItems = _items.map((item, index) => ({
      ...item,
      zIndex: index + 1
    }));
    
    draggingItemRef.current = null;
    dragOverItemRef.current = null;
    
    setState(prev => ({ ...prev, items: reorderedItems }));
  };

  const openSaveModal = () => {
      setIsSaveModalOpen(true);
  };

  const executeDownloadJPG = async () => {
    setIsSaveModalOpen(false);
    if (!exportContainerRef.current) return;
    
    selectItem(null);
    setTimeout(async () => {
        try {
            if(!exportContainerRef.current) return;
            
            const canvas = await html2canvas(exportContainerRef.current, {
                useCORS: true,
                backgroundColor: null,
                scale: 1, 
                onclone: (clonedDoc) => {
                    const clonedExportDiv = clonedDoc.getElementById('canvas-export-div');
                    if (clonedExportDiv) {
                        clonedExportDiv.style.transform = 'none';
                        clonedExportDiv.style.position = 'static';
                        clonedExportDiv.style.left = 'auto';
                        clonedExportDiv.style.top = 'auto';
                        
                        // FIX: Remove animation grain/dimness from base image during export
                        const baseImg = clonedExportDiv.querySelector('#canvas-base-image');
                        if (baseImg) {
                            baseImg.classList.remove('animate-grain-reveal');
                            // Ensure filters are reset
                            (baseImg as HTMLElement).style.filter = 'none';
                            (baseImg as HTMLElement).style.opacity = '1';
                        }
                        
                        // FIX: Remove item animations (Ghost floating) so they capture cleanly
                        // But KEEP the filters (grayscale etc)
                        const items = clonedExportDiv.querySelectorAll('[class*="anim-"]');
                        items.forEach(el => {
                            el.classList.remove('anim-float-ghost', 'anim-shimmer-fire');
                            // Reset transform to 0 state to avoid capture artifacts
                        });
                    }
                }
            });
            
            const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
            if (!blob) throw new Error("Failed to generate JPG");

            // Format filename to match PNG format: nglstory-YYYYMMDDTHHMMSS.jpg
            let filename = state.filename ? state.filename.replace(/\.(png|ngl|json)$/, '.jpg') : '';
            if (!filename) {
                const now = new Date();
                const pad = (n: number) => n.toString().padStart(2, '0');
                const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
                const timeStr = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
                filename = `nglstory-${dateStr}T${timeStr}.jpg`;
            }

            // Use File System Access API if available to prompt for overwrite
            let saved = false;
            if (window.showSaveFilePicker) {
               try {
                  const handle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    types: [{
                      description: 'JPEG Image',
                      accept: { 'image/jpeg': ['.jpg'] }
                    }]
                  });
                  const writable = await handle.createWritable();
                  await writable.write(blob);
                  await writable.close();
                  saved = true;
               } catch (err: any) {
                  // If user cancelled, stop
                  if (err.name === 'AbortError') return;
                  // If other error (e.g. cross-origin/iframe), fall through to link download
                  console.warn("File Picker API failed, falling back to download link.", err);
               }
            }
            
            if (!saved) {
               // Fallback: Create blob URL
               const url = URL.createObjectURL(blob);
               const link = document.createElement('a');
               link.download = filename;
               link.href = url;
               document.body.appendChild(link);
               link.click();
               document.body.removeChild(link);
               URL.revokeObjectURL(url);
            }
            
            showToast("Image downloaded successfully!");
        } catch (e) {
            console.error("Export failed", e);
            showToast("Could not export image.", true);
        }
    }, 100);
  };

  const executeSaveProject = async () => {
    setIsSaveModalOpen(false);
    try {
      if (!exportContainerRef.current || !state.baseImage) {
        showToast("Create a composition before saving.", true);
        return;
      }
      
      selectItem(null);
      await new Promise(resolve => setTimeout(resolve, 50));

      const canvas = await html2canvas(exportContainerRef.current, {
          useCORS: true,
          backgroundColor: '#020617', 
          scale: 1, 
          logging: false,
          onclone: (clonedDoc) => {
             const clonedExportDiv = clonedDoc.getElementById('canvas-export-div');
             if (clonedExportDiv) {
                 clonedExportDiv.style.transform = 'none';
                 clonedExportDiv.style.position = 'static';
                 clonedExportDiv.style.left = 'auto';
                 clonedExportDiv.style.top = 'auto';

                 // FIX: Remove animation grain/dimness from base image during export
                 const baseImg = clonedExportDiv.querySelector('#canvas-base-image');
                 if (baseImg) {
                     baseImg.classList.remove('animate-grain-reveal');
                     (baseImg as HTMLElement).style.filter = 'none';
                     (baseImg as HTMLElement).style.opacity = '1';
                 }

                 // FIX: Remove item animations for clean capture
                 const items = clonedExportDiv.querySelectorAll('[class*="anim-"]');
                 items.forEach(el => {
                    el.classList.remove('anim-float-ghost', 'anim-shimmer-fire');
                 });
             }
          }
      });
      
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error("Failed to generate project image");

      const savedFilename = await saveProject(state, blob);
      
      if (state.filename !== savedFilename) {
        setState(prev => ({ ...prev, filename: savedFilename }));
      }
      showToast("Project saved successfully!");
    } catch (e: any) {
      if (e.name === 'AbortError') return; // User cancelled, ignore
      console.error("Save failed", e);
      showToast("Failed to save project.", true);
    }
  };

  const executeSaveNGL = async () => {
    setIsSaveModalOpen(false);
    try {
      if (!state.baseImage) {
        showToast("Create a composition before saving.", true);
        return;
      }
      
      const savedFilename = await saveProjectNGL(state);
      
      if (state.filename !== savedFilename) {
        setState(prev => ({ ...prev, filename: savedFilename }));
      }
      showToast("NGL data saved!");
    } catch (e: any) {
      if (e.name === 'AbortError') return; // User cancelled
      console.error("Save failed", e);
      showToast("Failed to save NGL data.", true);
    }
  };

  const handleFileDrop = async (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          const file = e.dataTransfer.files[0];
          
          // 1. Try loading as a Project file (Polyglot PNG or .ngl or .json)
          try {
            const loadedState = await loadProject(file);
            setState(loadedState);
            showToast("Project loaded successfully!");
            return;
          } catch (error) {
            // Not a project file, ignore and continue to fallback
          }

          // 2. Fallback: Load as regular Base Image (Background)
          if (file.type.startsWith('image/')) {
             try {
                const base64 = await fileToBase64(file);
                handleBaseImageUpload(base64);
                showToast("Scene image loaded.");
             } catch (e) {
                console.error(e);
                showToast("Failed to load image.", true);
             }
          } else {
             showToast("File type not supported. Please drop an image or project file.", true);
          }
      }
  };

  const styles: { id: LayerStyle; label: string; }[] = [
    { id: 'normal', label: 'Normal' },
    { id: 'sticker', label: 'Sticker' },
    { id: 'ghost', label: 'Ghost' },
    { id: 'ink', label: 'Ink' },
    { id: 'pumpkin', label: 'Pumpkin' },
  ];

  const selectedItem = state.items.find(i => i.id === state.selectedItemId);

  if (apiKeyLoading) {
    return (
      <div className="flex h-screen bg-slate-900 items-center justify-center text-white">
        <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!hasApiKey) {
    return (
      <div className="flex h-screen bg-slate-900 items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 rounded-2xl p-8 shadow-2xl border border-slate-700 text-center">
          <div className="mb-6 flex justify-center">
             <div className="scale-150">
               <Logo />
             </div>
          </div>
          <h1 className="text-3xl font-bold font-['Chewy'] text-white mb-2">Welcome to ngl v1.0</h1>
          <p className="text-slate-400 mb-8 font-['Chewy'] text-xl">
             Based on a true story 😉
          </p>
          <button 
            onClick={handleConnectApiKey}
            className="w-full py-3 px-4 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-bold rounded-lg transition-all shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2"
          >
            <span>Connect API Key</span>
          </button>
        </div>
      </div>
    );
  }

  const reversedItems = [...state.items].reverse();

  return (
    <div 
        className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden relative"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleFileDrop}
    >
      {/* Save Modal */}
      {isSaveModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700 shadow-2xl transform transition-all scale-100">
                  <h3 className="text-xl font-bold text-white mb-2 text-center font-['Chewy'] tracking-wide text-2xl">Save Your Story</h3>
                  <p className="text-slate-400 text-sm text-center mb-6">Choose how you want to save your work.</p>
                  
                  <div className="grid gap-4">

                      <button 
                        onClick={executeSaveNGL}
                        className="group flex items-start gap-4 p-4 rounded-xl border border-slate-600 hover:border-orange-500 bg-slate-700/50 hover:bg-slate-700 transition-all text-left"
                      >
                          <div className="p-3 bg-slate-800 rounded-lg group-hover:bg-orange-500/20 group-hover:text-orange-400 transition-colors">
                            <FileJsonIcon />
                          </div>
                          <div>
                              <h4 className="font-bold text-slate-200 group-hover:text-white">Save Raw Data (.ngl)</h4>
                              <p className="text-xs text-slate-400 mt-1">Saves a compressed data file. Pick up from where you left any time!</p>
                          </div>
                      </button>

                      <button 
                        onClick={executeSaveProject}
                        className="group flex items-start gap-4 p-4 rounded-xl border border-slate-600 hover:border-orange-500 bg-slate-700/50 hover:bg-slate-700 transition-all text-left"
                      >
                          <div className="p-3 bg-slate-800 rounded-lg group-hover:bg-orange-500/20 group-hover:text-orange-400 transition-colors">
                            <FileCodeIcon />
                          </div>
                          <div>
                              <h4 className="font-bold text-slate-200 group-hover:text-white">Save Project (.png)</h4>
                              <p className="text-xs text-slate-400 mt-1">Saves an editable file containing the image and all your edits. Big file!</p>
                          </div>
                      </button>

                      <button 
                        onClick={executeDownloadJPG}
                        className="group flex items-start gap-4 p-4 rounded-xl border border-slate-600 hover:border-orange-500 bg-slate-700/50 hover:bg-slate-700 transition-all text-left"
                      >
                           <div className="p-3 bg-slate-800 rounded-lg group-hover:bg-orange-500/20 group-hover:text-orange-400 transition-colors">
                            <FileImageIcon />
                          </div>
                          <div>
                              <h4 className="font-bold text-slate-200 group-hover:text-white">Download Image (.jpg)</h4>
                              <p className="text-xs text-slate-400 mt-1">Exports a flattened high-quality image for sharing on social media.</p>
                          </div>
                      </button>

                  </div>

                  <button 
                    onClick={() => setIsSaveModalOpen(false)}
                    className="mt-6 w-full py-2 text-sm text-slate-500 hover:text-slate-300 font-medium"
                  >
                      Cancel
                  </button>
              </div>
          </div>
      )}

      {/* Sidebar - Widened to w-96 */}
      <aside className="w-96 bg-slate-900 border-r border-slate-800 flex flex-col z-20 shadow-xl">
        {/* Sidebar Header with Logo and Project Controls */}
        <div className="p-6 border-b border-slate-800 flex flex-col gap-4">
           <Logo />
           <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500 font-['Chewy'] tracking-wide text-lg text-amber-500/80 -mt-1 ml-14">
                Based on a true story 😜
              </p>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <section>
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500"></span>
              Set the Scene
            </h2>
            
            {state.baseImage ? (
                <div className="space-y-3">
                    <div className="rounded-lg overflow-hidden border border-slate-700 aspect-video bg-black relative group shadow-md">
                        <img src={state.baseImage} alt="Base" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                             <ImageUploader 
                                id="base-change"
                                label="Change Image" 
                                onUpload={handleBaseImageUpload} 
                             />
                        </div>
                    </div>
                </div>
            ) : (
                <ImageUploader 
                  id="base-upload"
                  label="Upload Landscape" 
                  onUpload={handleBaseImageUpload} 
                />
            )}
          </section>

          {/* Only show object controls if we have a scene */}
          {state.baseImage && (
            <section className="animate-fade-in">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                Build Your Story
              </h2>
              
              {/* 1. Object Settings (If Selected) */}
              {selectedItem && !selectedItem.isProcessing && (
                <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 mb-6 shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs uppercase font-semibold text-slate-400 tracking-wider">Settings</h3>
                      <span className="text-xs text-amber-400 font-mono font-bold">{selectedItem.name}</span>
                  </div>
                  
                  {/* Style Selector */}
                  <div className="mb-4">
                     <label className="text-[10px] text-slate-500 font-bold uppercase mb-2 block flex items-center gap-1">
                        <StyleIcon /> Layer Style
                     </label>
                     <div className="grid grid-cols-3 gap-1">
                        {styles.map(s => (
                            <button
                                key={s.id}
                                onClick={() => updateItem(selectedItem.id, { style: s.id })}
                                className={`text-[10px] py-1.5 px-1 rounded font-medium border transition-all
                                   ${selectedItem.style === s.id 
                                     ? 'bg-orange-500/20 border-orange-500 text-orange-200' 
                                     : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-700'
                                   }
                                `}
                            >
                                {s.label}
                            </button>
                        ))}
                     </div>
                  </div>
    
                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-700">
                        {/* Row 1: Mirror & Mask */}
                        <button
                            onClick={() => updateItem(selectedItem.id, { isMirrored: !selectedItem.isMirrored })}
                            className={`p-2 rounded-md transition-all flex items-center justify-center gap-2 border ${selectedItem.isMirrored ? 'bg-slate-700 border-orange-500/50 text-orange-400' : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600 hover:text-slate-200'}`}
                            title="Flip Horizontal"
                          >
                            <MirrorIcon />
                            <span className="text-[10px] font-medium">Flip</span>
                        </button>
                        
                        <button
                          onClick={() => updateItem(selectedItem.id, { showCutout: !selectedItem.showCutout })}
                          className={`p-2 rounded-md transition-all flex items-center justify-center gap-2 border ${
                              selectedItem.showCutout 
                                  ? 'bg-slate-700 border-orange-500/50 text-orange-400' 
                                  : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600 hover:text-slate-200'
                          }`}
                        >
                          <ScissorsIcon />
                          <span className="text-[10px] font-medium">{selectedItem.showCutout ? 'Mask On' : 'Mask Off'}</span>
                        </button>

                        {/* Row 2: Invert & Delete */}
                        <button
                          onClick={() => updateCompositing(selectedItem.id, !selectedItem.invertMask)}
                          className={`p-2 rounded-md transition-all flex items-center justify-center gap-2 border ${
                              selectedItem.invertMask 
                                  ? 'bg-slate-700 border-orange-500/50 text-orange-400' 
                                  : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600 hover:text-slate-200'
                          }`}
                        >
                          <InvertIcon />
                          <span className="text-[10px] font-medium">Invert</span>
                        </button>

                        <button 
                          onClick={() => removeItem(selectedItem.id)}
                          className="p-2 rounded-md transition-all flex items-center justify-center gap-2 border bg-slate-700 border-slate-600 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
                        >
                          <TrashIcon />
                          <span className="text-[10px] font-medium">Delete</span>
                        </button>

                        {/* Row 3: Retry (Wide) */}
                        <button 
                          onClick={(e) => handleRetry(selectedItem.id, e)}
                          className="col-span-2 p-3 rounded-md transition-all flex items-center justify-center gap-2 border bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600 hover:text-white hover:border-slate-500 mt-1 group"
                        >
                          <div className="group-hover:text-blue-400 transition-colors">
                              <GeminiIcon />
                          </div>
                          <span className="text-[11px] font-bold uppercase tracking-wider">Retry Extraction</span>
                        </button>
                  </div>
                </div>
              )}

              {/* 2. Add Object Uploader */}
              <ImageUploader 
                id="source-upload"
                label="Add Object" 
                onUpload={handleSourceImageUpload}
                isLoading={state.items.some(i => i.isProcessing)}
              />
              
              {/* 3. Object List */}
              <div className="space-y-2 mt-4">
                {reversedItems.map((item, index) => (
                  <div 
                    key={item.id}
                    draggable
                    onDragStart={() => (draggingItemRef.current = index)}
                    onDragEnter={() => (dragOverItemRef.current = index)}
                    onDragEnd={handleSort}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => selectItem(item.id)}
                    className={`flex items-center p-2 rounded-md cursor-pointer transition-all border ${state.selectedItemId === item.id ? 'bg-orange-900/20 border-orange-500/50 shadow-md' : 'bg-slate-800 border-transparent hover:bg-slate-750 hover:border-slate-700'}`}
                  >
                    <div className="mr-2 text-slate-600 cursor-grab hover:text-slate-400 active:cursor-grabbing" title="Drag to reorder">
                      <GripVerticalIcon />
                    </div>
                    <div className="w-10 h-10 bg-slate-950 rounded overflow-hidden flex-shrink-0 relative border border-slate-700">
                        {item.isProcessing ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                                <div className="w-4 h-4 rounded-full border border-t-transparent border-white animate-spin"></div>
                            </div>
                        ) : (
                          <img 
                            src={item.showCutout && item.processedSrc ? item.processedSrc : item.originalSrc} 
                            className="w-full h-full object-cover" 
                            alt="" 
                          />
                        )}
                    </div>
                    <div className="ml-3 overflow-hidden flex-1">
                        <div className="flex justify-between items-center">
                            <p className={`text-sm font-medium truncate capitalize ${state.selectedItemId === item.id ? 'text-orange-200' : 'text-slate-300'}`}>{item.name}</p>
                            {item.style !== 'normal' && (
                                <span className="text-[8px] bg-slate-700 px-1 rounded uppercase text-slate-400">{item.style}</span>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-500">{item.isProcessing ? 'Processing...' : 'Ready'}</p>
                    </div>
                  </div>
                ))}
                {state.items.length === 0 && (
                    <p className="text-xs text-slate-600 italic text-center py-4">No objects added yet.</p>
                )}
              </div>
            </section>
          )}

        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-900">
           <button 
             onClick={openSaveModal}
             disabled={!state.baseImage}
             className={`w-full py-3 px-4 rounded-lg font-bold text-sm uppercase tracking-wide flex items-center justify-center gap-2 transition-all transform active:scale-95
               ${state.baseImage 
                 ? 'bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 shadow-lg shadow-orange-500/20 text-white' 
                 : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
           >
             <SaveDiskIcon />
             Save / Download
           </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative min-w-0 min-h-0">
        
        {/* Toast Notification - Moved inside Canvas Area */}
        {notification && (
          <div className={`absolute bottom-12 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-2xl font-medium animate-toast-slide-up flex items-center gap-2 ${
            notification.isError 
              ? 'bg-red-500 text-white border border-red-400' 
              : 'bg-emerald-600 text-white border border-emerald-500'
          }`}>
            {notification.isError && <span className="text-lg">⚠️</span>}
            {notification.message}
          </div>
        )}

        {state.baseImage ? (
           <Canvas 
             baseImage={state.baseImage}
             items={state.items}
             selectedItemId={state.selectedItemId}
             onSelectItem={selectItem}
             onUpdateItem={updateItem}
             onRemoveItem={removeItem}
             onDimensionsLoaded={handleCanvasDimensions}
             exportRef={exportContainerRef}
           />
        ) : (
          /* Empty State / Welcome Splash / Drop Zone */
          <div className="flex-1 flex flex-col items-center justify-center bg-dot-grid relative overflow-hidden animate-fade-in">
             <div className="scale-[3] transform p-10 opacity-50 hover:opacity-100 transition-opacity duration-1000 grayscale hover:grayscale-0">
                <Logo />
             </div>
             <p className="mt-8 text-slate-500 text-2xl font-['Chewy'] animate-pulse tracking-wide">
               Set the scene to begin.
             </p>
             <p className="mt-2 text-slate-600 text-xs">
               Or drag & drop a saved project file here
             </p>
          </div>
        )}
        
        <div className="absolute bottom-1 right-2 text-[10px] text-slate-500/80 pointer-events-none select-none font-mono z-0">
           POWERED BY GEMINI 3 PRO
        </div>
      </main>

      <style>{`
        @keyframes bounce-in {
          0% { transform: translate(-50%, -200%); opacity: 0; }
          60% { transform: translate(-50%, 10%); opacity: 1; }
          100% { transform: translate(-50%, 0); opacity: 1; }
        }
        .animate-bounce-in {
          animation: bounce-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }

        @keyframes toast-slide-up {
          0% { transform: translate(-50%, 150%); opacity: 0; }
          60% { transform: translate(-50%, -10%); opacity: 1; }
          100% { transform: translate(-50%, 0); opacity: 1; }
        }
        .animate-toast-slide-up {
          animation: toast-slide-up 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
      `}</style>
    </div>
  );
};

export default App;