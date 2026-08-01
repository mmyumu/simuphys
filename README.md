# FallSim

Simulateur pédagogique interactif de chute libre. Une balle est lâchée, une
autre est lancée avec une vitesse et un angle réglables. Un interrupteur permet
de comparer le vide à un modèle atmosphérique.

Le modèle avec air utilise une sphère creuse lisse en ABS de 40 mm et 2,7 g.
La traînée est intégrée numériquement avec RK4. Son coefficient varie avec le
nombre de Reynolds selon la corrélation de Brown–Lawler, valable dans la plage
de vitesses couverte par l’expérience. La rugosité de surface est fixe.

## Développement

```bash
pnpm install
pnpm dev
```

## Vérifications

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```
