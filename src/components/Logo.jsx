// The ribbon "T" of tourneur.ch, with the name beside it (compact: the mark alone).
export default function Logo({ light = false, compact = false }) {
  return <div className={`brand ${light ? 'brand-light' : ''} ${compact ? 'brand-compact' : ''}`}>
    <img className="brand-mark" src="/icons/logo-mark.png" alt={compact ? 'tourneur.ch' : ''} width="48" height="48"/>
    {!compact && <span className="brand-name"><strong>tourneur.ch</strong><small>Un type tourne du bois</small></span>}
  </div>;
}
