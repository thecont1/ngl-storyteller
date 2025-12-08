
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { CollageItem, DragMode, Position, LayerStyle } from '../types';

interface CanvasProps {
  baseImage: string | null;
  items: CollageItem[];
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  onUpdateItem: (id: string, updates: Partial<CollageItem>) => void;
  onRemoveItem: (id: string) => void;
  exportRef: React.MutableRefObject<HTMLDivElement | null>;
}

export const Canvas: React.FC<CanvasProps> = ({
  baseImage,
  items,
  selectedItemId,
  onSelectItem,
  onUpdateItem,
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

  const containerRef = useRef<HTMLDivElement>(null);

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

    const dx = e.clientX - startPos.x;
    const dy = e.clientY - startPos.y;
    
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
      const rect = exportRef.current.getBoundingClientRect();
      
      const fullTLX = rect.left + initialItemState.pos.x;
      const fullTLY = rect.top + initialItemState.pos.y;

      const visW_pct = (100 - initialItemState.crop.left - initialItemState.crop.right) / 100;
      const visH_pct = (100 - initialItemState.crop.top - initialItemState.crop.bottom) / 100;
      
      const offX = initialItemState.size.width * (initialItemState.crop.left / 100);
      const offY = initialItemState.size.height * (initialItemState.crop.top / 100);

      const centerX = fullTLX + offX + (initialItemState.size.width * visW_pct) / 2;
      const centerY = fullTLY + offY + (initialItemState.size.height * visH_pct) / 2;
      
      const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
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

  }, [dragMode, selectedItemId, startPos, initialItemState, onUpdateItem]);

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

  const getStyleClasses = (style: LayerStyle) => {
    switch(style) {
        case 'sticker':
            return 'filter-sticker';
        case 'ghost':
            return 'filter-ghost mix-blend-screen opacity-80';
        case 'ink':
            return 'filter-ink mix-blend-multiply opacity-90';
        case 'retro':
            return 'filter-retro sepia contrast-125';
        default:
            return '';
    }
  };

  return (
    <div 
      className="flex-1 bg-dot-grid relative overflow-hidden flex items-center justify-center p-8 select-none"
      onClick={handleBackgroundClick}
      ref={containerRef}
    >
      <div 
        ref={exportRef}
        className="relative shadow-2xl bg-black transition-all duration-500 overflow-hidden"
        style={{
          width: baseImage ? 'auto' : '800px',
          height: baseImage ? 'auto' : '600px',
          minWidth: '400px',
          minHeight: '300px',
          maxWidth: '100%',
          maxHeight: '100%',
          aspectRatio: !baseImage ? '4/3' : undefined
        }}
      >
        {baseImage && (
          <img 
            src={baseImage} 
            alt="Background" 
            className="w-full h-full object-contain pointer-events-none"
          />
        )}

        {items.map(item => {
          const originX = item.crop.left + (100 - item.crop.left - item.crop.right) / 2;
          const originY = item.crop.top + (100 - item.crop.top - item.crop.bottom) / 2;

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
            <div className={`w-full h-full relative ${getStyleClasses(item.style)}`} style={{ 
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
                
                <img 
                    src={item.processedSrc || item.originalSrc} 
                    alt={item.name}
                    className={`w-full h-full object-contain select-none transition-opacity duration-700
                       ${item.isProcessing ? 'opacity-0' : 'opacity-100'}
                    `}
                    draggable={false}
                    style={{ transform: item.isMirrored ? 'scaleX(-1)' : 'none' }}
                />
            </div>
            
            {selectedItemId === item.id && (
              <div 
                className="absolute border border-orange-500 pointer-events-none"
                style={{
                  top: `${item.crop.top}%`,
                  bottom: `${item.crop.bottom}%`,
                  left: `${item.crop.left}%`,
                  right: `${item.crop.right}%`
                }}
              >
                <div 
                  className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-orange-500 rounded-full cursor-nw-resize pointer-events-auto shadow-sm hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, item, DragMode.RESIZE_TL)}
                />
                <div 
                  className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-orange-500 rounded-full cursor-ne-resize pointer-events-auto shadow-sm hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, item, DragMode.RESIZE_TR)}
                />
                <div 
                  className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-orange-500 rounded-full cursor-sw-resize pointer-events-auto shadow-sm hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, item, DragMode.RESIZE_BL)}
                />
                <div 
                  className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-orange-500 rounded-full cursor-se-resize pointer-events-auto shadow-sm hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, item, DragMode.RESIZE_BR)}
                />
                
                <div 
                  className="absolute -top-8 left-1/2 -translate-x-1/2 w-8 h-8 flex items-center justify-center cursor-pointer pointer-events-auto group-hover/rotate"
                  onMouseDown={(e) => handleMouseDown(e, item, DragMode.ROTATE)}
                  title="Rotate"
                >
                   <div className="w-3 h-3 bg-white border-2 border-orange-500 rounded-full shadow-sm"></div>
                   <div className="absolute top-5 h-3 w-px bg-orange-500"></div>
                </div>

                <div 
                    className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-white/80 border border-orange-500 rounded-full cursor-ns-resize pointer-events-auto hover:bg-orange-100"
                    onMouseDown={(e) => handleMouseDown(e, item, DragMode.CROP_T)}
                />
                <div 
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-white/80 border border-orange-500 rounded-full cursor-ns-resize pointer-events-auto hover:bg-orange-100"
                    onMouseDown={(e) => handleMouseDown(e, item, DragMode.CROP_B)}
                />
                <div 
                    className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-6 bg-white/80 border border-orange-500 rounded-full cursor-ew-resize pointer-events-auto hover:bg-orange-100"
                    onMouseDown={(e) => handleMouseDown(e, item, DragMode.CROP_L)}
                />
                <div 
                    className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-6 bg-white/80 border border-orange-500 rounded-full cursor-ew-resize pointer-events-auto hover:bg-orange-100"
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
        
        /* Simulating a sticker outline using drop-shadows. 
           Since standard stroke only works on SVG or Text, we use 4 directional hard shadows. */
        .filter-sticker {
            filter: drop-shadow(0px -2px 0px white) 
                    drop-shadow(0px 2px 0px white) 
                    drop-shadow(-2px 0px 0px white) 
                    drop-shadow(2px 0px 0px white)
                    drop-shadow(2px 4px 6px rgba(0,0,0,0.5));
        }
        
        .filter-ghost {
            filter: drop-shadow(0 0 10px rgba(100, 200, 255, 0.6)) brightness(1.2) hue-rotate(180deg);
        }

        .filter-ink {
            filter: grayscale(100%) contrast(150%) brightness(0.9);
        }

        .filter-retro {
             filter: sepia(0.5) contrast(1.2) brightness(0.9) drop-shadow(4px 4px 0px rgba(255,100,0,0.3));
        }
      `}</style>
    </div>
  );
};
