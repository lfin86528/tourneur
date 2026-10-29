import { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Images, Mail } from 'lucide-react';
import { api, datePart, formatDate } from '../api.js';
import { Loading } from '../components/UI.jsx';
import { useLanguage } from '../i18n.jsx';
import { EditContentLink, useContent } from '../content.jsx';
import { PIECE_KINDS } from '../gallery.js';

const kindLabel = (kind) => (PIECE_KINDS.find(([key]) => key === kind) || PIECE_KINDS.at(-1))[1];

// The pieces of the portfolio, one after the other: starting at a random one and
// changing every 7 seconds (no fade for visitors who prefer less motion, see CSS);
// the rotation pauses while the pointer is on the photo.
function RotatingPieces({ photos }) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * Math.max(photos.length, 1)));
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (photos.length < 2 || paused) return undefined;
    const timer = setInterval(() => setIndex((current) => (current + 1) % photos.length), 7000);
    return () => clearInterval(timer);
  }, [photos, paused]);
  if (!photos.length) return <div className="home-photos"><img className="visible" src="/images/bol-noyer.webp" alt="Grand bol en noyer"/></div>;
  return <div className="home-photos" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>{photos.map((photo, i) => <img key={photo.id} src={photo.thumbnailUrl} alt={i === index ? photo.title : ''} aria-hidden={i !== index} className={i === index ? 'visible' : ''} loading={i === index ? 'eager' : 'lazy'}/>)}</div>;
}

export default function Dashboard() {
  const { user, openUpload } = useOutletContext();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { c } = useContent();
  useEffect(() => { api('/bootstrap').then(setData).catch((err) => setError(t(err.message))); }, []);
  if (error) return <div className="inline-notice warning">{error}</div>;
  if (!data) return <Loading label="Chargement…"/>;
  const latest = data.photos[0];
  const facts = [1, 2, 3].map((n) => [c(`home.fact${n}Value`), c(`home.fact${n}Label`)]).filter(([value]) => value.trim() && value.trim() !== '-');

  return <div className="dashboard-page">
    <header className="dashboard-heading"><div><p className="eyebrow">{c('home.eyebrow')}</p><h1>{c('home.title')}</h1><p>{c('home.intro')}</p></div><div className="dashboard-heading-side"><EditContentLink user={user} page="home"/>{user ? <button className="button button-primary" onClick={openUpload}><Images size={17}/>Ajouter une pièce</button> : <Link className="button button-primary" to="/portfolio">Voir le portfolio<ArrowUpRight size={17}/></Link>}</div></header>
    <div className="dashboard-grid">
      <section className="next-event-card">
        {latest ? <><div className="event-card-top"><span className="event-kicker"><span/>Dernière pièce</span><span className="event-category">{t(kindLabel(latest.kind))}</span></div><div className="next-event-content"><div className="event-date-large"><strong>{datePart(latest.createdAt, 'day')}</strong><span>{datePart(latest.createdAt, 'month')}</span></div><div><p className="event-relative">{latest.wood || 'Bois tourné'} · {new Date(latest.createdAt).getFullYear()}</p><h2>{latest.title}</h2><p className="event-description">{latest.story}</p></div></div><div className="next-event-bottom"><span><Images size={16}/>{data.pieceCount} {data.pieceCount === 1 ? 'pièce' : 'pièces'} au portfolio</span><button onClick={() => navigate('/portfolio')}>Voir le portfolio <ArrowUpRight size={17}/></button></div><div className="event-watermark">T</div></>
          : <div className="event-empty"><Images/><h2>Le portfolio se prépare.</h2><p>Les premières pièces arrivent bientôt.</p></div>}
      </section>
      <aside className="community-card"><div className="community-image"><RotatingPieces photos={data.photos}/><span>{c('home.photoCaption')}</span></div><div className="community-copy"><p className="eyebrow">Fait main</p><h2>{data.pieceCount} {data.pieceCount === 1 ? 'pièce' : 'pièces'}.<br/><em>Une à la fois.</em></h2><Link className="text-link" to="/a-propos">Qui tourne ces pièces ? <ArrowRight size={16}/></Link></div></aside>
    </div>

    {facts.length > 0 && <section className="association-facts home-facts" aria-label="En chiffres">{facts.map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</section>}

    <div className="dashboard-lower">
      <section className="recent-work"><div className="section-heading"><div><p className="eyebrow">Sorties de l’atelier</p><h2>Dernières créations</h2></div><Link className="text-link" to="/portfolio">Tout le portfolio <ArrowRight size={16}/></Link></div><div className="recent-photo-grid">{data.photos.slice(0, 3).map((photo, index) => <button className={`recent-photo recent-photo-${index + 1}`} key={photo.id} onClick={() => navigate('/portfolio')}><img src={photo.thumbnailUrl} alt={photo.title}/><span className="photo-gradient"/><span className="recent-photo-caption"><span><strong>{photo.title}</strong><small>{photo.wood}</small></span><span className="round-arrow"><ArrowUpRight size={16}/></span></span></button>)}</div></section>
      <aside className="notice-board"><div className="section-heading"><div><p className="eyebrow">De l’atelier</p><h2>{t('Latest news')}</h2></div><span className="note-pin"/></div>{data.news.length === 0 && <p className="stats-empty">Pas encore de nouvelles.</p>}{data.news.map((item) => <article className="news-item" key={item.id}><div className="news-date">{formatDate(item.createdAt, { year: 'numeric' })}</div><h3><Link to={`/news/${item.id}`}>{item.title}</Link></h3><p>{item.summary}</p></article>)}<div className="notice-links"><Link className="text-link" to="/news">{t('All news')} <ArrowRight size={16}/></Link><Link className="text-link" to="/documents">Documents <ArrowRight size={16}/></Link></div></aside>
    </div>

    <section className="member-action-strip"><div className="action-strip-icon"><Mail/></div><div><p className="eyebrow">{c('home.contactText')}</p><h2>{c('home.contactTitle')}</h2></div><Link className="button button-secondary" to="/contact">Me contacter<ArrowUpRight size={17}/></Link></section>
  </div>;
}
