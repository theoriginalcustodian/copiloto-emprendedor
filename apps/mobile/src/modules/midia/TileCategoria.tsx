/**
 * El tile de color de cada tarjeta de Mi día (`index.html:2493-2495`, `.fi .cab .tile`): un cuadrado
 * pastel con el glifo de la categoría que decidió el detector del backend. La app no deduce la
 * categoría (ver `filtroTablero.ts`): sólo la lee. Una tarjeta sin categoría —o con una que esta
 * versión no conoce— NO lleva tile: un cuadrado genérico diría una categoría que nadie decidió.
 */
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { PHOSPHOR, VIEWBOX_PHOSPHOR } from '../../theme/glass/phosphor';
import { useTema } from '../../theme/ThemeProvider';

/** Glifo del set del sistema por categoría; las claves son las de `Tokens.color.tileFuncion`. */
const GLIFO = {
  cobros: 'coins',
  arca: 'arca',
  presupuestos: 'clipboard-text',
  tuyas: 'pen',
} as const;

type CategoriaConTile = keyof typeof GLIFO;

export function categoriaConTile(c: string | null | undefined): CategoriaConTile | null {
  return c != null && Object.prototype.hasOwnProperty.call(GLIFO, c) ? (c as CategoriaConTile) : null;
}

export function TileCategoria({ categoria, testID }: { categoria: string | null | undefined; testID?: string }) {
  const tema = useTema();
  const cat = categoriaConTile(categoria);
  if (cat == null) return null;
  const t = tema.color.tileFuncion;
  return (
    <View
      testID={testID}
      accessible={false}
      style={{
        width: 38,
        height: 38,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: t[cat],
      }}
    >
      <Svg width={18} height={18} viewBox={VIEWBOX_PHOSPHOR} fill="none">
        {(PHOSPHOR[GLIFO[cat]] ?? []).map((d, i) => (
          <Path key={i} d={d} fill={t.tinta} stroke="none" />
        ))}
      </Svg>
    </View>
  );
}
