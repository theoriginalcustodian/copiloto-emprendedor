---
name: una-barrera-que-excluye-el-archivo-y-deja-el-dato-en-el-indice
description: Excluir por .gitignore el archivo que contiene un dato sensible no lo saca del repo si el índice que lo referencia lo repite, ni si otras entradas lo mencionan.
metadata:
  node_type: memory
  type: feedback
---

Durante el rescate de memoria del 2026-09-22 detecté que `telegram-composio-canal-operador.md`
guardaba el chat_id del operador y que el propio archivo pedía no ser versionado. Lo excluí por
`.gitignore` y **verifiqué la barrera reponiendo el archivo**. La barrera funcionaba.

El dato se publicó igual. La línea de índice que apuntaba a esa entrada **repetía el chat_id en su
propio texto**, y `HISTORIA.md` sí está versionado. Un barrido posterior encontró el identificador en
**tres** archivos versionados: esa línea y **dos entradas más** que mi mismo rescate había subido,
donde aparecía de paso (`access.json … allowFrom`). Lo publiqué yo, en el merge de ese día, en un
repo público.

**Why:** protegí el **continente** y no el **contenido**. Un `.gitignore` razona sobre rutas; el dato
razona sobre apariciones. Y el índice es traicionero porque su trabajo es *resumir* la entrada: la
línea que describe una entrada sensible tiende a repetir justo lo que la hace sensible. Peor: la
barrera **daba una señal de éxito verificada** —probé que el archivo no entraba— y esa señal tapó la
pregunta que faltaba, que no era «¿entra el archivo?» sino «¿dónde más está el dato?».

**How to apply:** al excluir un archivo por su contenido, **grepeá el dato en todo el árbol
versionado, no la ruta** — con control positivo del grep (que encuentre una cadena que sabés que
está, para probar que el barrido mira de verdad). Revisá siempre el índice y los archivos que citan
al excluido: un puntero cita lo que apunta. Y si el dato ya se publicó, decilo con la evaluación
honesta de qué es: un chat_id no es una credencial —sin el bot token no abre nada— pero es un
identificador personal en un repo público, y quien decide sobre la historia es el operador.

Hermana de [[memoria-repo-vs-slug-drift]] (el rescate que publica) y de
[[el-gate-verifica-el-par-declarado-no-el-par-pintado]]: verificar lo declarado no cubre lo que nadie
declaró.
