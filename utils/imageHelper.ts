import { TextureData } from '../types';

export const processImageForGeometry = (base64: string): Promise<TextureData> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // Downscale for performance if needed, but keeping reasonable res for detail
      const MAX_SIZE = 512; 
      let width = img.width;
      let height = img.height;
      
      if (width > height) {
        if (width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        }
      } else {
        if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }
      }
      
      canvas.width = Math.floor(width);
      canvas.height = Math.floor(height);
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }
      
      // Draw image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Get raw pixel data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data; // RGBA
      
      // Convert to Grayscale / Luminance map (Uint8)
      // We only need one channel
      const luminance = new Uint8Array(canvas.width * canvas.height);
      
      for (let i = 0; i < luminance.length; i++) {
        const r = data[i * 4];
        const g = data[i * 4 + 1];
        const b = data[i * 4 + 2];
        // Standard Rec. 601 Luma
        luminance[i] = 0.299 * r + 0.587 * g + 0.114 * b;
      }
      
      resolve({
        data: luminance,
        width: canvas.width,
        height: canvas.height
      });
    };
    img.onerror = (err) => reject(err);
    img.src = base64;
  });
};

export const resizeImage = (file: File, maxWidth: number): Promise<string> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
    });
}