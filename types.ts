export type ExportFormat = 'obj' | 'stl' | 'ply' | 'gcode';
export type PrinterType = 'marlin' | 'wasp' | 'potterbot';

export interface VesselParams {
  height: number;
  baseRadius: number;
  noiseScale: number;
  noiseFrequency: number;
  layers: number;
  twist: number;
  segments: number;
  wallThickness: number;
  exportFormat: ExportFormat;
  // Texture / Image Influence
  textureImage: string | null; // Base64 string
  textureInfluence: number; // 0 to 50mm displacement
  // Printer Settings
  printerType: PrinterType;
  nozzleDiameter: number;
  filamentDiameter: number;
  printSpeed: number; // mm/min
}

export interface TextureData {
  data: Uint8Array;
  width: number;
  height: number;
}

export interface GeneratedScript {
  code: string;
  explanation: string;
}

export enum ViewMode {
  PREVIEW = 'PREVIEW',
  CODE = 'CODE',
}

export interface PrintStats {
  estimatedTime: number; // minutes
  filamentLength: number; // meters
  filamentWeight: number; // grams (assuming clay density)
  layerHeight: number; // mm
  totalLayers: number;
}