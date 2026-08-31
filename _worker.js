const DRAFT_BASE = 'https://draft.premierleague.com';
const FPL_BASE = 'https://fantasy.premierleague.com';
const LEAGUE_ID = 13174;

async function proxy(base, path, ttl = 30) {
  const upstream = await fetch(`${base}${path}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'SkyLux-FPL-Draft/2.1'
    }
  });
  const body = await upstream.arrayBuffer();
  const headers = new Headers(upstream.headers);
  headers.set('Cache-Control', `public, max-age=${ttl}, s-maxage=${ttl}`);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('X-SkyLux-Proxy', '2.1');
  return new Response(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/league') {
      return proxy(DRAFT_BASE, `/api/league/${LEAGUE_ID}/details`, 20);
    }
    if (url.pathname === '/api/bootstrap') {
      return proxy(DRAFT_BASE, '/api/bootstrap-static', 300);
    }
    if (url.pathname === '/api/element-status') {
      return proxy(DRAFT_BASE, `/api/league/${LEAGUE_ID}/element-status`, 30);
    }
    if (url.pathname === '/api/transactions') {
      return proxy(DRAFT_BASE, `/api/draft/league/${LEAGUE_ID}/transactions`, 45);
    }

    // Live individual player points come from the regular FPL API.
    // Draft uses the same element/player IDs, so these join directly to Draft lineups.
    const live = url.pathname.match(/^\/api\/live\/(\d+)$/);
    if (live) {
      return proxy(FPL_BASE, `/api/event/${live[1]}/live/`, 20);
    }

    const entryGw = url.pathname.match(/^\/api\/entry\/(\d+)\/event\/(\d+)$/);
    if (entryGw) {
      return proxy(DRAFT_BASE, `/api/entry/${entryGw[1]}/event/${entryGw[2]}`, 30);
    }

    return env.ASSETS.fetch(request);
  },
};