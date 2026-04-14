# Sea Wanderer: Vibe Coding Prompt Plan

This document contains the exact sequence of prompts for Cursor (Composer 2) to build a 2.5D modular ship roguelike.

## Phase 1: The Foundation (Engine & Movement)
**Goal:** Get a ship moving in a 3D ocean with a cinematic camera.

- [ ] **Prompt 1.1:** "Initialize a Vite + TypeScript + Three.js project. Create a scene with a light blue ocean plane (use a simple MeshStandardMaterial). Setup an OrthographicCamera at a 45-degree isometric angle. Implement a `Game` class that manages the resize listener and a basic render loop."
- [ ] **Prompt 1.2:** "Create a `Ship.ts` class. Use a BoxGeometry as a placeholder for a 3x3 base hull. Implement WASD movement with 'water physics': use acceleration, max speed, and friction/drag so the ship coasts to a stop. Ensure the camera follows the ship smoothly using `lerp`."
- [ ] **Prompt 1.3:** "Add a `WorldManager.ts`. Define a WORLD_SIZE of 100x100. Add invisible walls that prevent the ship from leaving the area. Add a visual 'border' like a grid or glowing line at the edges."

## Phase 2: Assets & Visual "Vibe"
**Goal:** Replace boxes with models and add the "Wanderburg" look.

- [ ] **Prompt 2.1:** "Create an `AssetManager.ts` to load GLB models. Setup paths for `hull.glb`, `cannon.glb`, and `enemy.glb`. Replace the player's box with the `hull.glb`. If the model is missing, fallback to a colored box."
- [ ] **Prompt 2.2:** "Add an Outline effect to the scene. Use Three.js `EffectComposer` and `OutlinePass` to give all models a 2px black border to achieve a 2.5D stylized aesthetic."

## Phase 3: The Survivors Loop (Combat & Enemies)
**Goal:** Auto-targeting weapons and endless enemies.

- [ ] **Prompt 3.1:** "Implement an `EnemyManager.ts`. Spawn enemies (red boxes or `enemy.glb`) at random positions outside the camera view but inside the world borders. Enemies should move slowly toward the player's current position."
- [ ] **Prompt 3.2:** "Add an `AutoWeapon` component to the Ship. Every 1.5 seconds, it should find the nearest enemy within a radius of 30 units and instantiate a `Projectile`. The projectile should move in a straight line and destroy the enemy on collision."

## Phase 4: The Wanderburg Loop (Scrap & Upgrades)
**Goal:** Collect resources and trigger the 3-choice upgrade menu.

- [ ] **Prompt 4.1:** "When an enemy is destroyed, spawn a 'Scrap' item (gold coin or small cube). Create a `ResourceManager` to track `scrapCount`. If the player ship overlaps with Scrap, collect it and update a simple HTML progress bar UI at the top of the screen."
- [ ] **Prompt 4.2:** "When `scrapCount` reaches the threshold (e.g., 20), pause the game (`timeScale = 0`). Display a 'Level Up' overlay with 3 buttons: 
    1. **Rapid Fire** (Reduces weapon cooldown by 20%)
    2. **Heavy Hull** (Adds a new physical hull piece to the ship grid and increases HP)
    3. **Long Range** (Increases auto-target radius by 30%)
    Clicking an upgrade applies the stat, resumes the game, and clears the scrap bar."

## Phase 5: Polish & Refinement
- [ ] **Prompt 5.1:** "Add 'Juice': Add a small screen shake when the ship fires or gets hit. Add a particle splash effect (simple white circles) behind the ship when it moves faster than a certain speed."