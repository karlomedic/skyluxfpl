const DRAFT_BASE = 'https://draft.premierleague.com';
const WORDPRESS_BASE = 'https://fplskylux.wordpress.com/wp-json/wp/v2';
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

async function wordpress(path, ttl = 60) {
  const upstream = await fetch(`${WORDPRESS_BASE}${path}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'SkyLux-FPL/WordPress-Sync'
    }
  });
  const body = await upstream.arrayBuffer();
  const headers = new Headers(upstream.headers);
  headers.set('Cache-Control', `public, max-age=${ttl}, s-maxage=${ttl}`);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('X-SkyLux-Source', 'WordPress');
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

    // WordPress is the editorial CMS. New published posts appear on SkyLux automatically.
    if (url.pathname === '/api/articles') {
      return wordpress('/posts?per_page=30&orderby=date&order=desc&_fields=id,date,modified,slug,title,excerpt,link', 60);
    }
    const article = url.pathname.match(/^\/api\/article\/(\d+)$/);
    if (article) {
      return wordpress(`/posts/${article[1]}?_fields=id,date,modified,slug,title,excerpt,content,link`, 60);
    }

    // Draft's event/live endpoint is the authoritative live player-point feed for this site.
    const live = url.pathname.match(/^\/api\/live\/(\d+)$/);
    if (live) return proxy(`/api/event/${live[1]}/live`, 8);

    const entryGw = url.pathname.match(/^\/api\/entry\/(\d+)\/event\/(\d+)$/);
    if (entryGw) return proxy(`/api/entry/${entryGw[1]}/event/${entryGw[2]}`, 20);

    return env.ASSETS.fetch(request);
  },
};