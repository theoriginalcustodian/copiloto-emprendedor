# SM-G1 y SM-G2: el mapa de pantallas deja de contradecirse

Medido el 2026-11-02 sirviendo `Prototipo frontend/odobi-ui/` con un servidor local, en Playwright, a 390 × 844.

## SM-G1

Los enlaces se reaplicaron sobre `origin/main` con un parche generado contra el `HEAD` del checkout compartido. No se copió ningún archivo.

- 15 archivos, 62 líneas cambiadas, todas de enlaces.
- Barrido de todos los HTML de `odobi-ui`: 173 enlaces relativos, 0 apuntan a una carpeta. Los 6 que no resuelven son los marcadores `__IMG_*__` de `audit/lamina/lamina.template.html`, que se rellenan al generar.

## SM-G2

| Punto del DoD | Antes | Medido después |
|---|---|---|
| Encabezado en 51 | La portada decía «30», escrito a mano | «51», calculado de la lista; 51 marcos |
| `?ver=vacio` muestra su estado | Se veía igual que la base | «Nada urgente por hoy.» con la explicación, dentro de la vista |
| `?ver=vacio-visto` muestra su estado | Se veía igual que la base | «Nada urgente por hoy.» sin la explicación, dentro de la vista |
| Sheet de `detalle` retirado | Fila en el mapa | 0 filas. El alias `?ver=detalle` sigue y abre el tablero con la primera fila expandida |
| «Crear una nueva cuenta» fuera | En `splash`, `reveal` y `volver` | `splash` y `reveal`: sólo «Empecemos». `volver`: «Entrar» y «Entrar con otra cuenta» |
| `plan` y `limite` como VISIÓN citando DEC-8 | Ya estaba hecho | Sin cambios |
| Paso de perfil en el mapa (N4) | Ya estaba hecho: `onb-perfil` | Sin cambios |

**Causa de los deep links.** El estado sí se dibujaba: `#calma` tenía la clase `on` y las 4 tarjetas estaban colapsadas. Quedaba debajo de «Ahora» y «Para hoy»: empezaba en y = 751, abajo de todo y tapado por el campo de texto. El marco del mapa usa `scrolling="no"`, así que no se podía llegar. Ahora, en estos dos deep links, el tablero baja hasta el final después de los 1100 ms del esqueleto.

**Lo que no se tocó.** Los `DECISIONES.md` y el mockup 01 conservan «Crear una nueva cuenta» porque registran la decisión de aquel momento.

## Capturas

- `SM-G2-1-vacio.webp`: con la explicación.
- `SM-G2-2-vacio-visto.webp`: la explicación ya se retiró.
