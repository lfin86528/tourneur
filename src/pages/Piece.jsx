import { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Maximize2, PencilLine } from 'lucide-react';
import { api, formatDate } from '../api.js';
import { Loading } from '../components/UI.jsx';
import Viewer from '../components/Viewer.jsx';
import { useLanguage } from '../i18n.jsx';
import { usePageTitle } from '../seo.js';
import { PhotoEdit, kindLabel } from './Gallery.jsx';
import NotFound from './NotFound.jsx';

// One piece, at its own address (/portfolio/grand-bol-en-noyer): the photo, its
// type, wood, date and story, the pieces before and after it; editable by the turner.
export default function Piece() {
  const { user, notify } = useOutletContext();
  const { slug } = useParams();
  const [photos, setPhotos] = useState(null);
  const [editing, setEditing] = useState(false);
  const [viewing, setViewing] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();
  useEffect(() => { setEditing(false); api('/photos').then((data) => setPhotos(data.photos)).catch(() => setPhotos([])); }, [slug, user?.id]);
  const index = photos ? photos.findIndex((photo) => photo.slug === slug || photo.id === slug) : -1;
  const piece = index >= 0 ? photos[index] : null;
  usePageTitle(piece ? piece.title : photos ? 'Pièce introuvable' : null);
  if (!photos) return <Loading label="Chargement…"/>;
  if (!piece) return <NotFound title="Pièce introuvable" text="Cette pièce n’est plus au portfolio." link={['/portfolio', 'Voir le portfolio']}/>;
  const newer = photos[index - 1];
  const older = photos[index + 1];
  const saved = (photo) => { setPhotos(photos.map((item) => (item.id === photo.id ? { ...item, ...photo } : item))); setEditing(false); notify?.(t('“{{title}}” has been updated.', { title: photo.title })); };
  return <div className="piece-page">
    <Link className="back-to-site" to="/portfolio"><ArrowLeft size={14}/>Tout le portfolio</Link>
    <article className="piece-layout">
      <button className="piece-image" onClick={() => setViewing(true)} aria-label={t('Show {{title}} full screen', { title: piece.title })}><img src={piece.imageUrl} alt={t('{{title}}, turned from {{wood}} by {{author}}', { title: piece.title, wood: piece.wood || t('wood'), author: piece.author })} width={piece.width} height={piece.height}/><span className="gallery-open"><Maximize2 size={17}/></span></button>
      <div className="piece-copy">{editing
        ? <PhotoEdit photo={piece} onSaved={saved} onDeleted={(photo) => { notify?.(`« ${photo.title} » a été retiré du portfolio.`); navigate('/portfolio'); }} onCancel={() => setEditing(false)}/>
        : <><p className="eyebrow">{t(kindLabel(piece.kind))}{piece.wood && ` · ${piece.wood}`}</p><h1>{piece.title}</h1>{piece.story && <p className="photo-story">{piece.story}</p>}
          <dl className="piece-facts"><div><dt>{t('Date')}</dt><dd>{formatDate(piece.createdAt, { year: 'numeric', month: 'long' })}</dd></div><div><dt>{t('Wood')}</dt><dd>{piece.wood || '—'}</dd></div><div><dt>{t('Type of piece')}</dt><dd>{t(kindLabel(piece.kind))}</dd></div></dl>
          <Link className="button button-secondary" to="/contact">Une question sur cette pièce ?<ArrowRight size={16}/></Link>
          {user?.role === 'moderator' && <button className="text-link photo-edit-link" onClick={() => setEditing(true)}><PencilLine size={16}/>Modifier ou retirer</button>}</>}
      </div>
    </article>
    <nav className="piece-nav" aria-label="Autres pièces">
      {newer ? <Link to={`/portfolio/${newer.slug || newer.id}`}><ArrowLeft size={16}/><span><small>Plus récente</small>{newer.title}</span></Link> : <span/>}
      {older && <Link className="piece-nav-older" to={`/portfolio/${older.slug || older.id}`}><span><small>Plus ancienne</small>{older.title}</span><ArrowRight size={16}/></Link>}
    </nav>
    {viewing && <Viewer items={[{ url: piece.imageUrl, alt: piece.title }]} index={0} onIndex={() => {}} onClose={() => setViewing(false)}/>}
  </div>;
}
