import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, FilePlus2, FileSpreadsheet, FileText, Image as ImageIcon, PencilLine, Presentation, Trash2, Upload } from 'lucide-react';
import { api, formatDate } from '../api.js';
import { EmptyState, Loading, Modal, PageHeader } from '../components/UI.jsx';
import { useLanguage } from '../i18n.jsx';
import { EditContentLink, useContent } from '../content.jsx';
import { usePageTitle } from '../seo.js';

const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.jpg,.jpeg,.png,.webp';
const MAX_BYTES = 20 * 1024 * 1024;
const SUGGESTED_CATEGORIES = ['Entretien', 'Tarifs', 'Bois', 'Conseils'];
const KINDS = {
  pdf: ['PDF', FileText], doc: ['Word', FileText], docx: ['Word', FileText], odt: ['OpenDocument', FileText],
  xls: ['Excel', FileSpreadsheet], xlsx: ['Excel', FileSpreadsheet], ods: ['OpenDocument', FileSpreadsheet],
  ppt: ['PowerPoint', Presentation], pptx: ['PowerPoint', Presentation],
  jpg: ['Image', ImageIcon], jpeg: ['Image', ImageIcon], png: ['Image', ImageIcon], webp: ['Image', ImageIcon],
};
const kindOf = (type) => KINDS[type] || ['Document', FileText];
const size = (bytes, locale) => (bytes >= 1024 * 1024
  ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} Mo`
  : `${Math.max(1, Math.round(bytes / 1024))} Ko`);

function ResourceForm({ item, categories, onClose, onSaved, onDeleted }) {
  const [form, setForm] = useState({ title: item?.title || '', category: item?.category || '', description: item?.description || '', featured: item?.featured || false });
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [confirming, setConfirming] = useState(false);
  const input = useRef(null);
  const { t, locale } = useLanguage();
  const choose = (selected) => {
    setError('');
    if (!selected) return;
    const extension = selected.name.split('.').pop().toLowerCase();
    if (!ACCEPT.split(',').includes(`.${extension}`)) { setError(t('Choose a PDF, Word, Excel, PowerPoint, OpenDocument, or image file.')); return; }
    if (selected.size > MAX_BYTES) { setError(t('The document is larger than 20 MB.')); return; }
    setFile(selected);
    if (!form.title.trim()) setForm({ ...form, title: selected.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ') });
  };
  const submit = async (event) => {
    event.preventDefault();
    if (!item && !file) { setError(t('Choose the file to add.')); return; }
    setBusy('save'); setError('');
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => body.append(key, String(value)));
      if (file) body.append('file', file);
      const data = await api(item ? `/resources/${item.id}` : '/resources', { method: 'POST', body });
      onSaved(data.resource, Boolean(item));
    } catch (err) { setError(t(err.message)); setBusy(''); }
  };
  const remove = async () => {
    setBusy('delete');
    try { await api(`/resources/${item.id}`, { method: 'DELETE' }); onDeleted(item); }
    catch (err) { setError(t(err.message)); setBusy(''); }
  };
  const current = file ? { name: file.name, bytes: file.size } : item?.fileUrl ? { name: item.fileName, bytes: item.fileSize } : null;
  return <Modal onClose={onClose} className="resource-modal" label={t(item ? 'Edit the document' : 'Add a document')}>
    <div className="modal-heading"><p className="eyebrow">{t('Club library')}</p><h2>{t(item ? 'Edit the document' : 'Add a document')}</h2><p>{t('PDF, Word, Excel, PowerPoint, OpenDocument, or image, up to 20 MB.')}</p></div>
    <form className="stack-form" onSubmit={submit}>
      <div className="field"><span>{t('File')} {!item && <b>*</b>}</span>
        <div className="resource-file">
          {current ? <span className="resource-file-name"><FileText size={18}/><span><strong>{current.name}</strong><small>{size(current.bytes, locale)}{file && item ? ` · ${t('replaces the current file')}` : ''}</small></span></span> : <span className="resource-file-name empty">{t('No file chosen yet')}</span>}
          <button type="button" className="button button-secondary" onClick={() => input.current.click()}><Upload size={16}/>{t(current ? 'Choose another file' : 'Choose a file')}</button>
        </div>
        <input ref={input} type="file" accept={ACCEPT} hidden onChange={(e) => { choose(e.target.files[0]); e.target.value = ''; }}/>
      </div>
      <label className="field"><span>{t('Title')} <b>*</b></span><input required maxLength={160} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}/></label>
      <label className="field"><span>{t('Category')}</span><input list="resource-categories" maxLength={60} value={form.category} placeholder="p. ex. Entretien, Tarifs, Bois" onChange={(e) => setForm({ ...form, category: e.target.value })}/></label>
      <datalist id="resource-categories">{categories.map((category) => <option key={category} value={category}/>)}</datalist>
      <label className="field"><span>{t('Description')} <small>{t('Optional')}</small></span><textarea rows="3" maxLength={600} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}/></label>
      {error && <p className="form-error">{error}</p>}
      {item && (confirming
        ? <div className="member-delete-confirm"><p><strong>{t('Delete “{{title}}”?', { title: item.title })}</strong> {t('The file is deleted from the website. This cannot be undone.')}</p><div className="member-delete-actions"><button type="button" className="button button-secondary" onClick={() => setConfirming(false)}>{t('Cancel')}</button><button type="button" className="button button-reject" disabled={busy === 'delete'} onClick={remove}><Trash2 size={16}/>{busy === 'delete' ? t('Deleting…') : t('Delete definitively')}</button></div></div>
        : <button type="button" className="text-link resource-delete" onClick={() => setConfirming(true)}><Trash2 size={15}/>{t('Delete this document')}</button>)}
      <div className="modal-footer"><span>Visible sur le site dès l’enregistrement.</span><button className="button button-primary" disabled={busy === 'save'}>{busy === 'save' ? t('Saving…') : (item ? t('Save changes') : 'Mettre en ligne')}<ArrowUpRight size={17}/></button></div>
    </form>
  </Modal>;
}

export default function Resources() {
  usePageTitle('Documents');
  const { user, notify } = useOutletContext();
  const [resources, setResources] = useState(null);
  const [news, setNews] = useState([]);
  const [editing, setEditing] = useState(null);
  const { t, locale } = useLanguage();
  const { c } = useContent();
  const moderator = user?.role === 'moderator';
  const load = () => {
    api('/resources').then((data) => setResources(data.resources)).catch(() => setResources([]));
    api('/news?limit=3').then((data) => setNews(data.news)).catch(() => {});
  };
  useEffect(() => { load(); }, [user?.id]);
  const categories = useMemo(() => [...new Set([...(resources || []).map((resource) => resource.category).filter(Boolean), ...SUGGESTED_CATEGORIES])], [resources]);
  const shown = (resources || []).filter((resource) => resource.fileUrl || moderator);
  return <div className="resources-page"><PageHeader eyebrow={c('resources.eyebrow')} title={c('resources.title')} description={c('resources.description')}><EditContentLink user={user} page="documents"/>{moderator && <button className="button button-primary" onClick={() => setEditing({})}><FilePlus2 size={17}/>{t('Add a document')}</button>}</PageHeader>
    <div className="library-layout"><section><div className="section-heading"><div><p className="eyebrow">À télécharger</p><h2>Fiches et documents</h2></div><span>{shown.length} {shown.length === 1 ? 'document' : 'documents'}</span></div>
      {!resources ? <Loading/> : shown.length === 0 ? <EmptyState icon={FileText} title={t('No documents yet')} text={moderator ? 'Ajoutez des fiches d’entretien, des tarifs ou des conseils avec « Ajouter un document ».' : 'Les documents seront bientôt disponibles ici.'} action={moderator && <button className="button button-primary" onClick={() => setEditing({})}><FilePlus2 size={17}/>{t('Add a document')}</button>}/>
        : <div className="resource-list">{shown.map((resource, index) => { const [kind, Icon] = kindOf(resource.fileType); return <div className="resource-card" key={resource.id}>
          {resource.fileUrl ? <a className="resource-link" href={resource.fileUrl} target="_blank" rel="noopener">
            <span className={`resource-icon resource-${index % 4}`}><Icon/></span>
            <span className="resource-text"><small>{resource.category}</small><strong>{resource.title}</strong>{resource.description && <p>{resource.description}</p>}<span className="resource-meta">{kind} · {size(resource.fileSize, locale)}</span></span>
            <ArrowUpRight size={18}/>
          </a> : <div className="resource-link missing"><span className={`resource-icon resource-${index % 4}`}><Icon/></span><span className="resource-text"><small>{resource.category}</small><strong>{resource.title}</strong><span className="resource-meta">{t('No file yet: edit it to add one.')}</span></span></div>}
          {moderator && <button className="resource-edit" onClick={() => setEditing(resource)} aria-label={t('Edit “{{title}}”', { title: resource.title })}><PencilLine size={16}/></button>}
        </div>; })}</div>}
    </section><aside className="library-news"><div className="section-heading"><div><p className="eyebrow">De l’atelier</p><h2>{t('Latest news')}</h2></div></div>{news.map((item) => <article key={item.id}><span>{formatDate(item.createdAt)}</span><h3><Link to={`/news/${item.id}`}>{item.title}</Link></h3><p>{item.summary}</p></article>)}<Link className="text-link" to="/news">{t('All news')} <ArrowRight size={15}/></Link></aside></div>
    {editing && <ResourceForm item={editing.id ? editing : null} categories={categories} onClose={() => setEditing(null)}
      onSaved={(saved, wasEdit) => { setEditing(null); load(); notify(wasEdit ? t('“{{title}}” has been updated.', { title: saved.title }) : `« ${saved.title} » est en ligne.`); }}
      onDeleted={(removed) => { setEditing(null); load(); notify(t('“{{title}}” has been deleted.', { title: removed.title })); }}/>}
  </div>;
}
