import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { ArrowUpRight, BarChart3, BookOpen, CheckCircle2, Download, Images, Inbox, KeyRound, LogOut, Mail, Newspaper, PencilLine, ShieldCheck, Smartphone } from 'lucide-react';
import { api } from '../api.js';
import { Avatar, Modal, PageHeader } from '../components/UI.jsx';
import { useLanguage } from '../i18n.jsx';

function PasswordForm({ onClose, onChanged }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const { t } = useLanguage();
  const submit = async (event) => {
    event.preventDefault(); setError('');
    if (form.newPassword !== form.confirm) { setError(t('The two new passwords do not match.')); return; }
    setSaving(true);
    try { await api('/auth/password', { method: 'POST', body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }) }); onChanged(); }
    catch (err) { setError(t(err.message)); setSaving(false); }
  };
  return <Modal onClose={onClose} label={t('Change password')}><div className="modal-heading"><p className="eyebrow">{t('Account security')}</p><h2>{t('Change password')}</h2><p>{t('Use at least 10 characters. A short sentence is easy to remember and hard to guess.')}</p></div><form className="stack-form" onSubmit={submit}>
    <label className="field"><span>{t('Current password')}</span><input type="password" autoComplete="current-password" required value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}/></label>
    <label className="field"><span>{t('New password')}</span><input type="password" autoComplete="new-password" required minLength={10} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })}/></label>
    <label className="field"><span>{t('Repeat the new password')}</span><input type="password" autoComplete="new-password" required minLength={10} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })}/></label>
    {error && <p className="form-error">{error}</p>}
    <div className="modal-footer"><span>{t('You stay signed in on this device.')}</span><button className="button button-primary" disabled={saving}>{saving ? t('Saving…') : t('Change password')}<ArrowUpRight size={17}/></button></div>
  </form></Modal>;
}

// "Mon compte": the single account, the phone app, shortcuts to the management pages.
export default function Profile({ onLogout }) {
  const { user, openUpload, notify } = useOutletContext();
  const [changingPassword, setChangingPassword] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(window.matchMedia('(display-mode: standalone)').matches);
  const { t } = useLanguage();
  useEffect(() => { const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); }; window.addEventListener('beforeinstallprompt', handler); return () => window.removeEventListener('beforeinstallprompt', handler); }, []);
  const install = async () => { if (deferredPrompt) { deferredPrompt.prompt(); const result = await deferredPrompt.userChoice; if (result.outcome === 'accepted') setInstalled(true); setDeferredPrompt(null); } };
  const links = [
    ['/portfolio', Images, 'Portfolio', 'Ajouter, corriger ou retirer des pièces.'],
    ['/news', Newspaper, 'Nouvelles', 'Écrire une nouvelle, avec photos et vidéos.'],
    ['/documents', BookOpen, 'Documents', 'Mettre en ligne des PDF et autres fichiers.'],
    ['/admin/messages', Inbox, 'Messages', 'Lire les messages du formulaire de contact.'],
    ['/admin/content', PencilLine, 'Textes des pages', 'Modifier les textes de l’accueil, d’À propos, du contact…'],
    ['/admin/stats', BarChart3, 'Statistiques', 'Visites et journal de vos modifications.'],
  ];
  return <div className="profile-page"><PageHeader eyebrow="Administration" title="Mon compte" description="Le seul compte de tourneur.ch : le vôtre."/>
    <div className="profile-layout"><section className="profile-main"><div className="profile-identity"><Avatar user={user} size="xl"/><div><div className="profile-name"><h2>{user.name}</h2><span><ShieldCheck size={15}/>Administration</span></div><div><a href={`mailto:${user.email}`}><Mail size={15}/>{user.email}</a></div></div></div>
      <div className="profile-admin-links">{links.map(([to, Icon, title, text]) => <Link key={to} to={to}><Icon size={19}/><span><strong>{title}</strong><small>{text}</small></span><ArrowUpRight size={16}/></Link>)}</div></section>
      <aside className="install-card"><span className="install-card-icon"><Smartphone/></span><p className="eyebrow">Sans magasin d’applications</p><h2>L’atelier,<br/>dans la poche.</h2><p>Installez tourneur.ch sur votre téléphone pour ajouter une pièce dès qu’elle est photographiée.</p>{installed ? <span className="installed-label"><CheckCircle2 size={17}/>Application installée</span> : <button className="button button-accent" onClick={deferredPrompt ? install : openUpload}><Download size={17}/>{deferredPrompt ? 'Installer sur cet appareil' : 'Ajouter une pièce'}</button>}<details><summary>Sur iPhone ou iPad ?</summary><p>Ouvrez tourneur.ch dans Safari, touchez le bouton Partager, puis « Sur l’écran d’accueil ».</p></details><details><summary>Sur Android ?</summary><p>Ouvrez le menu du navigateur et choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ».</p></details></aside></div>
    <div className="profile-footer"><div><ShieldCheck size={18}/><span>Mot de passe oublié ? Il se réinitialise en SSH (voir DEPLOYMENT.md).</span></div><div className="profile-footer-actions"><button className="button button-secondary" onClick={() => setChangingPassword(true)}><KeyRound size={17}/>Changer le mot de passe</button><button className="button button-danger-quiet" onClick={onLogout}><LogOut size={17}/>Se déconnecter</button></div></div>
    {changingPassword && <PasswordForm onClose={() => setChangingPassword(false)} onChanged={() => { setChangingPassword(false); notify(t('Your password has been changed.')); }}/>}
  </div>;
}
