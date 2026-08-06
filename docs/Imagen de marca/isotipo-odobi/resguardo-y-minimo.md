# Isotipo Odobi — área de resguardo y tamaño mínimo

> Fuente del símbolo: `Odobi Mobile Mariposas.dc.html` (Claude Design, proyecto
> `eb2c9e3f-453b-4886-a5fc-5b038942e1c5`). Ver `isotipo-odobi-{positivo,monocromo,negativo}.svg`
> para el path exacto y `../ODOBI_Brief_Visual.md` para la paleta canónica.

## 1. Geometría de referencia (medida, no estimada)

`viewBox="0 0 24 24"`, 4 arcos concéntricos sin punto central, `stroke-width` compensado por
`logoScale` (mock: `stroke-width = 1.7 / logoScale`, default `logoScale=1.3` → `≈1.3`).

Bbox real del símbolo (medido con `getBBox()` sobre el path renderizado, sin trazo):

```
x: [2.497, 21.376]   y: [3.5, 20.5]
ancho: 18.879 u   alto: 17 u
```

Todas las unidades de esta página están expresadas en **unidades del propio glifo** (u = 1 unidad
del `viewBox` nativo 0-24), nunca en píxeles absolutos, porque el símbolo se usa desde 16px
(favicon) hasta 1024px (splash) y un margen en px no escala entre esos dos extremos.

## 2. Área de resguardo (clearspace)

**Mínimo: 0.5 u en los cuatro lados**, medido desde el bbox real del símbolo (no desde el
`viewBox` completo, que ya trae aire de sobra: 24×24 contra un símbolo de 18.879×17).

```
resguardo mínimo = 0.5 × alto_del_símbolo / alto_del_símbolo = 0.5 u constante
                  (no es un porcentaje del alto — es una unidad fija del propio glifo,
                   así se mantiene proporcional a cualquier escala de salida)
```

Ningún otro elemento (texto, borde, otro ícono) puede entrar en ese margen. El propio `viewBox`
del isotipo suelto ya cumple esto de sobra (0.5 u pedidos vs. ~2.5-3 u que trae el `viewBox`
0-24 contra el bbox real) — el límite duro importa en **composición** (lockups, badges, favicons
recortados), no en el archivo del símbolo solo.

### Separación símbolo↔wordmark (lockups)

`0.3 × ancho_del_símbolo = 0.3 × 18.879 ≈ 5.66 u` — medido y aplicado en
`lockup-horizontal.svg` / `lockup-vertical.svg`. Es más ceñido que el resguardo externo (0.5 u)
porque es una relación **interna** entre dos elementos de la misma marca, no un margen contra
elementos ajenos.

## 3. Tamaño mínimo legible

**16px.** No es un criterio propio — está justificado por evidencia visual ya capturada:
`coordinacion/cerrado/2026-08-05/2026-08-05_odobi-hito5-legibilidad-16px.png`, donde el símbolo
se probó junto a los otros 18 íconos de la UI en la misma grilla y al mismo tamaño de render, y
los 4 arcos concéntricos siguen siendo distinguibles (no colapsan en una mancha) a esa escala.

Por debajo de 16px (favicon de navegador a veces renderiza a 12-14px real tras el downscale del
propio SO) el símbolo puede perder el arco más interno por aliasing — por eso el favicon usa la
**variante 10** («geométrica», círculo + 2 ondas, trazos más separados), no el símbolo de 4 arcos:
la variante 10 fue la elegida específicamente para ese rango de tamaño, no un descuido.

## 4. Contraste por variante de lockup

| Variante | Símbolo/wordmark sobre | Ratio | AA (texto normal, ≥3:1 gráficos) |
|---|---|---|---|
| `lockup-horizontal.svg` / `lockup-vertical.svg` (como están, `#1A1512`) | crema `#F7F3EC` | **16.37:1** | ✅ pasa con margen amplio |
| Mismo SVG, cambiando `stroke`/`fill` a `#F7F3EC` | negro tostado `#1A1512` | **16.37:1** | ✅ pasa (mismo par, invertido) |
| Mismo SVG con `#DE7250` (terracota) | negro tostado `#1A1512` | **5.71:1** | ✅ pasa AA texto normal |
| Mismo SVG con blanco/crema | terracota pleno `#DE7250` | **3.17:1** | ❌ **falla** — prohibido por el brief |
| Mismo SVG con blanco | terracota oscura `#C2452E` | **5.02:1** | ✅ pasa (variante más oscura, si hiciera falta terracota de fondo) |

Los 5 ratios están **calculados** (fórmula de luminancia relativa WCAG 2.x, no una cifra de
memoria) contra los hex canónicos del brief (`#1A1512`, `#F7F3EC`, `#DE7250`, `#C2452E`). El
3.17:1 de blanco-sobre-terracota-clara coincide con el número que ya traía el contrato de este
hito — confirma la cifra en vez de repetirla sin verificar.

**Regla:** los dos SVG de lockup se entregan en negro tostado (`#1A1512`) por default, para uso
sobre crema/blanco. Para uso sobre negro tostado, cambiar `stroke`/`fill` a `#F7F3EC` (no crear un
tercer archivo — es un cambio de un atributo). **Nunca** sobre terracota pleno.
