const http = require('http');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const port = process.env.PORT || 3000;

const dataDir = path.join(__dirname, 'data');
const dbFile = path.join(dataDir, 'team.sqlite');
const legacyTeamFile = path.join(dataDir, 'team_members.json');
const legacyTransportVisualsFile = path.join(dataDir, 'transport_visuals.json');
const legacyFactImagesFile = path.join(dataDir, 'fact_images.json');
const MAX_JSON_BODY_SIZE = 50 * 1024 * 1024;

function createSvgPlaceholder(label, background, foreground) {
  const safeLabel = String(label)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" rx="48" fill="${background}"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="56" fill="${foreground}">${safeLabel}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

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

const defaultTeamMembers = [
  { name: 'Leo Škrobo', role: 'Direktor', mediaType: 'image', mediaSrc: 'slike/leo.png' },
  { name: 'Ivana Stojčević', role: 'Financijska direktorica', mediaType: 'image', mediaSrc: 'slike/ivana.jpg' },
  { name: 'Ena Stupar', role: 'Direktorica logistike', mediaType: 'image', mediaSrc: 'slike/ena.jpg' }
];

const defaultTransportVisuals = {
  cestovni: createSvgPlaceholder('Dodajte sliku za cestovni promet', '#eef4ff', '#0f4fa8'),
  zeljeznicki: createSvgPlaceholder('Dodajte sliku za zeljeznicki promet', '#eef4ff', '#0f4fa8'),
  zracni: createSvgPlaceholder('Dodajte sliku za zracni promet', '#eef4ff', '#0f4fa8'),
  pomorski: createSvgPlaceholder('Dodajte sliku za pomorski promet', '#eef4ff', '#0f4fa8'),
  cjevovodni: createSvgPlaceholder('Dodajte sliku za cjevovodni promet', '#eef4ff', '#0f4fa8')
};

const defaultFactImages = {
  maglev: createSvgPlaceholder('Dodajte sliku za najbrzi vlak', '#eef4ff', '#0f4fa8'),
  evergiven: createSvgPlaceholder('Dodajte sliku za najveci brod', '#eef4ff', '#0f4fa8'),
  druzba: createSvgPlaceholder('Dodajte sliku za najduzi cjevovod', '#eef4ff', '#0f4fa8'),
  seuljeju: createSvgPlaceholder('Dodajte sliku za najprometniju rutu', '#eef4ff', '#0f4fa8')
};

const legacyDemoTeamMembers = [
  { name: 'Marko Tkalcic', role: 'Voditelj logistike', mediaType: 'image', mediaSrc: 'https://randomuser.me/api/portraits/men/32.jpg' },
  { name: 'Ana Knezevic', role: 'Planerica transporta', mediaType: 'image', mediaSrc: 'https://randomuser.me/api/portraits/women/68.jpg' },
  { name: 'Luka Babic', role: 'Koordinator voznog reda', mediaType: 'image', mediaSrc: 'https://randomuser.me/api/portraits/men/45.jpg' },
  { name: 'Iva Pavic', role: 'Specijalistica za zracni cargo', mediaType: 'video', mediaSrc: 'https://www.w3schools.com/html/mov_bbb.mp4' }
];

const legacyDemoTransportVisuals = {
  cestovni: 'https://images.unsplash.com/photo-1556388158-158ea5ccacbd?auto=format&fit=crop&w=1200&q=80',
  zeljeznicki: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=1200&q=80',
  zracni: 'https://images.unsplash.com/photo-1464037866556-6812c9d1c72e?auto=format&fit=crop&w=1200&q=80',
  pomorski: 'https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=1200&q=80',
  cjevovodni: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80'
};

const legacyDemoFactImages = {
  maglev: 'https://images.unsplash.com/photo-1535083783855-aaab7f5afdb8?auto=format&fit=crop&w=800&q=80',
  evergiven: 'https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=800&q=80',
  druzba: 'https://images.unsplash.com/photo-1513828583688-c52646db42da?auto=format&fit=crop&w=800&q=80',
  seuljeju: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=800&q=80'
};

const db = new DatabaseSync(dbFile);

db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS team_members (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT '',
    media_type TEXT NOT NULL,
    media_src TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS transport_visuals (
    id TEXT PRIMARY KEY,
    image_src TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS fact_images (
    id TEXT PRIMARY KEY,
    image_src TEXT NOT NULL
  );
`);

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

function rowCount(tableName) {
  const statement = db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`);
  const row = statement.get();
  return Number(row.count || 0);
}

function matchesTeamMembers(currentMembers, referenceMembers) {
  if (!Array.isArray(currentMembers) || currentMembers.length !== referenceMembers.length) {
    return false;
  }

  for (let i = 0; i < referenceMembers.length; i += 1) {
    const current = currentMembers[i] || {};
    const reference = referenceMembers[i];
    if (
      current.name !== reference.name ||
      current.role !== reference.role ||
      current.mediaType !== reference.mediaType ||
      current.mediaSrc !== reference.mediaSrc
    ) {
      return false;
    }
  }

  return true;
}

function matchesKeyValuePayload(currentPayload, referencePayload) {
  const keys = Object.keys(referencePayload);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (currentPayload[key] !== referencePayload[key]) {
      return false;
    }
  }

  return true;
}

function overwriteTeamMembers(members) {
  const deleteStatement = db.prepare('DELETE FROM team_members');
  const insertStatement = db.prepare('INSERT INTO team_members (id, name, role, media_type, media_src) VALUES (?, ?, ?, ?, ?)');

  db.exec('BEGIN');
  try {
    deleteStatement.run();
    for (let i = 0; i < members.length; i += 1) {
      const member = members[i];
      insertStatement.run(member.id, member.name, member.role || '', member.mediaType, member.mediaSrc);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function getStoredDefaultTeamMembers() {
  return defaultTeamMembers.map((member, index) => ({
    id: index,
    name: member.name,
    role: member.role,
    mediaType: member.mediaType,
    mediaSrc: member.mediaSrc
  }));
}

function overwriteKeyValueTable(tableName, payload) {
  const keys = Object.keys(payload);
  const deleteStatement = db.prepare(`DELETE FROM ${tableName}`);
  const insertStatement = db.prepare(`INSERT INTO ${tableName} (id, image_src) VALUES (?, ?)`);

  db.exec('BEGIN');
  try {
    deleteStatement.run();
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      insertStatement.run(key, payload[key]);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function seedDatabase() {
  if (rowCount('team_members') === 0) {
    const legacyMembers = readJsonFile(legacyTeamFile, null);
    const seedMembers = normalizeMembers(legacyMembers) || getStoredDefaultTeamMembers();
    overwriteTeamMembers(seedMembers);
  }

  if (rowCount('transport_visuals') === 0) {
    const legacyTransportVisuals = normalizeTransportVisuals(readJsonFile(legacyTransportVisualsFile, null)) || { ...defaultTransportVisuals };
    overwriteKeyValueTable('transport_visuals', legacyTransportVisuals);
  }

  if (rowCount('fact_images') === 0) {
    const legacyFactImages = readJsonFile(legacyFactImagesFile, null);
    const normalizedFactImages = {};
    let hasValidFactImages = true;

    for (const key of Object.keys(defaultFactImages)) {
      const value = legacyFactImages && typeof legacyFactImages[key] === 'string' ? legacyFactImages[key].trim() : '';
      if (!value) {
        hasValidFactImages = false;
        break;
      }
      normalizedFactImages[key] = value;
    }

    overwriteKeyValueTable('fact_images', hasValidFactImages ? normalizedFactImages : { ...defaultFactImages });
  }

  const currentTeamMembers = fetchMembers();
  if (
    currentTeamMembers.length !== defaultTeamMembers.length ||
    matchesTeamMembers(currentTeamMembers, legacyDemoTeamMembers) ||
    !matchesTeamMembers(currentTeamMembers, getStoredDefaultTeamMembers())
  ) {
    overwriteTeamMembers(getStoredDefaultTeamMembers());
  }

  const currentTransportVisuals = fetchTransportVisuals();
  if (matchesKeyValuePayload(currentTransportVisuals, legacyDemoTransportVisuals)) {
    overwriteKeyValueTable('transport_visuals', { ...defaultTransportVisuals });
  }

  const currentFactImages = fetchFactImages();
  if (matchesKeyValuePayload(currentFactImages, legacyDemoFactImages)) {
    overwriteKeyValueTable('fact_images', { ...defaultFactImages });
  }
}

seedDatabase();

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
  let settled = false;

  function finish(err, payload) {
    if (settled) {
      return;
    }
    settled = true;
    callback(err, payload);
  }

  req.on('data', (chunk) => {
    if (settled) {
      return;
    }

    body += chunk;
    if (Buffer.byteLength(body, 'utf8') > MAX_JSON_BODY_SIZE) {
      const error = new Error('Payload too large');
      error.statusCode = 413;
      finish(error);
      req.resume();
    }
  });

  req.on('end', () => {
    if (settled) {
      return;
    }

    if (!body.trim()) {
      finish(null, null);
      return;
    }

    try {
      finish(null, JSON.parse(body));
    } catch (err) {
      finish(err);
    }
  });

  req.on('error', (err) => {
    finish(err);
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
  const statement = db.prepare('SELECT id, name, role, media_type AS mediaType, media_src AS mediaSrc FROM team_members ORDER BY id ASC');
  const members = statement.all();
  if (Array.isArray(members) && members.length > 0) {
    return members;
  }

  return getStoredDefaultTeamMembers();
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

  res.writeHead(405, { 'Allow': 'GET' });
  res.end('Method Not Allowed');
}

function fetchTransportVisuals() {
  const rows = db.prepare('SELECT id, image_src FROM transport_visuals').all();
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ...defaultTransportVisuals };
  }

  const visuals = { ...defaultTransportVisuals };
  for (let i = 0; i < rows.length; i += 1) {
    visuals[rows[i].id] = rows[i].image_src;
  }
  return visuals;
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
  overwriteKeyValueTable('transport_visuals', payload);
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
        const statusCode = parseErr.statusCode || 400;
        sendJson(res, statusCode, { error: statusCode === 413 ? 'Payload je prevelik za spremanje.' : 'Neispravan JSON payload.' });
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
  const rows = db.prepare('SELECT id, image_src FROM fact_images').all();
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ...defaultFactImages };
  }

  const images = { ...defaultFactImages };
  for (let i = 0; i < rows.length; i += 1) {
    images[rows[i].id] = rows[i].image_src;
  }
  return images;
}

function saveFactImages(payload) {
  overwriteKeyValueTable('fact_images', payload);
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
      if (parseErr) {
        const statusCode = parseErr.statusCode || 400;
        sendJson(res, statusCode, { error: statusCode === 413 ? 'Payload je prevelik za spremanje.' : 'Neispravan JSON.' });
        return;
      }
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