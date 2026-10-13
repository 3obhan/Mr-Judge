export function createPageUrl(pageName: string) {
    const slug = pageName.replace(/ /g, '-');

    if (!slug || slug === 'Home') {
        return '/';
    }

    return `/${slug}`;
}
