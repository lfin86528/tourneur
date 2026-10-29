import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Mail, Send } from 'lucide-react';
import { api } from '../api.js';
import { PageHeader } from '../components/UI.jsx';
import { useLanguage } from '../i18n.jsx';
import { EditContentLink, useContent } from '../content.jsx';
import { usePageTitle } from '../seo.js';

// The contact form: the message is kept on the site, mailed to the turner (reply
// goes to the sender) and acknowledged to the sender.
export default function Contact() {
  usePageTitle('Contact');
  const { user } = useOutletContext();
  const { t } = useLanguage();
  const { c } = useContent();
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '', website: '' });
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const update = (key, value) => setForm({ ...form, [key]: value });
  const submit = async (e) => {
    e.preventDefault(); setSending(true); setError('');
    try { await api('/messages', { method: 'POST', body: JSON.stringify(form) }); setSent(true); window.scrollTo(0, 0); }
    catch (err) { setError(t(err.message)); }
    finally { setSending(false); }
  };
  const address = c('contact.email');
  if (sent) return <div className="join-page"><section className="join-thanks" role="status"><CheckCircle2 size={34}/><h1>{c('contact.thanksTitle')}</h1><p>{c('contact.thanksText')}</p><Link className="button button-primary" to="/portfolio">Voir le portfolio<ArrowRight size={17}/></Link></section></div>;
  return <div className="join-page contact-page">
    <PageHeader eyebrow={c('contact.eyebrow')} title={c('contact.title')} description={c('contact.description')}><EditContentLink user={user} page="contact"/></PageHeader>
    <div className="contact-layout">
      <form className="join-form" onSubmit={submit}>
        <p className="join-required">Les champs marqués d’un * sont obligatoires.</p>
        <div className="field-grid">
          <label className="field"><span>Nom<b aria-hidden="true">*</b></span><input required maxLength={120} autoComplete="name" value={form.name} onChange={(e) => update('name', e.target.value)}/></label>
          <label className="field"><span>E-mail<b aria-hidden="true">*</b></span><input required type="email" maxLength={160} autoComplete="email" value={form.email} onChange={(e) => update('email', e.target.value)}/></label>
          <label className="field"><span>Téléphone<small>{t('Optional')}</small></span><input type="tel" maxLength={50} autoComplete="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)}/></label>
          <label className="field"><span>Sujet<small>{t('Optional')}</small></span><input maxLength={160} value={form.subject} placeholder="p. ex. Une pièce sur mesure" onChange={(e) => update('subject', e.target.value)}/></label>
          <label className="field field-span"><span>Message<b aria-hidden="true">*</b></span><textarea required rows="6" maxLength={5000} value={form.message} onChange={(e) => update('message', e.target.value)}/></label>
        </div>
        {/* Left empty by people; robots filling every field are ignored by the server. */}
        <label className="join-trap" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => update('website', e.target.value)}/></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="join-submit"><button className="button button-primary" disabled={sending}><Send size={17}/>{sending ? 'Envoi…' : 'Envoyer le message'}</button><span>Vous recevez une copie par e-mail.</span></div>
      </form>
      <aside className="association-join contact-aside"><p className="eyebrow">Par e-mail</p><h2>Ou écrivez directement</h2><p>Si vous préférez votre messagerie habituelle :</p><a className="button button-accent" href={`mailto:${address}`}><Mail size={17}/>{address}</a></aside>
    </div>
  </div>;
}
