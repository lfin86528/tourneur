import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useLanguage } from '../i18n.jsx';

// Full-screen viewer: the image (or video) alone, as large as the screen allows,
// with no text. Arrows, keyboard and swipe move between items; ✕, Escape or a tap
// on the background closes it.
export default function Viewer({ items, index, onIndex, onClose }) {
  const { t } = useLanguage();
  const start = useRef(null);
  const root = useRef(null);
  const item = items[index];
  const many = items.length > 1;
  const step = (direction) => onIndex((index + direction + items.length) % items.length);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    root.current?.focus();
    return () => { document.body.style.overflow = previous; };
  }, []);
  if (!item) return null;
  const keys = (event) => {
    if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
    if (many && event.key === 'ArrowRight') step(1);
    if (many && event.key === 'ArrowLeft') step(-1);
  };
  const swipe = (event) => {
    if (!many || start.current === null) return;
    const distance = event.changedTouches[0].clientX - start.current;
    start.current = null;
    if (Math.abs(distance) > 50) step(distance < 0 ? 1 : -1);
  };
  return createPortal(<div className="viewer" role="dialog" aria-modal="true" aria-label={item.alt || t('Photo')} tabIndex={-1} ref={root}
    onKeyDown={keys} onClick={(event) => event.target === event.currentTarget && onClose()}
    onTouchStart={(event) => { start.current = event.touches[0].clientX; }} onTouchEnd={swipe}>
    {item.kind === 'video'
      ? <video key={item.url} src={item.url} controls autoPlay playsInline/>
      : <img key={item.url} src={item.url} alt={item.alt || ''} onClick={onClose}/>}
    <button className="viewer-button viewer-close" onClick={onClose} aria-label={t('Close dialog')}><X/></button>
    {many && <button className="viewer-button viewer-prev" onClick={() => step(-1)} aria-label={t('Previous')}><ChevronLeft/></button>}
    {many && <button className="viewer-button viewer-next" onClick={() => step(1)} aria-label={t('Next')}><ChevronRight/></button>}
  </div>, document.body);
}
