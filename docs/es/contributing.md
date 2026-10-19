# Contribuir

[English](../en/contributing.md)

Gracias por ayudar. Bazaria es MIT y gratuito; las contribuciones se publican bajo la
misma licencia.

## Preparar el entorno

```bash
cd web
npm install
npm run dev:demo
```

## Antes de abrir un PR

```bash
cd web
npx tsc -b --noEmit
npm run lint
npm run test
npm run build:demo && npm run check:bundle
```

## Convenciones

- **La lógica de negocio va en `web/src/domain`**: funciones puras, sin React, sin I/O, con su
  test de Vitest al lado.
- La UI habla con `DataSource`, nunca directo con IndexedDB ni `fetch`.
- El dinero son enteros en centavos.
- TypeScript estricto. Nada de `any` sin razón.
- Mantenlo simple: nada de abstracciones "para después".
- Commits pequeños que describan un solo cambio.
- Los identificadores del código están en español (vocabulario del dominio: `prenda`,
  `lote`, `venta`); los docs son bilingües. Si cambias un doc, actualiza `docs/en` y
  `docs/es`.

## Seguridad y privacidad

- Nunca subas `.env`, llaves ni datos reales de usuarias.
- Los secretos nunca llevan prefijo `VITE_`: Vite los metería en el bundle del navegador.
- Reporta vulnerabilidades en privado con GitHub Security Advisories, no en Issues públicos.

## Preguntas y bugs

Preguntas: Discussions. Bugs y peticiones: Issues, con pasos para reproducir.
