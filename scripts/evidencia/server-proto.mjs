// Server estático mínimo para el prototipo. Node core, cero dependencias, concurrente y sin logging.
//
// Por qué existe: el prototipo se venía sirviendo con `python -m http.server`, y el A/B del
// `waitUntil` mostró que los `page.goto` se cuelgan >8 s en celdas que CAMBIAN de corrida en
// corrida (`soporte@390` en una, `apar@390` en otra, `esc@desktop` en la tercera). Un fallo que se
// mueve no puede ser del id, del viewport ni del prototipo: los tres son fijos. Lo único compartido
// que varía entre intentos es el server.
//
// Este es el control positivo de esa hipótesis: si el mismo A/B sale 32/32 contra este server,
// la causa está aislada y el arreglo es de la PRECONDICIÓN (cómo se levanta el proto), no del
// generador ni del prototipo.
import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';

const RAIZ = process.env.PROTO_DIR;
const PUERTO = Number(process.env.PORT || 8124);
if (!RAIZ) { console.error('falta PROTO_DIR'); process.exit(2); }

const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json' };

http.createServer((req, res) => {
  // Sin path traversal: se normaliza y se exige que quede dentro de la raíz.
  let ruta = decodeURIComponent(req.url.split('?')[0]);
  if (ruta.endsWith('/')) ruta += 'index.html';
  const abs = normalize(join(RAIZ, ruta));
  if (!abs.startsWith(normalize(RAIZ))) { res.writeHead(403).end(); return; }
  let st;
  try { st = statSync(abs); } catch { res.writeHead(404).end('no existe'); return; }
  if (st.isDirectory()) { res.writeHead(404).end('es un directorio'); return; }
  res.writeHead(200, {
    'content-type': TIPOS[extname(abs).toLowerCase()] || 'application/octet-stream',
    'content-length': st.size,
    'cache-control': 'no-store',
  });
  createReadStream(abs).pipe(res);
}).listen(PUERTO, '127.0.0.1', () => console.log(`proto en http://127.0.0.1:${PUERTO}/ raiz=${RAIZ}`));
