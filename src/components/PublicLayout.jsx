import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, Home, Images, Mail, Newspaper, UserRound } from 'lucide-react';
import Logo from './Logo.jsx';
import { Toast } from './UI.jsx';
import { useContent } from '../content.jsx';

// The visitors' site. The single account signs in from the footer ("Administration").
export const siteNav = [
  { to: '/', label: 'Accueil', icon: Home, end: true },
  { to: '/portfolio', label: 'Portfolio', icon: Images },
  { to: '/news', label: 'Nouvelles', icon: Newspaper },
  // Not in the phone bar (five items fit): linked from "À propos" and the footer.
  { to: '/documents', label: 'Documents', icon: BookOpen, mobile: false },
  { to: '/a-propos', label: 'À propos', icon: UserRound },
  { to: '/contact', label: 'Contact', icon: Mail, header: false },
];

export default function PublicLayout() {
  const [toast, setToast] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { c } = useContent();
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  const notify = (message, type = 'success') => setToast({ message, type });

  return <div className="public-shell">
    <header className="public-header">
      <NavLink to="/" className="public-brand" aria-label="tourneur.ch, accueil"><Logo/></NavLink>
      <nav className="public-nav" aria-label="Navigation principale">
        {siteNav.filter((item) => item.header !== false).map(({ to, label, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? 'active' : ''}>{label}</NavLink>)}
      </nav>
      <div className="public-actions"><Link className="button button-primary public-login" to="/contact"><Mail size={16}/>Me contacter</Link></div>
    </header>
    <main className="public-main"><Outlet context={{ user: null, notify, openUpload: () => navigate('/login'), requireMember: () => navigate('/login') }}/></main>
    <footer className="public-footer"><div><Logo/><p>{c('footer.tagline')}</p></div><div className="public-footer-meta"><span>{c('footer.location')}</span><Link className="text-link" to="/documents">Documents</Link><Link className="text-link" to="/contact">Contact</Link><Link className="footer-admin" to="/login">Administration</Link><span>© {new Date().getFullYear()} {c('footer.owner')}</span></div></footer>
    <nav className="bottom-nav public-bottom-nav" aria-label="Navigation mobile">
      {siteNav.filter((item) => item.mobile !== false).map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? 'active' : ''}><Icon/><span>{label}</span></NavLink>)}
    </nav>
    <Toast toast={toast} onClose={() => setToast(null)}/>
  </div>;
}
