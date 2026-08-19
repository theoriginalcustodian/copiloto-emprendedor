# Cómo probar el prototipo

```bash
bash odobi-ui/prototipo/servir.sh
```

Imprime dos direcciones. **La que importa es la del celular** — un gesto vertical no se
evalúa con el mouse. Tiene que estar en la misma red WiFi.

**Si no carga en el celular**, en orden de probabilidad:

1. **Cambiaste de red y la IP ya no es la misma.** El script la imprime al arrancar y avisa si
   cambia mientras corre. Ante la duda: Ctrl+C y arrancarlo de nuevo.
2. **El celular está en otra red** — WiFi de invitados, o 5 GHz con aislamiento de clientes.
3. **El firewall de macOS bloquea Python.** Pregunta una sola vez; si esa vez se rechazó, no vuelve
   a preguntar. Ajustes → Red → Firewall → Opciones: Python tiene que estar permitido.

En el celular conviene agregarlo a la pantalla de inicio (*Compartir → Agregar a inicio*):
se abre sin barra del navegador y el gesto se siente como en una app.

## Qué se puede probar

| Gesto / toque | Qué pasa |
|---|---|
| **Arrastrar el composer hacia arriba** (o tocarlo) | Sube la conversación. Es *el* gesto del modelo: el composer **es** el borde del panel |
| **Arrastrar el asidero de arriba hacia abajo** (o tocarlo) | Baja Mi día y revela el escritorio de funciones |
| **Arrastrar el asidero del chat hacia abajo** | Vuelve a Mi día |
| Tocar **«Escribirle»** en la tarjeta de Lucía | El puente: el chat abre con el chip de contexto y el HITL ya armado |
| **Confirmar y mandar** | Receipt en el chat **y la tarjeta de Mi día queda en estado resultado** — el ciclo cierra donde empezó |
| En el escritorio, tocar **Gastos** | Abre la función |
| Dentro de Gastos, tocar el **mic** | La escucha con el velo, sin salir de la función |
| **Enviar** → **Guardar el gasto** | La card, y al guardar **el gasto aparece en la lista y el total se actualiza** |

## Lo que el prototipo NO es

- **No hay backend**: los datos son fijos y las acciones no persisten. Al recargar, vuelve al inicio.
- **No están las 11 pantallas**: están las que hacen falta para probar el modelo de capas, el puente
  y la voz contextual. El resto vive en los mockups y en el árbol.
- **No reemplaza a los mockups**: acá no hay anotaciones ni fundamentos. Esto se usa, no se lee.
