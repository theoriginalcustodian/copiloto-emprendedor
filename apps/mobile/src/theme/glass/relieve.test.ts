import { sombraVidrio, type NivelRelieve } from './relieve';

const nivel: NivelRelieve = { color: '#6E4B2C', opacity: 0.3, offsetY: 10, radius: 26, elevation: 14, spread: -12 };

describe('sombraVidrio', () => {
  it('traduce el nivel a boxShadow, con la opacidad dentro del color y el spread del DoD', () => {
    expect(sombraVidrio(nivel)).toEqual({
      boxShadow: [{ offsetX: 0, offsetY: 10, blurRadius: 26, spreadDistance: -12, color: '#6E4B2C4d' }],
    });
  });

  it('no deja la sombra por elevation, la que se ve a través del vidrio', () => {
    const estilo = sombraVidrio(nivel);
    expect(estilo).not.toHaveProperty('elevation');
    expect(estilo).not.toHaveProperty('shadowColor');
  });

  it('sin spread declarado queda en cero y una opacidad baja conserva los dos dígitos', () => {
    const { boxShadow } = sombraVidrio({ color: '#000000', opacity: 0.02, offsetY: 3, radius: 8, elevation: 6 });
    expect(boxShadow).toEqual([{ offsetX: 0, offsetY: 3, blurRadius: 8, spreadDistance: 0, color: '#00000005' }]);
  });
});
