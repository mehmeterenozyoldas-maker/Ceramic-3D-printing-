import { VesselParams, PrintStats, TextureData } from '../types';

export function calculateVesselPoint(
  params: VesselParams, 
  u: number, 
  v: number, 
  radiusOffset: number = 0,
  heightOffset: number = 0,
  heightScale: number = 1,
  textureData: TextureData | null = null
) {
  const { height, baseRadius, twist, noiseScale, noiseFrequency, textureInfluence } = params;
  
  // Calculate raw height and angle
  const cy = (v * height * heightScale) + heightOffset;
  const theta = u * Math.PI * 2;
  
  // Apply twist
  const twistOffset = v * twist;
  
  // Apply noise
  // We use the same 'v' for noise lookup even if height is scaled to ensure patterns match between inner/outer walls
  const noiseVal = Math.sin((theta + twistOffset) * noiseFrequency) * 
                   Math.cos(v * height * noiseFrequency * 0.5);
                   
  // Calculate radius with noise and offset
  let r = baseRadius + (noiseVal * noiseScale * (1 - Math.pow(v - 0.5, 2) * 0.5));
  
  // Apply Texture Displacement if data exists
  if (textureData && textureInfluence > 0) {
      // Map u, v to Texture Coordinates
      // u wraps 0-1. v goes 0-1.
      // Texture might need to repeat if aspect ratio differs, or clamp. 
      // Here we stretch texture to cover surface once.
      
      // Simple Nearest Neighbor or Bilinear? 
      // Bilinear is better for smoothness.
      
      const texX = (u * textureData.width) % textureData.width;
      // Invert V usually because images draw top-down but 3D often goes bottom-up
      const texY = ((1 - v) * textureData.height) % textureData.height; 
      
      const x1 = Math.floor(texX);
      const y1 = Math.floor(texY);
      // const index = (y1 * textureData.width) + x1;
      // const val = textureData.data[index] / 255.0; // 0 to 1
      
      // Bilinear Interpolation
      const x2 = (x1 + 1) % textureData.width;
      const y2 = (y1 + 1) < textureData.height ? y1 + 1 : y1;
      
      const dx = texX - x1;
      const dy = texY - y1;
      
      const i11 = (y1 * textureData.width) + x1;
      const i21 = (y1 * textureData.width) + x2;
      const i12 = (y2 * textureData.width) + x1;
      const i22 = (y2 * textureData.width) + x2;
      
      const val11 = textureData.data[i11];
      const val21 = textureData.data[i21];
      const val12 = textureData.data[i12];
      const val22 = textureData.data[i22];
      
      const val = (
          (val11 * (1 - dx) + val21 * dx) * (1 - dy) +
          (val12 * (1 - dx) + val22 * dx) * dy
      ) / 255.0;

      // Apply displacement
      // Dark = 0 displacement? or Dark = negative?
      // Let's say: Black = 0 displacement, White = full displacement
      r += val * textureInfluence;
  }

  r += radiusOffset;
  
  // Ensure radius doesn't invert
  if (r < 0.1) r = 0.1;
  
  const px = r * Math.cos(theta);
  const pz = r * Math.sin(theta);
  
  return { x: px, y: cy, z: pz, r };
}

export function generateVesselMesh(params: VesselParams, textureData: TextureData | null = null) {
  const { layers, segments, wallThickness, height } = params;
  const vertices: number[] = [];
  const indices: number[] = [];
  
  // If no thickness, generate single surface (Vase Mode)
  if (wallThickness <= 0) {
    for (let y = 0; y <= layers; y++) {
      const v = y / layers;
      for (let x = 0; x <= segments; x++) {
        const u = x / segments;
        const p = calculateVesselPoint(params, u, v, 0, 0, 1, textureData);
        vertices.push(p.x, p.y, p.z);
      }
    }
    
    for (let y = 0; y < layers; y++) {
      for (let x = 0; x < segments; x++) {
        const row1 = y * (segments + 1);
        const row2 = (y + 1) * (segments + 1);
        const a = row1 + x, b = row1 + x + 1;
        const c = row2 + x, d = row2 + x + 1;
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }
    return { vertices: new Float32Array(vertices), indices };
  }

  // --- SOLID GEOMETRY GENERATION ---
  // Strategy: Outer Shell + Inner Shell + Top Rim + Bottom Floor

  const vertsPerRow = segments + 1;
  const numRows = layers + 1;
  
  // 1. Generate Outer Shell Vertices
  // Saved at indices: [0 ... numRows * vertsPerRow - 1]
  for (let y = 0; y <= layers; y++) {
    const v = y / layers;
    for (let x = 0; x <= segments; x++) {
      const u = x / segments;
      const p = calculateVesselPoint(params, u, v, 0, 0, 1, textureData);
      vertices.push(p.x, p.y, p.z);
    }
  }

  // 2. Generate Inner Shell Vertices
  // Saved at indices: [numRows * vertsPerRow ... 2 * numRows * vertsPerRow - 1]
  // Inner shell height goes from `wallThickness` to `height`
  // Radius is `r - wallThickness`
  // v still goes 0 to 1 for noise consistency, but geometric Y is scaled
  const innerHeightScale = (height - wallThickness) / height;
  
  for (let y = 0; y <= layers; y++) {
    const v = y / layers;
    for (let x = 0; x <= segments; x++) {
      const u = x / segments;
      // Offset radius inwards (-wallThickness)
      // Offset height upwards (+wallThickness)
      // Scale height to fit remaining space
      const p = calculateVesselPoint(params, u, v, -wallThickness, wallThickness, innerHeightScale, textureData);
      vertices.push(p.x, p.y, p.z);
    }
  }

  // Helper to add Quad
  const addQuad = (p1: number, p2: number, p3: number, p4: number) => {
    indices.push(p1, p2, p3);
    indices.push(p3, p2, p4);
  };

  // 3. Stitch Outer Shell (CCW)
  for (let y = 0; y < layers; y++) {
    for (let x = 0; x < segments; x++) {
      const row1 = y * vertsPerRow;
      const row2 = (y + 1) * vertsPerRow;
      addQuad(
        row1 + x,           // Bottom Left
        row2 + x,           // Top Left
        row1 + x + 1,       // Bottom Right
        row2 + x + 1        // Top Right
      );
    }
  }

  // 4. Stitch Inner Shell (CW)
  const innerOffset = numRows * vertsPerRow;
  for (let y = 0; y < layers; y++) {
    for (let x = 0; x < segments; x++) {
      const row1 = innerOffset + y * vertsPerRow;
      const row2 = innerOffset + (y + 1) * vertsPerRow;
      // We swap order to flip normal
      addQuad(
        row1 + x + 1,       // Bottom Right
        row2 + x + 1,       // Top Right
        row1 + x,           // Bottom Left
        row2 + x            // Top Left
      );
    }
  }

  // 5. Stitch Top Rim
  // Connect Outer Top Row to Inner Top Row
  const outerTopRow = (layers) * vertsPerRow;
  const innerTopRow = innerOffset + (layers) * vertsPerRow;
  
  for (let x = 0; x < segments; x++) {
    addQuad(
       outerTopRow + x,
       outerTopRow + x + 1,
       innerTopRow + x,
       innerTopRow + x + 1
    );
  }

  // 6. Stitch Bottom Floor
  const centerBottomIndex = vertices.length / 3;
  vertices.push(0, 0, 0); // Center Bottom Outer
  
  const centerFloorIndex = centerBottomIndex + 1;
  vertices.push(0, wallThickness, 0); // Center Floor Inner

  // Outer Bottom Cap
  const outerBottomRow = 0;
  for (let x = 0; x < segments; x++) {
    indices.push(centerBottomIndex, outerBottomRow + x + 1, outerBottomRow + x);
  }

  // Inner Floor Cap
  const innerBottomRow = innerOffset;
  for (let x = 0; x < segments; x++) {
    indices.push(centerFloorIndex, innerBottomRow + x, innerBottomRow + x + 1);
  }

  return { 
    vertices: new Float32Array(vertices), 
    indices 
  };
}

export const calculatePrintStats = (params: VesselParams, textureData: TextureData | null = null): PrintStats => {
  const { layers, segments, height, baseRadius, printSpeed, filamentDiameter } = params;
  
  // Approximate path length for stats
  // We simulate a spiral walk similar to G-code generation but faster
  let totalDist = 0;
  const layerHeight = height / layers;
  
  // Quick estimation: Average circumference * layers
  // To be more accurate, we sample the noise function at 10 points per layer
  const sampleSteps = Math.min(segments, 20); 
  
  let prevP = calculateVesselPoint(params, 0, 0, 0, 0, 1, textureData);
  
  // We'll iterate through layers and accumulate distance
  for (let i = 0; i <= layers; i++) {
    const v = i / layers;
    for (let j = 0; j <= sampleSteps; j++) {
       const u = j / sampleSteps;
       const p = calculateVesselPoint(params, u, v, 0, 0, 1, textureData);
       
       // Just horizontal distance for simplicity + vertical step
       const dx = p.x - prevP.x;
       const dy = p.y - prevP.y;
       const dz = p.z - prevP.z;
       
       totalDist += Math.sqrt(dx*dx + dy*dy + dz*dz);
       prevP = p;
    }
  }
  
  let spiralDist = 0;
  for(let i=0; i<layers; i++) {
     const v = i/layers;
     // Sample radius at 4 points to average noise
     let avgR = 0;
     for(let k=0; k<4; k++) {
         avgR += calculateVesselPoint(params, k/4, v, 0, 0, 1, textureData).r;
     }
     avgR /= 4;
     spiralDist += 2 * Math.PI * avgR;
  }
  
  // Filament Usage
  const extrudedVol = spiralDist * (params.nozzleDiameter * layerHeight);
  
  // Filament Length (Input) = Vol / (PI * (FilamentDiam/2)^2)
  const filamentArea = Math.PI * Math.pow(filamentDiameter / 2, 2);
  const filamentLengthMM = extrudedVol / filamentArea;
  
  // Weight: Density of wet clay approx 1.6 - 1.8 g/cm3
  // Vol in mm3. 1 cm3 = 1000 mm3.
  const clayDensity = 0.0017; // g/mm3
  const weight = extrudedVol * clayDensity;

  return {
    estimatedTime: spiralDist / params.printSpeed,
    filamentLength: filamentLengthMM / 1000, // meters
    filamentWeight: weight,
    layerHeight: layerHeight,
    totalLayers: layers
  };
};