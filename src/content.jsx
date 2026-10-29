import { createContext, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PencilLine } from 'lucide-react';
import { api } from './api.js';
import { contentFallbacks, untranslatedKeys } from './contentBlocks.js';
import { useLanguage } from './i18n.jsx';
import { Splash } from './components/UI.jsx';

const ContentContext = createContext({ overrides: {}, setOverrides: () => {} });

export function ContentProvider({ children }) {
  const [overrides, setOverrides] = useState(null);
  useEffect(() => { api('/content').then((data) => setOverrides(data.content)).catch(() => setOverrides({})); }, []);
  if (!overrides) return <Splash/>;
  return <ContentContext.Provider value={{ overrides, setOverrides }}>{children}</ContentContext.Provider>;
}

export function useContent() {
  const { language, t } = useLanguage();
  const { overrides, setOverrides } = useContext(ContentContext);
  // A text saved by a moderator wins; otherwise the translated built-in text.
  // Untranslated blocks (a quote, a link) use the text saved in any language.
  const c = (key) => {
    const saved = overrides[key] || {};
    if (untranslatedKeys.has(key)) return saved[language] || saved.fr || Object.values(saved)[0] || contentFallbacks[key] || '';
    return saved[language] || t(contentFallbacks[key] ?? key);
  };
  return { c, overrides, setOverrides };
}

export function EditContentLink({ user, page }) {
  const { t } = useLanguage();
  if (user?.role !== 'moderator') return null;
  return <Link className="button button-secondary edit-content-link" to={`/admin/content?page=${page}`}><PencilLine size={16}/>{t('Edit texts')}</Link>;
}
