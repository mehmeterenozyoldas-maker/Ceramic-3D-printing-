import React, { useState, useMemo, useEffect, useRef } from 'react';
import { VesselParams, ExportFormat, PrinterType, PrintStats, TextureData } from '../types';
import { Sliders, Activity, Cylinder, Layers, RotateCw, Download, FileDown, BoxSelect, Settings, ChevronDown, ChevronUp, Play, Pause, BarChart3, AlertTriangle, Eye, Image as ImageIcon, Camera, Upload, X } from 'lucide-react';
import { exportByType } from '../utils/exporters';
import { calculatePrintStats } from '../utils/geometry';
import { resizeImage } from '../utils/imageHelper';

interface ControlsProps {
  params: VesselParams;
  setParams: React.Dispatch<React.SetStateAction<VesselParams>>;
  onGenerate: () => void;
  isGenerating: boolean;
  // Sim props
  isSimulating: boolean;
  setIsSimulating: (v: boolean) => void;
  simProgress: number;
  setSimProgress: (v: number) => void;
  showAnalysis: boolean;
  setShowAnalysis: (v: boolean) => void;
  // Texture
  textureData: TextureData | null;
}

export const Controls: React.FC<ControlsProps> = ({ 
  params, setParams, onGenerate, isGenerating,
  isSimulating, setIsSimulating, simProgress, setSimProgress,
  showAnalysis, setShowAnalysis, textureData
}) => {
  const [activeSlider, setActiveSlider] = useState<keyof VesselParams | null>(null);
  const [isPrinterSettingsOpen, setIsPrinterSettingsOpen] = useState(false);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(true);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  
  const stats: PrintStats = useMemo(() => calculatePrintStats(params, textureData), [params, textureData]);

  // Auto-play simulation
  useEffect(() => {
    let interval: number;
    if (isSimulating) {
      interval = window.setInterval(() => {
        setSimProgress(prev => {
          if (prev >= 1) {
            setIsSimulating(false);
            return 1;
          }
          return prev + 0.01;
        });
      }, 50);
    }
    return () => clearInterval(interval);
  }, [isSimulating, setSimProgress, setIsSimulating]);

  const handleChange = (key: keyof VesselParams, value: number | string | null) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const handleDirectDownload = () => {
    exportByType(params.exportFormat, params, textureData);
  };
  
  // Camera Handlers
  const startCamera = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          setCameraStream(stream);
          setIsCameraOpen(true);
          if (videoRef.current) {
              videoRef.current.srcObject = stream;
          }
      } catch (e) {
          console.error("Error accessing camera", e);
          alert("Could not access camera. Please allow permissions.");
      }
  };

  useEffect(() => {
      if (isCameraOpen && videoRef.current && cameraStream) {
          videoRef.current.srcObject = cameraStream;
          videoRef.current.play();
      }
  }, [isCameraOpen, cameraStream]);

  const capturePhoto = () => {
      if (videoRef.current) {
          const canvas = document.createElement('canvas');
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
              ctx.drawImage(videoRef.current, 0, 0);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
              handleChange('textureImage', dataUrl);
              stopCamera();
          }
      }
  };

  const stopCamera = () => {
      if (cameraStream) {
          cameraStream.getTracks().forEach(track => track.stop());
          setCameraStream(null);
      }
      setIsCameraOpen(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const resizedDataUrl = await resizeImage(file, 800);
          handleChange('textureImage', resizedDataUrl);
      }
  };

  const clearImage = () => {
      handleChange('textureImage', null);
  };

  const renderSlider = (
    label: React.ReactNode,
    paramKey: keyof VesselParams,
    min: number,
    max: number,
    step: number = 1,
    unit: string = ""
  ) => {
    const isActive = activeSlider === paramKey;
    return (
      <div className="space-y-2">
        <div className="flex justify-between text-sm items-center h-6">
          <label className={`transition-colors duration-200 flex items-center gap-2 ${isActive ? 'text-white' : 'text-zinc-300'}`}>
            {label}
          </label>
          <span 
            className={`font-mono transition-all duration-200 origin-right
              ${isActive ? 'text-clay-300 text-base font-bold scale-110' : 'text-clay-400 text-sm'}
            `}
          >
            {params[paramKey] as number}{unit}
          </span>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={params[paramKey] as number}
          onChange={(e) => handleChange(paramKey, Number(e.target.value))}
          onPointerDown={() => setActiveSlider(paramKey)}
          onPointerUp={() => setActiveSlider(null)}
          onBlur={() => setActiveSlider(null)}
          className={`
            w-full rounded-lg appearance-none cursor-pointer transition-all duration-200
            ${isActive 
              ? 'h-2 bg-zinc-700 accent-clay-400 shadow-[0_0_10px_rgba(161,128,114,0.2)]' 
              : 'h-1.5 bg-zinc-800 accent-clay-500'}
          `}
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 text-zinc-100 p-6 border-r border-zinc-800 overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Cylinder className="w-6 h-6 text-clay-500" />
          CeramicFlow
        </h1>
        <p className="text-sm text-zinc-500 mt-2">Parametric design for clay 3D printing.</p>
      </div>

      <div className="space-y-8 flex-1">
        
        {/* Sim & Analysis Section */}
        <div className="bg-zinc-950/50 rounded-xl border border-zinc-800 overflow-hidden">
             <button
                onClick={() => setIsAnalysisOpen(!isAnalysisOpen)}
                className="w-full flex items-center justify-between p-3 bg-zinc-900/80 hover:bg-zinc-800 transition-colors text-left group border-b border-zinc-800"
              >
                <div className="flex items-center gap-2 text-clay-400 group-hover:text-clay-300">
                  <BarChart3 className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Sim & Analysis</span>
                </div>
                {isAnalysisOpen ? <ChevronUp className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />}
            </button>
            
            {isAnalysisOpen && (
              <div className="p-4 space-y-4 animate-in slide-in-from-top-2">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                   <div className="bg-zinc-900 p-2 rounded border border-zinc-800">
                      <span className="block text-zinc-500 mb-1">Time</span>
                      <span className="text-white font-mono">{Math.round(stats.estimatedTime)}m</span>
                   </div>
                   <div className="bg-zinc-900 p-2 rounded border border-zinc-800">
                      <span className="block text-zinc-500 mb-1">Weight</span>
                      <span className="text-white font-mono">{Math.round(stats.filamentWeight)}g</span>
                   </div>
                   <div className="bg-zinc-900 p-2 rounded border border-zinc-800">
                      <span className="block text-zinc-500 mb-1">Height</span>
                      <span className="text-white font-mono">{stats.layerHeight.toFixed(2)}mm</span>
                   </div>
                   <div className="bg-zinc-900 p-2 rounded border border-zinc-800">
                      <span className="block text-zinc-500 mb-1">Layers</span>
                      <span className="text-white font-mono">{stats.totalLayers}</span>
                   </div>
                </div>

                {/* Overhang Toggle */}
                <button
                   onClick={() => setShowAnalysis(!showAnalysis)}
                   className={`
                      w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium border transition-all
                      ${showAnalysis 
                        ? 'bg-red-900/20 border-red-500/50 text-red-200' 
                        : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200'}
                   `}
                >
                   {showAnalysis ? <Eye className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                   {showAnalysis ? 'Hide Overhang Heatmap' : 'Show Overhang Heatmap'}
                </button>

                {/* Simulation Control */}
                <div className="pt-2 border-t border-zinc-800">
                  <div className="flex justify-between items-center mb-2">
                     <span className="text-xs text-zinc-400">Print Simulator</span>
                     <span className="text-xs font-mono text-clay-400">{Math.round(simProgress * 100)}%</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <button 
                      onClick={() => setIsSimulating(!isSimulating)}
                      className={`p-2 rounded-md border ${isSimulating ? 'bg-clay-600 border-clay-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}
                    >
                       {isSimulating ? <Pause className="w-3.5 h-3.5"/> : <Play className="w-3.5 h-3.5 ml-0.5"/>}
                    </button>
                    <input 
                      type="range" min="0" max="1" step="0.01"
                      value={simProgress}
                      onChange={(e) => {
                         setSimProgress(parseFloat(e.target.value));
                         setIsSimulating(false);
                      }}
                      className="flex-1 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-clay-500"
                    />
                  </div>
                </div>
              </div>
            )}
        </div>

        {/* Geometry Section */}
        <section>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Cylinder className="w-4 h-4" /> Geometry
          </h3>
          
          <div className="space-y-6">
            {renderSlider("Height", "height", 50, 300, 1, "mm")}
            {renderSlider("Base Radius", "baseRadius", 20, 100, 1, "mm")}
            {renderSlider(<><BoxSelect className="w-3 h-3" /> Thickness</>, "wallThickness", 0, 10, 0.5, "mm")}
            {renderSlider(<><Layers className="w-3 h-3" /> Layers</>, "layers", 50, 400, 10)}
            {renderSlider("Mesh Detail", "segments", 30, 200, 10)}
          </div>
        </section>

        {/* Image Influence Section */}
        <section>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <ImageIcon className="w-4 h-4" /> Image Influence
          </h3>

          <div className="space-y-4">
             {params.textureImage ? (
                 <div className="relative rounded-lg overflow-hidden border border-zinc-700 bg-zinc-950 aspect-video group">
                     <img src={params.textureImage} alt="Texture Source" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                     <button 
                       onClick={clearImage}
                       className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-red-900/80 text-white rounded-full backdrop-blur-sm transition-colors"
                     >
                       <X className="w-4 h-4" />
                     </button>
                 </div>
             ) : (
                 <div className="grid grid-cols-2 gap-2">
                     <label className="flex flex-col items-center justify-center p-4 rounded-lg border border-zinc-700 border-dashed bg-zinc-900/50 hover:bg-zinc-800 transition-colors cursor-pointer gap-2 text-zinc-400 hover:text-white">
                         <Upload className="w-5 h-5" />
                         <span className="text-xs font-medium">Upload</span>
                         <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                     </label>
                     <button 
                       onClick={startCamera}
                       className="flex flex-col items-center justify-center p-4 rounded-lg border border-zinc-700 border-dashed bg-zinc-900/50 hover:bg-zinc-800 transition-colors gap-2 text-zinc-400 hover:text-white"
                     >
                         <Camera className="w-5 h-5" />
                         <span className="text-xs font-medium">Camera</span>
                     </button>
                 </div>
             )}
             
             {renderSlider("Texture Depth", "textureInfluence", 0, 30, 0.5, "mm")}
          </div>

          {/* Camera Modal */}
          {isCameraOpen && (
              <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="w-full max-w-md bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-700 shadow-2xl relative">
                      <div className="relative aspect-[3/4] bg-black">
                          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                          <button onClick={stopCamera} className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full">
                              <X className="w-6 h-6" />
                          </button>
                      </div>
                      <div className="p-6 flex justify-center bg-zinc-900">
                          <button 
                            onClick={capturePhoto}
                            className="w-16 h-16 rounded-full border-4 border-white bg-transparent hover:bg-white/10 flex items-center justify-center"
                          >
                             <div className="w-12 h-12 bg-white rounded-full"></div>
                          </button>
                      </div>
                  </div>
              </div>
          )}
        </section>

        {/* Noise Section */}
        <section>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4" /> Noise & Surface
          </h3>
          
          <div className="space-y-6">
            {renderSlider("Amplitude", "noiseScale", 0, 50)}
            {renderSlider("Frequency", "noiseFrequency", 1, 20, 0.5)}
            {renderSlider(<><RotateCw className="w-3 h-3"/> Twist</>, "twist", 0, 10, 0.1)}
          </div>
        </section>

        {/* Export Settings */}
        <section>
           <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Download className="w-4 h-4" /> Export
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <label className="text-zinc-300">Format Selection</label>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(['obj', 'stl', 'ply', 'gcode'] as ExportFormat[]).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => handleChange('exportFormat', fmt)}
                  className={`
                    px-2 py-2 text-xs font-bold uppercase rounded-md border transition-all text-center
                    ${params.exportFormat === fmt
                      ? 'bg-clay-600 border-clay-500 text-white shadow-md'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'}
                  `}
                >
                  {fmt}
                </button>
              ))}
            </div>

            {/* G-Code Settings Panel - Collapsible */}
            {params.exportFormat === 'gcode' && (
              <div className="mt-3 border border-zinc-800 rounded-lg overflow-hidden transition-all duration-200">
                <button
                  onClick={() => setIsPrinterSettingsOpen(!isPrinterSettingsOpen)}
                  className="w-full flex items-center justify-between p-3 bg-zinc-900/50 hover:bg-zinc-800 transition-colors text-left group"
                >
                  <div className="flex items-center gap-2 text-clay-400 group-hover:text-clay-300">
                    <Settings className="w-3.5 h-3.5" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Printer Config</span>
                  </div>
                  {isPrinterSettingsOpen ? (
                    <ChevronUp className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-400" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-400" />
                  )}
                </button>

                {isPrinterSettingsOpen && (
                  <div className="p-3 bg-zinc-950/30 space-y-4 border-t border-zinc-800 animate-in slide-in-from-top-2">
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-400 block">Printer Type</label>
                      <select 
                        value={params.printerType}
                        onChange={(e) => handleChange('printerType', e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-clay-500 transition-colors hover:border-zinc-600"
                      >
                        <option value="marlin">Generic (Marlin)</option>
                        <option value="wasp">WASP / Delta</option>
                        <option value="potterbot">Potterbot</option>
                      </select>
                    </div>

                    {renderSlider("Nozzle Ø", "nozzleDiameter", 0.4, 5.0, 0.2, "mm")}
                    {renderSlider("Filament Ø", "filamentDiameter", 1.75, 40, 0.05, "mm")}
                    {renderSlider("Speed", "printSpeed", 300, 3000, 100, "mm/m")}
                    
                    {params.wallThickness > 0 && (
                      <div className="p-2 rounded bg-yellow-900/10 border border-yellow-700/30">
                         <p className="text-[10px] text-yellow-500 leading-tight">
                           Spiral vase mode: Single wall, continuous extrusion. Wall thickness settings in Geometry are ignored.
                         </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            <button
              onClick={handleDirectDownload}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 transition-all active:scale-[0.98] mt-2"
            >
              <FileDown className="w-4 h-4" />
              Download .{params.exportFormat}
            </button>
          </div>
        </section>
      </div>

      <div className="pt-6 mt-6 border-t border-zinc-800">
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className={`
            w-full flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-all
            ${isGenerating 
              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
              : 'bg-clay-600 hover:bg-clay-500 text-white shadow-lg shadow-clay-900/50 hover:shadow-clay-900/70 active:scale-[0.98]'}
          `}
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin"></div>
              Generating...
            </>
          ) : (
            <>
              <Sliders className="w-4 h-4" />
              Generate Script
            </>
          )}
        </button>
      </div>
    </div>
  );
};