/**
 * Compresses an image file using the Browser Canvas API.
 * 
 * @param {File} file - The image file to compress.
 * @param {number} maxWidth - Maximum width of the output image. Default 800px.
 * @param {number} quality - Quality of the JPEG output (0 to 1). Default 0.7.
 * @returns {Promise<string>} - A promise that resolves to the compressed Base64 string.
 */
export const compressImage = (file, maxWidth = 800, quality = 0.7) => {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject("No file provided");
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Compress and return as Base64
                // Use original type if PNG to preserve transparency
                // Otherwise use JPEG for better compression
                const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
                // Quality argument is ignored for PNGs in standard implementations
                const dataUrl = canvas.toDataURL(outputType, quality);
                resolve(dataUrl);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};
