# La pasada de device: índice único de recetas, y las 7 fichas que NINGUNA cubre

**2026-11-04 · planificación.** Medido contra `origin/main`, no citado de memoria.

El operador fijó meta de **100 % en 12 h**. Con 74/99 cerradas, **las 23 abiertas cuelgan de un
único disparador: una pasada de device** — ya no de cuatro disparadores distintos, porque tres los
decidió él hoy (build YA · N32 retirar · N51 al mapa · L4-03 regla del sistema).

## El riesgo que esto cierra

Hay **8 recetas de device en `main`** y ninguna sabe de las otras. Una pasada guiada por una sola
receta deja fichas afuera **sin dar ningún síntoma**: el operador termina la pasada, devuelve el
teléfono, y el faltante aparece recién al contar. Con el teléfono como recurso escaso y de dueño
único, ese descubrimiento tardío cuesta otra pasada entera.

## Cobertura REAL (grep de ids `SM-` sobre cada receta en `origin/main`)

| Receta | Fichas que nombra |
|---|---|
| `2026-11-04-receta-pasada-de-device-frontend2.md` | J1 J3 J4 K2 N19 N29 N32 N34 N35 N41 N42 Z3 Z4 Z5 |
| `Auditorias/2026-11-03-SM-L4-receta-device-las-11-entradas-del-corpus.md` | L4 N28 N32 N34 N35 |
| `2026-11-02-receta-build-release-eas.md` | I6 L1 N22 |
| `2026-10-14-receta-medicion-device-SM-{E3,F2,F3}.md`, `rebuild-dev-client`, `BETA1a` | E3 F2 F3 D5 F4 A217 — **sprints cerrados, no de esta pasada** |

Las tres primeras son las vigentes. Cubren 19 ids.

## 🔴 Las 7 que NINGUNA receta nombra

`SM-H5` · `SM-I4` · `SM-N25` · `SM-N38` · `SM-N48` · `SM-N51` · `SM-Z1`

Dos salen por código y ya están en vuelo (**N51** al mapa y **N32**, PR #1623 de frontend2), así que
**las huérfanas reales de la pasada son 5: H5 · I4 · N25 · N38 · Z1**.

Y no son huérfanas por descuido, sino por **no encajar en el molde de ninguna receta**:

- **`H5` e `I4`** quedaron fuera porque su `Falta:` **enumeraba trabajo ya saldado** dentro de la
  propia ficha: el punto de lectura de H5 está hecho (`mockups/06-presupuestos/index.html:243`,
  `4c2bd865`/#1607) y el punto (a) de I4 fue **retirado por falso** (el crema en piel oscura es una
  inversión deliberada, `tokens.ts:477-479`, afirmada por `BloqueCifra.test.tsx:46-50`). Nadie les
  escribió receta porque leídas de arriba parecían tener trabajo de código pendiente. **Lo único que
  les queda es la captura.**
- **`N38` y `N22`** piden **ojo humano del operador sobre la imagen del mapa**: no hay gesto que
  escribir, y por eso ninguna receta de pasos las reclamó. Su paso es «mirar y decir sí o no».
- **`Z1`** no es captura: es **un clic en Apps → conectar Drive/Calendar** (`PantallaApps.tsx:112`),
  OAuth de Composio — **no** «Entrar con Google» del login (`PantallaLogin.tsx:303`). Y exige el
  binario nuevo instalado: el fix que hace a Drive conectable es `63b50b8a`, de las 18:33.
- **`N25`** son sus DoD 1 y 2 en device; la cita ya la corrigió frontend1 (`b9b67667`/#1605).

**La lección, que es la que vale guardar:** un índice de recetas construido por quien escribe cada
receta cubre lo que esa receta sabe. Las que faltan no son las difíciles — son **las que no se
parecen a las demás**: una decisión de ojo, un clic de OAuth, dos capturas cuyo `Falta:` parecía
código. Un inventario por **cobertura medida** las encuentra; uno por buena voluntad, no.

## Orden de la pasada (una sola sesión, el teléfono tiene dueño único)

1. **Instalar el APK del build `fb0fb9d3`** (EAS preview sobre `1c0584f3`, que incluye `63b50b8a`).
   Sin esto, `Z1` no puede aparecer y `I6`/`L1` no se pueden medir.
2. 🔴 **TRES reconexiones OAuth seguidas en Apps, no una.** Medido por backend en el VPS el
   2026-11-04 03:22 UTC sobre la canónica `e2e-device@copiloto.test` (cliente `4f3ecb78`, sólo
   lectura, sin imprimir secretos):
   - **Drive** — es `SM-Z1`, lo que el operador reportó trabado.
   - **Calendar** — las 3 cuentas `googlecalendar` están **EXPIRED**; `composio_caidos` da
     `['googlecalendar']`.
   - **MercadoPago** — 1 fila en `mp_credentials` con `reauth_desde = 2026-09-23 08:17 UTC` y token
     vencido esa misma mañana: **MP rechazó el refresh hace 6 semanas**.

   Las tres se reconectan sólo con OAuth del operador, y **sin ellas las entradas 06, 10 y 47(2) de
   la receta fracasan tal como están** — no por defecto de la app, sino porque no hay con qué
   probarlas. Descubrirlo durante la pasada, con el teléfono en la mano, cuesta la pasada entera; por
   eso van juntas en el paso 0 y no dispersas en las entradas que las necesitan.

   ⚠️ **Y el dato de noviembre:** no hay NINGÚN movimiento cargado en el mes en curso (1 cobro y 4
   gastos de 2026-09, 3 gastos de 2026-10, 0 `mp_payments`). El chip «−18 %» de la entrada 06 compara
   contra el mes en curso, así que se va a ver vacío — y **eso es dato correcto, no bug**. Si se
   quiere juzgar esa entrada de verdad, hay que cargar un par de movimientos de noviembre ANTES.
3. **`I6` y `L1`**: medir sobre el release recién instalado (receta `build-release-eas`).
4. **La receta de frontend2**, de un tirón: J1 J3 J4 K2 N19 N29 N34 N41 Z3 Z4 Z5.
5. **La receta de las 11 de auditoría** (L4) + N28.
6. **Las de ojo del operador**: N22 y N38 — mirar el mapa y dictaminar.
7. **Las dos capturas sueltas**: H5 e I4.

Cada paso cierra con el `cierre_` de su dueño: `FICHA:` · `SHA:` · `DOD:` punto por punto.
