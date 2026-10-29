import { Link } from 'react-router-dom';
import { ArrowRight, Compass } from 'lucide-react';
import { EmptyState } from '../components/UI.jsx';
import { usePageTitle } from '../seo.js';

// Unknown addresses (the server answers them with a real 404 for search engines).
export default function NotFound({ title = 'Page introuvable', text = 'Cette adresse n’existe pas, ou plus.', link = ['/', 'Retour à l’accueil'] }) {
  usePageTitle(title);
  return <EmptyState icon={Compass} title={title} text={text} action={<Link className="button button-primary" to={link[0]}>{link[1]}<ArrowRight size={17}/></Link>}/>;
}
