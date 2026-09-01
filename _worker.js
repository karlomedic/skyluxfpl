const DRAFT_BASE = 'https://draft.premierleague.com';
const LEAGUE_ID = 13174;

async function proxy(path, ttl = 20) {
  const upstream = await fetch(`${DRAFT_BASE}${path}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'SkyLux-FPL-Draft/3.0'
    }
  });
  const body = await upstream.arrayBuffer();
  const headers = new Headers(upstream.headers);
  headers.set('Cache-Control', `public, max-age=${ttl}, s-maxage=${ttl}`);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('X-SkyLux-Proxy', '3.0');
  return new Response(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/league') return proxy(`/api/league/${LEAGUE_ID}/details`, 15);
    if (url.pathname === '/api/bootstrap') return proxy('/api/bootstrap-static', 300);
    if (url.pathname === '/api/element-status') return proxy(`/api/league/${LEAGUE_ID}/element-status`, 20);
    if (url.pathname === '/api/transactions') return proxy(`/api/draft/league/${LEAGUE_ID}/transactions`, 30);

    // Draft's event/live endpoint is the authoritative live player-point feed for this site.
    const live = url.pathname.match(/^\/api\/live\/(\d+)$/);
    if (live) return proxy(`/api/event/${live[1]}/live`, 8);

    const entryGw = url.pathname.match(/^\/api\/entry\/(\d+)\/event\/(\d+)$/);
    if (entryGw) return proxy(`/api/entry/${entryGw[1]}/event/${entryGw[2]}`, 20);

    return env.ASSETS.fetch(request);
  },
};