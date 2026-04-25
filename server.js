const http = require('http');
const fs = require('fs');
const path = require('path');
const port = process.env.PORT || 3000;

const dataDir = path.join(__dirname, 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function readJsonFile(filePath, defaultValue) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) { /* fall through */ }
  return defaultValue;
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

const defaultTeamMembers = [
  { name: 'Marko Tkalcic', role: 'Voditelj logistike', mediaType: 'image', mediaSrc: 'https://randomuser.me/api/portraits/men/32.jpg' },
  { name: 'Ana Knezevic', role: 'Planerica transporta', mediaType: 'image', mediaSrc: 'https://randomuser.me/api/portraits/women/68.jpg' },
  { name: 'Luka Babic', role: 'Koordinator voznog reda', mediaType: 'image', mediaSrc: 'https://randomuser.me/api/portraits/men/45.jpg' },
  { name: 'Iva Pavic', role: 'Specijalistica za zracni cargo', mediaType: 'video', mediaSrc: 'https://www.w3schools.com/html/mov_bbb.mp4' }
];

const defaultTransportVisuals = {
  cestovni: 'https://images.unsplash.com/photo-1556388158-158ea5ccacbd?auto=format&fit=crop&w=1200&q=80',
  zeljeznicki: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=1200&q=80',
  zracni: 'https://images.unsplash.com/photo-1464037866556-6812c9d1c72e?auto=format&fit=crop&w=1200&q=80',
  pomorski: 'https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=1200&q=80',
  cjevovodni: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80'
};

const defaultFactImages = {
  maglev: 'https://images.unsplash.com/photo-1535083783855-aaab7f5afdb8?auto=format&fit=crop&w=800&q=80',
  evergiven: 'https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=800&q=80',
  druzba: 'https://images.unsplash.com/photo-1513828583688-c52646db42da?auto=format&fit=crop&w=800&q=80',
  seuljeju: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=800&q=80'
};

const teamFile = path.join(dataDir, 'team_members.json');
const tvFile = path.join(dataDir, 'transport_visuals.json');
const fiFile = path.join(dataDir, 'fact_images.json');

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject'
};

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/team-members')) {
    handleTeamApi(req, res);
    return;
  }

  if (req.url.startsWith('/api/transport-visuals')) {
    handleTransportVisualsApi(req, res);
    return;
  }

  if (req.url.startsWith('/api/fact-images')) {
    handleFactImagesApi(req, res);
    return;
  }

  let requestUrl = req.url.split('?')[0];

  const cleanRoutes = {
    '/': '/index.html',
    '/o-nama': '/poduzece.html',
    '/cjenik': '/cijenik.html',
    '/pracenje-posiljke': '/pracenje.html'
  };

  if (cleanRoutes[requestUrl]) {
    requestUrl = cleanRoutes[requestUrl];
  }

  const safePath = path.normalize(path.join(__dirname, requestUrl));
  if (!safePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(safePath, (err, stats) => {
    if (err) {
      res.writeHead(404);
      res.end('404 Not Found');
      return;
    }

    if (stats.isDirectory()) {
      const indexPath = path.join(safePath, 'index.html');
      fs.stat(indexPath, (indexErr) => {
        if (indexErr) {
          res.writeHead(404);
          res.end('404 Not Found');
          return;
        }
        sendFile(indexPath, res);
      });
      return;
    }

    sendFile(safePath, res);
  });
});

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req, callback) {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > 5 * 1024 * 1024) {
      req.destroy();
    }
  });

  req.on('end', () => {
    if (!body.trim()) {
      callback(null, null);
      return;
    }

    try {
      callback(null, JSON.parse(body));
    } catch (err) {
      callback(err);
    }
  });
}

function normalizeMembers(input) {
  if (!Array.isArray(input)) {
    return null;
  }

  const normalized = [];
  for (let i = 0; i < input.length; i += 1) {
    const item = input[i] || {};
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    const role = typeof item.role === 'string' ? item.role.trim() : '';
    const mediaType = item.mediaType === 'video' ? 'video' : 'image';
    const mediaSrc = typeof item.mediaSrc === 'string' ? item.mediaSrc.trim() : '';

    if (!name || !mediaSrc) {
      return null;
    }

    normalized.push({ id: i, name, role, mediaType, mediaSrc });
  }

  return normalized;
}

function fetchMembers() {
  return readJsonFile(teamFile, defaultTeamMembers.map((m, i) => ({ id: i, name: m.name, role: m.role, mediaType: m.mediaType, mediaSrc: m.mediaSrc })));
}

function saveMembers(members) {
  writeJsonFile(teamFile, members);
}

function handleTeamApi(req, res) {
  if (req.method === 'GET') {
    try {
      const members = fetchMembers();
      sendJson(res, 200, members);
    } catch (err) {
      sendJson(res, 500, { error: 'Ne mogu ucitati podatke iz baze.' });
    }
    return;
  }

  if (req.method === 'PUT') {
    readJsonBody(req, (parseErr, body) => {
      if (parseErr) {
        sendJson(res, 400, { error: 'Neispravan JSON payload.' });
        return;
      }

      const members = normalizeMembers(body);
      if (!members) {
        sendJson(res, 400, { error: 'Podaci za tim nisu valjani.' });
        return;
      }

      try {
        saveMembers(members);
        sendJson(res, 200, { ok: true });
      } catch (saveErr) {
        sendJson(res, 500, { error: 'Ne mogu spremiti podatke u bazu.' });
      }
    });
    return;
  }

  res.writeHead(405, { 'Allow': 'GET, PUT' });
  res.end('Method Not Allowed');
}

function fetchTransportVisuals() {
  return readJsonFile(tvFile, { ...defaultTransportVisuals });
}

function normalizeTransportVisuals(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }

  const normalized = {};
  const keys = Object.keys(defaultTransportVisuals);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const value = typeof input[key] === 'string' ? input[key].trim() : '';
    if (!value) {
      return null;
    }
    normalized[key] = value;
  }

  return normalized;
}

function saveTransportVisuals(payload) {
  writeJsonFile(tvFile, payload);
}

function handleTransportVisualsApi(req, res) {
  if (req.method === 'GET') {
    try {
      const visuals = fetchTransportVisuals();
      sendJson(res, 200, visuals);
    } catch (err) {
      sendJson(res, 500, { error: 'Ne mogu ucitati slike sekcija.' });
    }
    return;
  }

  if (req.method === 'PUT') {
    readJsonBody(req, (parseErr, body) => {
      if (parseErr) {
        sendJson(res, 400, { error: 'Neispravan JSON payload.' });
        return;
      }

      const visuals = normalizeTransportVisuals(body);
      if (!visuals) {
        sendJson(res, 400, { error: 'Podaci za slike nisu valjani.' });
        return;
      }

      try {
        saveTransportVisuals(visuals);
        sendJson(res, 200, { ok: true });
      } catch (saveErr) {
        sendJson(res, 500, { error: 'Ne mogu spremiti slike u bazu.' });
      }
    });
    return;
  }

  res.writeHead(405, { Allow: 'GET, PUT' });
  res.end('Method Not Allowed');
}

function fetchFactImages() {
  return readJsonFile(fiFile, { ...defaultFactImages });
}

function saveFactImages(payload) {
  writeJsonFile(fiFile, payload);
}

function handleFactImagesApi(req, res) {
  if (req.method === 'GET') {
    try {
      const images = fetchFactImages();
      sendJson(res, 200, images);
    } catch (err) {
      sendJson(res, 500, { error: 'Ne mogu ucitati slike zanimljivosti.' });
    }
    return;
  }

  if (req.method === 'PUT') {
    readJsonBody(req, (parseErr, body) => {
      if (parseErr) { sendJson(res, 400, { error: 'Neispravan JSON.' }); return; }
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        sendJson(res, 400, { error: 'Neispravan format podataka.' }); return;
      }

      const normalized = {};
      for (const key of Object.keys(defaultFactImages)) {
        const val = typeof body[key] === 'string' ? body[key].trim() : '';
        if (!val) { sendJson(res, 400, { error: 'Nedostaje vrijednost za: ' + key }); return; }
        normalized[key] = val;
      }

      try {
        saveFactImages(normalized);
        sendJson(res, 200, { ok: true });
      } catch (saveErr) {
        sendJson(res, 500, { error: 'Ne mogu spremiti slike zanimljivosti.' });
      }
    });
    return;
  }

  res.writeHead(405, { Allow: 'GET, PUT' });
  res.end('Method Not Allowed');
}

function sendFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end('500 Internal Server Error');
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

server.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
