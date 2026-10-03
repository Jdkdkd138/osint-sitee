const express = require('express');
const app = express();

app.use(express.static('public'));

// === 1. УТЕЧКИ EMAIL ===
app.get('/api/breaches', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'email required' });
  try {
    const r = await fetch(`https://api.xposedornot.com/v1/check-email/${encodeURIComponent(email)}`);
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'breach lookup failed' });
  }
});

// === 2. СТИЛЕРЫ ===
app.get('/api/stealer', async (req, res) => {
  const { email, domain } = req.query;
  let url;
  if (email) {
    url = `https://cavalier.hudsonrock.com/api/v2/osint-tools/search-by-email?email=${encodeURIComponent(email)}`;
  } else if (domain) {
    url = `https://cavalier.hudsonrock.com/api/v2/osint-tools/search-by-domain?domain=${encodeURIComponent(domain)}`;
  } else {
    return res.status(400).json({ error: 'email or domain required' });
  }
  try {
    const r = await fetch(url);
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'stealer lookup failed' });
  }
});

// === 3. ДОМЕН ===
app.get('/api/domain', async (req, res) => {
  const { domain } = req.query;
  if (!domain) return res.status(400).json({ error: 'domain required' });
  try {
    const rdap = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`);
    const rdapData = await rdap.json();
    const dns = await fetch(`https://api.hackertarget.com/dnslookup/?q=${encodeURIComponent(domain)}`);
    const dnsData = await dns.text();
    res.json({
      whois: {
        registrar: rdapData.entities?.[0]?.vcardArray?.[1]?.find(v => v[0] === 'fn')?.[3] || 'unknown',
        status: rdapData.status || [],
        events: rdapData.events || []
      },
      dns: dnsData
    });
  } catch (e) {
    res.status(500).json({ error: 'domain lookup failed' });
  }
});

// === 4. IP ===
app.get('/api/ip', async (req, res) => {
  const { ip } = req.query;
  if (!ip) return res.status(400).json({ error: 'ip required' });
  try {
    const geo = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}`);
    const geoData = await geo.json();
    const shodan = await fetch(`https://internetdb.shodan.io/${encodeURIComponent(ip)}`);
    const shodanData = shodan.ok ? await shodan.json() : {};
    res.json({
      geo: geoData,
      security: {
        ports: shodanData.ports || [],
        vulns: shodanData.vulns || [],
        hostnames: shodanData.hostnames || [],
        cpes: shodanData.cpes || []
      }
    });
  } catch (e) {
    res.status(500).json({ error: 'ip lookup failed' });
  }
});

// === 5. USERNAME ===
app.get('/api/username', async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: 'username required' });
  try {
    const r = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
      headers: { 'User-Agent': 'gorisint' }
    });
    if (r.status === 404) return res.json({ found: false, username });
    if (!r.ok) return res.status(500).json({ error: 'github api error' });
    const data = await r.json();
    res.json({
      found: true,
      username: data.login,
      name: data.name,
      bio: data.bio,
      company: data.company,
      location: data.location,
      blog: data.blog,
      public_repos: data.public_repos,
      followers: data.followers,
      created_at: data.created_at,
      avatar_url: data.avatar_url
    });
  } catch (e) {
    res.status(500).json({ error: 'username lookup failed' });
  }
});

// === 6. GOOGLE DORKS (генератор ссылок) ===
app.get('/api/dorks', (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: 'query required' });

  const q = encodeURIComponent(query);
  const dorks = [
    { name: 'Все упоминания', desc: 'обычный поиск по слову', url: `https://www.google.com/search?q=${q}` },
    { name: 'Файлы PDF', desc: 'поиск PDF-документов', url: `https://www.google.com/search?q=${q}+filetype%3Apdf` },
    { name: 'Файлы DOC/XLS', desc: 'документы Word и Excel', url: `https://www.google.com/search?q=${q}+filetype%3Adoc+OR+filetype%3Axls` },
    { name: 'Файлы SQL / DB', desc: 'дампы баз данных', url: `https://www.google.com/search?q=${q}+filetype%3Asql+OR+filetype%3Adb` },
    { name: 'Конфиги', desc: 'env, cfg, conf', url: `https://www.google.com/search?q=${q}+filetype%3Aenv+OR+filetype%3Aconf` },
    { name: 'Индексы директорий', desc: 'открытые листинги папок', url: `https://www.google.com/search?q=intitle%3A%22index+of%22+${q}` },
    { name: 'Логины / пароли', desc: 'страницы с логинами', url: `https://www.google.com/search?q=${q}+intext%3A%22password%22+OR+intext%3A%22login%22` },
    { name: 'Админ-панели', desc: 'страницы входа админок', url: `https://www.google.com/search?q=${q}+inurl%3Aadmin+OR+inurl%3Alogin` },
    { name: 'Утечки на pastebin', desc: 'упоминания на pastebin.com', url: `https://www.google.com/search?q=site%3Apastebin.com+${q}` },
    { name: 'GitHub упоминания', desc: 'упоминания в репозиториях', url: `https://www.google.com/search?q=site%3Agithub.com+${q}` },
    { name: 'Кэш Google', desc: 'сохранённая версия страниц', url: `https://www.google.com/search?q=cache%3A${q}` },
    { name: 'Поддомены', desc: 'все поддомены через site:', url: `https://www.google.com/search?q=site%3A*.${q}` }
  ];

  res.json({ query, dorks });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`http://localhost:${PORT}`));