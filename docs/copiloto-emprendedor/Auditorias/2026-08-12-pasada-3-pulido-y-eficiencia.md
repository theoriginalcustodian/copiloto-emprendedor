# Pasada 3 — Pulido y eficiencia

> **Estado:** PLAN, sin ejecutar. **Índice:** [ESTRATEGIA](2026-08-12-ESTRATEGIA-tres-pasadas-de-auditoria.md)
> **Precondición:** pasadas 1 y 2 triadas **y sus fixes aplicados**. Va última.
> **Muta código:** SÍ, mucho. Es la única pasada cuyo producto es un diff grande.

---

## Por qué va última

Es la pasada que más código toca y la de menor consecuencia si se posterga. Corrida antes:

- invalidaría los reportes de las pasadas 1 y 2 — describirían código que ya no existe;
- obligaría a re-escanear todo, pagando dos veces;
- un refactor sobre código con un bug de seguridad vivo puede **esconder** el bug sin arreglarlo, y de
  paso volverlo más difícil de encontrar.

Regla del plan: **descubrimiento read-only primero, mutación después.**

---

## Pregunta que responde

> Con la app ya correcta y segura: ¿qué la vuelve **más barata de operar y más fácil de seguir
> evolucionando**, sin cambiar su comportamiento?

Cambio de comportamiento = fuera de alcance. Si un "pulido" cambia qué inputs acepta el código, no es
pulido: es un cambio funcional y va por contrato aparte.

---

## Instrumentos

| Frente | Instrumento |
|---|---|
| Simplificación de lo cambiado | `/simplify` (reuso, simplificación, eficiencia, altura de abstracción — no busca bugs) |
| Revisión contra estándares del repo | `/code-review` (ejes Standards + Spec) |
| Performance mobile | `callstack-react-native-performance`, `swmansion-react-native-best-practices` |
| Consistencia de UI | `documed-front` como app canónica (regla §3.ter del `CLAUDE.md`) |
| Deuda de tipos | typecheck (si la Pasada 0 dejó la capa lista) |

---

## Los cinco frentes

### P1 — Cota de listas y renders (hereda C6)

`C6: chat/listas sin cota, "M-WEB duplicó"` es deuda de agosto que aterriza acá.

- Cap `slice(-N)` en historiales de chat; `FlatList`/`FlashList` con virtualización donde hoy hay
  `.map()` sobre arrays sin techo.
- Re-renders: el precedente de `BotonVoz.tsx` (objeto `voz` inestable → ~10 renders/seg mientras
  graba, cazado en ODOBI8) sugiere **buscar las hermanas**: props de objeto sin `useMemo` en
  componentes de alta frecuencia.
- Medir antes y después. "Se siente más rápido" no es evidencia.

### P2 — Duplicación entre las tres capas de UI

El repo tiene `apps/copiloto-web/` (258), `apps/mobile/` (254) y `packages/` (91). Cada feature reciente
se implementó **dos veces** (web + mobile): chat, soporte, voz, Mi Día, Calendar.

- ¿Qué lógica duplicada debería vivir en `packages/core`? Los clientes de API son el candidato obvio
  (`soporte.ts` y `soporteChat.ts` ya mostraron el problema: un cambio de contrato exigió el **mismo
  fix de 1 línea en dos archivos**).
- Regla que aplica: capa plantilla vs. capa cliente. Lo clonable se parametriza; lo específico se aísla.

### P3 — Backend: 109 módulos planos

`apps/copiloto/` tiene 109 módulos `.py` en un solo nivel. Funciona, pero es el tipo de estructura que
se vuelve cara sin avisar.

- Agrupación por dominio (afip / soporte / inteligencia / plataforma) sin romper `_paths.py` ni el
  boundary del motor vendorizado.
- **Precaución:** un movimiento masivo de archivos rompe el historial de `git blame` y el grafo de
  código. Evaluar si el beneficio lo paga. **Puede ser legítimo decidir que no.**
- Duplicación real entre los 11 módulos `*_web.py`: ¿los guards de auth y ownership están repetidos
  cuando deberían ser una dependencia común? (esto **conecta con O1 de la Pasada 1**: un guard
  centralizado es más fácil de verificar que 30 copias).

### P4 — Costo operativo

- Ventana de contexto: `REACT_TAIL=80` se subió con un análisis de costo que proyectaba +75-120% de
  tokens por turno con tool-calls. **Medir el real** ahora que está en prod.
- Cache de Composio (C7): además de latencia, es dinero.
- Consultas al LLM: ¿hay prompts que se podrían acortar sin perder calidad? ¿algún `gpt-4o-mini`
  llamado donde alcanzaría una regla determinista?
- Bundle: tamaño del bundle web y del APK, y qué lo domina.

### P5 — Higiene del repo

- Los 8 worktrees activos, varios de spikes ya cerrados (`spike/cal1-shape-real`,
  `spike/odobi-hito0-relieve`, `odobi8-c1-soporte-audio`). Limpiar los huérfanos **verificando primero
  que no tengan WIP sin mergear**.
- `coordinacion/en-curso/` tiene logs de julio (`.logcat-experimento-avion.log`, 841 KB) que nunca se
  archivaron.
- Ramas viejas en el remoto.
- El checkout compartido con **325 commits de atraso y 24 commits propios** sin mergear: decidir qué
  se rescata de esos 24 y qué se descarta. **Esto tiene dueño y fecha, o se pierde** — es el mismo
  mecanismo que se tragó el plan de la auditoría de agosto.

---

## Restricciones duras

1. **Cero cambio de comportamiento.** Un cambio en qué inputs acepta el código **es** un cambio de
   comportamiento, y sale del alcance.
2. **La suite verde antes y después**, con el mismo número de tests. Un test borrado durante un
   refactor es un hallazgo, no un detalle.
3. **Se toca sólo lo que tiene test.** Refactorizar código sin cobertura es mover a ciegas: si un
   frente no tiene tests, primero se escriben.
4. **Nada de refactor + fix en el mismo commit.** Se pierde la capacidad de bisecar.
5. **Batch, no PR por tweak** (orden permanente del operador): se juntan los cambios.

---

## Definition of Done — Pasada 3

- [ ] C6 cerrado con medición antes/después.
- [ ] Los 5 frentes recorridos, cada uno con veredicto — incluido **"se evaluó y se decidió no
      hacerlo, por esto"**, que es un resultado válido y preferible a un refactor caro sin beneficio.
- [ ] Suite verde con el mismo conteo de tests; gate 6/6.
- [ ] Cero cambios de comportamiento (verificado por review, no por autoevaluación).
- [ ] Worktrees huérfanos limpiados tras confirmar que no tenían WIP.
- [ ] Los 24 commits del checkout compartido: rescatados o descartados, con decisión escrita.

## Cierre del plan completo (después de esta pasada)

1. `/security-review` sobre el **diff acumulado** de las tres pasadas — este es su lugar natural:
   es diff-scoped y acá recién existe el diff.
2. Gate completo 6/6 con las capas nuevas de la Pasada 0.
3. **E2E en device real** — la regla del proyecto: "terminado" exige evidencia de device.
4. Actualizar el `README.md` de `Auditorias/` con las tres pasadas y su resultado.
5. Memoria: un gancho por aprendizaje que sobreviva al sprint.

## Lo que esta pasada NO hace

- No agrega features.
- No cambia contratos de API.
- No toca el motor vendorizado salvo que un hallazgo lo exija (fork duro: el fix se hace acá, pero se
  documenta).
