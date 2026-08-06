export function createPageUrl(pageName: string) {
    const slug = pageName.replace(/ /g, '-');
    const baseUrl = import.meta.env.BASE_URL || '/';
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

    if (!slug || slug === 'Home') {
        return normalizedBase === '/' ? '/' : normalizedBase.replace(/\/$/, '');
    }

    return `${normalizedBase.replace(/\/$/, '')}/${slug}`;
}