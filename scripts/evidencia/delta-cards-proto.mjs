// Qué es CADA `card-*` en el PROTOTIPO, extraído del DOM y no de una captura.
//
// Por qué el texto y no la imagen: un veredicto «COHERENTE» sobre dos capturas se sostiene en que
// las dos sean la misma pantalla. Acá la duda es justamente ésa, así que lo que hay que comparar es
// el CONTENIDO (título, botón, campos), que es verificable renglón por renglón.
//
// Dato del prototipo que reordena la comparación (`index.html:3663-3666`):
//   if (ver.startsWith('card')) { $('#funcion').classList.add('on'); abrirCard(ver.slice(5) || 'gasto'); }
// La card aterriza DENTRO de `#funcion` — la pantalla de la función después de dictar. En la app las
// cards viven en el hilo del chat (`MessageList.tsx:274,304`). Si el contenedor es otro, «se ven
// parecidas» no alcanza para COHERENTE.
import { chromium } from './pwa-lib.mjs';

const BASE = `http://localhost:${process.env.PROTO_PORT ?? '8124'}/prototipo`;
const IDS = (process.env.SOLO_IDS || 'card,card-presu,card-cobro,card-factura,card-cliente').split(',');
const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 } });

console.log('=== qué muestra el PROTOTIPO en cada ?ver=card* ===\n');
for (const id of IDS) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?ver=${id}`, { waitUntil: 'domcontentloaded' });
  let datos;
  try {
    // `abrirCard` monta `#card` (ID, no clase `.card` — mi primer selector midió la nada y los 5 ids
    // fallaron idénticos, que es la firma de un instrumento roto y no de un sistema roto):
    //   #card-tit = título · #guardar = botón · #card-campos .kv = campos · dataset.card = la clave
    // Ese `dataset.card` es el control positivo regalado: dice QUÉ card montó, así que si no coincide
    // con el `?ver=` que pedí, estoy fotografiando otra.
    await page.waitForSelector('#card.on', { timeout: 6000 });
    datos = await page.evaluate(() => {
      const card = document.querySelector('#card.on');
      const enFuncion = !!document.querySelector('#funcion.on');
      const hitl = document.querySelector('.hitl');
      return {
        claveMontada: card.dataset.card,
        dentroDeFuncion: enFuncion,
        titulo: (document.querySelector('#card-tit') || {}).textContent?.trim() || '(vacío)',
        boton: (document.querySelector('#guardar') || {}).textContent?.trim() || '(vacío)',
        campos: Array.from(document.querySelectorAll('#card-campos .kv')).map((kv) => {
          const k = kv.querySelector('.k'), v = kv.querySelector('.v'), e = kv.querySelector('.e');
          return `${k ? k.textContent.trim() : '?'} = ${v ? v.textContent.trim() : '?'} [${e ? e.textContent.trim() : '-'}]`;
        }),
        // El OTRO mecanismo del prototipo, y el que importa para la comparación con la app: `vozAlChat`
        // monta un `.hitl` EN EL CHAT. Si existe a la vez que `#card`, el proto tiene dos superficies
        // distintas para lo mismo y hay que declarar contra cuál se compara.
        hayHitlEnChat: !!hitl,
        hitlTitulo: hitl ? (hitl.querySelector('b') || {}).textContent?.trim() : null,
      };
    });
  } catch (e) {
    datos = { error: String(e.message).split('\n')[0].slice(0, 80) };
  }
  if (datos?.error) console.log(`${id}:  ✗ ${datos.error}`);
  else if (!datos) console.log(`${id}:  ✗ la card no está en #funcion (¿cambió el contenedor?)`);
  else {
    const pedida = id === 'card' ? 'gasto' : id.slice(5);
    const coincide = datos.claveMontada === pedida;
    console.log(`${id}:  clave montada = "${datos.claveMontada}" (pedí "${pedida}") ${coincide ? '✅' : '⚠️ NO COINCIDE: estaría midiendo otra card'}`);
    console.log(`   dentro de #funcion: ${datos.dentroDeFuncion ? 'sí' : 'NO'}   ·   .hitl en el chat: ${datos.hayHitlEnChat ? 'sí -> "' + datos.hitlTitulo + '"' : 'no'}`);
    console.log(`   título: ${datos.titulo}`);
    console.log(`   botón:  ${datos.boton}`);
    datos.campos.forEach((c) => console.log(`   campo:  ${c}`));
  }
  console.log('');
  await page.close();
}
await ctx.close(); await navegador.close();
