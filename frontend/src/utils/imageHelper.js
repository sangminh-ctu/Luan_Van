export const getBookCoverUrl = (images, fallbackTitle = 'No Cover') => {
    if (!images || images.length === 0) {
        return `https://via.placeholder.com/200x280/F5F5F5/888888?text=${encodeURIComponent(fallbackTitle)}`;
    }
    const primary = images.find(img => img.is_primary);
    const url = primary ? primary.image_url : images[0].image_url;
    if (url && url.startsWith('/uploads')) {
        const backendBase = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:5000';
        return `${backendBase}${url}`;
    }
    return url || `https://via.placeholder.com/200x280/F5F5F5/888888?text=${encodeURIComponent(fallbackTitle)}`;
};

export default getBookCoverUrl;
