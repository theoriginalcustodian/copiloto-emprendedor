/**
 * `ResumenFacturado` — el «Facturado este mes» con que el prototipo abre Facturación (`factura`,
 * mapeo 2026-10-12).
 *
 * 🔴 **La cifra la calcula el backend, no esta pantalla.** Es `portada.mes.facturado` — la MISMA que
 * ve Inteligencia, con el predicado de «facturado» (con CAE, las NC restan) definido UNA vez del lado
 * del servidor. Sumar acá `listarComprobantes` habría sido una segunda definición de «facturado» en el
 * cliente: justo la divergencia que el predicado único existe para impedir.
 *
 * Sin dato (`no_disponible`, error, o `facturado: null`) no se pinta NADA: un «$0» afirmaría que no se
 * facturó nada sobre un número que no llegó.
 *
 * El chip «6 facturas · 1 impaga» del prototipo NO está: la portada no trae conteos y derivarlos del
 * listado paginado daría un número que depende de cuántas páginas se bajaron.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

import { formatearImporte, leerPortada } from '@copiloto/core';

import { BloqueCifra } from '../../theme/BloqueCifra';

export interface ResumenFacturadoHandle {
  /** Relee la portada. Nunca rechaza: un fallo deja lo último que se vio. */
  recargar: () => Promise<void>;
}

export interface ResumenFacturadoProps {
  testID?: string;
}

export const ResumenFacturado = forwardRef<ResumenFacturadoHandle, ResumenFacturadoProps>(
  function ResumenFacturado({ testID = 'facturacion-resumen' }, ref) {
    const [facturado, setFacturado] = useState<string | null>(null);
    const vivo = useRef(true);

    const cargar = useCallback(async () => {
      try {
        const res = await leerPortada();
        if (!vivo.current) return;
        // Un fallo NO borra lo que ya se mostró: una cifra vieja es mejor que una que parpadea.
        if (res.status === 'ok') setFacturado(res.portada.mes.facturado);
      } catch {
        /* sin portada no hay resumen: el resto de la pantalla no depende de esto */
      }
    }, []);

    useImperativeHandle(ref, () => ({ recargar: cargar }), [cargar]);

    useEffect(() => {
      vivo.current = true;
      void cargar();
      return () => {
        vivo.current = false;
      };
    }, [cargar]);

    if (facturado == null) return null;
    return <BloqueCifra testID={testID} rotulo="Facturado este mes" cifra={formatearImporte(facturado)} />;
  },
);
