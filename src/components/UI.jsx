import { X, Inbox, LoaderCircle } from 'lucide-react';
import Logo from './Logo.jsx';
import { useLanguage } from '../i18n.jsx';

export function Avatar({ user, size = 'md', className = '' }) {
  return <span className={`avatar avatar-${size} ${className}`} aria-hidden="true">{user?.initials || user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2)}</span>;
}

export function PageHeader({ eyebrow, title, description, children }) {
  return <header className="page-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>{children && <div className="page-actions">{children}</div>}</header>;
}

export function StatusPill({ status, children }) {
  const { t } = useLanguage();
  return <span className={`status-pill status-${status}`}><span className="status-dot" />{children || t(status)}</span>;
}

export function Modal({ children, onClose, className = '', label = 'Dialog' }) {
  const { t } = useLanguage();
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={label}><button className="icon-button modal-close" onClick={onClose} aria-label={t('Close dialog')}><X size={20}/></button>{children}</section></div>;
}

export function EmptyState({ icon: Icon = Inbox, title, text, action }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={25}/></span><h3>{title}</h3><p>{text}</p>{action}</div>;
}

export function Loading({ label }) {
  const { t } = useLanguage();
  return <div className="loading-state"><LoaderCircle className="spin" size={25}/><span>{label || t('Loading your club…')}</span></div>;
}

export function Splash() {
  const { t } = useLanguage();
  return <div className="splash"><Logo/><div className="splash-line"><span/></div><p>{t('A community shaped by hand.')}</p></div>;
}

export function Toast({ toast, onClose }) {
  const { t } = useLanguage();
  if (!toast) return null;
  return <div className={`toast toast-${toast.type || 'success'}`} role="status"><span>{toast.message}</span><button onClick={onClose} aria-label={t('Dismiss notification')}><X size={17}/></button></div>;
}
