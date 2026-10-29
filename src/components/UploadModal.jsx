import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Check, ShieldCheck, AlertCircle, ArrowUpRight } from 'lucide-react';
import { Modal } from './UI.jsx';
import { api } from '../api.js';
import { useLanguage } from '../i18n.jsx';
import { PIECE_KINDS } from '../gallery.js';

export default function UploadModal({ onClose, onUploaded }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [dimensions, setDimensions] = useState(null);
  const [form, setForm] = useState({ title: '', kind: '', wood: '', story: '', date: new Date().toLocaleDateString('sv-SE') });
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const libraryInput = useRef(null);
  const cameraInput = useRef(null);
  const { t } = useLanguage();

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const chooseFile = (selected) => {
    setError('');
    if (!selected) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type)) { setError(t('Please choose a JPEG, PNG, or WebP image.')); return; }
    if (selected.size > 15 * 1024 * 1024) { setError(t('Your image must be smaller than 15 MB.')); return; }
    if (preview) URL.revokeObjectURL(preview);
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    const image = new Image();
    image.onload = () => setDimensions({ width: image.naturalWidth, height: image.naturalHeight });
    image.src = URL.createObjectURL(selected);
  };
  const submit = async (event) => {
    event.preventDefault();
    if (!file) { setError(t('Add a photograph of your piece first.')); return; }
    setSubmitting(true); setError('');
    try {
      const body = new FormData();
      body.append('photo', file);
      Object.entries(form).forEach(([key, value]) => body.append(key, value));
      const data = await api('/photos', { method: 'POST', body });
      onUploaded(data.photo);
    } catch (err) { setError(t(err.message)); setSubmitting(false); }
  };
  const goodResolution = dimensions && Math.min(dimensions.width, dimensions.height) >= 1000;

  return <Modal onClose={onClose} className="upload-modal" label="Ajouter une pièce">
    <div className="modal-heading"><p className="eyebrow">Portfolio</p><h2>Ajouter une pièce</h2><p>Une photo, un titre, le type et le bois : la pièce est en ligne tout de suite.</p></div>
    <form onSubmit={submit} className="upload-form">
      {!preview ? <div className={`drop-zone ${dragging ? 'dragging' : ''}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); chooseFile(e.dataTransfer.files[0]); }}>
        <span className="drop-icon"><ImagePlus size={28}/></span><h3>La photo de la pièce</h3><p>{t('Drop a photo here, or choose from your device')}</p>
        <div className="upload-choice"><button type="button" className="button button-dark" onClick={() => libraryInput.current.click()}><ImagePlus size={17}/>{t('Choose photo')}</button><button type="button" className="button button-secondary camera-choice" onClick={() => cameraInput.current.click()}><Camera size={17}/>{t('Take photo')}</button></div>
        <small>{t('JPEG, PNG or WebP · Up to 15 MB')}</small>
        <input ref={libraryInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => chooseFile(e.target.files[0])}/><input ref={cameraInput} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={(e) => chooseFile(e.target.files[0])}/>
      </div> : <div className="upload-preview"><img src={preview} alt={t('Preview of your submission')}/><div className="preview-overlay"><span className={`quality-chip ${goodResolution ? 'good' : 'warn'}`}>{goodResolution ? <Check size={14}/> : <AlertCircle size={14}/>}{dimensions ? `${dimensions.width} × ${dimensions.height}` : t('Reading image…')}</span><button type="button" className="button button-glass" onClick={() => libraryInput.current.click()}>{t('Replace photo')}</button></div><input ref={libraryInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => chooseFile(e.target.files[0])}/></div>}
      {dimensions && !goodResolution && <div className="inline-notice warning"><AlertCircle size={17}/><span>Le petit côté fait moins de 1000 px : la photo sera un peu floue en plein écran.</span></div>}
      <div className="field-grid"><label className="field field-span"><span>{t('Title of your piece')} <b>*</b></span><input required maxLength={140} placeholder="p. ex. Grand bol en noyer" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}/></label><label className="field"><span>{t('Type of piece')} <b>*</b></span><select required value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}><option value="" disabled>{t('Choose…')}</option>{PIECE_KINDS.map(([kind, label]) => <option key={kind} value={kind}>{t(label)}</option>)}</select></label><label className="field"><span>{t('Date')}</span><input type="date" value={form.date} max={new Date().toLocaleDateString('sv-SE')} onChange={(e) => setForm({ ...form, date: e.target.value })}/></label><label className="field field-span"><span>{t('Wood species')}</span><small className="field-hint">{t('Several woods: separate them with a dash or a comma.')}</small><input maxLength={100} placeholder="p. ex. Noyer – Buis" value={form.wood} onChange={(e) => setForm({ ...form, wood: e.target.value })}/></label><label className="field field-span"><span>{t('Description')}</span><textarea maxLength={1500} rows={3} placeholder="Technique, finition, commande…" value={form.story} onChange={(e) => setForm({ ...form, story: e.target.value })}/></label></div>
      {error && <div className="form-error"><AlertCircle size={17}/>{error}</div>}
      <div className="modal-footer"><span>Vous pourrez la corriger ou la retirer à tout moment.</span><button className="button button-primary" disabled={submitting}>{submitting ? t('Uploading…') : 'Mettre en ligne'}{!submitting && <ArrowUpRight size={17}/>}</button></div>
    </form>
  </Modal>;
}
