// BUILDSHA (2026-09-28): convierte `servido@<sha>` de inferencia (hora del PNG) a lectura real.
// Placeholder EXACTO del vocabulario del contrato — el instrumento que lo consume trata
// "unknown" como marcador ausente, nunca como un SHA válido.
export const BUILD_SHA_PLACEHOLDER = 'unknown';

export function resolveBuildSha(env: string | undefined): string {
  return env && env.trim() !== '' ? env : BUILD_SHA_PLACEHOLDER;
}

export function injectBuildSha(html: string, sha: string): string {
  return html.replace(/<html(\s|>)/, `<html data-build-sha="${sha}"$1`);
}
