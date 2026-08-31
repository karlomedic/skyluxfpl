const FPL_BASE = 'https://draft.premierleague.com';
const LEAGUE_ID = 13174;

async function proxy(path, ttl = 30) {
  const upstream = await fetch(`${FPL_BASE}${path}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'SkyLux-FPL-Draft/1.0',
    },
  });

  const body = await upstream.arrayBuffer();
  const headers = new Headers(upstream.headers);
  headers.set('Cache-Control', `public, max-age=${ttl}, s-maxage=${ttl}`);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('X-SkyLux-Proxy', '1');

  return new Response(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/league') {
      return proxy(`/api/league/${LEAGUE_ID}/details`, 20);
    }

    if (url.pathname === '/api/bootstrap') {
      return proxy('/api/bootstrap-static', 300);
    }

    if (url.pathname === '/api/game') {
      return proxy('/api/game', 60);
    }

    const liveMatch = url.pathname.match(/^\/api\/live\/(\d+)$/);
    if (liveMatch) {
      return proxy(`/api/event/${liveMatch[1]}/live`, 20);
    }

    return env.ASSETS.fetch(request);
  },
};
