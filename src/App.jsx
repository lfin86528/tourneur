import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api } from './api.js';
import { Splash } from './components/UI.jsx';
import AdminLayout from './components/AdminLayout.jsx';
import PublicLayout from './components/PublicLayout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Gallery from './pages/Gallery.jsx';
import Resources from './pages/Resources.jsx';
import Profile from './pages/Profile.jsx';
import News, { NewsDetail } from './pages/News.jsx';
import ContentEditor from './pages/ContentEditor.jsx';
import Statistics from './pages/Statistics.jsx';
import About from './pages/About.jsx';
import Contact from './pages/Contact.jsx';
import Messages from './pages/Messages.jsx';

function RequireAuth({ user, children }) {
  const location = useLocation();
  return user ? children : <Navigate to="/login" state={{ from: location.pathname }} replace/>;
}

// Visitors see the public site; the turner, once signed in, the same pages with
// the management tools around them (AdminLayout).
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  useEffect(() => {
    if (user || /^\/(admin|login|profile)(\/|$)/.test(location.pathname)) return;
    api('/stats/view', { method: 'POST', body: JSON.stringify({ path: location.pathname }), keepalive: true }).catch(() => {});
  }, [location.pathname, user]);
  useEffect(() => { api('/auth/me').then((data) => setUser(data.user)).catch(() => {}).finally(() => setLoading(false)); }, []);
  useEffect(() => {
    let manifest = document.querySelector('link[data-admin-manifest]');
    if (!user) { manifest?.remove(); return; }
    if (!manifest) {
      manifest = document.createElement('link');
      manifest.rel = 'manifest';
      manifest.dataset.adminManifest = 'true';
      document.head.appendChild(manifest);
    }
    manifest.href = '/api/manifest';
  }, [user]);
  if (loading) return <Splash/>;
  const logout = async () => { await api('/auth/logout', { method: 'POST' }).catch(() => {}); window.location.replace('/'); };
  const destination = typeof location.state?.from === 'string' && location.state.from.startsWith('/') ? location.state.from : '/';
  const admin = (page) => <RequireAuth user={user}>{page}</RequireAuth>;

  return <Routes>
    <Route path="/login" element={user ? <Navigate to={destination} replace/> : <Login onLogin={setUser}/>}/>
    <Route element={user ? <AdminLayout user={user}/> : <PublicLayout/>}>
      <Route index element={<Dashboard/>}/>
      <Route path="portfolio" element={<Gallery/>}/>
      <Route path="news" element={<News/>}/>
      <Route path="news/:id" element={<NewsDetail/>}/>
      <Route path="documents" element={<Resources/>}/>
      <Route path="a-propos" element={<About/>}/>
      <Route path="contact" element={<Contact/>}/>
      <Route path="admin/messages" element={admin(<Messages/>)}/>
      <Route path="admin/stats" element={admin(<Statistics/>)}/>
      <Route path="admin/content" element={admin(<ContentEditor/>)}/>
      <Route path="profile" element={admin(<Profile onLogout={logout}/>)}/>
      {/* Addresses of the former site and of the ART sur bois code base. */}
      <Route path="gallery" element={<Navigate to="/portfolio" replace/>}/>
      <Route path="resources" element={<Navigate to="/documents" replace/>}/>
      <Route path="admin" element={<Navigate to="/login" replace/>}/>
      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Route>
  </Routes>;
}
