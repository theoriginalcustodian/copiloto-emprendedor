# Receta · reconstruir el APK de dev-client en EAS (`SM-F4` / `#1013`)

> **Para quién:** cualquier sesión u operador que se encuentre con que el dev-client del teléfono ya no
> se puede reinstalar porque EAS borró el artefacto. **Prerrequisito:** `EXPO_TOKEN` en el entorno (ya
> está en esta máquina) o `eas login`.
>
> **Estado de esta receta:** ejercitada el 2026-10-14 desde un árbol limpio recién creado. El resultado
> está al final, con el id del build y su fecha de vencimiento medidos con el mismo comando que te doy
> para verificar. Una receta no ejercitada es una promesa, así que si cambiás un paso, volvela a correr.

---

## 0. Primero medí: ¿hace falta?

```bash
cd apps/mobile
npx --yes eas-cli@24.13.0 build:list --platform android --limit 6 --json --non-interactive
```

Mirá `expirationDate` del último `FINISHED` con perfil `development`. **EAS borra los artefactos a los
14 días** del build, no de la última descarga.

⚠️ **Dos trampas de este comando, ya pagadas:**

1. **Corrido desde un worktree sin `node_modules` falla con exit code 0.** Imprime `Failed to resolve
   plugin for module "expo-router" … Do you have node modules installed?` y devuelve **0**. Si lo
   pipeás a un parser, vas a leer «0 builds» y concluir que no hay ninguno. Medí el contenido, no el
   código de salida.
2. **`apps/mobile/node_modules` existe y está VACÍO** en todos los checkouts: es un monorepo con npm
   workspaces y los paquetes están **hoisteados a la raíz**. «La carpeta existe» no significa
   instalado — contá archivos.

---

## 1. Árbol limpio anclado a `main` (el «desde cero» es parte de la receta)

```bash
cd "C:/Proyectos/Claude/Claude code/copiloto-emprendedor"
git fetch origin main
git worktree add C:/gfw-src/wt-eas-rebuild --detach origin/main
cd C:/gfw-src/wt-eas-rebuild
git rev-parse --short HEAD     # anotá este sha: es la procedencia del binario
```

**Por qué un worktree nuevo y no el checkout compartido:** el checkout compartido está permanentemente
sucio (decenas de untracked) y EAS empaqueta el proyecto desde git. Un build hecho ahí no es
reproducible ni sabés qué entró.

---

## 2. Instalar desde la RAÍZ del monorepo, no desde `apps/mobile`

```bash
cd C:/gfw-src/wt-eas-rebuild
npm install --no-audit --no-fund
```

**No lo saltees ni lo hagas parcial.** Dos razones medidas:

- `package.json` de la raíz declara `workspaces: ["apps/mobile", "packages/*"]`. Un `npm install`
  dentro de `apps/mobile` rompe el hoisting.
- `apps/mobile/package.json` tiene **`postinstall`: `cd ../.. && patch-package --patch-dir
  apps/mobile/patches`**. Si el postinstall no corre, los parches de dependencias **no se aplican** y
  el binario difiere del que funciona en el teléfono, sin ningún síntoma en el build.

---

## 3. Lanzar el build

```bash
cd apps/mobile
npx --yes eas-cli@24.13.0 build --platform android --profile development --non-interactive --no-wait
```

- El perfil `development` es el que importa: `eas.json` lo define con `developmentClient: true`,
  `distribution: "internal"` y `android.buildType: "apk"`. **`preview` no sirve** para iterar con Metro.
- `--no-wait` devuelve el control; el build sigue en la nube. Es lo que querés: son decenas de minutos.
- **Versión pinneada a propósito** (`@24.13.0`, la publicada al 2026-10-14). `@latest` convierte una
  receta en una ruleta. Para actualizarla a conciencia: `npm view eas-cli version`, y volvés a correr
  esta receta entera.
- `eas.json` usa `appVersionSource: "remote"`: el `versionCode` lo asigna EAS, no el repo. No lo toques
  a mano.

---

## 4. Verificar e instalar

```bash
cd apps/mobile
npx --yes eas-cli@24.13.0 build:list --platform android --limit 3 --json --non-interactive
```

Esperá `"status": "FINISHED"` y tomá `artifacts.buildUrl`. Después, con el teléfono conectado:

```bash
adb install -r <apk-descargado>
```

🛑 **Antes de instalar, leé esto:** el device es recurso de **dueño único** y el dev-client instalado
**va adelante de `main`** — el teléfono corre lo que Metro le sirve, no lo que dice el repo. Instalar un
APK nuevo mientras otra sesión está midiendo en device le invalida la corrida y además escribe en la
base. **Pedí el device en el buzón antes de instalar.** Reconstruir el APK y guardarlo **no** necesita el
teléfono; instalarlo, sí.

---

## 5. Ejercicio de esta receta — 2026-10-14

| Qué | Valor |
|---|---|
| Árbol | `C:/gfw-src/wt-easf4`, worktree nuevo detached en `origin/main` |
| Sha | `93d792d2` |
| Paso 2 | `npm install` en la raíz, desde cero (sin `node_modules` previos) |
| Comando del paso 3 | `eas-cli@24.13.0 build -p android --profile development --non-interactive --no-wait` |
| Build previo medido | `ad2ce5e4` · creado 2026-10-13T20:07 · **expira 2026-10-27** · git `ca5e3fe6` |

**Corrección de la premisa del issue `#1013`:** decía «el build actual (`5e19949f`) tiene fecha de
vencimiento». Medido hoy, `5e19949f` es el build `a0c8c8b7` del 11-10 y **ya había uno más nuevo**:
`ad2ce5e4` del 13-10, con margen hasta el 27-10. La reconstrucción había ocurrido; lo que faltaba era
exactamente lo que este archivo arregla: que estuviera **escrita**. Un paso que sólo vive en la cabeza
de quien lo hizo ayer no es una receta.

El resultado del ejercicio de hoy (id del build nuevo y su vencimiento) se anota abajo apenas EAS lo
termina, con la salida de `build:list` — no con mi palabra.

<!-- RESULTADO-EJERCICIO:INICIO -->
### Resultado medido (salida de `build:list`, no mi palabra)

```
d6cecf02 IN_QUEUE   development  git= 93d792d2 | creado 2026-10-14T14:21:56 | expira 2026-10-28T14:21:56 | apk no
ad2ce5e4 FINISHED   development  git= ca5e3fe6 | creado 2026-10-13T20:07:11 | expira 2026-10-27T20:07:11 | apk SI
```

Los pasos 1 a 3 corrieron tal como están escritos arriba: worktree nuevo detached en `origin/main`,
`npm install` desde cero en la raíz (1206 paquetes, `expo-router` presente — verificado contando
archivos, no confiando en que la carpeta exista) y `eas build` que subió 71,1 MB y devolvió el id.
El build quedó **con el sha de `main` como procedencia** (`git= 93d792d2`), que es el punto.

🟨 **Por eso `SM-F4` queda `DOD-PARCIAL` y no `TERMINADO`:** `d6cecf02` está `IN_QUEUE`. Una receta
se acredita cuando el artefacto **existe**, no cuando el comando salió sin error — si el build
fallara en la nube, la receta estaría mal y el `EXIT=0` del CLI no lo diría. El disparador para
cerrarla es una sola línea:

```bash
cd apps/mobile && npx --yes eas-cli@24.13.0 build:list --platform android --limit 2 --json --non-interactive
# d6cecf02 -> FINISHED con `apk SI`  ⇒  SM-F4 TERMINADO
```

Mientras tanto el teléfono **no corre riesgo**: `ad2ce5e4` sigue vivo hasta el 27-10 y el dev-client
instalado no se toca. Reconstruir y guardar no necesita el device; instalar, sí.
<!-- RESULTADO-EJERCICIO:FIN -->
