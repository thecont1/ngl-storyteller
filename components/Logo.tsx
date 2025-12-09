import React from 'react';

export const Logo: React.FC = () => {
  return (
    <div className="flex items-center gap-3 group select-none cursor-default">
      {/* Icon: Distinct Stacking Layers constructing reality */}
      <div className="relative w-10 h-10 flex-shrink-0">
        {/* Layer 1 (Bottom): Shadow/Base */}
        <div className="absolute top-1.5 left-1.5 w-full h-full bg-orange-900/50 rounded-lg border border-orange-500/30"></div>
        
        {/* Layer 2 (Middle): Accent */}
        <div className="absolute top-0.5 left-0.5 w-full h-full bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg opacity-90"></div>
        
        {/* Layer 3 (Top): Main Interface */}
        <div className="absolute top-0 left-0 w-full h-full bg-slate-950 border-2 border-white rounded-lg flex items-center justify-center shadow-lg transform transition-transform duration-300 group-hover:-translate-y-1 group-hover:-translate-x-1">
           <span className="text-xl font-black text-white tracking-tighter font-['Chewy']">n</span>
        </div>
      </div>
      
      <div className="flex flex-col justify-center">
        <h1 className="text-3xl font-normal font-['Chewy'] tracking-wide leading-none text-white">
          ngl
        </h1>
        <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest leading-tight">
          Not Gonna Lie
        </p>
      </div>
    </div>
  );
};