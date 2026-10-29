import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, BookOpen, Mail } from 'lucide-react';
import { api } from '../api.js';
import { PageHeader } from '../components/UI.jsx';
import Viewer from '../components/Viewer.jsx';
import { EditContentLink, useContent } from '../content.jsx';
import { usePageTitle } from '../seo.js';

// "À propos": the editable text, the signature, and a few pieces of the portfolio.
export default function About() {
  usePageTitle('À propos');
  const { user } = useOutletContext();
  const [photos, setPhotos] = useState([]);
  const [open, setOpen] = useState(null);
  const { c } = useContent();
  useEffect(() => { api('/photos').then((data) => setPhotos(data.photos.slice(0, 5))).catch(() => {}); }, []);
  return <div className="association-page about-page">
    <PageHeader eyebrow={c('about.eyebrow')} title={c('about.title')}><EditContentLink user={user} page="about"/></PageHeader>
    <section className="association-story">
      <div>
        {c('about.text').split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        <div className="about-signature"><img src="/images/signature.png" alt="" width="260" height="130"/><span>{c('about.signature')}</span></div>
      </div>
      <figure><img src="/images/logo-tourneur.png" width="231" height="155" alt="Le logo de tourneur.ch : un outil de tournage et son copeau"/></figure>
    </section>
    {photos.length > 0 && <section className="association-photos" aria-label="Quelques pièces">{photos.map((photo, index) => <button key={photo.id} onClick={() => setOpen(index)} aria-label={`Agrandir « ${photo.title} »`}><img src={photo.thumbnailUrl} alt="" loading="lazy"/></button>)}</section>}
    <section className="association-columns">
      <div className="association-committee"><h2>Documents</h2><p>Conseils d’entretien, informations pratiques et fiches à télécharger.</p><Link className="text-link" to="/documents"><BookOpen size={16}/>Voir les documents<ArrowRight size={16}/></Link></div>
      <div className="association-join"><p className="eyebrow">Contact</p><h2>{c('home.contactTitle')}</h2><p>{c('contact.description')}</p><Link className="button button-accent" to="/contact"><Mail size={17}/>Me contacter<ArrowUpRight size={17}/></Link></div>
    </section>
    {open !== null && <Viewer items={photos.map((photo) => ({ url: photo.imageUrl, alt: photo.title }))} index={open} onIndex={setOpen} onClose={() => setOpen(null)}/>}
  </div>;
}
