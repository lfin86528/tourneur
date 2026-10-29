import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, ChevronRight, Download, Home, Images, Inbox, Mail, Newspaper, PencilLine, Plus } from 'lucide-react';
import Logo from './Logo.jsx';
import { Avatar, Toast } from './UI.jsx';
import UploadModal from './UploadModal.jsx';
import { siteNav } from './PublicLayout.jsx';
import { api } from '../api.js';
import { useContent } from '../content.jsx';

// The site as the turner sees it once signed in: the same pages, editable in
// place, plus the management pages. There is only this one account.
const titles = { '/': 'Accueil', '/portfolio': 'Portfolio', '/news': 'Nouvelles', '/documents': 'Documents', '/a-propos': 'À propos', '/contact': 'Contact', '/admin/messages': 'Messages', '/admin/content': 'Textes des pages', '/admin/stats': 'Statistiques', '/profile': 'Mon compte' };
const titleFor = (pathname) => titles[pathname] || (pathname.startsWith('/news/') ? 'Nouvelles' : 'Administration');

export default function AdminLayout({ user }) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [messageCount, setMessageCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const { c } = useContent();

  useEffect(() => {
    const handler = (event) => { event.preventDefault(); setInstallPrompt(event); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  useEffect(() => { api('/bootstrap').then((data) => setMessageCount(data.messageCount || 0)).catch(() => {}); }, [location.pathname]);
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  const notify = (message, type = 'success') => setToast({ message, type });
  const openUpload = () => setUploadOpen(true);
  const install = async () => {
    if (!installPrompt) { navigate('/profile'); return; }
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };
  const item = (to, Icon, label, badge = 0, end = false) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><Icon size={19}/><span>{label}</span>{badge > 0 && <span className="count-badge">{badge}</span>}</NavLink>;

  return <div className="app-shell">
    <aside className="sidebar">
      <NavLink to="/" className="sidebar-logo"><Logo/></NavLink>
      <p className="nav-label">Le site</p>
      <nav className="side-nav" aria-label="Navigation principale">{siteNav.map(({ to, icon, label, end }) => item(to, icon, label, 0, end))}</nav>
      <p className="nav-label nav-label-second">Gestion</p>
      <nav className="side-nav">{item('/admin/messages', Inbox, 'Messages', messageCount)}{item('/admin/content', PencilLine, 'Textes des pages')}{item('/admin/stats', BarChart3, 'Statistiques')}</nav>
      <div className="sidebar-spacer"/>
      <div className="sidebar-share"><span className="share-icon"><Images size={20}/></span><h3>Une nouvelle pièce ?</h3><p>Photo, bois et type : elle est en ligne tout de suite.</p><button className="text-link light" onClick={openUpload}>Ajouter au portfolio <Plus size={15}/></button><div className="wood-ring ring-one"/><div className="wood-ring ring-two"/></div>
      <button className="profile-card" onClick={() => navigate('/profile')}><Avatar user={user}/><span><strong>{user.name}</strong><small>Administration</small></span><ChevronRight size={16}/></button>
    </aside>

    <div className="main-column">
      <header className="topbar"><div className="mobile-logo"><Logo compact/></div><div className="topbar-title"><span>tourneur.ch</span><strong>{titleFor(location.pathname)}</strong></div><div className="topbar-actions"><button className="install-button" onClick={install}><Download size={16}/><span>Installer l’app</span></button><button className="button button-primary top-upload" onClick={openUpload}><Plus size={17}/>Ajouter une pièce</button><button className="mobile-avatar" onClick={() => navigate('/profile')} aria-label="Mon compte"><Avatar user={user} size="sm"/></button></div></header>
      <main className="main-content"><Outlet context={{ user, openUpload, notify, setMessageCount }}/></main>
      <footer className="app-footer"><span>tourneur.ch · {c('footer.location')}</span><span>{c('footer.tagline')}</span></footer>
    </div>

    <nav className="bottom-nav" aria-label="Navigation mobile">
      <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}><Home/><span>Accueil</span></NavLink>
      <NavLink to="/portfolio" className={({ isActive }) => isActive ? 'active' : ''}><Images/><span>Portfolio</span></NavLink>
      <button className="bottom-upload" onClick={openUpload} aria-label="Ajouter une pièce"><Plus/></button>
      <NavLink to="/news" className={({ isActive }) => isActive ? 'active' : ''}><Newspaper/><span>Nouvelles</span></NavLink>
      <NavLink to="/admin/messages" className={({ isActive }) => isActive ? 'active' : ''}><Mail/><span>Messages</span>{messageCount > 0 && <i/>}</NavLink>
    </nav>
    {uploadOpen && <UploadModal onClose={() => setUploadOpen(false)} onUploaded={(photo) => { setUploadOpen(false); notify(`« ${photo.title} » est en ligne dans le portfolio.`); navigate('/portfolio'); }}/>}
    <Toast toast={toast} onClose={() => setToast(null)}/>
  </div>;
}
