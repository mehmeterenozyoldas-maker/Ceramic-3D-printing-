import React, { useState, useEffect } from 'react';
import { Controls } from './components/Controls';
import { VesselPreview } from './components/VesselPreview';
import { CodeDisplay } from './components/CodeDisplay';
import { SimulationWindow } from './components/SimulationWindow';
import { VesselParams, GeneratedScript, TextureData } from './types';
import { generateProcessingCode } from './services/gemini';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { processImageForGeometry } from './utils/imageHelper';

const INITIAL_PARAMS: VesselParams = {
  height: 150,
  baseRadius: 40,
  noiseScale: 10,
  noiseFrequency: 5,
  layers: 150,
  twist: 1,
  segments: 120,
  wallThickness: 2,
  exportFormat: 'obj',
  printerType: 'marlin',
  nozzleDiameter: 1.2,
  filamentDiameter: 1.75,
  printSpeed: 1200,
  textureImage: null,
  textureInfluence: 10,
};

function App() {
  const [params, setParams] = useState<VesselParams>(INITIAL_PARAMS);
  const [generatedScript, setGeneratedScript] = useState<GeneratedScript | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Texture Data State
  const [textureData, setTextureData] = useState<TextureData | null>(null);

  // Simulation State
  const [isSimulating, setIsSimulating] = useState(false);
  const [simProgress, setSimProgress] = useState(1); // 0 to 1
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isSimWindowOpen, setIsSimWindowOpen] = useState(false);

  // Effect to process image when params.textureImage changes
  useEffect(() => {
    if (params.textureImage) {
        processImageForGeometry(params.textureImage)
            .then(data => setTextureData(data))
            .catch(err => {
                console.error("Failed to process image", err);
                setError("Failed to process image data");
            });
    } else {
        setTextureData(null);
    }
  }, [params.textureImage]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const script = await generateProcessingCode(params);
      setGeneratedScript(script);
      setSuccessMessage("Processing script generated successfully! Ready for copy or export.");
    } catch (err) {
      console.error(err);
      setError("Failed to generate code. Please check your API key and try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-black overflow-hidden relative">
      {/* Sidebar Controls */}
      <div className="w-80 h-full flex-shrink-0 z-20">
        <Controls 
          params={params} 
          setParams={setParams} 
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          isSimulating={isSimulating}
          setIsSimulating={(v) => {
             setIsSimulating(v);
             if(v) setIsSimWindowOpen(true);
          }}
          simProgress={simProgress}
          setSimProgress={(v) => {
            setSimProgress(v);
            if (v < 1) setIsSimWindowOpen(true);
          }}
          showAnalysis={showAnalysis}
          setShowAnalysis={setShowAnalysis}
          textureData={textureData}
        />
      </div>

      {/* Main Content */}
      <main className="flex-1 h-full relative flex flex-col min-w-0">
        
        {/* Error Toast */}
        {error && (
          <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-50 bg-red-900/90 border border-red-700 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 backdrop-blur-sm">
            <AlertCircle className="w-5 h-5 text-red-200" />
            <span className="text-sm font-medium">{error}</span>
            <button onClick={() => setError(null)} className="ml-2 text-red-200 hover:text-white transition-colors">×</button>
          </div>
        )}

        {/* Success Toast */}
        {successMessage && (
          <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-50 bg-emerald-900/90 border border-emerald-700 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 backdrop-blur-sm transition-all duration-300 animate-in fade-in slide-in-from-top-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span className="text-sm font-medium">{successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} className="ml-2 text-emerald-200 hover:text-white transition-colors">×</button>
          </div>
        )}

        <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 h-full overflow-hidden">
          
          {/* Left: 3D Preview (Always Final View) */}
          <div className="h-full min-h-[400px] flex flex-col">
             <VesselPreview 
                params={params} 
                simProgress={1} // Main view always shows completed vessel
                showAnalysis={showAnalysis}
                textureData={textureData}
             />
          </div>

          {/* Right: Code Output */}
          <div className="h-full min-h-[400px] flex flex-col">
            <CodeDisplay script={generatedScript} />
          </div>

        </div>
      </main>

      {/* Floating Simulation Window */}
      <SimulationWindow 
        isOpen={isSimWindowOpen}
        onClose={() => {
            setIsSimWindowOpen(false);
            setIsSimulating(false);
        }}
        params={params}
        simProgress={simProgress}
        textureData={textureData}
      />
    </div>
  );
}

export default App;