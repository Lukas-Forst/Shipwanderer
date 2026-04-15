# Automated Art Pipeline

This project now includes a low-touch sprite production pipeline that can generate style packs (`industrial`, `clean`, `stormy`) from one set of master assets.

## Goals

- Keep manual work to "drop source files + run one command".
- Produce consistent outputs for gameplay-ready sprites.
- Make it easy to regenerate all style packs after any art change.

## Source Of Truth

- Ship stack slices: `public/ship/tile000.png`, `tile001.png`, ...
- Player ship sheet: `public/sprites/player_ship_stack.png`
- Pipeline config: `tools/art-pipeline.config.json`

## Commands

- Dry run (validation only):
  - `npm run art:dry-run`
- Build all style packs:
  - `npm run art:build`

If your shell runs from a UNC path and `npm run ...` fails, run the script directly:

- `node scripts/art-pipeline.mjs --dry-run`
- `node scripts/art-pipeline.mjs`

## Output Structure

Generated files go under:

- `public/generated/styles/industrial/`
- `public/generated/styles/clean/`
- `public/generated/styles/stormy/`

Each style directory includes:

- `ship/tileXXX.png` slice variants
- `sprites/player_ship_stack.png`
- `manifest.json`

Top-level report:

- `public/generated/styles/pipeline-report.json`

## Minimal Manual Workflow

1. Update your master source art:
   - replace/add `public/ship/tileXXX.png`
   - update `public/sprites/player_ship_stack.png`
2. Run `npm run art:build`
3. Test in game and choose desired style pack.

## Notes

- Style transforms are centralized in `scripts/art-pipeline.mjs`.
- Style list and I/O paths are configurable in `tools/art-pipeline.config.json`.
- This pipeline intentionally avoids per-file manual editing and batch tools everything in one pass.
- If native `canvas` is unavailable, the pipeline falls back to copy mode:
  - generation still succeeds
  - style directories are produced
  - recolor transforms are skipped (manifests include `"processingMode": "copy"`).
