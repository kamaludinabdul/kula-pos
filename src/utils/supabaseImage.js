/**
 * Utility to generate optimized URLs for Supabase Storage images.
 * Uses Supabase's built-in image transformation service.
 * 
 * @param {string} url - The original image URL.
 * @param {Object} options - Transformation options.
 * @param {number} options.width - Desired width.
 * @param {number} options.height - Desired height.
 * @param {number} options.quality - Image quality (1-100).
 * @param {string} options.resize - Resize mode: 'cover', 'contain', 'fill'.
 * @returns {string} - The optimized image URL.
 */
export const getOptimizedImage = (url, options = {}) => {
    if (!url) return 'https://placehold.co/400x300?text=No+Image'; // Robust fallback

    // Don't transform Base64 data
    if (url.startsWith('data:')) return url;

    // Handle relative path "400x300.png" which seems to be appearing in data
    // Return a valid placeholder instead of a broken relative link
    if (url === '400x300.png' || url.match(/^\d+x\d+\.png$/)) {
        return `https://placehold.co/${url}?text=Placeholder`;
    }

    // Check if it's a Supabase storage URL
    // Format: https://[project-id].supabase.co/storage/v1/object/public/[bucket]/[path]
    const isSupabaseUrl = url.includes('.supabase.co/storage/v1/object/public/');

    if (!isSupabaseUrl) return url;

    const {
        width,
        height,
        quality = 75,
        resize = 'cover'
    } = options;

    // Transformation parameters
    const params = new URLSearchParams();
    if (width) params.append('width', width);
    if (height) params.append('height', height);
    params.append('quality', quality);
    params.append('resize', resize);

    // Supabase transformation URL format:
    // https://[project-id].supabase.co/storage/v1/render/image/public/[bucket]/[path]?[params]

    // Change 'object' to 'render/image' in the URL
    const transformedUrl = url.replace('/v1/object/public/', '/v1/render/image/public/');

    return `${transformedUrl}?${params.toString()}`;
};
