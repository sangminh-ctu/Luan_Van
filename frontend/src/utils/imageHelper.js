export const formatImageUrl = (url, fallbackTitle = 'Book Image') => {
    if (!url) return `https://via.placeholder.com/400x560/F5F5F5/888888?text=${encodeURIComponent(fallbackTitle)}`;
    if (url.startsWith('/uploads')) {
        const backendBase = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:5000';
        return `${backendBase}${url}`;
    }
    return url;
};

export const getBookCoverUrl = (images, fallbackTitle = 'No Cover') => {
    if (!images || images.length === 0) {
        return formatImageUrl(null, fallbackTitle);
    }
    const primary = images.find(img => img.is_primary);
    const url = primary ? primary.image_url : images[0].image_url;
    return formatImageUrl(url, fallbackTitle);
};

export default getBookCoverUrl;

