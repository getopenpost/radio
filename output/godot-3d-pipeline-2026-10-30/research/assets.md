# Stylized low-poly 3D asset research — Godot middle band

Research date: 30 October 2026. Scope per brief: (a) modular town/village/harbour building kits, (b) activity props (bicycle, dinghy, small sailboat, telescope, pull-up/dip bars, broom), (c) middle-band vegetation. Distant mountains are out of scope (staying 2D parallax). Target style: the `18-house-library.png`, `19-settlement-strips.png` and `22-vehicles-and-passersby.png` boards — cute, chunky, readable, European-flavoured, flat colours, pushed through a palette+ordered-dither post-process at 640x360.

Licenses: CC0 preferred, CC-BY acceptable, anything NC/ND/unclear rejected. Formats must include glTF or Blend. All candidates below are CC0 unless noted.

Key discovery channel: **gamedev.trebeljahr.com** re-hosts Quaternius, Kenney and KayKit packs per-model with direct GLB downloads at `https://assets.gamedev.trebeljahr.com/glb/<creator>/<pack-slug>/<model>.glb` (the middle `glb/` path segment varies per pack; model pages list the exact URL). Every model page states the original license (CC0). poly.pizza is the other per-model GLB source, but its search is client-side rendered and hard to scrape; trebeljahr's sitemap (`/sitemap.xml`) lists every pack and model page and is the reliable index.

## Shortlist

| # | Candidate | Author | License | Formats | Contents | Fit |
|---|-----------|--------|---------|---------|-----------|-----|
| 1 | Medieval Village MegaKit | Quaternius | CC0 | FBX, OBJ, Blend, glTF | 304 modular grid-snapped pieces (walls, roofs, stairs, doors, windows, vines) | **Best village/harbour core** |
| 2 | Medieval Village Pack | Quaternius | CC0 | FBX, OBJ, Blend (+GLB via mirror) | 44 pre-built medieval buildings/props | Best free full-kit of finished houses |
| 3 | Pirate Kit | Quaternius | CC0 | FBX, OBJ, Blend, glTF | docks, coastal houses, palms, cliffs, boats, props | **Best harbour set** |
| 4 | Ships Pack | Quaternius | CC0 | FBX, OBJ, Blend (+GLB via mirror) | 6 boats incl. `boat`, `boatwsail`, `lifeboat` | Sailboat + small boat coverage |
| 5 | Stylized Nature MegaKit | Quaternius | CC0 | FBX, OBJ, Blend, glTF | 116 models: 40 trees, 35 plants/flowers, 27 rocks | **Best vegetation** |
| 6 | Fantasy Town Kit | Kenney | CC0 | glTF (+ Blend on request; GLB via mirror) | 160 files, medieval town buildings/walls, remade 2.0 | Strong town alternative |
| 7 | Pirate Kit (rowboats) | Kenney | CC0 | glTF (GLB via mirror) | `boat-row-small`, `boat-row-large` | **Dinghy found** |
| 8 | Public Transport Pack | Quaternius | CC0 | FBX, OBJ, Blend (+GLB via mirror) | incl. `bicycle`, `squareframebicycle` | **Bicycle found** |
| 9 | KayKit Forest Nature Pack | Kay Lousberg | CC0 | FBX, glTF, OBJ (Blend in paid Source tier) | low-poly trees, bushes, grass, rocks, logs | Lightest flat-colour vegetation |
| 10 | Modular Medieval Building Pack | Quaternius | CC0 | FBX, OBJ, Blend (+GLB via mirror) | towers, walls, `bridge`, `well` | Bridge/well props for boards |
| 11 | Telescope (pixor.art) | Pixor | CC0 | GLB, .blend | 376-tri telescope, tripod | Telescope found |
| 12 | Telescope (poly.pizza) | CreativeTrio | CC0 | FBX, glTF | low-poly telescope on tripod | Telescope alternative |
| 13 | Farm Buildings Pack | Quaternius | CC0 | FBX, OBJ, Blend (index-listed) | farm buildings | Farmhouse archetype |
| 14 | City Kit (Suburban/Commercial) | Kenney | CC0 | glTF | suburban/commercial city buildings | Canal/river city strips (board 19) |
| 15 | Downtown City MegaKit | Quaternius | CC0 | FBX, OBJ, Blend, glTF (index-listed) | modular city environment | Larger city strips; likely too modern |
| 16 | Medieval Builder Pack (Legacy) / Medieval Hexagon Pack | Kay Lousberg | CC0 | FBX, glTF, OBJ | medieval buildings, castle, bridge, trees | Village alternative |
| 17 | Simple Nature Pack | Quaternius | CC0 | FBX, OBJ, Blend (+GLB via mirror) | untextured trees, bushes, rocks, grass | Best pixelation-survival vegetation |
| 18 | KayKit Medieval Hexagon Pack | Kay Lousberg | CC0 | FBX, glTF, OBJ | 200+ medieval hex tiles, buildings, props | Not recommended (hex tiles) |

## Per-candidate notes

### 1. Quaternius — Medieval Village MegaKit (January 2025) — the flagged pick

- Link: https://quaternius.com/packs/medievalvillagemegakit.html
- License: CC0 (page badge links creativecommons.org/publicdomain/zero/1.0; page text: "Free to use in personal, educational and commercial projects. (CC0 License)").
- Formats: FBX, OBJ, Blend, glTF (badge list). Source (paid) tier adds .BLEND sources plus ready-made Unity (URP), Unreal and **Godot** projects; engine versions listed as Godot_v4.3, Unity 2022.3.4, UE 4.27.2.
- Contents: "over 300 modular environment pieces, all designed to snap perfectly to a grid. The walls include both an exterior and an interior at the same time. The kit includes modular roofs, stairs, walls, doors and windows, vines and much more" — 304 models, textured.
- Pricing caveat: "60-70% of my pack is completely free"; Pro adds 30-40% (paid); Source (all 100% + Blend + engine projects) is paid via Patreon credits. So the CC0 free tier covers most, not all, pieces.
- Polycount ballpark: not stated per model; Quaternius modular pieces are typically a few hundred to a few thousand triangles each. The sampled 2020-pack houses (404-728 KB textured GLBs) are in the same league.
- Style fit: best match for board 18's "build settlement variation from roof massing, building height, material, shutters, chimneys and spacing" — a modular kit is exactly how you mass distinct cottage/townhouse/farmhouse silhouettes, and chunky flat-shaded Quaternius style matches the cute/European boards. Weaknesses: "medieval" vocabulary has no canal-house rows, chalets, lighthouse, station or tiled coastal houses; those need the supplements below or small custom builds. Grid snapping suits a scrolling side-view band where buildings can be assembled once and cached.
- Preview: https://quaternius.com/assets/images/fullres/medievalvillagemegakit.jpg (also `previews/medievalvillagemegakit.jpg`), plus tier sheets at `/assets/images/fullres/medievalvillagemegakit/{standard,pro,source}.jpg`.

### 2. Quaternius — Medieval Village Pack (December 2020)

- Link: https://quaternius.com/packs/medievalvillage.html
- License: CC0. Formats: FBX, OBJ, Blend (no glTF badge, but per-model GLBs exist on the trebeljahr mirror: https://gamedev.trebeljahr.com/quaternius/medieval-village-pack-dec-2020).
- Contents: "a set of medieval buildings and props", 44 models. Mirror lists: `house-1..4`, `inn`, `blacksmith`, `mill`, `sawmill`, `stable`, `bell-tower`.
- Sampled (see `../assets-samples/`): `house-1.glb` (410 KB), `inn.glb` (469 KB), `bell-tower.glb` (728 KB) — all verified `glTF` magic. These are finished, distinctive buildings: read as cottages and a chapel-adjacent tower for boards 18/19.
- Polycount ballpark: textured low-poly, order of 1-10k tris per building (estimated from GLB sizes).
- Style fit: pre-built buildings with strong silhouettes beat raw modular pieces for a side-scrolling band at 640x360, where the dither post-process erases fine texture anyway. Pairs with #1: MegaKit for custom massing, this pack for ready landmarks.

### 3. Quaternius — Pirate Kit (November 2023) — best harbour set

- Link: https://quaternius.com/packs/piratekit.html (index: "Pirate, Game Kit").
- License: CC0 (all Quaternius packs). Formats: FBX, OBJ, Blend, glTF.
- Contents (from trebeljahr mirror listing): `environment-dock`, `environment-dock-broken`, `environment-dock-pole`, `environment-house-1..3`, `environment-palm-tree-1..3`, `environment-cliff-1..4`, `environment-rock-1..5`, boats, plus characters.
- Style fit: the dock/house/cliff/palm set maps directly onto board 19's "fishing harbour" strip and board 18's "fishing/coastal houses"; docks give the fox's boat boarding spots. Pirate characters are not needed. Chunky flat-colour style consistent with the boards.

### 4. Quaternius — Ships Pack (February 2018)

- Link: https://quaternius.com/packs/ships.html
- License: CC0. Formats: FBX, OBJ, Blend (+GLB via mirror).
- Contents: "a set of simple ships!", 6 models. Mirror names: `boat`, `boatwsail`, `lifeboat`, `viking-boat`, `sail-ship`, `cruiseship`.
- Sampled: `boatwsail.glb` (58 KB, verified) — a small boat with a sail, the closest CC0 match to board 22's sailboat ("modest cream sail, fox at the tiller"). `lifeboat` is the other candidate hull for the cream dinghy if Kenney's rowboat reads too small.
- Style fit: simple, untextured, chunky — exactly board 22's visual family. Re-colour to cream/rust in Blender via material colours.

### 5. Quaternius — Stylized Nature MegaKit (July 2024) — best vegetation

- Link: https://quaternius.com/packs/stylizednaturemegakit.html
- License: CC0 ("Free to use in personal, educational and commercial projects. (CC0 License)").
- Formats: FBX, OBJ, Blend, glTF. Source tier has ready-made Unity/Unreal/**Godot** projects and wind shaders; Godot version listed as 4.3.
- Contents: "over 110+ unique nature models. Ideal for creating enchanting, Ghibli-inspired scenes, it includes 40 trees, 35 plants and flowers, 27 rocks, grass, bushes and more"; "tree leaves can be swapped between 7 different varieties".
- Style fit: Ghibli-inspired round stylized trees match board 21's deciduous seasonal variants and the autumn-valley master reference well. Season swaps (7 leaf varieties) support the four-season world day. Caveat: models are textured; at 640x360 the textures become palette noise, so the dither/palette post-process must quantize hard. The 2022 predecessor (Ultimate Stylized Nature Pack, CC0) has heavy GLBs (a single birch tree GLB is 22 MB) — prefer the 2024 kit or the untextured #17 for the pixel grid.
- Preview: https://quaternius.com/assets/images/fullres/stylizednaturemegakit.jpg (also `previews/stylizednaturemegakit.jpg`).

### 6. Kenney — Fantasy Town Kit (remade 2.0, 2022)

- Link: https://kenney.nl/assets/fantasy-town-kit
- License: "Creative Commons CC0" (asset page license row).
- Formats: Kenney 3D kits ship glTF (the pirate-kit models exist as GLB on the trebeljahr mirror, confirming glTF availability across Kenney 3D).
- Contents: "160x" files; tags medieval/wall/town/building; "Completely remade" in 2.0.
- Style fit: Kenney's flat-shaded chunky look is very close to the boards' cute chunky language; good cottage/townhouse massing. Kenney's medieval is more toy-like than Quaternius'; mixing the two vendors in one town risks a proportion clash (Kenney models are slightly stockier). Best use: Fantasy Town for dense small-town strips if Quaternius massing feels too grand.

### 7. Kenney — Pirate Kit (rowboats): the dinghy, found

- Link: https://kenney.nl/assets/pirate-kit (CC0).
- `boat-row-small` and `boat-row-large` exist as per-model GLBs (mirror). Sampled `boat-row-small.glb` (28 KB, verified) — a small flat-shaded rowboat, the closest CC0 stand-in for the cream dinghy in board 22 / scenes 07-08. Also useful: `platform`, `platform-planks`, `rocks-*`, `palm-*` for coastal dressing.

### 8. Quaternius — Public Transport Pack (February 2017): the bicycle, found

- Link: https://quaternius.com/packs/publictransport.html (index: "Vehicles, Cars, Transport").
- License: CC0. Formats: FBX, OBJ, Blend (+GLB via mirror).
- Contents include `bicycle` and `squareframebicycle` (mirror sitemap). Sampled `bicycle.glb` (166 KB, verified).
- Style fit: a simple diamond-frame bicycle — matches the handoff's "one consistent teal diamond-frame bike" after a material recolour. No other CC0 bicycle surfaced in the checked libraries; this closes board 22's bike cell.

### 9. KayKit — Forest Nature Pack (Kay Lousberg)

- Link: https://kaylousberg.itch.io/ (pack listed on the creator page: "3D stylised low poly trees, rocks, grass, and more"); mirror: https://gamedev.trebeljahr.com/kaykit/forest-nature-pack
- License: CC0 (KayKit pages state "Asset license: Creative Commons Zero v1.0 Universal"; the Complete KayKit page: "These assets are CC0 so you can use them freely").
- Formats: FBX, glTF, OBJ (all KayKit packs; .blend source in the paid SOURCE tier).
- Contents: trees, bushes, grass, rocks, logs, stumps, each in multiple colour variants (mirror lists `tree-*`, `bush-1..4`, `grass-1..3`, `rock-*`).
- Sampled: `kaykit-tree-1.glb` (20 KB, verified) — extremely light flat-colour geometry; ideal payload for dense scrolling vegetation, and flat vertex-ish colours survive palette quantization perfectly. Seasonal change = swap colour variants, which the pack ships by default.

### 10. Quaternius — Modular Medieval Building Pack (July 2017)

- Link: https://quaternius.com/packs/modularmedievalbuildings.html
- License: CC0. Formats: FBX, OBJ, Blend (+GLB via mirror).
- Contents (mirror): towers, walls, `bridge`, `well`, windows, banners, watchtowers.
- Style fit: the `bridge` model maps to board 18's bridge landmark and scene 02's stone bridge; `well` is a classic wayside prop. Towers/walls are castle-flavoured, lower priority.

### 11-12. Telescope — found (two CC0 sources)

- Pixor telescope: https://pixor.art/library/interior/telescope/ — "low-poly 3D model (376 triangles) with its Blender file"; "Licence: CC0, no credit needed"; files "GLB, .blend, PNG, Godot, Aseprite"; even ships a Godot 4 SpriteFrames resource. A wayside ground telescope is exactly board 22's telescope cell and the scene 12 encounter. Small enough (376 tris) to pixelate cleanly.
- CreativeTrio telescope on poly.pizza: https://poly.pizza/m/RjyTCQvA8b — "FBX/GLTF format • Public Domain (CC0)", Jan 2022, "Low Poly Objects #Tripod #Telescope".
- Also seen but not preferred: 1DesignTool "Telescope on a Swivel" (https://1designtool.com/3d/models/wizards-tower-telescope, 1,476 tris, 138 KB GLB, animated swivel) — free for commercial use under the site's own library license (not CC0); fine fallback if the CC0 ones disappoint. Grab3D's radio telescope/spyglass are sci-fi/desk props, wrong register.

### 13-16. Settlement supplements

- Quaternius Farm Buildings Pack: https://quaternius.com/packs/farmbuildings.html (index: "Farm, Buildings"; Sept 2018 per mirror slug). CC0. Farmhouse archetype for board 18. Page not opened during this pass; index-derived.
- Kenney City Kit (Suburban): https://kenney.nl/assets/city-kit-suburban and (Commercial): https://kenney.nl/assets/city-kit-commercial — CC0, glTF. Covers board 19's canal-city/river-city strips and scene 04's wet canal promenade. Kenney's city look is modern-toy; needs palette work to read European.
- Quaternius Downtown City MegaKit: https://quaternius.com/packs/downtowncitymegakit.html (index: "Environment, Modular"). CC0. Likely too modern/tall for the boards; listed for completeness. Index-derived, page not opened.
- KayKit Medieval Builder Pack (Legacy, free) and Medieval Hexagon Pack (200+ tiles): https://kaylousberg.itch.io/ — CC0, FBX/glTF/OBJ. Builder Pack has ready `castle`, `bridge`, `bridge-roofed`, trees; the Hexagon Pack is tile-based and wrong for a free-scrolling side band.

### 17. Quaternius — Simple Nature Pack (December 2016)

- Link: https://quaternius.com/packs/simplenature.html
- License: CC0. Formats: FBX, OBJ, Blend (+GLB via mirror).
- Contents: `tree-1..4`, `bush-1..3`, `rock-1..3`, `grass-1..3` — untextured, flat colours.
- Sampled: `quaternius-tree-1.glb` (27 KB, verified). At 640x360 with palette+dither, untextured flat-colour models are the safest vegetation bet: no texture detail to alias, and shading bands come from the post-process, not baked maps. Recommended as the primary pixel-grid vegetation, with #5 for hero trees.

### 18. Vegetation strategy note

Board 21's list (fir, coastal pine, cypress, olive, willow, reeds) is species-specific and no single CC0 pack covers it. Closest coverage: #5 (40 trees, seasonal leaf swaps) + #9 (colour-variant bushes/grass) + #17 (flat colour). Reeds/coastal scrub/olive/cypress would be small custom builds or Sketchfab singles; Sketchfab has downloadable CC0/CC-BY models but each upload's license must be checked per model (Sketchfab's own license filter exists at `sketchfab.com/search?features=downloadable&licenses=cc0`); not individually vetted in this pass — treat Sketchfab as a per-model source with license verification, not a pack.

## Category B coverage summary (board 22)

| Prop | Status | Best CC0 source | Sample |
|------|--------|-----------------|--------|
| Bicycle | **Found** | Quaternius Public Transport Pack (`bicycle`, `squareframebicycle`) | `bicycle.glb` |
| Dinghy/rowboat | **Found** | Kenney Pirate Kit (`boat-row-small/large`); alt Quaternius Ships `lifeboat` | `kenney-boat-row-small.glb` |
| Small sailboat | **Found** | Quaternius Ships Pack (`boatwsail`) | `boatwsail.glb` |
| Telescope | **Found** | pixor.art telescope (376 tris, GLB+.blend); alt poly.pizza CreativeTrio | not downloaded |
| Broom | **Missing** | No clearly-licensed CC0 broom verified in the checked libraries. Closest: build from two cylinders (trivial in Blender, matches the existing 2D broom concept exactly); KayKit Halloween Bits (https://kaylousberg.itch.io/) plausibly has one but was not verified this pass. | none |
| Pull-up/dip bars | **Missing** | No calisthenics kit found in any checked library. Closest: build from 3-4 cylinders per the board 22 sketch; KayKit City Builder Bits has a `bench` (mirror) but no bars. Trivial custom prop. | none |

## Recommendation

**Flagged village/harbour candidate: Quaternius Medieval Village MegaKit** (#1) — CC0, glTF+Blend, grid-modular, 304 pieces, explicitly Godot-friendly (Source tier ships a Godot 4.3 project). Supplement with the 2020 Medieval Village Pack (#2) for ready landmarks, Pirate Kit (#3) for the fishing-harbour strip, Kenney rowboats + Quaternius `boatwsail` for the water crossings.

**Best overall strategy: one dominant vendor (Quaternius) for the near/middle band, supplemented per-gap, rather than a pure single pack or a free-for-all mix.**

Reasons:
1. Every candidate above is CC0, so mixing is legally clean; the real risk of mixing is inconsistent proportions and shading language between vendors (Kenney is stockier, KayKit rounder, Quaternius chunkier).
2. No single pack covers the boards: chalets, canal houses, lighthouse, station and alpine vocabulary are missing everywhere; those are 4-6 small custom builds (Blender, from the same palette) regardless of strategy. A dominant kit keeps the other 80% coherent while customs blend in.
3. The palette+ordered-dither post-process is the great unifier: it flattens texture detail and re-colours everything into the scene palette slots, which erases most inter-vendor material differences. That is the project's insurance for mixing — but silhouette/proportion consistency still has to come from disciplined kit choice.

Practical pipeline: pull per-model GLBs from the trebeljahr mirror for evaluation (direct URLs, no login), and full packs from quaternius.com / kenney.nl / kaylousberg.itch.io for production; open Blend sources where available for palette-remap to the stream's palette slots before the dither pass.

## Gaps not closed

- Broom and pull-up/dip bars: no verified CC0 models; plan custom builds (both trivial).
- Chalet, canal-house row, lighthouse, station: no CC0 pack covers these; plan custom or Sketchfab singles with per-model license checks.
- Sketchfab and itch.io free packs beyond KayKit: not deeply swept (poly.pizza search is client-rendered; time-boxed pass). The trebeljahr sitemap is the best machine-readable index for the Quaternius/Kenney/KayKit ecosystem.
- Polycounts are estimated from GLB file sizes and vendor reputation; exact per-mesh counts need a Blender/mesh-tools pass on the samples in `../assets-samples/`.
