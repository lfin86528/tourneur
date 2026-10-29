import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import { api } from '../api.js';
import { useLanguage } from '../i18n.jsx';

// The single account of tourneur.ch (the turner). A forgotten password is reset
// over SSH: php app/cli/create-moderator.php (see DEPLOYMENT.md).
export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [demoMode, setDemoMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { t } = useLanguage();
  useEffect(() => { api('/config').then((config) => { setDemoMode(config.demo); if (config.demo) { setEmail('admin@tourneur.test'); setPassword('Demo2026!'); } }).catch(() => {}); }, []);
  const submit = async (event) => {
    event.preventDefault(); setLoading(true); setError('');
    try { const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); onLogin(data.user); }
    catch (err) { setError(t(err.message)); setLoading(false); }
  };

  return <div className="login-page">
    <section className="login-panel">
      <div className="login-top"><Logo/><div className="login-top-actions"><Link className="back-to-site" to="/"><ArrowLeft size={14}/>Retour au site</Link></div></div>
      <div className="login-form-wrap"><p className="eyebrow">Administration</p><h1>Bon retour<br/><em>à l’atelier.</em></h1><p className="login-intro">Ajoutez vos pièces et vos nouvelles, modifiez les textes du site et lisez les messages reçus.</p>
        <form onSubmit={submit} className="login-form"><label className="field"><span>Adresse e-mail</span><input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)}/></label><label className="field"><span>Mot de passe</span><div className="password-field"><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)}/><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>{error && <p className="form-error">{error}</p>}<button className="button button-primary login-submit" disabled={loading}>{loading ? 'Connexion…' : 'Se connecter'}<ArrowRight size={18}/></button></form>
        {demoMode && <div className="demo-access"><span>Démonstration : le compte et le mot de passe sont déjà remplis.</span></div>}
      </div>
      <div className="login-bottom"><span>© {new Date().getFullYear()} tourneur.ch</span></div>
    </section>
    <section className="login-visual"><img src="/images/bol-noyer.webp" alt="Grand bol en noyer tourné à la main"/><div className="login-image-overlay"/><div className="visual-quote"><span className="quote-mark">“</span><blockquote>Pour donner vie<br/><em>au bois.</em></blockquote><div className="quote-rule"/><p>Une création à la fois.</p></div></section>
  </div>;
}
