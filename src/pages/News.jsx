import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowUpRight, Images, ImagePlus, Megaphone, Newspaper, PencilLine, Plus, Trash2, X } from 'lucide-react';
import { api, formatDate } from '../api.js';
import { EmptyState, Loading, Modal, PageHeader } from '../components/UI.jsx';
import { EditContentLink, useContent } from '../content.jsx';
import { useLanguage } from '../i18n.jsx';
import Viewer from '../components/Viewer.jsx';

// Plain text only: blank lines separate paragraphs, single newlines become line breaks.
// Web addresses in the text become links.
function Linkified({ text }) {
  return String(text).split(/(https?:\/\/[^\s)<>]+)/g).map((part, index) => index % 2 ? <a key={index} href={part.replace(/[.,;:!?]+$/, '')} target="_blank" rel="noopener noreferrer">{part}</a> : part);
}
export function Paragraphs({ text }) {
  return String(text || '').split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph.split('\n').flatMap((line, i) => i ? [<br key={i}/>, <Linkified key={`l${i}`} text={line}/>] : [<Linkified key="l0" text={line}/>])}</p>);
}

function Album({ media }) {
  const [open, setOpen] = useState(null);
  const { t } = useLanguage();
  if (!media?.length) return null;
  return <section className="news-album">
    <h2><Images size={18}/>{t('Photo album')} <small>{media.length}</small></h2>
    <div className="news-album-grid">{media.map((item, index) => <button key={item.id} className="news-album-item" onClick={() => setOpen(index)} aria-label={item.caption || t('Open photo {{number}}', { number: index + 1 })}>
      {item.kind === 'video' ? <video src={item.url} preload="metadata" muted/> : <img src={item.url} alt={item.caption} loading="lazy"/>}
      {item.kind === 'video' && <span className="news-album-play">▶</span>}
    </button>)}</div>
    {open !== null && <Viewer items={media.map((item) => ({ url: item.url, kind: item.kind, alt: item.caption }))} index={open} onIndex={setOpen} onClose={() => setOpen(null)}/>}
  </section>;
}

export function NewsForm({ item, onClose, onSaved }) {
  const [form, setForm] = useState({ title: item?.title || '', summary: item?.summary || '', body: item?.body || '', published: item ? item.published : true });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(item?.imageUrl || '');
  const [removeImage, setRemoveImage] = useState(false);
  const [albumFiles, setAlbumFiles] = useState([]);
  const [removedMedia, setRemovedMedia] = useState([]);
  const albumInput = useRef(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const input = useRef(null);
  const { t } = useLanguage();
  useEffect(() => () => { if (preview.startsWith('blob:')) URL.revokeObjectURL(preview); }, [preview]);
  const addAlbumFiles = (files) => {
    const valid = [...files].filter((file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && file.size <= 15 * 1024 * 1024);
    if (valid.length < files.length) setError(t('Some files were skipped: only JPEG, PNG, or WebP images up to 15 MB are accepted.'));
    setAlbumFiles((current) => [...current, ...valid.map((file) => ({ file, url: URL.createObjectURL(file) }))].slice(0, 20));
  };
  const keptMedia = (item?.media || []).filter((media) => !removedMedia.includes(media.id));
  const chooseFile = (selected) => {
    if (!selected) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type)) { setError(t('Please choose a JPEG, PNG, or WebP image.')); return; }
    if (selected.size > 15 * 1024 * 1024) { setError(t('Your image must be smaller than 15 MB.')); return; }
    setError(''); setFile(selected); setRemoveImage(false); setPreview(URL.createObjectURL(selected));
  };
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => body.append(key, String(value)));
      if (file) body.append('image', file);
      if (removeImage) body.append('removeImage', 'true');
      albumFiles.forEach(({ file }) => body.append('gallery[]', file));
      if (removedMedia.length) body.append('removeMedia', JSON.stringify(removedMedia));
      // Always POST: PHP only reads uploaded files from POST requests.
      const data = await api(item ? `/news/${item.id}` : '/news', { method: 'POST', body });
      onSaved(data.news);
    } catch (err) { setError(t(err.message)); setSaving(false); }
  };
  return <Modal onClose={onClose} className="news-modal" label={t(item ? 'Edit news item' : 'Add news')}>
    <div className="modal-heading"><p className="eyebrow">{t('Club news')}</p><h2>{t(item ? 'Edit news item' : 'Add news')}</h2><p>{t('Share an announcement, a workshop report, or a club update.')}</p></div>
    <form className="stack-form" onSubmit={submit}>
      <label className="field"><span>{t('Title')} <b>*</b></span><input required maxLength={160} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}/></label>
      <label className="field"><span>{t('Summary')} <small>{t('Shown in lists. Optional.')}</small></span><textarea rows="2" maxLength={400} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })}/></label>
      <label className="field"><span>{t('Message')} <b>*</b> <small>{t('Leave a blank line between paragraphs.')}</small></span><textarea rows="9" required maxLength={20000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}/></label>
      <div className="field"><span>{t('Image')} <small>{t('Optional · JPEG, PNG or WebP · Up to 15 MB')}</small></span>
        {preview && !removeImage ? <div className="news-image-edit"><img src={preview} alt=""/><div><button type="button" className="button button-secondary" onClick={() => input.current.click()}><ImagePlus size={16}/>{t('Replace photo')}</button><button type="button" className="button button-danger-quiet" onClick={() => { setFile(null); setRemoveImage(Boolean(item?.imageUrl)); setPreview(''); }}><Trash2 size={16}/>{t('Remove image')}</button></div></div>
          : <button type="button" className="news-image-drop" onClick={() => input.current.click()}><ImagePlus size={22}/>{t('Choose photo')}</button>}
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => chooseFile(e.target.files[0])}/>
      </div>
      <div className="field"><span>{t('Photo album')} <small>{t('Up to 20 new photos at a time')}</small></span>
        <div className="news-album-edit">
          {keptMedia.map((media) => <figure key={media.id}>{media.kind === 'video' ? <video src={media.url} preload="metadata" muted/> : <img src={media.url} alt=""/>}<button type="button" onClick={() => setRemovedMedia([...removedMedia, media.id])} aria-label={t('Remove image')}><X size={14}/></button></figure>)}
          {albumFiles.map((entry, index) => <figure key={entry.url} className="news-album-new"><img src={entry.url} alt=""/><button type="button" onClick={() => setAlbumFiles(albumFiles.filter((_, i) => i !== index))} aria-label={t('Remove image')}><X size={14}/></button></figure>)}
          <button type="button" className="news-album-add" onClick={() => albumInput.current.click()}><ImagePlus size={20}/><span>{t('Add photos')}</span></button>
        </div>
        <input ref={albumInput} type="file" multiple accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { addAlbumFiles(e.target.files); e.target.value = ''; }}/>
      </div>
      <label className="news-publish-toggle"><input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })}/><span><strong>{t('Publish this news item')}</strong><small>{t('Unchecked items stay as drafts, visible only to moderators.')}</small></span></label>
      {error && <p className="form-error">{error}</p>}
      <div className="modal-footer"><span>{t('Published news is visible on the public website.')}</span><button className="button button-primary" disabled={saving}>{saving ? t('Saving…') : t(item ? 'Save changes' : 'Publish news')}<ArrowUpRight size={17}/></button></div>
    </form>
  </Modal>;
}

export default function News() {
  const { user, notify } = useOutletContext();
  const [news, setNews] = useState(null);
  const [editing, setEditing] = useState(null);
  const { t } = useLanguage();
  const { c } = useContent();
  const moderator = user?.role === 'moderator';
  const load = () => api(`/news${moderator ? '?all=1' : ''}`).then((data) => setNews(data.news)).catch((err) => { notify(t(err.message), 'error'); setNews([]); });
  useEffect(() => { load(); }, [moderator]);
  const [lead, ...rest] = news || [];
  return <div className="news-page">
    <PageHeader eyebrow={c('news.eyebrow')} title={c('news.title')} description={c('news.description')}><EditContentLink user={user} page="news"/>{moderator && <button className="button button-primary" onClick={() => setEditing({})}><Plus size={17}/>{t('Add news')}</button>}</PageHeader>
    {!news ? <Loading/> : news.length === 0 ? <EmptyState icon={Newspaper} title={t('No news yet')} text={t('Club announcements and reports will be published here.')} action={moderator && <button className="button button-primary" onClick={() => setEditing({})}><Plus size={17}/>{t('Add news')}</button>}/> : <>
      <NewsCard item={lead} lead moderator={moderator} onEdit={setEditing}/>
      {rest.length > 0 && <div className="news-grid">{rest.map((item) => <NewsCard key={item.id} item={item} moderator={moderator} onEdit={setEditing}/>)}</div>}
    </>}
    {editing && <NewsForm item={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={(saved) => { setEditing(null); load(); notify(t(saved.published ? 'The news item has been published.' : 'The news item has been saved as a draft.')); }}/>}
  </div>;
}

function NewsCard({ item, lead = false, moderator, onEdit }) {
  const { t } = useLanguage();
  return <article className={`news-card ${lead ? 'news-card-lead' : ''} ${item.imageUrl ? '' : 'news-card-plain'}`}>
    {item.imageUrl ? <Link to={`/news/${item.id}`} className="news-card-image"><img src={item.imageUrl} alt="" loading="lazy"/></Link> : <Link to={`/news/${item.id}`} className="news-card-image news-card-placeholder" aria-hidden="true" tabIndex={-1}><Megaphone/></Link>}
    <div className="news-card-body">
      <div className="news-card-meta"><span>{formatDate(item.createdAt, { year: 'numeric' })}{item.mediaCount > 0 && <> · <Images size={12}/> {item.mediaCount}</>}</span>{!item.published && <span className="status-pill status-pending"><span className="status-dot"/>{t('Draft')}</span>}</div>
      <h2><Link to={`/news/${item.id}`}>{item.title}</Link></h2>
      <p>{item.summary}</p>
      <div className="news-card-footer"><Link className="text-link" to={`/news/${item.id}`}>{t('Read more')} <ArrowRight size={15}/></Link>{moderator && <button className="text-link" onClick={() => onEdit(item)}><PencilLine size={15}/>{t('Edit')}</button>}</div>
    </div>
  </article>;
}

export function NewsDetail() {
  const { user, notify } = useOutletContext();
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [viewingLead, setViewingLead] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const moderator = user?.role === 'moderator';
  useEffect(() => { setItem(null); setMissing(false); api(`/news/${id}`).then((data) => setItem(data.news)).catch(() => setMissing(true)); }, [id]);
  const remove = async () => {
    if (!window.confirm(t('Delete this news item? This cannot be undone.'))) return;
    try { await api(`/news/${item.id}`, { method: 'DELETE' }); notify(t('The news item has been deleted.')); navigate('/news'); }
    catch (err) { notify(t(err.message), 'error'); }
  };
  if (missing) return <EmptyState icon={Newspaper} title={t('News item not found.')} text={t('It may have been removed or is not published yet.')} action={<Link className="button button-primary" to="/news">{t('All news')}</Link>}/>;
  if (!item) return <Loading/>;
  return <article className="news-detail">
    <div className="news-detail-top"><Link className="text-link" to="/news"><ArrowLeft size={15}/>{t('All news')}</Link>{moderator && <div className="news-detail-actions"><button className="button button-secondary" onClick={() => setEditing(true)}><PencilLine size={16}/>{t('Edit')}</button><button className="button button-danger-quiet" onClick={remove}><Trash2 size={16}/>{t('Delete')}</button></div>}</div>
    <header><p className="eyebrow">{formatDate(item.createdAt, { year: 'numeric', month: 'long' })} · {item.author}{!item.published && <> · {t('Draft')}</>}</p><h1>{item.title}</h1>{item.summary && !item.body.startsWith(item.summary) && <p className="news-detail-summary">{item.summary}</p>}</header>
    {item.imageUrl && <button className="news-detail-image-button" onClick={() => setViewingLead(true)} aria-label={t('Show the photo full screen')}><img className="news-detail-image" src={item.imageUrl} alt=""/></button>}
    {viewingLead && <Viewer items={[{ url: item.imageUrl, alt: item.title }]} index={0} onIndex={() => {}} onClose={() => setViewingLead(false)}/>}
    <div className="news-detail-body"><Paragraphs text={item.body}/></div>
    <Album media={item.media}/>
    {item.updatedAt && <p className="news-detail-updated">{t('Updated {{date}}', { date: formatDate(item.updatedAt, { year: 'numeric' }) })}</p>}
    {editing && <NewsForm item={item} onClose={() => setEditing(false)} onSaved={(saved) => { setEditing(false); setItem(saved); notify(t('Your changes have been saved.')); }}/>}
  </article>;
}
