export function createPageUrl(pageName: string) {
    const slug = pageName.replace(/ /g, '-');
    const baseUrl = import.meta.env.BASE_URL.endsWith('/')
        ? import.meta.env.BASE_URL
        : `${import.meta.env.BASE_URL}/`;

    if (!slug || slug === 'Home') {
        return baseUrl;
    }

    return `${baseUrl}#/${slug}`;
}