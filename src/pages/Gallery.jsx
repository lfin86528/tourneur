import { useEffect, useMemo, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Camera, PencilLine, Plus, Search, Trash2 } from 'lucide-react';
import { api, formatDate } from '../api.js';
import { EmptyState, Loading, Modal, PageHeader } from '../components/UI.jsx';
import { useLanguage } from '../i18n.jsx';
import Viewer from '../components/Viewer.jsx';
import { EditContentLink, useContent } from '../content.jsx';
import { PIECE_KINDS, groupPhotos } from '../gallery.js';

const SORTS = [['all', 'Everything'], ['wood', 'Wood'], ['kind', 'Type of piece']];
const kindLabel = (kind) => (PIECE_KINDS.find(([key]) => key === kind) || PIECE_KINDS.at(-1))[1];
// Groups shown as chips before "Show all": the rest stays one click away.
const CHIP_LIMIT = 14;

// The turner edits a piece, or removes it from the portfolio.
function PhotoEdit({ photo, onSaved, onDeleted, onCancel }) {
  const [form, setForm] = useState({ title: photo.title, kind: photo.kind || 'other', wood: photo.wood || '', story: photo.story || '', date: new Date(photo.createdAt).toLocaleDateString('sv-SE') });
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const { t } = useLanguage();
  const update = (key, value) => setForm({ ...form, [key]: value });
  const submit = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try { const { photo: saved } = await api(`/photos/${photo.id}`, { method: 'PATCH', body: JSON.stringify(form) }); onSaved(saved); }
    catch (err) { setError(t(err.message)); setSaving(false); }
  };
  const remove = async () => {
    setSaving(true);
    try { await api(`/photos/${photo.id}`, { method: 'DELETE' }); onDeleted(photo); }
    catch (err) { setError(t(err.message)); setSaving(false); }
  };
  return <form className="stack-form photo-edit" onSubmit={submit}>
    <label className="field"><span>{t('Title of your piece')}</span><input required maxLength={140} value={form.title} onChange={(e) => update('title', e.target.value)}/></label>
    <div className="field-grid">
      <label className="field"><span>{t('Type of piece')}</span><select value={form.kind} onChange={(e) => update('kind', e.target.value)}>{PIECE_KINDS.map(([kind, label]) => <option key={kind} value={kind}>{t(label)}</option>)}</select></label>
      <label className="field"><span>{t('Date')}</span><input type="date" value={form.date} onChange={(e) => update('date', e.target.value)}/></label>
      <label className="field field-span"><span>{t('Wood species')}</span><small className="field-hint">{t('Several woods: separate them with a dash or a comma.')}</small><input maxLength={100} value={form.wood} onChange={(e) => update('wood', e.target.value)}/></label>
      <label className="field field-span"><span>{t('Description')}</span><textarea rows={3} maxLength={1500} value={form.story} onChange={(e) => update('story', e.target.value)}/></label>
    </div>
    {error && <p className="form-error">{error}</p>}
    {confirming
      ? <div className="member-delete-confirm"><p><strong>Retirer « {photo.title} » du portfolio ?</strong> La photo est supprimée du site.</p><div className="member-delete-actions"><button type="button" className="button button-secondary" onClick={() => setConfirming(false)}>{t('Cancel')}</button><button type="button" className="button button-reject" disabled={saving} onClick={remove}><Trash2 size={16}/>{t('Delete definitively')}</button></div></div>
      : <button type="button" className="text-link resource-delete" onClick={() => setConfirming(true)}><Trash2 size={15}/>Retirer cette pièce</button>}
    <div className="photo-edit-actions"><button type="button" className="button button-secondary" onClick={onCancel}>{t('Cancel')}</button><button className="button button-primary" disabled={saving}>{saving ? t('Saving…') : t('Save changes')}</button></div>
  </form>;
}

export default function Gallery() {
  const { user, openUpload, notify } = useOutletContext();
  const [photos, setPhotos] = useState(null);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(false);
  // Index in the visible list for the full-screen viewer; 'detail' = the open card's photo.
  const [viewing, setViewing] = useState(null);
  const [search, setSearch] = useState('');
  const [allChips, setAllChips] = useState(false);
  // The sort and the chosen group are in the address, so a link can share "the walnut pieces".
  const [params, setParams] = useSearchParams();
  const by = SORTS.some(([key]) => key === params.get('by')) ? params.get('by') : 'all';
  const group = params.get('group') || '';
  const { t } = useLanguage();
  const { c } = useContent();
  useEffect(() => { api('/photos').then((data) => setPhotos(data.photos)).catch(() => setPhotos([])); }, [user?.id]);
  const filtered = useMemo(() => photos?.filter((photo) => `${photo.title} ${photo.wood} ${photo.author} ${t(kindLabel(photo.kind))}`.toLowerCase().includes(search.toLowerCase())) || [], [photos, search, t]);
  const groups = useMemo(() => groupPhotos(filtered, by, { t, unknownWood: t('Wood not specified') }), [filtered, by, t]);
  const sections = by === 'all' ? groups : group ? groups.filter((item) => item.key === group) : groups;
  // The viewer moves through the pieces in the order they are shown.
  // A piece of several woods appears in each of them: positions, not pieces, are counted.
  const visible = sections.flatMap((section) => section.photos);
  const offsets = sections.map((_, index) => sections.slice(0, index).reduce((sum, section) => sum + section.photos.length, 0));
  const choose = (nextBy, nextGroup = '') => { setAllChips(false); setParams(nextBy === 'all' ? {} : nextGroup ? { by: nextBy, group: nextGroup } : { by: nextBy }, { replace: true }); };
  const chips = allChips || group ? groups : groups.slice(0, CHIP_LIMIT);
  const saved = (photo) => { setPhotos(photos.map((item) => (item.id === photo.id ? { ...item, ...photo } : item))); setSelected({ ...selected, ...photo }); setEditing(false); notify?.(t('“{{title}}” has been updated.', { title: photo.title })); };
  const card = (photo, index, position = index) => <div className={`gallery-card gallery-card-${index % 5}`} key={photo.id}><button className="gallery-image" onClick={() => setViewing(position)} aria-label={t('Show {{title}} full screen', { title: photo.title })}><img src={photo.thumbnailUrl} alt={t('{{title}}, turned from {{wood}} by {{author}}', { title: photo.title, wood: photo.wood || t('wood'), author: photo.author })} loading="lazy"/><span className="gallery-open"><ArrowUpRight size={18}/></span></button><button className="gallery-card-caption" onClick={() => { setSelected(photo); setEditing(false); }}><div><h3>{photo.title}</h3><p>{photo.wood || t('Turned wood')}</p></div><span className="maker-label">{t(kindLabel(photo.kind))}</span></button></div>;
  return <div className="gallery-page"><PageHeader eyebrow={c('gallery.eyebrow')} title={c('gallery.title')} description={c('gallery.description')}><EditContentLink user={user} page="portfolio"/>{user && <button className="button button-primary" onClick={openUpload}><Plus size={17}/>Ajouter une pièce</button>}</PageHeader>
    <div className="gallery-toolbar"><label className="search-field"><Search size={17}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Chercher une pièce, un bois…"/><span>{filtered.length} {t('pieces')}</span></label></div>
    <div className="gallery-sort"><span id="gallery-sort-label">{t('Sort by')}</span><div className="segmented" role="group" aria-labelledby="gallery-sort-label">{SORTS.map(([key, label]) => <button key={key} className={by === key ? 'active' : ''} aria-pressed={by === key} onClick={() => choose(key)}>{t(label)}</button>)}</div></div>
    {by !== 'all' && photos && groups.length > 0 && <div className="gallery-groups" role="group" aria-label={t('Show one group')}>
      <button className={`chip ${group ? '' : 'active'}`} aria-pressed={!group} onClick={() => choose(by)}>{t('All')}<span>{filtered.length}</span></button>
      {chips.map((item) => <button key={item.key} className={`chip ${group === item.key ? 'active' : ''}`} aria-pressed={group === item.key} onClick={() => choose(by, group === item.key ? '' : item.key)}>{item.label}<span>{item.photos.length}</span></button>)}
      {chips.length < groups.length && <button className="chip chip-more" onClick={() => setAllChips(true)}>{t('Show all ({{count}})', { count: groups.length })}</button>}
    </div>}
    {!photos ? <Loading/> : visible.length === 0 ? <EmptyState icon={Camera} title={search ? t('No matching pieces') : 'Le portfolio se prépare'} text={search ? t('Try another title, maker, or wood species.') : 'Les premières pièces arrivent bientôt.'} action={!search && user && <button className="button button-primary" onClick={openUpload}>Ajouter une pièce<ArrowUpRight size={17}/></button>}/>
      : by === 'all' ? <div className="gallery-grid">{visible.map((photo, index) => card(photo, index))}</div>
      : sections.map((section, s) => <section className="gallery-section" key={section.key} aria-label={section.label}><h2>{section.label}<span>{t(section.photos.length === 1 ? '1 piece' : '{{count}} pieces', { count: section.photos.length })}</span></h2><div className="gallery-grid">{section.photos.map((photo, index) => card(photo, index, offsets[s] + index))}</div></section>)}
    {selected && <Modal onClose={() => setSelected(null)} className="photo-detail-modal" label={selected.title}><button className="photo-detail-image" onClick={() => setViewing('detail')} aria-label={t('Show {{title}} full screen', { title: selected.title })}><img src={selected.imageUrl} alt={selected.title}/></button><div className="photo-detail-copy">{editing ? <PhotoEdit photo={selected} onSaved={saved} onDeleted={(photo) => { setPhotos(photos.filter((item) => item.id !== photo.id)); setSelected(null); setEditing(false); notify?.(`« ${photo.title} » a été retiré du portfolio.`); }} onCancel={() => setEditing(false)}/> : <><div className="photo-detail-top"><p className="eyebrow">{t(kindLabel(selected.kind))} · {selected.wood || t('Turned wood')}</p></div><h2>{selected.title}</h2><p className="photo-story">{selected.story}</p><div className="photo-technical"><span><strong>{formatDate(selected.createdAt, { year: 'numeric' })}</strong>{t('Date')}</span><span><strong>{selected.wood || '—'}</strong>{t('Wood')}</span></div>{user && selected.moderationNote && <div className={`moderation-feedback ${selected.status}`}><strong>{selected.status === 'approved' ? <CheckCircle2 size={17}/> : <XCircle size={17}/>} {t('Moderator feedback')}</strong><p>{selected.moderationNote}</p></div>}{selected.status === 'pending' && <div className="inline-notice"><Clock3 size={17}/><span>{t('This piece is with our moderators. We’ll add it to the gallery once reviewed.')}</span></div>}{user?.role === 'moderator' && <button className="text-link photo-edit-link" onClick={() => setEditing(true)}><PencilLine size={16}/>Modifier ou retirer</button>}</>}</div></Modal>}
    {viewing === 'detail' && selected && <Viewer items={[{ url: selected.imageUrl, alt: selected.title }]} index={0} onIndex={() => {}} onClose={() => setViewing(null)}/>}
    {typeof viewing === 'number' && visible[viewing] && <Viewer items={visible.map((photo) => ({ url: photo.imageUrl, alt: photo.title }))} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)}/>}
  </div>;
}
