import React from 'react';
import { VesselParams, TextureData } from '../types';
import { VesselPreview } from './VesselPreview';
import { X, PlayCircle, Printer } from 'lucide-react';

interface SimulationWindowProps {
  isOpen: boolean;
  onClose: () => void;
  params: VesselParams;
  simProgress: number;
  textureData: TextureData | null;
}

export const SimulationWindow: React.FC<SimulationWindowProps> = ({ isOpen, onClose, params, simProgress, textureData }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 w-96 h-96 z-50 flex flex-col bg-zinc-950 border border-zinc-700 rounded-xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden animate-in slide-in-from-bottom-5 zoom-in-95 duration-300">
      {/* Window Header */}
      <div className="h-10 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-3 cursor-move select-none">
        <div className="flex items-center gap-2 text-clay-400">
          <Printer className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">Print Simulator</span>
        </div>
        <button 
          onClick={onClose}
          className="text-zinc-500 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 relative">
        <VesselPreview params={params} simProgress={simProgress} minimal={true} textureData={textureData} />
        
        {/* Overlay Stats */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 to-transparent pointer-events-none">
           <div className="flex justify-between items-end">
             <div>
                <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-semibold mb-0.5">Progress</p>
                <p className="text-2xl font-mono text-white font-bold leading-none">
                    {Math.round(simProgress * 100)}<span className="text-sm text-zinc-500">%</span>
                </p>
             </div>
             <div className="text-right">
                <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-semibold mb-0.5">Layer</p>
                <p className="text-lg font-mono text-zinc-300 leading-none">
                    {Math.floor(simProgress * params.layers)}<span className="text-zinc-600">/{params.layers}</span>
                </p>
             </div>
           </div>
           
           {/* Progress Bar */}
           <div className="mt-2 h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-clay-500 transition-all duration-75 ease-out"
                style={{ width: `${simProgress * 100}%` }}
              />
           </div>
        </div>
      </div>
    </div>
  );
};