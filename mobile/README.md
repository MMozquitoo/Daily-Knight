# Wardrobe Knight — vertical slice de Hoy

React Native + Expo. Ver `Contrato de Pantallas v0.2` y `El Bucle Hoy v0.1`
para el contenido y las reglas de estado que este código implementa.

## Qué hay

```
src/
  types.ts                       Garment, TodayOutfit, resolveGarmentImage()
  events.ts                      TodayEvents — contrato de eventos
  fixtures/today-2026-08-18.ts   fixture real (Planification + Armoire)
  components/
    GarmentVisual.tsx            fallback clean -> product -> raw -> placeholder
    OutfitHero.tsx
    WhyBlock.tsx                 explicación + clima + agenda en un solo bloque
    CarryBlock.tsx               se omite por completo si no hay carry
    TodayActions.tsx             Je la porte / Changer une pièce / Autre tenue
  screens/TodayScreen.tsx        loading / ready / accepted / error
  __tests__/TodayScreen.test.tsx
```

## Correr

```bash
npm install
npm run typecheck
npm test
```

## Sobre "prueba móvil del flujo completo"

Este entorno no tiene Xcode ni un emulador Android disponibles, así que
no se pudo abrir un simulador real. Lo que sí se hizo y está verificado:

- `npm run typecheck` — sin errores.
- `npm test` — 9/9 tests con `@testing-library/react-native` sobre el
  fixture real del 18 de agosto, cubriendo: estado ready, carry vacío,
  las tres acciones visibles, el fallback de imagen (verificando que
  NINGÚN texto "product"/"clean"/"tier" se filtra a la UI aunque el
  evento de telemetría sí se dispare), aceptar, cambiar pieza, regenerar,
  loading y error.

Falta: correr `npx expo start` en un simulador o dispositivo real. El
código no usa ninguna API específica de Expo todavía, así que debería
levantar sin cambios — pero eso no está probado desde acá.
