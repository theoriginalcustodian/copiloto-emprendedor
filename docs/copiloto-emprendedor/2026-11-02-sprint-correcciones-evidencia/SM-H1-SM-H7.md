# SM-H1 y SM-H7 — evidencia de device

**Device:** RF8T318RN9T · 2026-11-02 · usuario canónico · Metro local desde la rama de #1328.

**Ambiente:** `GET /afip/estado` → `ambiente: dev`, `ambientes_vinculados: ['dev']` (homologación). No se tocó
Emitir; `GET /afip/comprobantes` da 4, ninguno de esta fecha. El borrador de prueba quedó cancelado.

## SM-H1 — Editar · Cancelar · Emitir

1. [Con faltantes: Editar y Cancelar, sin Emitir](SM-H1-1-card-con-faltantes-editar-cancelar.webp)
2. [Editar abre el dato dentro de la card](SM-H1-2-editar-dentro-de-la-card.webp)
3. [Completo: los tres botones](SM-H1-3-card-con-los-tres-botones.webp)
4. [Cantidad 1 → 2, total 100000](SM-H1-4-item-cambiado-total-100000.webp)
5. [Vuelve a la card con el dato cambiado](SM-H1-5-vuelve-a-la-card-con-el-dato-cambiado.webp)
6. [Tras force-stop conserva la edición](SM-H1-6-tras-recargar-conserva-la-edicion.webp)
7. [Cancelar en vuelo: el botón sigue diciendo «Emitir la factura»](SM-H1-7-cancelar-en-vuelo-sin-emitiendo.webp)
8. [Recibo en vivo](SM-H1-8-recibo-en-vivo-factura-cancelada.webp)
9. [Sigue cancelada tras force-stop](SM-H1-9-cancelada-tras-recargar.webp)

## SM-H7 — una card cancelada no vuelve a leerse como «Confirmado»

Card real, pedida en lenguaje natural («agendame una reunion con Juan manana a las 10»). No se creó ningún evento.

1. [Antes de cancelar](SM-H7-1-card-calendar-antes-de-cancelar.webp)
2. [Recibo en vivo: «No lo hicimos»](SM-H7-2-recibo-en-vivo-no-lo-hicimos.webp)
3. [Tras force-stop: «No lo hicimos»](SM-H7-3-tras-recargar-no-lo-hicimos.webp)
