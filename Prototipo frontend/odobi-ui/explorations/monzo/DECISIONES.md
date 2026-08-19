# DECISIONES — Renovación visual a partir de Monzo

Abierto el 19/08/2026. Origen: Martin, sobre los mockups vigentes — *"la interfaz es intuitiva y práctica, pero el diseño es una mierda: los botones, las cards, las cajas, los contrastes, las sombras, nada encaja"*. Palabra elegida para el problema: **insulso, apático**.

Referencia aportada: **Monzo (iOS, ago 2026)** — 595 capturas. Restricción declarada: **paleta, tipografía e íconos quedan** (se pueden sumar tonos si hacen falta); la renovación es de construcción.

## 1 · El diagnóstico, medido

Monzo **nunca usa fondo blanco**: el lienzo es un tinte pálido (`#EDF5EE` medido sobre la home) y las cards son blancas **sin un solo borde**. Nosotros hacíamos lo contrario — fondo blanco + cards blancas — y por eso **cada card necesitaba un borde de 1 px para existir**. Ese borde es lo que da el aire de formulario administrativo.

Los tres rasgos que separan una app "de consumo" de una "administrativa", y que teníamos todos del lado equivocado:

| | Monzo | Nosotros (antes) |
|---|---|---|
| Separación de planos | color + sombra | borde de 1 px |
| Radios | 20-28, pills a 999 | 16 en todo |
| Jerarquía | un bloque de color pleno por pantalla | todo al mismo peso |

## 2 · Las siete decisiones

| # | Qué | Decisión | Fundamento |
|---|---|---|---|
| 1 | **Lienzo** | Degradé **ascendente**: arena 14 % (`#F5E7DE`) abajo → crema arriba. **Nunca llega a blanco** | La temperatura sube desde el composer, que en el modelo de capas **es el borde del panel de conversación**: el degradé insinúa que ahí abajo hay algo. Se descartó el descendente porque empuja hacia abajo una pantalla que ya tiene el bloque negro pesando arriba. Se descartó terminar en blanco: ahí las cards blancas se funden con el lienzo y vuelven a necesitar borde |
| 2 | **Cards** | Blancas, **sin borde**, radio 22, sombra `0 4px 18px rgba(26,21,18,.07)` | Con el lienzo teñido, la card se separa sola. El borde era una muleta del fondo blanco |
| 3 | **Bloque pleno** | La portada en **negro tostado**, radio 26, cifra en crema | Es lo que ancla la mirada; sin él todo pesa igual y el ojo no sabe dónde entrar. **En negro y no en terracota** porque la Decisión B reserva el acento para lo tocable — y el DoD de David ya usa negro pleno para la píldora activa |
| 4 | **Cifra** | 46 px, con el **`$` a 26 px** | El número es el contenido; el símbolo es gramática. Tratarlos igual desperdicia la única cifra que importa |
| 5 | **Acción de tarjeta** | **Pill sólido `#DE7250`** — el mismo fill del mic — con label **Inter Medium 16** | Un link se lee "más info"; un pill se lee "esto hace algo". Y al compartir fill con el mic, el color dice **una sola cosa** en toda la pantalla: terracota viva = esto ejecuta |
| 6 | **Header** | **Fecha chica + avatar con punto de estado.** Sin wordmark, sin lupa, sin pills de navegación | La lupa sobra: en Odobi **buscar es hablarle**, y competiría con el mic. El pill "Mi día" era peor: se lee como botón, y un botón implica que se navega ahí — **enseñaba el modelo de capas al revés** (Mi día es la capa base, no un destino). Objeción de Martin, correcta |
| 7 | **Tipografía del pill** | Inter Medium 16, sin bold | Decisión de Martin. El pill deja de gritar y se integra con el texto de la card, que también es Inter — antes había dos familias peleando dentro de la misma tarjeta |

## 3 · La tensión de fondo, y cómo se resolvió

**Monzo vive del color:** rojo, azul, verde y morado, uno por cuenta y por categoría. Odobi tiene **un solo acento con regla de ≤10 % de superficie**. Copiar su policromía habría costado la identidad — y habría dejado a Odobi como otra fintech, que es justo lo que el brief pedía evitar.

**Se tomó su construcción, no su paleta.** El golpe de color que en Monzo da una card roja, acá lo da el bloque negro tostado. La terracota queda donde manda la Decisión B: el pill de acción y el mic.

## 4 · Contrastes verificados

| Par | Ratio |
|---|---|
| Crema sobre negro (la cifra) | 16,37:1 ✅ |
| Arena sobre negro (el label) | 8,46:1 ✅ |
| Negro sobre card blanca | 18,10:1 ✅ |
| `sec` sobre el punto más cálido del degradé | 6,21:1 ✅ |
| Negro sobre el punto más cálido | 14,97:1 ✅ |

⚠️ **Pendiente de resolver:** el pill de acción es **blanco sobre `#DE7250` a 16 px sin bold = 3,17:1**, por debajo de AA para texto normal. Se probó así por pedido explícito de Martin y **queda anotado, no cerrado**. Las salidas conocidas: fill `#B04A2E` (5,43:1 con texto normal) o volver a display ≥19 Bold sobre `#DE7250`.

⚠️ **Consecuencia sobre la regla de marca:** al sacar el wordmark del header, "Odobi" deja de aparecer en las pantallas de uso diario — queda sólo en splash y onboarding. Hay que actualizar la regla de `CLAUDE.md`, que hoy dice *"wordmark solo → header de la app"*.
