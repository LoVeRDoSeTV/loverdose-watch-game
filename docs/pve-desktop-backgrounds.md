# Desktop PvE scenery

Ten landscape adaptations of the existing zone artwork, created with the built-in image generation tool. The delivered originals are approximately 1672 × 941 pixels (Automata: 1672 × 940); these are not 4K files. WebP copies use quality 93. Mobile and tablet continue to use the existing portrait assets.

## Shared generation brief

Edit the existing zone image into a high resolution 16:9 desktop landscape scene for LoVeR Watch Game. Preserve the zone palette, environment and premium painted game style. Recompose horizontally rather than stretch the portrait. Use crisp foreground and midground detail, no depth-of-field blur. Keep an empty stone fighting platform across the width, a central enemy standing area, and a restrained dark lower foreground for the player HUD. No characters, monsters, text, logos or interface. The generation prompt requested 3840 × 2160, but the returned files have the dimensions recorded above.

## Zone variations and saved assets

- `public/assets/pve-battle-forest-desktop.webp`: Mossy forest and cyan crystals.
- `public/assets/pve-battle-ember-desktop.webp`: Volcanic cavern, basalt and orange lava.
- `public/assets/pve-battle-night-desktop.webp`: Nocturnal violet ruins, broken columns and stars.
- `public/assets/pve-battle-tide-desktop.webp`: Turquoise submerged ruins, corals and arches.
- `public/assets/pve-battle-frost-desktop.webp`: Icy mountains, blue crystals and aurora.
- `public/assets/pve-battle-dune-desktop.webp`: Golden desert ruins at sunset, engraved sandstone monoliths.
- `public/assets/pve-battle-dream-desktop.webp`: Lilac mushroom garden with luminous mushrooms and wisteria.
- `public/assets/pve-battle-storm-desktop.webp`: Violet storm, floating rock islands and distant lightning.
- `public/assets/pve-battle-automata-desktop.webp`: Overgrown brass factory, gears, pipes and cyan crystals.
- `public/assets/pve-battle-origin-desktop.webp`: Violet-gold celestial sanctuary, floating temples and a golden halo.

The desktop CSS selects these assets by zone. The scene and enemy ground placement use the combat panel height, with both fighters grounded near 61% of the panel. On PC, the player occupies the left half and the enemy the right half, using the same responsive sprite size.
