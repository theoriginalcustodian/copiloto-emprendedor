// Server del prototipo que INYECTA un canario en el index.html al vuelo.
//
// Para qué: el brazo `pageerror` de `criterio3-matriz.mjs` estaba `[PARCIAL]` — se sabía que NO
// dispara cuando no hay excepción, no se sabía que dispare cuando la hay. Un guard que sólo se
// probó hacia el "no" no tiene control positivo (`memoria/un-mecanismo-roto-hacia-el-no-no-da-sintoma.md`).
//
// Inyecta sobre el árbol ORIGINAL sin copiarlo ni modificarlo: el canario vive en la respuesta HTTP,
// así que no hay 35 MB duplicados ni un árbol que después haya que borrar.
//
//   CANARIO=1  excepción DIFERIDA a 300 ms. La activación del proto ocurre a 60 ms, así que el DOM
//              queda intacto: aísla el brazo `pageerror` de la aserción positiva.
//   CANARIO=2  borra `#s-cuenta` a 20 ms. A los 60 ms el proto hace `$('#s-cuenta').classList.add`
//              sobre null ⇒ TypeError. Es el modo de falla REAL de `index.html:3472-3474`, el que
//              motivó el guard: rompe la activación Y tira la excepción a la vez.
//   CANARIO=0  sin inyección (control negativo: el brazo no debe disparar).
//
// Uso: RAIZ=<.../Prototipo frontend/odobi-ui> CANARIO=1 PUERTO=8123 node server-canario.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, resolve, sep, extname } from 'node:path';

const RAIZ = process.env.RAIZ;
const PUERTO = Number(process.env.PUERTO ?? 8123);
const CANARIO = process.env.CANARIO ?? '0';
if (!RAIZ) { console.error('falta RAIZ'); process.exit(2); }
const RAIZ_ABS = resolve(RAIZ);   // una vez: el guard compara contra esto, no contra el env crudo

const INYECCIONES = {
  1: `<script>setTimeout(function(){throw new Error('CANARIO-1-PAGEERROR-INOCUO')},300);</script>`,
  2: `<script>setTimeout(function(){var n=document.getElementById('s-cuenta');if(n)n.remove()},20);</script>`,
};

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  const ruta = decodeURIComponent((req.url || '/').split('?')[0]);
  // Mismo fix que `server-proto.mjs`: Chrome pide un favicon que el proto no declara y el 404
  // llegaba como `console.error`, tumbando celdas con la activación intacta (tasa medida 1/10).
  if (ruta === '/favicon.ico') { res.writeHead(204).end(); return; }
  const rel = ruta.endsWith('/') ? join(ruta, 'index.html') : ruta;
  // El guard NO puede ser `startsWith(RAIZ)` pelado: sin el separador, un HERMANO cuyo nombre
  // empieza igual que RAIZ pasa el prefijo (`<raiz>-secreto/x` empieza con `<raiz>`). Medido el
  // 2026-09-28 con `probar-traversal.sh`: servia el archivo del hermano con HTTP 200, mientras el
  // caso obvio (`/../../fuera`) SI daba 403 — el guard bloqueaba lo lejano y dejaba pasar lo vecino,
  // que es justo su caso de activacion (`memoria/el-guard-falla-abierto-en-su-caso-de-activacion.md`).
  // `join` neutraliza un `rel` absoluto, `resolve` colapsa los `..`, y el separador cierra el prefijo.
  const abs = resolve(join(RAIZ_ABS, rel));
  if (abs !== RAIZ_ABS && !abs.startsWith(RAIZ_ABS + sep)) { res.writeHead(403).end(); return; }
  try {
    let cuerpo = await readFile(abs);
    const ext = extname(abs).toLowerCase();
    if (ext === '.html' && INYECCIONES[CANARIO]) {
      const txt = cuerpo.toString('utf8');
      if (!txt.includes('</body>')) { res.writeHead(500).end('sin </body>: no se pudo inyectar'); return; }
      cuerpo = Buffer.from(txt.replace('</body>', `${INYECCIONES[CANARIO]}\n</body>`), 'utf8');
    }
    res.writeHead(200, { 'content-type': TIPOS[ext] ?? 'application/octet-stream' }).end(cuerpo);
  } catch {
    res.writeHead(404).end('no existe');   // un faltante real SIGUE dando 404
  }
}).listen(PUERTO, '127.0.0.1', () => console.log(`canario=${CANARIO} en :${PUERTO} sobre ${RAIZ}`));
