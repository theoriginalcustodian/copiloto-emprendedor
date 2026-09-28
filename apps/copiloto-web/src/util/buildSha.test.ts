import { describe, expect, it } from 'vitest';
import { BUILD_SHA_PLACEHOLDER, injectBuildSha, resolveBuildSha } from './buildSha';

describe('resolveBuildSha', () => {
  it('devuelve el placeholder cuando la env no está seteada', () => {
    expect(resolveBuildSha(undefined)).toBe(BUILD_SHA_PLACEHOLDER);
  });

  it('devuelve el placeholder cuando la env está vacía', () => {
    expect(resolveBuildSha('')).toBe(BUILD_SHA_PLACEHOLDER);
  });

  it('devuelve el sha real cuando está presente', () => {
    expect(resolveBuildSha('a'.repeat(40))).toBe('a'.repeat(40));
  });
});

describe('injectBuildSha — control positivo §4(2): dos SHA distintos dan dos valores distintos', () => {
  const html = '<!doctype html>\n<html lang="es-AR">\n<head></head>\n</html>\n';

  it('inyecta el atributo preservando los atributos existentes', () => {
    const out = injectBuildSha(html, 'a'.repeat(40));
    expect(out).toContain(`<html data-build-sha="${'a'.repeat(40)}" lang="es-AR">`);
  });

  it('dos builds con SHA distinto producen dos atributos distintos', () => {
    const shaUno = '1'.repeat(40);
    const shaDos = '2'.repeat(40);
    const outUno = injectBuildSha(html, shaUno);
    const outDos = injectBuildSha(html, shaDos);
    expect(outUno).toContain(`data-build-sha="${shaUno}"`);
    expect(outDos).toContain(`data-build-sha="${shaDos}"`);
    expect(outUno).not.toBe(outDos);
  });

  it('sin VITE_BUILD_SHA, el atributo queda en el placeholder ruidoso, nunca vacío', () => {
    const out = injectBuildSha(html, resolveBuildSha(undefined));
    expect(out).toContain(`data-build-sha="${BUILD_SHA_PLACEHOLDER}"`);
  });
});
