
import React, { useState, useRef, useEffect } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { Canvas } from './components/Canvas';
import { extractObjectFromImage } from './services/geminiService';
import { applyMask, analyzeImageContent, loadImage, calculateInitialSize } from './utils/imageUtils';
import { saveProject, loadProject } from './utils/projectUtils';
import { CollageItem, AppState, LayerStyle } from './types';
import { MagicIcon, DownloadIcon, TrashIcon, RefreshIcon, InvertIcon, MirrorIcon, GripVerticalIcon, FolderIcon, SaveDiskIcon, StyleIcon } from './components/Icons';
import { Logo } from './components/Logo';
import html2canvas from 'html2canvas';
import confetti from 'canvas-confetti';

const App: React.FC = () => {
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [apiKeyLoading, setApiKeyLoading] = useState<boolean>(true);

  const [state, setState] = useState<AppState>({
    baseImage: null,
    items: [],
    selectedItemId: null,
    isExporting: false
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

  const handleConnectApiKey = async () => {
    try {
      if (window.aistudio && window.aistudio.openSelectKey) {
        await window.aistudio.openSelectKey();
        setHasApiKey(true);
      }
    } catch (e) {
      console.error("Error selecting API key", e);
      alert("Failed to select API key. Please try again.");
    }
  };

  const handleBaseImageUpload = (base64: string) => {
    setState(prev => ({ ...prev, baseImage: base64 }));
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

    } catch (error) {
      console.error("Processing failed", error);
      setState(prev => ({
        ...prev,
        items: prev.items.map(item => 
          item.id === itemId 
            ? { ...item, isProcessing: false }
            : item
        )
      }));
      alert("Extraction failed. Please try again.");
    }
  };

  const handleSourceImageUpload = async (base64: string) => {
    const newId = Date.now().toString();
    const maxZ = state.items.length > 0 ? Math.max(...state.items.map(i => i.zIndex)) : 0;
    const objectCount = state.items.length + 1;

    let initialWidth = 200;
    let initialHeight = 200;
    try {
      const img = await loadImage(base64);
      const size = calculateInitialSize(img.width, img.height, 300);
      initialWidth = size.width;
      initialHeight = size.height;
    } catch (e) {
      console.error("Failed to load source image for dimensions", e);
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
      position: { x: 50 + state.items.length * 20, y: 50 + state.items.length * 20 },
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

  const handleDownload = async () => {
    if (!exportContainerRef.current) return;
    
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#f97316', '#fbbf24', '#ffffff'] // Orange/Yellow/White confetti
    });

    selectItem(null);
    setTimeout(async () => {
        try {
            if(!exportContainerRef.current) return;
            const canvas = await html2canvas(exportContainerRef.current, {
                useCORS: true,
                backgroundColor: null,
                scale: 2
            });
            const link = document.createElement('a');
            link.download = 'ngl-story.jpg';
            link.href = canvas.toDataURL('image/jpeg', 0.9);
            link.click();
        } catch (e) {
            console.error("Export failed", e);
            alert("Could not export image.");
        }
    }, 100);
  };

  const handleSaveProject = () => {
    saveProject(state);
  };

  const handleLoadProject = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const loadedState = await loadProject(e.target.files[0]);
        setState(loadedState);
        // Clear input
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (error) {
        alert("Failed to load project file.");
        console.error(error);
      }
    }
  };

  const styles: { id: LayerStyle; label: string; }[] = [
    { id: 'normal', label: 'Normal' },
    { id: 'sticker', label: 'Sticker' },
    { id: 'ghost', label: 'Ghost' },
    { id: 'ink', label: 'Ink' },
    { id: 'retro', label: 'Retro' },
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
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to ngl v1.0</h1>
          <p className="text-slate-400 mb-8">
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
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden relative">
      <aside className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col z-20 shadow-xl">
        {/* Sidebar Header with Logo and Project Controls */}
        <div className="p-6 border-b border-slate-800 flex flex-col gap-4">
           <Logo />
           <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 font-medium tracking-wide">
                Based on a true story 😉
              </p>
              
              <div className="flex gap-2">
                 <input 
                    type="file" 
                    accept=".json" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleLoadProject} 
                 />
                 <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                    title="Load Project"
                 >
                    <FolderIcon />
                 </button>
                 <button 
                    onClick={handleSaveProject}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                    title="Save Project"
                 >
                    <SaveDiskIcon />
                 </button>
              </div>
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
                        <button
                            onClick={() => updateItem(selectedItem.id, { isMirrored: !selectedItem.isMirrored })}
                            className={`p-2 rounded-md transition-all flex items-center justify-center gap-2 border ${selectedItem.isMirrored ? 'bg-slate-700 border-orange-500/50 text-orange-400' : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600 hover:text-slate-200'}`}
                          >
                            <MirrorIcon />
                            <span className="text-[10px] font-medium">Mirror</span>
                        </button>

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
                          onClick={(e) => handleRetry(selectedItem.id, e)}
                          className="p-2 rounded-md transition-all flex items-center justify-center gap-2 border bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600 hover:text-slate-200"
                        >
                          <RefreshIcon />
                          <span className="text-[10px] font-medium">Retry</span>
                        </button>

                        <button 
                          onClick={() => removeItem(selectedItem.id)}
                          className="p-2 rounded-md transition-all flex items-center justify-center gap-2 border bg-slate-700 border-slate-600 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
                        >
                          <TrashIcon />
                          <span className="text-[10px] font-medium">Delete</span>
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
             onClick={handleDownload}
             disabled={!state.baseImage}
             className={`w-full py-3 px-4 rounded-lg font-bold text-sm uppercase tracking-wide flex items-center justify-center gap-2 transition-all transform active:scale-95
               ${state.baseImage 
                 ? 'bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 shadow-lg shadow-orange-500/20 text-white' 
                 : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
           >
             <DownloadIcon />
             Save Composition
           </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative">
        {state.baseImage ? (
           <Canvas 
             baseImage={state.baseImage}
             items={state.items}
             selectedItemId={state.selectedItemId}
             onSelectItem={selectItem}
             onUpdateItem={updateItem}
             onRemoveItem={removeItem}
             exportRef={exportContainerRef}
           />
        ) : (
          /* Empty State / Welcome Splash */
          <div className="flex-1 flex flex-col items-center justify-center bg-dot-grid relative overflow-hidden animate-fade-in">
             <div className="scale-[3] transform p-10 opacity-50 hover:opacity-100 transition-opacity duration-1000 grayscale hover:grayscale-0">
                <Logo />
             </div>
             <p className="mt-8 text-slate-500 text-lg font-medium animate-pulse">
               Set the scene to begin.
             </p>
          </div>
        )}
        
        <div className="absolute bottom-4 right-4 text-[10px] text-slate-600 pointer-events-none select-none font-mono">
           POWERED BY GEMINI 3 PRO
        </div>
      </main>
    </div>
  );
};

export default App;
