import { GoogleGenAI, Schema, Type } from "@google/genai";
import { VesselParams, GeneratedScript } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateProcessingCode = async (params: VesselParams): Promise<GeneratedScript> => {
  
  const isGcode = params.exportFormat === 'gcode';
  
  const formatInstruction = isGcode
    ? `3. G-CODE EXPORT: Instead of just a mesh, the script must generate the actual print path (G1 moves) for a spiralized vase mode.
       4. Implement a function to write a '.gcode' text file when 's' is pressed.
       5. Printer Config: Type=${params.printerType}, Nozzle=${params.nozzleDiameter}mm, Speed=${params.printSpeed}mm/min.
       6. The visual sketch should visualize the toolpath points.`
    : `3. Implement a 'save' function to export a .${params.exportFormat} file when 's' is pressed.
       4. Use a standard library (like nervoussystem.obj for OBJ) or manual string writing if specific libraries are hard to assume present for ${params.exportFormat}.
       5. Ensure the mesh is solid/watertight. If Wall Thickness > 0, generate an inner and outer shell and connect them at the rim.`;

  const imageInstruction = params.textureImage 
    ? `8. IMAGE INFLUENCE: The user has provided an image to influence the texture. 
       The script should try to load an image file named "texture.jpg" (or allow user selection) and use its brightness values to displace the mesh vertices, similar to a displacement map.
       The displacement amount is ${params.textureInfluence}. Map the image UVs to the cylinder surface.`
    : '';

  const prompt = `
    Act as an expert in computational design and generative art using Processing (Java) for 3D printing ceramic vessels.
    
    Create a complete, working Processing (Java) script based on the following parameters:
    - Base Radius: ${params.baseRadius}
    - Total Height: ${params.height}
    - Wall Thickness: ${params.wallThickness}
    - Noise Amplitude (Scale): ${params.noiseScale}
    - Noise Frequency: ${params.noiseFrequency}
    - Number of Layers: ${params.layers}
    - Mesh Resolution (Segments around): ${params.segments}
    - Twist Factor: ${params.twist}
    - Export Format: ${params.exportFormat.toUpperCase()}
    ${isGcode ? `- Printer Settings: ${params.printerType} | Nozzle: ${params.nozzleDiameter}mm | Speed: ${params.printSpeed}mm/min` : ''}
    ${params.textureImage ? `- Texture Influence: ${params.textureInfluence} (Use image brightness for displacement)` : ''}

    Requirements:
    1. Use a mesh generation approach.
    2. Modify the vertex radius using Perlin noise or Sine waves based on the parameters provided.
    ${params.wallThickness > 0 ? "3. The vessel must be a solid object with thickness (not just a surface). Create a closed volume with an inner wall, outer wall, floor, and rim." : "3. Create a surface mesh (vase mode compatible)."}
    ${formatInstruction}
    ${imageInstruction}
    7. The code must be ready to copy-paste into the Processing IDE.

    Output format:
    Provide the raw code and a brief explanation of how the parameters affect the shape and how to use the export.
  `;

  // Define schema for structured output
  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      code: {
        type: Type.STRING,
        description: "The complete Processing (Java) source code.",
      },
      explanation: {
        type: Type.STRING,
        description: "A brief explanation of the code and how to use it for 3D printing.",
      },
    },
    required: ["code", "explanation"],
  };

  try {
    const contents: any = [{ text: prompt }];
    
    // Note: We don't send the base64 image directly to Gemini to analyze for code generation context 
    // unless strictly needed, as we want the *script* to load the image, not hardcode the geometry.
    // However, if we wanted Gemini to "mimic" the shape, we would send it.
    // Given the prompt "influence vessel's shape or texture", keeping it as a parametric displacement map is the most "computational design" approach.
    
    // If we wanted to send the image for visual context:
    if (params.textureImage) {
        const base64Data = params.textureImage.split(',')[1];
        contents.push({
            inlineData: {
                mimeType: "image/jpeg",
                data: base64Data
            }
        });
        contents.push({ text: "Use the provided image as a visual reference for the intended texture pattern." });
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        systemInstruction: "You are a specialized coding assistant for ceramic 3D printing.",
      },
    });

    if (response.text) {
      return JSON.parse(response.text) as GeneratedScript;
    }
    throw new Error("No response generated");
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};