const DRAFT_BASE = 'https://draft.premierleague.com';
const WORDPRESS_BASE = 'https://public-api.wordpress.com/wp/v2/sites/fplskylux.wordpress.com';
const WORDPRESS_SITE = 'https://public-api.wordpress.com/rest/v1.1/sites/fplskylux.wordpress.com';
const WORDPRESS_HOME = 'https://fplskylux.wordpress.com/';
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
  headers.set('X-SkyLux-Source', 'WordPress.com');
  return new Response(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers
  });
}

async function wordpressSite(ttl = 3600) {
  const upstream = await fetch(WORDPRESS_SITE, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'SkyLux-FPL/WordPress-Brand'
    }
  });
  const body = await upstream.arrayBuffer();
  const headers = new Headers(upstream.headers);
  headers.set('Cache-Control', `public, max-age=${ttl}, s-maxage=${ttl}`);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('X-SkyLux-Source', 'WordPress.com Site');
  return new Response(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers
  });
}

function attr(tag,name){
  const m=tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`,'i'));
  return m?m[1]:'';
}

async function wordpressLogo(ttl = 86400) {
  let target = new URL('favicon.ico', WORDPRESS_HOME).toString();
  try {
    const page = await fetch(WORDPRESS_HOME, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'SkyLux-FPL/WordPress-Brand'
      }
    });
    if (page.ok) {
      const html = await page.text();
      const tags = html.match(/<link\b[^>]*>/gi) || [];
      const icons = tags.map(tag=>{
        const rel=attr(tag,'rel').toLowerCase();
        const href=attr(tag,'href');
        const sizes=attr(tag,'sizes');
        if(!href || !(rel.includes('icon') || rel.includes('apple-touch-icon')))return null;
        let score=rel.includes('apple-touch-icon')?100:50;
        const n=parseInt((sizes.match(/(\d+)x\d+/)||[])[1]||'0',10);
        score+=Number.isFinite(n)?n:0;
        return{href,score};
      }).filter(Boolean).sort((a,b)=>b.score-a.score);
      if(icons.length)target=new URL(icons[0].href,WORDPRESS_HOME).toString();
    }
  } catch(e) {
    console.warn('WordPress crest discovery failed',e);
  }

  let upstream = await fetch(target, {headers:{'User-Agent':'SkyLux-FPL/WordPress-Brand'}});
  if(!upstream.ok && target!==new URL('favicon.ico',WORDPRESS_HOME).toString()){
    upstream=await fetch(new URL('favicon.ico',WORDPRESS_HOME).toString(),{headers:{'User-Agent':'SkyLux-FPL/WordPress-Brand'}});
  }
  const body=await upstream.arrayBuffer();
  const headers=new Headers();
  headers.set('Content-Type',upstream.headers.get('content-type')||'image/png');
  headers.set('Cache-Control',`public, max-age=${ttl}, s-maxage=${ttl}`);
  headers.set('Access-Control-Allow-Origin','*');
  headers.set('X-SkyLux-Source','WordPress.com Crest');
  return new Response(body,{status:upstream.status,statusText:upstream.statusText,headers});
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/league') return proxy(`/api/league/${LEAGUE_ID}/details`, 15);
    if (url.pathname === '/api/bootstrap') return proxy('/api/bootstrap-static', 300);
    if (url.pathname === '/api/element-status') return proxy(`/api/league/${LEAGUE_ID}/element-status`, 20);
    if (url.pathname === '/api/transactions') return proxy(`/api/draft/league/${LEAGUE_ID}/transactions`, 30);

    // WordPress.com is the editorial CMS. Public posts and branding require no auth.
    if (url.pathname === '/api/site-brand') return wordpressSite(3600);
    if (url.pathname === '/api/site-logo') return wordpressLogo(86400);
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