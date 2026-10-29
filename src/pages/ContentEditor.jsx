import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Info, RotateCcw, Save } from 'lucide-react';
import { api } from '../api.js';
import { PageHeader } from '../components/UI.jsx';
import { useContent } from '../content.jsx';
import { contentPages } from '../contentBlocks.js';
import { translate, useLanguage } from '../i18n.jsx';
import { usePageTitle } from '../seo.js';

// tourneur.ch is in French only; the page texts and their labels are in French.
const editorLanguages = ['fr'];

export default function ContentEditor() {
  usePageTitle('Textes des pages');
  const { notify } = useOutletContext();
  const [params, setParams] = useSearchParams();
  const { t } = useLanguage();
  const { overrides, setOverrides } = useContent();
  const page = contentPages.find((item) => item.id === params.get('page')) || contentPages[0];
  const saved = useMemo(() => Object.fromEntries(page.blocks.flatMap((block) => editorLanguages.map((lang) => [`${block.key}|${lang}`, overrides[block.key]?.[lang] || '']))), [page, overrides]);
  const [draft, setDraft] = useState(saved);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDraft(saved); }, [saved]);
  const changed = Object.keys(draft).filter((id) => draft[id].trim() !== saved[id]);
  const choosePage = (id) => {
    if (changed.length && !window.confirm(t('You have unsaved changes on this page. Leave without saving?'))) return;
    setParams({ page: id });
  };
  const save = async () => {
    if (!changed.length) return;
    setSaving(true);
    try {
      const entries = changed.map((id) => { const [key, lang] = id.split('|'); return { key, lang, value: draft[id] }; });
      const data = await api('/content', { method: 'PUT', body: JSON.stringify({ entries }) });
      setOverrides(data.content);
      notify(t('The page texts have been saved.'));
    } catch (err) { notify(t(err.message), 'error'); }
    finally { setSaving(false); }
  };

  return <div className="content-editor-page">
    <PageHeader eyebrow="Gestion" title="Textes des pages" description="Modifiez les textes du site. Laissez un champ vide pour garder le texte d’origine.">
      <Link className="button button-secondary" to={page.path}><ArrowUpRight size={16}/>{t('View page')}</Link>
      <button className="button button-primary" disabled={!changed.length || saving} onClick={save}><Save size={17}/>{saving ? t('Saving…') : changed.length ? t('Save {{count}} changes', { count: changed.length }) : t('No changes')}</button>
    </PageHeader>
    <div className="content-editor-layout">
      <nav className="content-page-list" aria-label={t('Pages')}>{contentPages.map((item) => {
        const customised = item.blocks.filter((block) => Object.keys(overrides[block.key] || {}).length).length;
        return <button key={item.id} className={item.id === page.id ? 'active' : ''} onClick={() => choosePage(item.id)}><span>{item.label}</span>{customised > 0 && <small>{customised}</small>}</button>;
      })}</nav>
      <section className="content-blocks">
        <div className="inline-notice"><Info size={17}/><span>Le texte gris de chaque champ est le texte d’origine. Un texte enregistré le remplace.</span></div>
        {page.blocks.map((block) => <article className="content-block" key={block.key}>
          <h2>{block.label}</h2>
          <div className="content-block-fields content-block-single">{editorLanguages.map((lang) => {
            const id = `${block.key}|${lang}`;
            const Input = block.multiline ? 'textarea' : 'input';
            return <label className={`field ${draft[id] !== saved[id] ? 'field-changed' : ''}`} key={lang}>
              <span>{block.hint || 'Texte'}{draft[id] && <button type="button" className="content-reset" onClick={() => setDraft({ ...draft, [id]: '' })} title={t('Restore the original text')}><RotateCcw size={12}/>{t('Original')}</button>}</span>
              <Input rows={block.multiline ? 3 : undefined} maxLength={5000} value={draft[id]} placeholder={translate(lang, block.fallback)} onChange={(e) => setDraft({ ...draft, [id]: e.target.value })}/>
            </label>;
          })}</div>
        </article>)}
      </section>
    </div>
  </div>;
}
