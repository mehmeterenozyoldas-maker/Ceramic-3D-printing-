import React, { useMemo, useRef, useLayoutEffect } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Grid, Line } from '@react-three/drei';
import { VesselParams, TextureData } from '../types';
import { generateVesselMesh, calculateVesselPoint } from '../utils/geometry';

interface VesselMeshProps {
  params: VesselParams;
  simProgress: number;
  showAnalysis: boolean;
  textureData: TextureData | null;
}

const VesselMesh: React.FC<VesselMeshProps> = ({ params, simProgress, showAnalysis, textureData }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const geometryRef = useRef<THREE.BufferGeometry>(null);

  // Generate Geometry
  const { positions, indices } = useMemo(() => {
    const meshData = generateVesselMesh(params, textureData);
    return {
      positions: meshData.vertices,
      indices: meshData.indices
    };
  }, [params, textureData]);

  // Clipping Plane for Simulation
  // We recreate the plane when simProgress changes to ensure the material updates
  const clippingPlanes = useMemo(() => {
    // If simulation is complete (1.0), move plane infinitely high to show everything
    // otherwise calculate cut height
    const bottomY = -params.height / 2;
    const currentHeight = params.height * simProgress;
    
    // Add a small epsilon to currentHeight to avoid z-fighting at the very bottom
    const constant = (simProgress >= 0.995) 
        ? Infinity 
        : bottomY + currentHeight;

    // Plane Normal (0, -1, 0) points DOWN.
    // Plane Equation: 0x - 1y + 0z + constant > 0
    // constant > y
    // So keeps everything where y is LESS than constant.
    const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), constant);
    return [plane];
  }, [params.height, simProgress]);

  useFrame(() => {
    if (meshRef.current) {
        // Rotate model slightly
        meshRef.current.rotation.y += 0.002;
    }
  });

  // Calculate Vertex Colors for Analysis (Overhang Heatmap)
  const colors = useMemo(() => {
    if (!showAnalysis) return null;
    
    const count = positions.length / 3;
    const colorArray = new Float32Array(count * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    const normals = geometry.attributes.normal.array;
    const color = new THREE.Color();
    
    for (let i = 0; i < count; i++) {
        const nx = normals[i * 3];
        const ny = normals[i * 3 + 1];
        const nz = normals[i * 3 + 2];
        
        // Analyze Normal for Overhangs
        // ny = 1 (Up), ny = 0 (Vertical), ny = -1 (Down)
        
        if (ny > -0.2) {
            // Safe - Clay Color
            color.set('#d2bab0'); 
        } else if (ny > -0.5) {
            // Warning - Yellow/Orange
            color.set('#f59e0b');
        } else {
            // Danger - Red (Severe Overhang)
            color.set('#ef4444');
        }
        
        colorArray[i * 3] = color.r;
        colorArray[i * 3 + 1] = color.g;
        colorArray[i * 3 + 2] = color.b;
    }
    return colorArray;
  }, [showAnalysis, positions, indices]);

  useLayoutEffect(() => {
    if (geometryRef.current) {
      geometryRef.current.computeVertexNormals();
    }
  }, [positions]);

  return (
    <mesh ref={meshRef} position={[0, -params.height / 2, 0]} castShadow receiveShadow>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={positions.length / 3}
          itemSize={3}
        />
        <bufferAttribute
          attach="index"
          array={new Uint16Array(indices)}
          count={indices.length}
          itemSize={1}
        />
        {showAnalysis && colors && (
             <bufferAttribute
                attach="attributes-color"
                array={colors}
                count={colors.length / 3}
                itemSize={3}
             />
        )}
      </bufferGeometry>
      
      {showAnalysis ? (
         <meshStandardMaterial 
            vertexColors
            roughness={0.8}
            side={THREE.DoubleSide}
            clippingPlanes={clippingPlanes}
            clipShadows={true}
         />
      ) : (
        <meshStandardMaterial 
            color="#d2bab0" 
            roughness={0.6} 
            metalness={0.1}
            side={THREE.DoubleSide}
            flatShading={false}
            clippingPlanes={clippingPlanes}
            clipShadows={true}
        />
      )}
    </mesh>
  );
};

const SimulationOverlay: React.FC<{ params: VesselParams; simProgress: number; textureData: TextureData | null }> = ({ params, simProgress, textureData }) => {
  const { height, wallThickness, layers } = params;
  
  // Only show if simulation is active (and not fully complete/reset)
  if (simProgress >= 0.995 || simProgress <= 0.005) return null;

  // Calculate Nozzle Position
  // The nozzle follows the spiral path.
  // u (rotation) increases with layers.
  const currentU = simProgress * layers; 
  const currentV = simProgress;
  
  const nozzlePos = useMemo(() => {
      // Use standard calculation (center of wall)
      // Note: calculateVesselPoint returns y from 0 to height.
      // We need to shift it to match the mesh position in the scene.
      const p = calculateVesselPoint(params, currentU, currentV, 0, 0, 1, textureData);
      return new THREE.Vector3(p.x, p.y, p.z);
  }, [params, currentU, currentV, textureData]);

  // Calculate Active Layer Rings (Outer and Inner) to visualize deposition
  const { outerPoints, innerPoints } = useMemo(() => {
      const segs = Math.min(params.segments, 128); // Cap resolution for perf
      const out = [];
      const inn = [];
      
      // We want the ring at the current PHYSICAL height of the nozzle
      
      for(let i=0; i<=segs; i++) {
          const u = i/segs;
          const pOut = calculateVesselPoint(params, u, currentV, 0, 0, 1, textureData);
          out.push(new THREE.Vector3(pOut.x, pOut.y, pOut.z));
          
          if (wallThickness > 0) {
              // Approximate inner wall top surface by offsetting radius
              const pIn = calculateVesselPoint(params, u, currentV, -wallThickness, 0, 1, textureData);
              // Force Y to match pOut to ensure a flat visual layer top
              inn.push(new THREE.Vector3(pIn.x, pOut.y, pIn.z)); 
          }
      }
      return { outerPoints: out, innerPoints: inn };
  }, [params, currentV, wallThickness, textureData]);

  return (
    <group position={[0, -height / 2, 0]}>
       {/* Active Layer Highlights - Glowing lines at the cut plane */}
       <Line points={outerPoints} color="#ef4444" lineWidth={3} transparent opacity={0.6} />
       {wallThickness > 0 && (
          <Line points={innerPoints} color="#ef4444" lineWidth={3} transparent opacity={0.6} />
       )}

       {/* Nozzle Assembly Visualization */}
       <group position={nozzlePos}>
          {/* Nozzle Tip */}
          <mesh position={[0, 2, 0]} rotation={[Math.PI, 0, 0]}>
             <cylinderGeometry args={[0.5, 2, 4, 16]} />
             <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.3} />
          </mesh>
          
          {/* Heater Block */}
          <mesh position={[0, 5, 0]}>
             <boxGeometry args={[6, 3, 6]} />
             <meshStandardMaterial color="#27272a" />
          </mesh>
          
          {/* Heat Break / Throat */}
          <mesh position={[0, 8, 0]}>
              <cylinderGeometry args={[1.5, 1.5, 3]} />
              <meshStandardMaterial color="#52525b" />
          </mesh>
          
          {/* Filament entering top */}
          <mesh position={[0, 15, 0]}>
              <cylinderGeometry args={[0.8, 0.8, 15]} />
              <meshStandardMaterial color="#e5e5e5" />
          </mesh>

           {/* Glowing Point Light at tip */}
           <pointLight intensity={3} color="#ef4444" distance={15} decay={2} position={[0, -0.5, 0]} />
       </group>
    </group>
  );
};

export const VesselPreview: React.FC<{ 
    params: VesselParams, 
    simProgress?: number, 
    showAnalysis?: boolean,
    minimal?: boolean,
    textureData?: TextureData | null
}> = ({ params, simProgress = 1, showAnalysis = false, minimal = false, textureData = null }) => {
  return (
    <div className={`w-full h-full rounded-xl overflow-hidden shadow-2xl relative ${minimal ? 'bg-zinc-950' : 'bg-zinc-900'}`}>
       {!minimal && (
          <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full text-xs text-white border border-white/10 flex gap-2 items-center pointer-events-none select-none">
            <span>Live WebGL Preview</span>
            {showAnalysis && <span className="text-red-400 font-bold">• Heatmap Active</span>}
          </div>
       )}
      
      {/* 
        localClippingEnabled is required for object-level clippingPlanes to work.
      */}
      <Canvas shadows camera={{ position: [50, 40, 50], fov: 45 }} localClippingEnabled>
        <OrbitControls makeDefault autoRotate={simProgress >= 1 && !minimal} autoRotateSpeed={0.5} />
        <Environment preset="studio" />
        
        <ambientLight intensity={0.5} />
        <spotLight position={[50, 50, 20]} angle={0.3} penumbra={1} intensity={1000} castShadow />
        
        <VesselMesh params={params} simProgress={simProgress} showAnalysis={showAnalysis} textureData={textureData} />
        <SimulationOverlay params={params} simProgress={simProgress} textureData={textureData} />
        
        <Grid position={[0, -params.height / 2, 0]} args={[100, 100]} cellSize={5} sectionSize={25} fadeDistance={200} sectionColor="#666" cellColor="#333" />
        <ContactShadows position={[0, -params.height / 2, 0]} opacity={0.5} scale={50} blur={2.5} far={10} />
      </Canvas>
    </div>
  );
};