import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Eye, Images, Mail, ShieldAlert } from 'lucide-react';
import { api, formatDate, formatTime } from '../api.js';
import { EmptyState, Loading, PageHeader } from '../components/UI.jsx';
import { useLanguage } from '../i18n.jsx';
import { usePageTitle } from '../seo.js';

// What each journal entry means (tourneur.ch is in French only).
const ACTIONS = {
  'auth.login': 'Connexion',
  'auth.login_failed': 'Connexion refusée',
  'auth.password': 'Mot de passe changé',
  'setup.moderator': 'Compte créé',
  'legacy.imported': 'Pièces de l’ancien site importées',
  'news.created': 'Nouvelle publiée',
  'news.updated': 'Nouvelle modifiée',
  'news.deleted': 'Nouvelle supprimée',
  'content.updated': 'Textes modifiés',
  'photo.created': 'Pièce ajoutée',
  'photo.updated': 'Pièce modifiée',
  'photo.deleted': 'Pièce retirée',
  'message.received': 'Message reçu',
  'message.done': 'Message traité',
  'message.reopened': 'Message rouvert',
  'message.deleted': 'Message supprimé',
  'resource.created': 'Document ajouté',
  'resource.updated': 'Document modifié',
  'resource.deleted': 'Document supprimé',
};
const FILTERS = [['', 'Tout'], ['photo', 'Portfolio'], ['news', 'Nouvelles'], ['message', 'Messages'], ['resource', 'Documents'], ['content', 'Textes'], ['auth', 'Connexions']];
const PAGE_NAMES = { '/': 'Accueil', '/portfolio': 'Portfolio', '/news': 'Nouvelles', '/documents': 'Documents', '/a-propos': 'À propos', '/contact': 'Contact' };

// One series per chart (never two axes): thin bars from a shared zero baseline.
function DailyBars({ series, field, label, unit }) {
  const [hover, setHover] = useState(null);
  const { t, locale } = useLanguage();
  // Drawn at roughly the size it is shown, so 14-unit labels read as ~14px text.
  const width = 520, height = 190, top = 12, bottom = 28, left = 34, right = 6;
  const max = Math.max(1, ...series.map((point) => point[field]));
  // About four round steps, always reaching at least the highest value.
  const raw = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  const step = Math.max(1, [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= raw && Number.isInteger(candidate)) ?? 10 * magnitude);
  const ticks = Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step);
  const scaleMax = ticks.at(-1);
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const slot = plotWidth / series.length;
  const barWidth = Math.max(2, slot - 2);
  const y = (value) => top + plotHeight - (value / scaleMax) * plotHeight;
  const day = (value) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00`));
  const labelEvery = Math.ceil(series.length / 6);
  const current = hover === null ? null : series[hover];
  return <figure className="stats-chart">
    <figcaption><strong>{label}</strong><span>{t('{{total}} over the period', { total: series.reduce((sum, point) => sum + point[field], 0) })}</span></figcaption>
    <div className="stats-chart-plot">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} onMouseLeave={() => setHover(null)}>
        {ticks.map((tick) => <g key={tick}><line className="grid" x1={left} x2={width - right} y1={y(tick)} y2={y(tick)}/><text className="tick" x={left - 6} y={y(tick) + 4} textAnchor="end">{tick}</text></g>)}
        {series.map((point, i) => {
          const x = left + i * slot + 1;
          const h = y(0) - y(point[field]);
          // Rounded at the data end only; the bar stays square on the baseline.
          const r = Math.min(4, h, barWidth / 2);
          return <g key={point.day}>
            {point[field] > 0 && <path className={`bar ${hover === i ? 'active' : ''}`} d={`M${x},${y(0)} V${y(0) - h + r} Q${x},${y(0) - h} ${x + r},${y(0) - h} H${x + barWidth - r} Q${x + barWidth},${y(0) - h} ${x + barWidth},${y(0) - h + r} V${y(0)} Z`}/>}
            {i % labelEvery === 0 && <text className="tick" x={x + barWidth / 2} y={height - 8} textAnchor="middle">{day(point.day)}</text>}
            <rect className="hit" x={left + i * slot} y={top} width={slot} height={plotHeight} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={-1}/>
          </g>;
        })}
        <line className="baseline" x1={left} x2={width - right} y1={y(0)} y2={y(0)}/>
      </svg>
      {current && <div className="stats-tooltip" style={{ left: `${((left + hover * slot + slot / 2) / width) * 100}%` }}><strong>{day(current.day)}</strong><span>{current[field]} {unit}</span></div>}
    </div>
    <details className="stats-table"><summary>{t('Show as a table')}</summary>
      <div className="table-scroll"><table><thead><tr><th>{t('Day')}</th><th>{label}</th></tr></thead><tbody>{series.map((point) => <tr key={point.day}><td>{day(point.day)}</td><td>{point[field]}</td></tr>)}</tbody></table></div>
    </details>
  </figure>;
}

function describe(entry, t) {
  const d = entry.details || {};
  if (entry.action === 'auth.login_failed') return [d.account || t('Unknown address'), t(d.reason === 'suspended' ? 'suspended account' : d.reason === 'wrong password' ? 'wrong password' : 'unknown address')].join(' · ');
  if (entry.action === 'legacy.imported') return `${d.pieces ?? 0} pièce(s)`;
  if (entry.action === 'content.updated') return (d.keys || []).join(', ');
  return d.title || d.name || '';
}

export default function Statistics() {
  usePageTitle('Statistiques');
  const { notify } = useOutletContext();
  const [days, setDays] = useState(30);
  const [filter, setFilter] = useState('');
  const [data, setData] = useState(null);
  const { t, locale } = useLanguage();
  useEffect(() => {
    setData(null);
    api(`/admin/stats?days=${days}${filter ? `&action=${filter}` : ''}`).then(setData).catch((err) => notify(t(err.message), 'error'));
  }, [days, filter]);
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  if (!data) return <div className="stats-page"><PageHeader eyebrow="Gestion" title="Statistiques"/><Loading/></div>;
  const tiles = [
    [Eye, data.period.views, 'pages vues'],
    [Mail, data.period.messages, 'messages reçus'],
    [Images, data.period.piecesAdded, 'pièces ajoutées'],
    [ShieldAlert, data.period.failedLogins, 'connexions refusées'],
  ];
  return <div className="stats-page">
    <PageHeader eyebrow="Gestion" title="Statistiques" description="Les visites sont comptées par page et par jour, sans adresse ni cookie. Le journal garde deux ans d’activité.">
      <div className="segmented" role="group" aria-label={t('Period')}>{[7, 30, 90, 365].map((value) => <button key={value} className={days === value ? 'active' : ''} aria-pressed={days === value} onClick={() => setDays(value)}>{t('{{days}} days', { days: value })}</button>)}</div>
    </PageHeader>

    <section className="stats-tiles" aria-label={t('Over the period')}>{tiles.map(([Icon, value, label]) => <div className="stats-tile" key={label}><Icon size={18}/><strong>{number.format(value)}</strong><span>{label}</span></div>)}</section>

    <section className="stats-charts">
      <DailyBars series={data.series} field="views" label={t('Page views per day')} unit={t('views')}/>
      <DailyBars series={data.series} field="messages" label="Messages reçus par jour" unit="messages"/>
    </section>

    <section className="stats-columns">
      <div className="stats-panel">
        <h2>{t('Most viewed pages')}</h2>
        {data.topPages.length === 0 ? <p className="stats-empty">{t('No visits recorded yet for this period.')}</p> : <table className="stats-list"><tbody>{data.topPages.map((page) => <tr key={page.path}><td><Link to={page.path}>{page.label || (PAGE_NAMES[page.path] || page.path)}</Link>{page.label && <small>{t('News')}</small>}</td><td>{number.format(page.views)}</td></tr>)}</tbody></table>}
      </div>
      <div className="stats-panel">
        <h2>Le site aujourd’hui</h2>
        <table className="stats-list"><tbody>
          <tr><td>Pièces au portfolio</td><td>{data.totals.pieces}</td></tr>
          <tr><td>Nouvelles publiées</td><td>{data.totals.publishedNews}</td></tr>
          <tr><td>Brouillons</td><td>{data.totals.draftNews}</td></tr>
          <tr><td>Documents</td><td>{data.totals.documents}</td></tr>
          <tr><td>Messages à traiter</td><td>{data.totals.newMessages}</td></tr>
          <tr><td>Messages conservés</td><td>{data.totals.messages}</td></tr>
        </tbody></table>
      </div>
    </section>

    <section className="stats-panel stats-journal">
      <div className="stats-journal-heading"><h2>{t('Activity journal')}</h2><div className="stats-filters" role="group" aria-label={t('Filter the journal')}>{FILTERS.map(([value, label]) => <button key={value} className={`chip ${filter === value ? 'active' : ''}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div></div>
      {data.audit.length === 0 ? <EmptyState icon={Activity} title={t('Nothing recorded yet')} text={t('Sign-ins and changes will appear here.')}/> : <div className="table-scroll"><table className="stats-audit"><thead><tr><th>{t('When')}</th><th>{t('Who')}</th><th>{t('What')}</th><th>{t('Details')}</th></tr></thead><tbody>
        {data.audit.map((entry) => <tr key={entry.id} className={entry.action === 'auth.login_failed' ? 'warn' : ''}><td>{formatDate(entry.at, { year: 'numeric' })} {formatTime(entry.at)}</td><td>{entry.actor || '—'}</td><td>{ACTIONS[entry.action] || entry.action}</td><td>{describe(entry, t)}</td></tr>)}
      </tbody></table></div>}
    </section>
  </div>;
}
