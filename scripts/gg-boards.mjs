/* eslint-disable no-console */
// Creates or updates the Granada Grapevine boards through the Umami API.
// Boards are matched by name, so re-running updates them in place.
//
//   node --env-file=.env scripts/gg-boards.mjs
//
// Needs UMAMI_USER and UMAMI_PASSWORD; UMAMI_API_URL defaults to the live instance.
// Panels use the "EventProperty" board component and the events sent by
// granada-grapevine (see its ANALYTICS_EVENTS.md).

const API = (process.env.UMAMI_API_URL || 'https://analytics.granadagrapevine.com').replace(/\/$/, '');
const DOMAIN = 'granadagrapevine.com';
const NEWSLETTER = { filterProperty: 'utm_medium', filterValue: 'newsletter' };

const prop = (title, eventName, propertyName, extra = {}) => ({
  type: 'EventProperty',
  title,
  props: { eventName, propertyName, limit: '10', ...extra },
});

const BOARDS = [
  {
    name: 'Granada Grapevine content',
    description: 'Visits by venue, musician, tag, category, area and genre',
    rows: [
      [prop('Venues', 'view-venue', 'name'), prop('Musicians', 'view-musician', 'name')],
      [prop('Tags', 'view-tag', 'name'), prop('Categories', 'view-category', 'name')],
      [prop('Areas', 'view-area', 'name'), prop('Genres', 'view-genre', 'name')],
      [prop('Content type', 'content-view', 'type'), prop('Most viewed pages', 'content-view', 'name', { limit: '20' })],
    ],
  },
  {
    name: 'Newsletter',
    description: 'What newsletter readers go on to look at',
    rows: [
      [
        { type: 'UTM', title: 'Issues (utm_campaign)', props: { param: 'utm_campaign', limit: '10' } },
        { type: 'UTM', title: 'Newsletter sections (utm_content)', props: { param: 'utm_content', limit: '10' } },
      ],
      [
        prop('Venues', 'view-venue', 'name', NEWSLETTER),
        prop('Musicians', 'view-musician', 'name', NEWSLETTER),
      ],
      [
        prop('Tags', 'view-tag', 'name', NEWSLETTER),
        prop('Most viewed pages', 'content-view', 'name', { ...NEWSLETTER, limit: '20' }),
      ],
    ],
  },
];

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

const { UMAMI_USER, UMAMI_PASSWORD } = process.env;
if (!UMAMI_USER || !UMAMI_PASSWORD) {
  console.error('Set UMAMI_USER and UMAMI_PASSWORD (e.g. in .env).');
  process.exit(1);
}

const { token } = await api('/auth/login', {
  method: 'POST',
  body: { username: UMAMI_USER, password: UMAMI_PASSWORD },
});

const websites = await api('/websites?pageSize=100', { token });
const website = (websites.data ?? websites).find(w => w.domain === DOMAIN);
if (!website) throw new Error(`No website with domain ${DOMAIN}`);

const existing = await api('/boards?pageSize=100', { token });
const byName = new Map((existing.data ?? existing).map(b => [b.name, b]));

for (const board of BOARDS) {
  const rows = board.rows.map((columns, i) => ({
    id: `row-${i}`,
    columns: columns.map((component, j) => ({ id: `row-${i}-col-${j}`, component })),
  }));
  const body = {
    type: 'website',
    name: board.name,
    description: board.description,
    parameters: { websiteId: website.id, rows },
  };
  const found = byName.get(board.name);
  const saved = found
    ? await api(`/boards/${found.id}`, { method: 'POST', token, body })
    : await api('/boards', { method: 'POST', token, body });
  console.log(`${found ? 'Updated' : 'Created'} "${board.name}": ${API}/boards/${saved.id ?? found.id}`);
}
