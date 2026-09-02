import { DurableObject } from 'cloudflare:workers';

export class ArticleComments extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.lastPostByClient = new Map();
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        author TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);
      CREATE TABLE IF NOT EXISTS comment_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  cleanupMarioKovacevicComment() {
    const marker = this.ctx.storage.sql
      .exec("SELECT value FROM comment_meta WHERE key = 'cleanup_mario_kovacevic_v1' LIMIT 1")
      .toArray();
    if (marker.length) return false;

    const rows = this.ctx.storage.sql
      .exec('SELECT id, body FROM comments ORDER BY created_at DESC, id DESC')
      .toArray();
    const target = rows.find(row => {
      const text = String(row.body || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      return /mari[ao]\s+kovacevic/.test(text);
    });

    if (target) {
      this.ctx.storage.sql.exec('DELETE FROM comments WHERE id = ?', target.id);
    }
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO comment_meta (key, value) VALUES ('cleanup_mario_kovacevic_v1', ?)",
      String(Date.now())
    );
    return Boolean(target);
  }

  list() {
    this.cleanupMarioKovacevicComment();
    return this.ctx.storage.sql
      .exec('SELECT id, author, body, created_at FROM comments ORDER BY created_at DESC, id DESC LIMIT 100')
      .toArray();
  }

  add(author, body, clientKey) {
    const now = Date.now();
    const last = this.lastPostByClient.get(clientKey) || 0;
    if (now - last < 12000) throw new Error('RATE_LIMIT');
    const row = this.ctx.storage.sql
      .exec(
        'INSERT INTO comments (author, body, created_at) VALUES (?, ?, ?) RETURNING id, author, body, created_at',
        author,
        body,
        now
      )
      .one();
    this.lastPostByClient.set(clientKey, now);
    return row;
  }
}

const DRAFT_BASE = 'https://draft.premierleague.com';
const WORDPRESS_BASE = 'https://public-api.wordpress.com/wp/v2/sites/fplskylux.wordpress.com';
const WORDPRESS_SITE = 'https://public-api.wordpress.com/rest/v1.1/sites/fplskylux.wordpress.com';
const WORDPRESS_HOME = 'https://fplskylux.wordpress.com/';
const LEAGUE_ID = 13174;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers
    }
  });
}

function requestClientKey(request) {
  return request.headers.get('CF-Connecting-IP') ||
    (request.headers.get('X-Forwarded-For') || '').split(',')[0].trim() ||
    'anonymous';
}

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

function decodeUrl(value=''){
  return String(value)
    .replaceAll('&amp;','&')
    .replaceAll('&#038;','&')
    .replaceAll('&#38;','&')
    .trim();
}

function logoScore({src='',cls='',alt='',title=''}){
  const s=`${src} ${cls} ${alt} ${title}`.toLowerCase();
  let score=0;
  if(/custom-logo/.test(cls.toLowerCase())) score+=1000;
  if(/wp-block-site-logo|site-logo/.test(cls.toLowerCase())) score+=900;
  if(/skylux/.test(alt.toLowerCase())) score+=500;
  if(/skylux/.test(title.toLowerCase())) score+=450;
  if(/skylux/.test(src.toLowerCase())) score+=280;
  if(/\b(grb|crest|logo)\b/.test(s)) score+=220;
  if(/header|branding|identity/.test(s)) score+=120;
  if(/avatar|gravatar|emoji|wordpress-logo|wp-logo/.test(s)) score-=900;
  return score;
}

function logoFromHomepage(html){
  const imgs=html.match(/<img\b[^>]*>/gi)||[];
  const ranked=imgs.map(tag=>{
    const src=decodeUrl(attr(tag,'src')||attr(tag,'data-src'));
    if(!src)return null;
    const cls=attr(tag,'class');
    const alt=attr(tag,'alt');
    const title=attr(tag,'title');
    return{src,score:logoScore({src,cls,alt,title})};
  }).filter(Boolean).sort((a,b)=>b.score-a.score);
  return ranked[0]?.score>=200?ranked[0].src:'';
}

function logoFromMedia(items){
  const ranked=(Array.isArray(items)?items:[]).map(item=>{
    const src=decodeUrl(item?.source_url||'');
    const title=item?.title?.rendered||'';
    const alt=item?.alt_text||'';
    const caption=item?.caption?.rendered||'';
    return{src,score:logoScore({src,cls:'media-library',alt,title:`${title} ${caption}`})};
  }).filter(x=>x.src).sort((a,b)=>b.score-a.score);
  return ranked[0]?.score>=220?ranked[0].src:'';
}

function iconFromHomepage(html){
  const tags=html.match(/<link\b[^>]*>/gi)||[];
  const icons=tags.map(tag=>{
    const rel=attr(tag,'rel').toLowerCase();
    const href=decodeUrl(attr(tag,'href'));
    const sizes=attr(tag,'sizes');
    if(!href||!(rel.includes('icon')||rel.includes('apple-touch-icon')))return null;
    let score=rel.includes('apple-touch-icon')?100:50;
    const n=parseInt((sizes.match(/(\d+)x\d+/)||[])[1]||'0',10);
    score+=Number.isFinite(n)?n:0;
    return{href,score};
  }).filter(Boolean).sort((a,b)=>b.score-a.score);
  return icons[0]?.href||'';
}

async function discoverWordpressLogo(){
  let html='';
  try{
    const page=await fetch(WORDPRESS_HOME,{
      headers:{Accept:'text/html,application/xhtml+xml','User-Agent':'SkyLux-FPL/WordPress-Brand'}
    });
    if(page.ok)html=await page.text();
  }catch(e){console.warn('WordPress homepage logo discovery failed',e)}

  const headerLogo=logoFromHomepage(html);
  if(headerLogo)return new URL(headerLogo,WORDPRESS_HOME).toString();

  try{
    const queries=['skylux','logo','grb'];
    const results=await Promise.all(queries.map(async q=>{
      const r=await fetch(`${WORDPRESS_BASE}/media?search=${encodeURIComponent(q)}&per_page=20&_fields=source_url,title,caption,alt_text`,{
        headers:{Accept:'application/json','User-Agent':'SkyLux-FPL/WordPress-Brand'}
      });
      return r.ok?await r.json():[];
    }));
    const mediaLogo=logoFromMedia(results.flat());
    if(mediaLogo)return mediaLogo;
  }catch(e){console.warn('WordPress media logo discovery failed',e)}

  const icon=iconFromHomepage(html);
  if(icon)return new URL(icon,WORDPRESS_HOME).toString();
  return new URL('favicon.ico',WORDPRESS_HOME).toString();
}

async function wordpressLogo(ttl = 86400) {
  const target=await discoverWordpressLogo();
  let upstream=await fetch(target,{headers:{'User-Agent':'SkyLux-FPL/WordPress-Brand'}});
  const type=(upstream.headers.get('content-type')||'').toLowerCase();
  if(!upstream.ok||!type.startsWith('image/')){
    const fallback=new URL('favicon.ico',WORDPRESS_HOME).toString();
    upstream=await fetch(fallback,{headers:{'User-Agent':'SkyLux-FPL/WordPress-Brand'}});
  }
  const body=await upstream.arrayBuffer();
  const headers=new Headers();
  headers.set('Content-Type',upstream.headers.get('content-type')||'image/png');
  headers.set('Cache-Control',`public, max-age=${ttl}, s-maxage=${ttl}`);
  headers.set('Access-Control-Allow-Origin','*');
  headers.set('X-SkyLux-Source','WordPress.com Header Logo');
  return new Response(body,{status:upstream.status,statusText:upstream.statusText,headers});
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/league') return proxy(`/api/league/${LEAGUE_ID}/details`, 15);
    if (url.pathname === '/api/bootstrap') return proxy('/api/bootstrap-static', 300);
    if (url.pathname === '/api/element-status') return proxy(`/api/league/${LEAGUE_ID}/element-status`, 20);
    if (url.pathname === '/api/transactions') return proxy(`/api/draft/league/${LEAGUE_ID}/transactions`, 30);

    const comments = url.pathname.match(/^\/api\/comments\/(\d+)$/);
    if (comments) {
      const stub = env.ARTICLE_COMMENTS.getByName(`article:${comments[1]}`);
      if (request.method === 'GET') {
        const items = await stub.list();
        return json({ comments: items });
      }
      if (request.method === 'POST') {
        let payload;
        try {
          payload = await request.json();
        } catch {
          return json({ error: 'Neispravan zahtjev.' }, 400);
        }
        if (String(payload?.website || '').trim()) return json({ ok: true }, 201);
        const author = String(payload?.author || '').replace(/\s+/g, ' ').trim();
        const body = String(payload?.body || '').replace(/\r\n?/g, '\n').trim();
        if (author.length < 2 || author.length > 40) {
          return json({ error: 'Ime mora imati između 2 i 40 znakova.' }, 400);
        }
        if (!body || body.length > 1000) {
          return json({ error: 'Komentar mora imati između 1 i 1000 znakova.' }, 400);
        }
        try {
          const comment = await stub.add(author, body, requestClientKey(request));
          return json({ comment }, 201);
        } catch (e) {
          if (String(e?.message || '').includes('RATE_LIMIT')) {
            return json({ error: 'Pričekaj nekoliko sekundi prije novog komentara.' }, 429);
          }
          console.error('Comment save error', e);
          return json({ error: 'Komentar trenutno nije moguće spremiti.' }, 500);
        }
      }
      return json({ error: 'Method not allowed' }, 405, { Allow: 'GET, POST' });
    }

    if (url.pathname === '/api/site-brand') return wordpressSite(3600);
    if (url.pathname === '/api/site-logo') return wordpressLogo(86400);
    if (url.pathname === '/api/articles') {
      return wordpress('/posts?per_page=30&orderby=date&order=desc&_fields=id,date,modified,slug,title,excerpt,link', 60);
    }
    const article = url.pathname.match(/^\/api\/article\/(\d+)$/);
    if (article) {
      return wordpress(`/posts/${article[1]}?_fields=id,date,modified,slug,title,excerpt,content,link`, 60);
    }

    const live = url.pathname.match(/^\/api\/live\/(\d+)$/);
    if (live) return proxy(`/api/event/${live[1]}/live`, 8);

    const entryGw = url.pathname.match(/^\/api\/entry\/(\d+)\/event\/(\d+)$/);
    if (entryGw) return proxy(`/api/entry/${entryGw[1]}/event/${entryGw[2]}`, 20);

    return env.ASSETS.fetch(request);
  },
};
