import { useEffect, useState } from 'react';

import { listarFeedbackPropio, type FeedbackPropio } from '@copiloto/core';

import { Badge, Surface } from '../../design-system';
import './ajustes.css';

/**
 * «Lo pediste vos» (BL-J12, K-08) — el feedback PROPIO y si el equipo ya lo escuchó. Es la pieza que
 * cierra el circuito: mandar una sugerencia sin saber si alguien la leyó es hablarle a una caja.
 *
 * 🔴 **Fail-soft**: es un agregado de la pantalla de feedback, no la pantalla. Si `GET /feedback`
 * falla, o no hay nada enviado todavía, no se dibuja NADA (ni cartel de error ni sección vacía): el
 * formulario de arriba sigue siendo lo que el emprendedor vino a hacer.
 *
 * `version` sube cuando el padre confirma un envío nuevo, para que aparezca en la lista sin recargar.
 */
export function LoPedisteVos({ version = 0 }: { version?: number }) {
  const [items, setItems] = useState<FeedbackPropio[]>([]);

  useEffect(() => {
    let vivo = true;
    void listarFeedbackPropio()
      .then((lista) => {
        if (vivo) setItems(lista);
      })
      .catch(() => {
        // Silencio deliberado: ver el docstring del componente.
      });
    return () => {
      vivo = false;
    };
  }, [version]);

  if (items.length === 0) return null;

  return (
    <section className="lo-pediste-vos" data-testid="lo-pediste-vos" aria-labelledby="lo-pediste-vos-titulo">
      <h2 className="lo-pediste-vos__titulo" id="lo-pediste-vos-titulo">
        Lo pediste vos
      </h2>
      <ul className="lo-pediste-vos__lista">
        {items.map((it) => (
          <li key={it.id} data-testid={`lo-pediste-vos-${it.id}`}>
            <Surface variant="card" className="lo-pediste-vos__item">
              <p className="lo-pediste-vos__texto">{it.texto}</p>
              {it.escuchado ? (
                <Badge variant="ok" className="lo-pediste-vos__estado">
                  <span data-testid={`lo-pediste-vos-${it.id}-escuchado`}>Escuchado</span>
                </Badge>
              ) : (
                <span className="lo-pediste-vos__pendiente" data-testid={`lo-pediste-vos-${it.id}-pendiente`}>
                  Enviado
                </span>
              )}
            </Surface>
          </li>
        ))}
      </ul>
    </section>
  );
}
