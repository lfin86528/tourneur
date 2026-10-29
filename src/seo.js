import { useEffect } from 'react';

// The browser tab's title while browsing; the server writes the same titles
// (with descriptions and previews) for search engines, see php/app/seo.php.
export function usePageTitle(title) {
  useEffect(() => {
    if (title === null) return;
    document.title = title ? `${title} — tourneur.ch` : 'tourneur.ch — Un type tourne du bois';
  }, [title]);
}
