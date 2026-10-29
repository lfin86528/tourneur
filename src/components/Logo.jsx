// The tourneur.ch logo (the turning tool and its shaving, with the name);
// compact: the drawing alone, for narrow headers.
export default function Logo({ light = false, compact = false }) {
  return <div className={`brand ${light ? 'brand-light' : ''} ${compact ? 'brand-compact' : ''}`}>
    {compact
      ? <img className="brand-mark" src="/icons/logo-mark.png" alt="tourneur.ch" width="40" height="40"/>
      : <img className="brand-logo" src="/images/logo-tourneur.png" alt="tourneur.ch" width="231" height="155"/>}
  </div>;
}
