import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Check, Inbox, Mail, Phone, RotateCcw, Trash2 } from 'lucide-react';
import { api, formatDate, formatTime } from '../api.js';
import { EmptyState, Loading, PageHeader } from '../components/UI.jsx';
import { useLanguage } from '../i18n.jsx';

// Messages of the contact form. They also arrive by e-mail; here they can be
// marked as answered, reopened, or deleted.
function Message({ message, onChanged, notify }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState('');
  const { t } = useLanguage();
  const act = async (kind) => {
    setBusy(kind);
    try {
      if (kind === 'delete') await api(`/messages/${message.id}`, { method: 'DELETE' });
      else await api(`/messages/${message.id}`, { method: 'PATCH', body: JSON.stringify({ status: kind }) });
      onChanged(kind === 'delete' ? `Le message de ${message.name} est supprimé.` : kind === 'done' ? `Le message de ${message.name} est marqué comme traité.` : `Le message de ${message.name} est de nouveau à traiter.`);
    } catch (err) { notify(t(err.message), 'error'); setBusy(''); }
  };
  const reply = `mailto:${message.email}?subject=${encodeURIComponent(`Re: ${message.subject || 'Votre message à tourneur.ch'}`)}`;
  return <article className={`membership-request ${message.status === 'done' ? 'is-done' : ''}`}>
    <header><div><h3>{message.name}</h3><span>{formatDate(message.createdAt, { year: 'numeric' })} · {formatTime(message.createdAt)}{message.status === 'done' && message.handledAt && ` · traité le ${formatDate(message.handledAt)}`}</span></div></header>
    {message.subject && <strong className="message-subject">{message.subject}</strong>}
    <blockquote>{message.message}</blockquote>
    <dl><div><dt>E-mail</dt><dd><a href={`mailto:${message.email}`}>{message.email}</a></dd></div>{message.phone && <div><dt>Téléphone</dt><dd><a href={`tel:${message.phone.replace(/\s+/g, '')}`}>{message.phone}</a></dd></div>}</dl>
    {confirming
      ? <div className="member-delete-confirm"><p><strong>Supprimer le message de {message.name} ?</strong> Il est retiré du site (l’e-mail reçu n’est pas touché).</p><div className="member-delete-actions"><button type="button" className="button button-secondary" onClick={() => setConfirming(false)}>{t('Cancel')}</button><button type="button" className="button button-reject" disabled={busy === 'delete'} onClick={() => act('delete')}><Trash2 size={16}/>{busy === 'delete' ? t('Deleting…') : t('Delete definitively')}</button></div></div>
      : <div className="membership-actions">
        <a className="button button-secondary" href={reply}><Mail size={16}/>Répondre</a>
        {message.phone && <a className="button button-secondary" href={`tel:${message.phone.replace(/\s+/g, '')}`}><Phone size={16}/>Appeler</a>}
        {message.status === 'done'
          ? <button className="button button-secondary" disabled={!!busy} onClick={() => act('new')}><RotateCcw size={16}/>Rouvrir</button>
          : <button className="button button-primary" disabled={!!busy} onClick={() => act('done')}><Check size={16}/>Marquer comme traité</button>}
        <button className="text-link resource-delete" onClick={() => setConfirming(true)}><Trash2 size={15}/>Supprimer</button>
      </div>}
  </article>;
}

export default function Messages() {
  const { notify, setMessageCount } = useOutletContext();
  const [messages, setMessages] = useState(null);
  const load = () => api('/messages').then((data) => { setMessages(data.messages); setMessageCount?.(data.messages.filter((message) => message.status === 'new').length); }).catch(() => setMessages([]));
  useEffect(() => { load(); }, []);
  const changed = (text) => { notify(text); load(); };
  const open = messages?.filter((message) => message.status === 'new') || [];
  const done = messages?.filter((message) => message.status === 'done') || [];
  return <div className="messages-page">
    <PageHeader eyebrow="Gestion" title="Messages" description="Les messages du formulaire de contact. Ils arrivent aussi par e-mail ; répondre ici ouvre votre messagerie."/>
    {!messages ? <Loading label="Chargement…"/> : messages.length === 0 ? <EmptyState icon={Inbox} title="Aucun message pour l’instant" text="Les messages envoyés depuis la page Contact apparaîtront ici."/> : <>
      <section className="membership-requests"><div className="membership-requests-heading"><Inbox size={20}/><h2>À traiter</h2>{open.length > 0 && <span className="count-badge">{open.length}</span>}</div>
        {open.length === 0 ? <p className="membership-requests-empty">Tout est traité.</p> : <div className="membership-list">{open.map((message) => <Message key={message.id} message={message} onChanged={changed} notify={notify}/>)}</div>}
      </section>
      {done.length > 0 && <details className="membership-done"><summary>Messages traités ({done.length})</summary><div className="membership-list">{done.map((message) => <Message key={message.id} message={message} onChanged={changed} notify={notify}/>)}</div></details>}
    </>}
  </div>;
}
