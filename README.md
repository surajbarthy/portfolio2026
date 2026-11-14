# Suraj Barthy — portfolio 2026

A wall of work you run along. In **2D** it's a long-lens side view: a runner crosses one numbered line per project. Toggle to **3D** and the camera swings to a low three-quarter view, the lines unfold into doors, and the doors come to the runner. Click a door to walk in to the case study.

## Run it

It's a static site. Any static server works:

```sh
npm run serve        # http://localhost:8000
```

(Open it through a server, not as a file, so the 3D runner model can load.)

## Build

`index.html` is generated. Edit the sources in `src/`, then:

```sh
npm install          # esbuild + three, only needed for the runner bundle
npm run build        # bundles src/runner3d.js -> js/runner3d.js, then assembles index.html
```

- `src/scene.css`, `src/over.css` — styles (tokens, light/dark, phone layout, type)
- `src/scene.js` — the hall: layout, camera, scroll spring, doors, timeline, phone caption
- `src/app.js` — routing and page transitions
- `src/runner3d.js` — the Three.js runner, drawn on its own canvas with the hall's camera
- `src/build.py` — assembles `index.html`; case-study content, Short/Full and the NDA lock come from `src/v0.html`
- `models/runner.glb.wasm` — the runner (a GLB; named `.wasm` so every host serves it as binary). Stand-in mannequin for now; replace with a GLB that has `idle`, `walk` and `run` clips, in place, Mixamo-style bone names.

## Notes

- Text is 16px minimum; `#index` is the plain list version of the wall.
- Light/dark follows the system and can be toggled; the choice is stored as `sb-theme`.
- If WebGL isn't available, a drawn stick-figure runner takes over.
