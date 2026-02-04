import { VesselParams, TextureData } from '../types';
import { generateVesselMesh, calculateVesselPoint } from './geometry';

export const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportOBJ = (params: VesselParams, textureData: TextureData | null = null) => {
  const { vertices, indices } = generateVesselMesh(params, textureData);
  let obj = `# CeramicFlow AI Export\n# Vertices: ${vertices.length / 3}\n# Faces: ${indices.length / 3}\no vessel\n`;
  
  for (let i = 0; i < vertices.length; i += 3) {
    obj += `v ${vertices[i].toFixed(4)} ${vertices[i + 1].toFixed(4)} ${vertices[i + 2].toFixed(4)}\n`;
  }
  
  for (let i = 0; i < indices.length; i += 3) {
    // OBJ indices are 1-based
    obj += `f ${indices[i] + 1} ${indices[i + 1] + 1} ${indices[i + 2] + 1}\n`;
  }
  
  downloadFile(obj, 'vessel.obj', 'text/plain');
};

export const exportSTL = (params: VesselParams, textureData: TextureData | null = null) => {
   const { vertices, indices } = generateVesselMesh(params, textureData);
   let stl = "solid vessel\n";
   
   for (let i = 0; i < indices.length; i += 3) {
     const i1 = indices[i] * 3;
     const i2 = indices[i + 1] * 3;
     const i3 = indices[i + 2] * 3;
     
     const v1 = { x: vertices[i1], y: vertices[i1+1], z: vertices[i1+2] };
     const v2 = { x: vertices[i2], y: vertices[i2+1], z: vertices[i2+2] };
     const v3 = { x: vertices[i3], y: vertices[i3+1], z: vertices[i3+2] };
     
     // Calculate normal (simple cross product)
     const u = { x: v2.x - v1.x, y: v2.y - v1.y, z: v2.z - v1.z };
     const v = { x: v3.x - v1.x, y: v3.y - v1.y, z: v3.z - v1.z };
     const nx = u.y * v.z - u.z * v.y;
     const ny = u.z * v.x - u.x * v.z;
     const nz = u.x * v.y - u.y * v.x;
     // Normalize
     const len = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
     
     stl += `facet normal ${(nx/len).toFixed(4)} ${(ny/len).toFixed(4)} ${(nz/len).toFixed(4)}\n`;
     stl += "  outer loop\n";
     stl += `    vertex ${v1.x.toFixed(4)} ${v1.y.toFixed(4)} ${v1.z.toFixed(4)}\n`;
     stl += `    vertex ${v2.x.toFixed(4)} ${v2.y.toFixed(4)} ${v2.z.toFixed(4)}\n`;
     stl += `    vertex ${v3.x.toFixed(4)} ${v3.y.toFixed(4)} ${v3.z.toFixed(4)}\n`;
     stl += "  endloop\n";
     stl += "endfacet\n";
   }
   
   stl += "endsolid vessel\n";
   downloadFile(stl, 'vessel.stl', 'text/plain');
};

export const exportPLY = (params: VesselParams, textureData: TextureData | null = null) => {
  const { vertices, indices } = generateVesselMesh(params, textureData);
  const vertexCount = vertices.length / 3;
  const faceCount = indices.length / 3;
  
  let ply = "ply\n";
  ply += "format ascii 1.0\n";
  ply += `element vertex ${vertexCount}\n`;
  ply += "property float x\n";
  ply += "property float y\n";
  ply += "property float z\n";
  ply += `element face ${faceCount}\n`;
  ply += "property list uchar int vertex_index\n";
  ply += "end_header\n";
  
  for (let i = 0; i < vertices.length; i += 3) {
    ply += `${vertices[i].toFixed(4)} ${vertices[i+1].toFixed(4)} ${vertices[i+2].toFixed(4)}\n`;
  }
  
  for (let i = 0; i < indices.length; i += 3) {
    ply += `3 ${indices[i]} ${indices[i+1]} ${indices[i+2]}\n`;
  }
  
  downloadFile(ply, 'vessel.ply', 'text/plain');
};

const getHeader = (params: VesselParams, layerHeight: number) => {
  const { printerType, nozzleDiameter, printSpeed } = params;
  let header = `; CeramicFlow AI G-Code Export
; Printer: ${printerType}
; Nozzle: ${nozzleDiameter}mm
; Layer Height: ${layerHeight.toFixed(3)}mm
; Speed: ${printSpeed} mm/min
G21 ; Millimeters
G90 ; Absolute positioning
M82 ; Absolute extrusion mode
`;

  switch (printerType) {
    case 'wasp':
      header += `G28 ; Home Delta
G1 Z15 F${printSpeed} ; Move up
M204 S500 ; Low acceleration for clay
`;
      break;
    case 'potterbot':
      header += `G28 ; Home
G1 Z10 ; Lift
G92 E0 ; Reset Extruder
`;
      break;
    case 'marlin':
    default:
      header += `G28 ; Home
G1 Z5 F${printSpeed} ; Lift nozzle
`;
      break;
  }
  return header;
};

export const exportGCODE = (params: VesselParams, textureData: TextureData | null = null) => {
  // Spiral vase mode GCode Generation
  const { layers, segments, height, nozzleDiameter, filamentDiameter, printSpeed } = params;
  
  const layerHeight = height / layers;
  let gcode = getHeader(params, layerHeight);
  
  // E calculation: Volume of cylinder segment = length * width * height
  // E moves filament linear distance. Volume = E * FilamentArea
  // E = (length * width * height) / FilamentArea
  // Width assumed to be nozzle diameter for vase mode
  const filamentArea = Math.PI * Math.pow(filamentDiameter / 2, 2);
  const ePerMM = (nozzleDiameter * layerHeight) / filamentArea;
  
  let currentE = 0;
  
  // Move to start
  const start = calculateVesselPoint(params, 0, 0, 0, 0, 1, textureData);
  // Map coordinates: Mesh Y (up) -> GCode Z. Mesh Z -> GCode Y.
  gcode += `\n; Start Loop\nG0 X${start.x.toFixed(3)} Y${start.z.toFixed(3)} Z${layerHeight.toFixed(3)} F${printSpeed}\n`;
  
  // Spiral loop
  // We want a continuous spiral, so we iterate total steps = layers * segments
  // This creates a smooth helix instead of stacked rings
  const totalSteps = layers * segments;
  
  let prevX = start.x;
  let prevY = start.z; 
  let prevZ = layerHeight; // Start at first layer height
  
  for (let i = 1; i <= totalSteps; i++) {
    // Normalized height (v) moves continuously from 0 to 1
    const v = i / totalSteps;
    
    // Normalized circumference (u)
    // We pass i/segments to calculateVesselPoint. calculateVesselPoint uses cos(u * 2PI).
    // So as long as i increases, it wraps around naturally in the trig functions.
    const u = i / segments; 
    
    const p = calculateVesselPoint(params, u, v, 0, 0, 1, textureData);
    
    const gx = p.x;
    const gy = p.z; // Mesh Z is Printer Y
    const gz = p.y; // Mesh Y is Printer Z
    
    // 3D Distance for extrusion
    const dist = Math.sqrt(
      Math.pow(gx - prevX, 2) + 
      Math.pow(gy - prevY, 2) + 
      Math.pow(gz - prevZ, 2)
    );
    
    currentE += dist * ePerMM;
    
    gcode += `G1 X${gx.toFixed(3)} Y${gy.toFixed(3)} Z${gz.toFixed(3)} E${currentE.toFixed(4)}\n`;
    
    prevX = gx;
    prevY = gy;
    prevZ = gz;
  }
  
  // Footer
  gcode += `\n; Footer\n`;
  gcode += "G1 E-2 F2400 ; Retract\n";
  gcode += `G1 Z${(params.height + 20).toFixed(2)} F${printSpeed} ; Move up safety\n`; 
  gcode += "G28 X0 Y0 ; Home X Y\n";
  gcode += "M30 ; End of program\n";
  
  downloadFile(gcode, 'vessel.gcode', 'text/plain');
};

export const exportByType = (type: string, params: VesselParams, textureData: TextureData | null = null) => {
  switch (type) {
    case 'obj': exportOBJ(params, textureData); break;
    case 'stl': exportSTL(params, textureData); break;
    case 'ply': exportPLY(params, textureData); break;
    case 'gcode': exportGCODE(params, textureData); break;
  }
};