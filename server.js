const http = require('http');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const port = process.env.PORT || 3000;

const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'team.sqlite');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

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

db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS team_members (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT '',
      media_type TEXT NOT NULL,
      media_src TEXT NOT NULL
    )`
  );

  db.run(
    `CREATE TABLE IF NOT EXISTS transport_visuals (
      id TEXT PRIMARY KEY,
      image_src TEXT NOT NULL
    )`
  );

  db.all('PRAGMA table_info(team_members)', (pragmaErr, columns) => {
    if (pragmaErr) {
      console.error('DB pragma error:', pragmaErr.message);
      return;
    }

    const hasRole = Array.isArray(columns) && columns.some((col) => col.name === 'role');
    if (!hasRole) {
      db.run("ALTER TABLE team_members ADD COLUMN role TEXT NOT NULL DEFAULT ''");
    }
  });

  db.get('SELECT COUNT(*) AS total FROM team_members', (err, row) => {
    if (err) {
      console.error('DB init error:', err.message);
      return;
    }

    if (!row || row.total === 0) {
      const stmt = db.prepare('INSERT INTO team_members (id, name, role, media_type, media_src) VALUES (?, ?, ?, ?, ?)');
      defaultTeamMembers.forEach((member, index) => {
        stmt.run(index, member.name, member.role, member.mediaType, member.mediaSrc);
      });
      stmt.finalize();
    }
  });

  db.get('SELECT COUNT(*) AS total FROM transport_visuals', (err, row) => {
    if (err) {
      console.error('Transport visuals init error:', err.message);
      return;
    }

    if (!row || row.total === 0) {
      const stmt = db.prepare('INSERT INTO transport_visuals (id, image_src) VALUES (?, ?)');
      Object.entries(defaultTransportVisuals).forEach(([id, imageSrc]) => {
        stmt.run(id, imageSrc);
      });
      stmt.finalize();
    }
  });

  db.run(
    `CREATE TABLE IF NOT EXISTS fact_images (
      id TEXT PRIMARY KEY,
      image_src TEXT NOT NULL
    )`
  );

  db.get('SELECT COUNT(*) AS total FROM fact_images', (err, row) => {
    if (err) {
      console.error('Fact images init error:', err.message);
      return;
    }
    if (!row || row.total === 0) {
      const stmt = db.prepare('INSERT INTO fact_images (id, image_src) VALUES (?, ?)');
      Object.entries(defaultFactImages).forEach(([id, imageSrc]) => {
        stmt.run(id, imageSrc);
      });
      stmt.finalize();
    }
  });
});

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

function fetchMembers(callback) {
  db.all(
    'SELECT id, name, role, media_type AS mediaType, media_src AS mediaSrc FROM team_members ORDER BY id ASC',
    (err, rows) => {
      if (err) {
        callback(err);
        return;
      }

      callback(null, rows || []);
    }
  );
}

function saveMembers(members, callback) {
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    db.run('DELETE FROM team_members');

    const stmt = db.prepare('INSERT INTO team_members (id, name, role, media_type, media_src) VALUES (?, ?, ?, ?, ?)');
    members.forEach((member) => {
      stmt.run(member.id, member.name, member.role || '', member.mediaType, member.mediaSrc);
    });

    stmt.finalize((finalizeErr) => {
      if (finalizeErr) {
        db.run('ROLLBACK');
        callback(finalizeErr);
        return;
      }

      db.run('COMMIT', callback);
    });
  });
}

function handleTeamApi(req, res) {
  if (req.method === 'GET') {
    fetchMembers((err, members) => {
      if (err) {
        sendJson(res, 500, { error: 'Ne mogu ucitati podatke iz baze.' });
        return;
      }

      sendJson(res, 200, members);
    });
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

      saveMembers(members, (saveErr) => {
        if (saveErr) {
          sendJson(res, 500, { error: 'Ne mogu spremiti podatke u bazu.' });
          return;
        }

        sendJson(res, 200, { ok: true });
      });
    });
    return;
  }

  res.writeHead(405, { 'Allow': 'GET, PUT' });
  res.end('Method Not Allowed');
}

function fetchTransportVisuals(callback) {
  db.all('SELECT id, image_src AS imageSrc FROM transport_visuals ORDER BY id ASC', (err, rows) => {
    if (err) {
      callback(err);
      return;
    }

    const merged = { ...defaultTransportVisuals };
    (rows || []).forEach((row) => {
      if (row && row.id && row.imageSrc) {
        merged[row.id] = row.imageSrc;
      }
    });
    callback(null, merged);
  });
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

function saveTransportVisuals(payload, callback) {
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    const stmt = db.prepare('INSERT OR REPLACE INTO transport_visuals (id, image_src) VALUES (?, ?)');
    Object.entries(payload).forEach(([id, imageSrc]) => {
      stmt.run(id, imageSrc);
    });

    stmt.finalize((finalizeErr) => {
      if (finalizeErr) {
        db.run('ROLLBACK');
        callback(finalizeErr);
        return;
      }
      db.run('COMMIT', callback);
    });
  });
}

function handleTransportVisualsApi(req, res) {
  if (req.method === 'GET') {
    fetchTransportVisuals((err, visuals) => {
      if (err) {
        sendJson(res, 500, { error: 'Ne mogu ucitati slike sekcija.' });
        return;
      }
      sendJson(res, 200, visuals);
    });
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

      saveTransportVisuals(visuals, (saveErr) => {
        if (saveErr) {
          sendJson(res, 500, { error: 'Ne mogu spremiti slike u bazu.' });
          return;
        }
        sendJson(res, 200, { ok: true });
      });
    });
    return;
  }

  res.writeHead(405, { Allow: 'GET, PUT' });
  res.end('Method Not Allowed');
}

function fetchFactImages(callback) {
  db.all('SELECT id, image_src AS imageSrc FROM fact_images ORDER BY id ASC', (err, rows) => {
    if (err) { callback(err); return; }
    const merged = { ...defaultFactImages };
    (rows || []).forEach((row) => {
      if (row && row.id && row.imageSrc) merged[row.id] = row.imageSrc;
    });
    callback(null, merged);
  });
}

function saveFactImages(payload, callback) {
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    const stmt = db.prepare('INSERT OR REPLACE INTO fact_images (id, image_src) VALUES (?, ?)');
    Object.entries(payload).forEach(([id, imageSrc]) => {
      stmt.run(id, imageSrc);
    });
    stmt.finalize((finalizeErr) => {
      if (finalizeErr) { db.run('ROLLBACK'); callback(finalizeErr); return; }
      db.run('COMMIT', callback);
    });
  });
}

function handleFactImagesApi(req, res) {
  if (req.method === 'GET') {
    fetchFactImages((err, images) => {
      if (err) { sendJson(res, 500, { error: 'Ne mogu ucitati slike zanimljivosti.' }); return; }
      sendJson(res, 200, images);
    });
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
      saveFactImages(normalized, (saveErr) => {
        if (saveErr) { sendJson(res, 500, { error: 'Ne mogu spremiti slike zanimljivosti.' }); return; }
        sendJson(res, 200, { ok: true });
      });
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

server.listen(port, () => {
  console.log(`Local server is running at http://localhost:${port}`);
});
