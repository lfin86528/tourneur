export async function api(path, options = {}) {
  const config = { credentials: 'same-origin', ...options, headers: { ...(options.headers || {}) } };
  if (options.body && !(options.body instanceof FormData)) config.headers['Content-Type'] = 'application/json';
  const response = await fetch(`/api${path}`, config);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'The request could not be completed.');
    error.status = response.status;
    throw error;
  }
  return data;
}

let currentDateLocale = 'en-GB';
export function setDateLocale(locale) {
  currentDateLocale = locale;
}

export function formatDate(date, options = {}) {
  return new Intl.DateTimeFormat(currentDateLocale, { day: 'numeric', month: 'short', ...options }).format(new Date(date));
}

// One part of a date ("25", "oct."), instead of splitting a formatted string.
export function datePart(date, part) {
  // Format day and month together: some locales abbreviate differently on their own (de-CH "Okt." vs "Okt").
  return new Intl.DateTimeFormat(currentDateLocale, { day: '2-digit', month: 'short' }).formatToParts(new Date(date)).find((item) => item.type === part)?.value || '';
}

export function formatTime(date) {
  return new Intl.DateTimeFormat(currentDateLocale, { hour: '2-digit', minute: '2-digit' }).format(new Date(date));
}

export function relativeDate(date) {
  const days = Math.round((new Date(date) - new Date()) / 86400000);
  if (days >= -1 && days < 7) return new Intl.RelativeTimeFormat(currentDateLocale, { numeric: 'auto' }).format(days, 'day');
  return formatDate(date);
}
