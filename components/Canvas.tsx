
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { CollageItem, DragMode, Position, LayerStyle } from '../types';

interface CanvasProps {
  baseImage: string | null;
  items: CollageItem[];
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  onUpdateItem: (id: string, updates: Partial<CollageItem>) => void;
  onRemoveItem: (id: string) => void;
  onDimensionsLoaded: (width: number, height: number) => void;
  exportRef: React.MutableRefObject<HTMLDivElement | null>;
}

export const Canvas: React.FC<CanvasProps> = ({
  baseImage,
  items,
  selectedItemId,
  onSelectItem,
  onUpdateItem,
  onDimensionsLoaded,
  exportRef
}) => {
  const [dragMode, setDragMode] = useState<DragMode>(DragMode.NONE);
  const [startPos, setStartPos] = useState<Position>({ x: 0, y: 0 });
  const [initialItemState, setInitialItemState] = useState<{ 
    pos: Position; 
    size: { width: number; height: number }; 
    rotation: number;
    crop: { top: number; bottom: number; left: number; right: number };
  } | null>(null);

  // Resolution Independence State
  const [scale, setScale] = useState<number>(1);
  const [baseDimensions, setBaseDimensions] = useState<{ width: number, height: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Determine Natural Dimensions of the Base Image
  useEffect(() => {
    if (baseImage) {
        const img = new Image();
        img.onload = () => {
            setBaseDimensions({ width: img.naturalWidth, height: img.naturalHeight });
            onDimensionsLoaded(img.naturalWidth, img.naturalHeight);
        };
        img.src = baseImage;
    } else {
        setBaseDimensions(null);
    }
  }, [baseImage, onDimensionsLoaded]);

  // 2. Calculate Scale to Fit Container (ResizeObserver)
  useEffect(() => {
    if (!containerRef.current || !baseDimensions) return;

    const updateScale = () => {
        if (!containerRef.current || !baseDimensions) return;
        
        const containerW = containerRef.current.clientWidth;
        const containerH = containerRef.current.clientHeight;
        const padding = 40; // Space for comfort
        
        const availW = containerW - padding;
        const availH = containerH - padding;

        const scaleW = availW / baseDimensions.width;
        const scaleH = availH / baseDimensions.height;

        // "Fit inside" logic
        setScale(Math.min(scaleW, scaleH));
    };

    const observer = new ResizeObserver(updateScale);
    observer.observe(containerRef.current);
    updateScale(); // Initial call

    return () => observer.disconnect();
  }, [baseDimensions]);

  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || e.target === exportRef.current) {
      onSelectItem(null);
    }
  };

  const handleMouseDown = (e: React.MouseEvent, item: CollageItem, mode: DragMode) => {
    e.stopPropagation();
    onSelectItem(item.id);
    setDragMode(mode);
    setStartPos({ x: e.clientX, y: e.clientY });
    setInitialItemState({
      pos: { ...item.position },
      size: { ...item.size },
      rotation: item.rotation,
      crop: { ...item.crop }
    });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragMode === DragMode.NONE || !selectedItemId || !initialItemState) return;

    // ADJUST DELTA BY SCALE (Resolution Independence)
    const dx = (e.clientX - startPos.x) / scale;
    const dy = (e.clientY - startPos.y) / scale;
    
    if (dragMode === DragMode.DRAG) {
      onUpdateItem(selectedItemId, {
        position: {
          x: initialItemState.pos.x + dx,
          y: initialItemState.pos.y + dy
        }
      });
      return;
    }

    if (dragMode === DragMode.ROTATE) {
      if (!exportRef.current) return;
      
      // Calculate center of item in SCREEN coordinates
      // 1. Item Pos relative to canvas top-left (unscaled)
      const visW_pct = (100 - initialItemState.crop.left - initialItemState.crop.right) / 100;
      const visH_pct = (100 - initialItemState.crop.top - initialItemState.crop.bottom) / 100;
      const offX = initialItemState.size.width * (initialItemState.crop.left / 100);
      const offY = initialItemState.size.height * (initialItemState.crop.top / 100);
      
      const itemCenterX_unscaled = initialItemState.pos.x + offX + (initialItemState.size.width * visW_pct) / 2;
      const itemCenterY_unscaled = initialItemState.pos.y + offY + (initialItemState.size.height * visH_pct) / 2;

      // 2. Project to screen
      // getBoundingClientRect includes the transform (translate + scale), so left/top are visual screen coords
      const canvasRect = exportRef.current.getBoundingClientRect();
      const screenCenterX = canvasRect.left + (itemCenterX_unscaled * scale);
      const screenCenterY = canvasRect.top + (itemCenterY_unscaled * scale);
      
      const angle = Math.atan2(e.clientY - screenCenterY, e.clientX - screenCenterX);
      const deg = angle * (180 / Math.PI) + 90; 
      
      onUpdateItem(selectedItemId, {
        rotation: deg
      });
      return;
    }

    const aspectRatio = initialItemState.size.width / initialItemState.size.height;

    if ([DragMode.RESIZE_TL, DragMode.RESIZE_TR, DragMode.RESIZE_BL, DragMode.RESIZE_BR].includes(dragMode)) {
        const visW_pct = (100 - initialItemState.crop.left - initialItemState.crop.right) / 100;
        const visH_pct = (100 - initialItemState.crop.top - initialItemState.crop.bottom) / 100;
        
        const scaleX = visW_pct > 0.05 ? 1 / visW_pct : 1;
        const effectiveDx = dx * scaleX;

        let newWidth = initialItemState.size.width;
        let newHeight = initialItemState.size.height;
        let newX = initialItemState.pos.x;
        let newY = initialItemState.pos.y;

        switch (dragMode) {
            case DragMode.RESIZE_TL:
                newWidth = Math.max(50, initialItemState.size.width - effectiveDx);
                newHeight = newWidth / aspectRatio;
                newX = initialItemState.pos.x + (initialItemState.size.width - newWidth);
                newY = initialItemState.pos.y + (initialItemState.size.height - newHeight);
                break;

            case DragMode.RESIZE_TR:
                newWidth = Math.max(50, initialItemState.size.width + effectiveDx);
                newHeight = newWidth / aspectRatio;
                newY = initialItemState.pos.y + (initialItemState.size.height - newHeight);
                break;

            case DragMode.RESIZE_BL:
                newWidth = Math.max(50, initialItemState.size.width - effectiveDx);
                newHeight = newWidth / aspectRatio;
                newX = initialItemState.pos.x + (initialItemState.size.width - newWidth);
                break;

            case DragMode.RESIZE_BR:
                newWidth = Math.max(50, initialItemState.size.width + effectiveDx);
                newHeight = newWidth / aspectRatio;
                break;
        }

        onUpdateItem(selectedItemId, {
            size: { width: newWidth, height: newHeight },
            position: { x: newX, y: newY }
        });
        return;
    }

    if ([DragMode.CROP_T, DragMode.CROP_B, DragMode.CROP_L, DragMode.CROP_R].includes(dragMode)) {
        const pxToPctX = (val: number) => (val / initialItemState.size.width) * 100;
        const pxToPctY = (val: number) => (val / initialItemState.size.height) * 100;

        let { top, bottom, left, right } = initialItemState.crop;

        switch(dragMode) {
            case DragMode.CROP_T:
                top = Math.min(Math.max(0, initialItemState.crop.top + pxToPctY(dy)), 90 - initialItemState.crop.bottom);
                break;
            case DragMode.CROP_B:
                bottom = Math.min(Math.max(0, initialItemState.crop.bottom - pxToPctY(dy)), 90 - initialItemState.crop.top);
                break;
            case DragMode.CROP_L:
                left = Math.min(Math.max(0, initialItemState.crop.left + pxToPctX(dx)), 90 - initialItemState.crop.right);
                break;
            case DragMode.CROP_R:
                right = Math.min(Math.max(0, initialItemState.crop.right - pxToPctX(dx)), 90 - initialItemState.crop.left);
                break;
        }

        onUpdateItem(selectedItemId, {
            crop: { top, bottom, left, right }
        });
    }

  }, [dragMode, selectedItemId, startPos, initialItemState, onUpdateItem, scale]);

  const handleMouseUp = useCallback(() => {
    setDragMode(DragMode.NONE);
    setInitialItemState(null);
  }, []);

  useEffect(() => {
    if (dragMode !== DragMode.NONE) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragMode, handleMouseMove, handleMouseUp]);

  const getFilterClass = (style: LayerStyle) => {
    switch(style) {
        case 'sticker': return '';
        case 'ghost': return 'filter-ghost'; 
        case 'ink': return 'filter-ink';
        case 'pumpkin': return 'filter-pumpkin';
        default: return '';
    }
  };

  const getAnimationClass = (style: LayerStyle) => {
      switch(style) {
          case 'ghost': return 'anim-float-ghost';
          case 'pumpkin': return 'anim-shimmer-fire';
          default: return '';
      }
  };

  // Generate dynamic inline styles for the Sticker effect
  const generateStickerStyle = (item: CollageItem) => {
    if (item.style !== 'sticker') return {};
    const thickness = Math.max(3, Math.round(item.size.width * 0.002));
    
    return {
        filter: `
            drop-shadow(0px -${thickness}px 0px white) 
            drop-shadow(0px ${thickness}px 0px white) 
            drop-shadow(-${thickness}px 0px 0px white) 
            drop-shadow(${thickness}px 0px 0px white)
            drop-shadow(-${thickness*0.7}px -${thickness*0.7}px 0px white)
            drop-shadow(${thickness*0.7}px -${thickness*0.7}px 0px white)
            drop-shadow(-${thickness*0.7}px ${thickness*0.7}px 0px white)
            drop-shadow(${thickness*0.7}px ${thickness*0.7}px 0px white)
            drop-shadow(2px 4px 8px rgba(0,0,0,0.3))
        `
    };
  };

  // Dimensions for the style attribute
  const canvasStyle = baseDimensions 
    ? {
        width: baseDimensions.width,
        height: baseDimensions.height,
        // Center with absolute positioning and scale
        transform: `translate(-50%, -50%) scale(${scale})`,
        transformOrigin: 'center center'
      }
    : {
        width: '800px',
        height: '600px',
        transform: `translate(-50%, -50%) scale(${scale})`,
        transformOrigin: 'center center'
      };

  return (
    <div 
      className="w-full h-full bg-dot-grid relative overflow-hidden select-none"
      onClick={handleBackgroundClick}
      ref={containerRef}
    >
      <div 
        ref={exportRef}
        id="canvas-export-div"
        className="absolute top-1/2 left-1/2 shadow-2xl bg-black transition-transform duration-200 ease-out overflow-hidden"
        style={canvasStyle}
      >
        {baseImage && (
          <img 
            id="canvas-base-image"
            src={baseImage} 
            alt="Background" 
            className="w-full h-full object-contain pointer-events-none animate-grain-reveal"
          />
        )}

        {items.map(item => {
          const originX = item.crop.left + (100 - item.crop.left - item.crop.right) / 2;
          const originY = item.crop.top + (100 - item.crop.top - item.crop.bottom) / 2;
          
          // Helper to scale handle sizes inversely so they don't get tiny when zoomed out
          const handleScale = 1 / scale; 

          return (
          <div
            key={item.id}
            className={`absolute group`}
            style={{
              left: item.position.x,
              top: item.position.y,
              width: item.size.width,
              height: item.size.height,
              zIndex: item.zIndex,
              transform: `rotate(${item.rotation}deg)`,
              transformOrigin: `${originX}% ${originY}%`,
              cursor: dragMode === DragMode.NONE ? 'grab' : 'grabbing',
            }}
            onMouseDown={(e) => handleMouseDown(e, item, DragMode.DRAG)}
          >
            <div className={`w-full h-full relative`} style={{ 
                clipPath: `inset(${item.crop.top}% ${item.crop.right}% ${item.crop.bottom}% ${item.crop.left}%)`,
                transition: 'clip-path 0.1s ease-out'
            }}>
                {item.isProcessing && (
                    <div className="absolute inset-0 z-10 pointer-events-none">
                        <img 
                            src={item.originalSrc}
                            alt="Loading"
                            className="w-full h-full object-contain opacity-40 transition-opacity duration-1000"
                        />
                        <div className="absolute bottom-4 left-4 right-4 h-2 bg-slate-700/50 rounded-full overflow-hidden backdrop-blur-sm">
                            <div className="h-full bg-orange-500 animate-progress-real"></div>
                        </div>
                    </div>
                )}
                
                {/* 
                   Animation Wrapper: Handles animation transforms (translateY).
                   This is SEPARATE from the image to prevent conflict with scaleX mirroring.
                */}
                <div className={`w-full h-full ${getAnimationClass(item.style)}`}>
                    <img 
                        src={(item.showCutout && item.processedSrc) ? item.processedSrc : item.originalSrc} 
                        alt={item.name}
                        className={`w-full h-full object-contain select-none transition-opacity duration-700 ${getFilterClass(item.style)}
                           ${item.isProcessing ? 'opacity-0' : 'opacity-100'}
                        `}
                        draggable={false}
                        style={{ 
                            // Transform (Mirroring) is applied directly to the image
                            transform: item.isMirrored ? 'scaleX(-1)' : 'none',
                            ...generateStickerStyle(item)
                        }}
                    />
                </div>
            </div>
            
            {selectedItemId === item.id && (
              <div 
                className="absolute border border-orange-500 pointer-events-none"
                style={{
                  top: `${item.crop.top}%`,
                  bottom: `${item.crop.bottom}%`,
                  left: `${item.crop.left}%`,
                  right: `${item.crop.right}%`,
                  borderWidth: `${2 * handleScale}px`
                }}
              >
                {/* Resize Handles - Scaled to remain visible */}
                <div 
                  className="absolute bg-white border border-orange-500 rounded-full cursor-nw-resize pointer-events-auto shadow-sm hover:scale-125 transition-transform"
                  style={{ width: `${12*handleScale}px`, height: `${12*handleScale}px`, top: `-${6*handleScale}px`, left: `-${6*handleScale}px`, borderWidth: `${1*handleScale}px` }}
                  onMouseDown={(e) => handleMouseDown(e, item, DragMode.RESIZE_TL)}
                />
                <div 
                  className="absolute bg-white border border-orange-500 rounded-full cursor-ne-resize pointer-events-auto shadow-sm hover:scale-125 transition-transform"
                  style={{ width: `${12*handleScale}px`, height: `${12*handleScale}px`, top: `-${6*handleScale}px`, right: `-${6*handleScale}px`, borderWidth: `${1*handleScale}px` }}
                  onMouseDown={(e) => handleMouseDown(e, item, DragMode.RESIZE_TR)}
                />
                <div 
                  className="absolute bg-white border border-orange-500 rounded-full cursor-sw-resize pointer-events-auto shadow-sm hover:scale-125 transition-transform"
                  style={{ width: `${12*handleScale}px`, height: `${12*handleScale}px`, bottom: `-${6*handleScale}px`, left: `-${6*handleScale}px`, borderWidth: `${1*handleScale}px` }}
                  onMouseDown={(e) => handleMouseDown(e, item, DragMode.RESIZE_BL)}
                />
                <div 
                  className="absolute bg-white border border-orange-500 rounded-full cursor-se-resize pointer-events-auto shadow-sm hover:scale-125 transition-transform"
                  style={{ width: `${12*handleScale}px`, height: `${12*handleScale}px`, bottom: `-${6*handleScale}px`, right: `-${6*handleScale}px`, borderWidth: `${1*handleScale}px` }}
                  onMouseDown={(e) => handleMouseDown(e, item, DragMode.RESIZE_BR)}
                />
                
                {/* Rotate Handle */}
                <div 
                  className="absolute flex items-center justify-center cursor-pointer pointer-events-auto group-hover/rotate"
                  style={{ top: `-${32*handleScale}px`, left: '50%', transform: 'translateX(-50%)', width: `${32*handleScale}px`, height: `${32*handleScale}px` }}
                  onMouseDown={(e) => handleMouseDown(e, item, DragMode.ROTATE)}
                  title="Rotate"
                >
                   <div className="bg-white border-2 border-orange-500 rounded-full shadow-sm" style={{ width: `${12*handleScale}px`, height: `${12*handleScale}px`, borderWidth: `${2*handleScale}px` }}></div>
                   <div className="absolute bg-orange-500" style={{ top: `${20*handleScale}px`, height: `${12*handleScale}px`, width: `${2*handleScale}px` }}></div>
                </div>

                {/* Crop Handles */}
                <div 
                    className="absolute left-1/2 -translate-x-1/2 bg-white/80 border border-orange-500 rounded-full cursor-ns-resize pointer-events-auto hover:bg-orange-100"
                    style={{ width: `${24*handleScale}px`, height: `${8*handleScale}px`, top: `-${4*handleScale}px`, borderWidth: `${1*handleScale}px` }}
                    onMouseDown={(e) => handleMouseDown(e, item, DragMode.CROP_T)}
                />
                <div 
                    className="absolute left-1/2 -translate-x-1/2 bg-white/80 border border-orange-500 rounded-full cursor-ns-resize pointer-events-auto hover:bg-orange-100"
                    style={{ width: `${24*handleScale}px`, height: `${8*handleScale}px`, bottom: `-${4*handleScale}px`, borderWidth: `${1*handleScale}px` }}
                    onMouseDown={(e) => handleMouseDown(e, item, DragMode.CROP_B)}
                />
                <div 
                    className="absolute top-1/2 -translate-y-1/2 bg-white/80 border border-orange-500 rounded-full cursor-ew-resize pointer-events-auto hover:bg-orange-100"
                    style={{ width: `${8*handleScale}px`, height: `${24*handleScale}px`, left: `-${4*handleScale}px`, borderWidth: `${1*handleScale}px` }}
                    onMouseDown={(e) => handleMouseDown(e, item, DragMode.CROP_L)}
                />
                <div 
                    className="absolute top-1/2 -translate-y-1/2 bg-white/80 border border-orange-500 rounded-full cursor-ew-resize pointer-events-auto hover:bg-orange-100"
                    style={{ width: `${8*handleScale}px`, height: `${24*handleScale}px`, right: `-${4*handleScale}px`, borderWidth: `${1*handleScale}px` }}
                    onMouseDown={(e) => handleMouseDown(e, item, DragMode.CROP_R)}
                />

              </div>
            )}
          </div>
        )})}
      </div>
      
      <style>{`
        @keyframes progress-real {
          0% { width: 0%; }
          10% { width: 20%; }
          40% { width: 50%; }
          70% { width: 80%; }
          90% { width: 95%; }
          100% { width: 100%; }
        }
        .animate-progress-real { animation: progress-real 8s ease-out forwards; }
        
        @keyframes float-ghost {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }

        @keyframes shimmer-fire {
            0% { filter: drop-shadow(0 0 5px #f97316) drop-shadow(0 0 10px #fbbf24) brightness(1.1); }
            50% { filter: drop-shadow(0 0 15px #f97316) drop-shadow(0 0 25px #fbbf24) brightness(1.3); }
            100% { filter: drop-shadow(0 0 5px #f97316) drop-shadow(0 0 10px #fbbf24) brightness(1.1); }
        }

        @keyframes grain-reveal {
            0% { opacity: 0; filter: contrast(200%) brightness(50%) sepia(100%); transform: scale(1.05); }
            50% { opacity: 0.5; filter: contrast(150%) brightness(80%) sepia(50%); }
            100% { opacity: 1; filter: contrast(100%) brightness(100%) sepia(0%); transform: scale(1); }
        }
        .animate-grain-reveal {
            animation: grain-reveal 2s ease-out forwards;
        }

        .filter-ghost {
            filter: grayscale(100%) sepia(100%) hue-rotate(190deg) saturate(150%) opacity(0.77) drop-shadow(0 0 8px rgba(150, 220, 255, 0.4));
        }
        
        /* Animation applied to wrapper */
        .anim-float-ghost {
            animation: float-ghost 3s ease-in-out infinite;
        }

        .filter-pumpkin {
            filter: sepia(0.5) contrast(1.2) brightness(0.9) drop-shadow(4px 4px 0px rgba(255,100,0,0.3));
        }
        
        .anim-shimmer-fire {
            animation: shimmer-fire 2s infinite ease-in-out;
        }

        .filter-ink {
            filter: grayscale(100%) contrast(150%) brightness(0.8) opacity(0.85);
        }
      `}</style>
    </div>
  );
};
