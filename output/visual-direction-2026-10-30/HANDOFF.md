# The endless fox journey

Visual exploration, 30 October 2026. Generated artwork and a design brief only. The stream, music, scheduler and live deployment have not been changed.

Start with `index.html`. It links every original PNG. `prompts.json` records the built-in ImageGen prompts, input references and refinements. `manifest.json` records the delivered files and image properties.

## Direction

Use `scenes/01-autumn-valley.png` as the principal look reference. The supplied image is retained in `context/user-reference.png` for comparison. Make the world feel expansive, inhabited and worth watching, with a small expressive fox travelling through it. Architecture, cloud shapes, rock faces and tree silhouettes should carry the detail. Leave quiet areas between those clusters.

The fox stays horizontally centred and faces right. On land, a continuous side-on path crosses the screen near 84% of frame height. The scenery moves left. Hills, towns, trees and passing friends supply variety without requiring the fox to stop. Water crossings and occasional bike or broom travel continue the same journey.

Keep the burnt-orange fur, cream muzzle/chest/tail tip, dark-rimmed upright ears, black nose, dark paws and brown postal satchel. Preserve the face and proportions across outfits. The head, ears and tail must remain readable in a small preview. A walking fox is roughly one fifth of frame height. Vehicles can widen its silhouette without turning it into a close-up.

## Behaviour to build later

At least 95% of elapsed programme time should show rightward world progress. On-foot walking is the default. Boat, bicycle and broom are moving variations. Avoid standing conversations, stationary sailing and a long setup or recovery animation for an activity.

| Situation | Proposed behaviour |
| --- | --- |
| Walking | Continuous relaxed brisk walk; independent blink, glance, ear and tail gestures. |
| Passing friends | Rabbit or bear enters from the right travelling left, gives a brief nod or wave, and exits left. Neither character stops. |
| Rain | Continue walking in a cape; umbrella is a variation. Let wet ground and mist change the scene rather than moving the fox indoors. |
| Snow | Continue walking in the beanie and scarf. Footprints trail left, sparse flakes occupy several depth layers. |
| Found bicycle | Discover it ahead, mount with a short transition, pedal right for a while, dismount into the walking stride. Use one consistent teal diamond-frame bike. |
| Lake or river | Step into the cream dinghy, paddle facing right, cross the water, step out and continue. Wake trails left. |
| Ocean | Same visual boat family with a modest cream sail, fox at the tiller, bow right and wake left. |
| Magic travel | The existing broom concept becomes a forward-moving variation, with bristles and a restrained spark trail to the left. |
| Calisthenics | One short sequence: 20 pull-ups, a few dips, a few muscle-ups, a few push-ups, collect the bag and immediately continue right. |
| Telescope | Optional encounter of about five seconds, one look through a small wayside scope, then continue. No sky panel. |

A proposed workout target is about 45–55 seconds including transitions: 20 brisk pull-ups, 6 dips, 3 muscle-ups and 8 push-ups. These counts beyond the requested 20 pull-ups are suggestions. Keep each repetition legible, with full movement and clean contact. Use rarity to meet the travel target rather than speeding exercises into a flicker. At most 60 seconds stationary in any 20-minute window gives 95% moving time; all boarding, mounting, greetings, telescope looks and exercise transitions count if world progress actually stops. A 50-second workout and five-second telescope look leave only five seconds for other stationary transitions in that window. Do not make every possible event happen each window.

Remove the reading, computer, standalone fishing, home and campfire stops from this proposed programme. Fishing is omitted from the boards; if revisited, it should happen while the boat continues right. Buildings remain scenery. No giant reading, computer, telescope or other picture-in-picture panels.

## Full-frame references

| File in `scenes/` | Situation |
| --- | --- |
| `01-autumn-valley.png` | Master fox and landscape direction, golden hour. |
| `02-spring-riverside.png` | Spring blossom, river, stone bridge and passing rabbit. |
| `03-summer-hill-town.png` | Summer village architecture, tiled facade and open valley. |
| `04-rainy-city.png` | Wet canal promenade, warm windows and passing bear. |
| `05-winter-alpine.png` | Snowy mountain pass, winter clothing and snowfall. |
| `06-winter-moonlight.png` | Snow at night, moonlight, distant windows and aurora. |
| `07-coastal-bicycle.png` | Summer bicycle travel beside the sea. |
| `08-alpine-lake-boat.png` | Dawn lake crossing in the cream-and-rust dinghy. |
| `09-ocean-sailing.png` | Sunset ocean travel under a small sail. |
| `10-forest-broom-flight.png` | Forward-moving broom travel at twilight. |
| `11-calisthenics-park.png` | Small roadside exercise set, pull-up pose. |
| `12-telescope-glance.png` | Brief telescope encounter at a coastal overlook. |
| `13-rainy-forest.png` | Rain cape, puddles and layered forest mist. |

## Study and asset boards

Read multi-cell sheets left to right, then top to bottom.

| File in `studies/` | Contents |
| --- | --- |
| `14-day-night-cycle.png` | Dawn, noon, sunset and night at one autumn location. |
| `15-fox-walk-cycle.png` | Contact/down/passing/up phase studies, opposite stride, blink, glance, wave and wind. |
| `16-fox-travel-wardrobe.png` | Rain, snow, bike mounting/cruising, boat boarding/paddling/sailing and broom poses. |
| `17-fox-calisthenics.png` | Hang, pull-up, dip low/high, muscle-up low/high and push-up low/high. |
| `18-house-library.png` | Sixteen building/landmark designs: cottages, tiled house, townhouse, farmhouse, chalets, cabin, canal houses, fishing/coastal houses, chapel, lighthouse, station and bridge. |
| `19-settlement-strips.png` | Hill village, fishing harbour, summer/winter alpine village, canal city and larger river city. |
| `20-terrain-library.png` | Distant ridges, hills, rocky/snowy alpine peaks, cliffs, islands, boulders and riverbank. |
| `21-vegetation-library.png` | Fir, coastal pine, cypress, olive, deciduous seasonal variants, snowy fir, ferns, grasses, bramble, snow shrubs, willow, reeds and coastal scrub. |
| `22-vehicles-and-passersby.png` | Bike, dinghy, sailboat, broom, telescope, exercise bars, bag/helmet and leftward rabbit/bear variations. |
| `23-sky-weather-library.png` | Dawn, noon, sunset, night, rain, snow, aurora and clearing fog. |

## Movement notes

- Walk: one planted foot at a time, controlled bob, opposite arm swing, gentle satchel lag and a counterbalancing tail. Phase should follow distance travelled so feet do not slide. Keep blink and passing wave independent of the stride.
- Bike: paws stay on the handlebars; both feet follow opposite pedals; wheel rotation follows travel distance. Keep bag and tail clear of spokes. Reference the diamond-frame bike in scene 07 if sheets disagree.
- Boat: fox faces right with two paws on a single paddle. Paddle entry, power stroke, exit and recovery should read distinctly. Boat continues forward during recovery. Bob is subtle; keep fox seated relative to the hull.
- Sail: fox stays near the stern, away from the mast and boom. A small sail flex and broken wake are enough. No stationary fishing pose.
- Broom: retain small forward progress during takeoff/landing, two paws on the shaft and a readable face. Avoid a big costume covering both ears.
- Workout: plant paws on fixed bars or ground. The low and high positions are distinct. The single-bar support above the bar distinguishes a muscle-up from a pull-up. For push-ups keep a straight body line, fixed paws/toes and the head lifted enough to read as the fox.
- Return to travel: collect the same satchel, face right, enter the stride immediately. Never replace the fox with a different proportioned activity sprite.

## Pixel and environment treatment

The images communicate the target look, not a measured export specification. Recreate the result on the project's 640×360 native grid. Use uniform integer enlargement with no smoothing. The generated PNGs themselves have varied larger dimensions, more colours and occasional finer detail than a production grid should allow.

Use solid colour clusters inside forms and restrained 4×4 Bayer transitions between neighbouring palette shades. Anchor texture to its world layer so scrolling does not shimmer. Avoid a screen-wide noise filter. Distant ranges are simpler, softer and lighter; middle scenery carries structure; near foliage and rocks frame the bottom and sides. Keep the travel lane and the fox's face clear.

Day, night, season and weather remain independent. A snowy scene is not always night, a rainy scene is not always a city, and a summer scene need not always be noon. Preserve the same depth order throughout the lighting cycle: sky lightest, near foreground darkest, distinct middle layers. Night needs readable blue-green terrain and small warm lights, not a flat black silhouette or a glowing fox.

Build settlement variation from roof massing, building height, material, shutters, chimneys and spacing. A tiled coastal house, timber chalet and canal townhouse should retain distinct silhouettes even at a distance. Keep substantial quiet sky in open-country scenes; dense forest and town frames can have less. Cloud, wave and leaf movement should remain much calmer than a game action scene.

## Existing owners inspected

`src/stream/scene/character.js` owns the current fox, rabbit, bear and poses. `world.js` owns the current six biomes, layers and horizontal path. `clock.js` and `palette.js` supply time, season and lighting. `acts/index.js` registers the long-stop activities, including the current broom/plane in `acts/fly.js` and crossing in `acts/river.js`. `src/stream/tour.js` demonstrates the existing long-stop programme. Reuse those owners when implementation is requested.

The two `context/current-*.png` files are existing captured renderer stills from 27 October, not newly extracted frames or proof of the current live service. They illustrate the old computer and reading composition. `ffprobe` was unavailable in the shell, so no new video extraction was performed for this package.

## Handoff limits

These are generated visual targets, pose studies and asset references. They are not a playable implementation, animation proof, seamless scrolling strips, palette-indexed sprites, registered frame-by-frame atlases or deployment proof. The day/night sheet illustrates continuity; generated geometry is not guaranteed identical between panels. Contact poses still require registration and movement verification when animated. For identity and vehicle conflicts, the master fox, scene 07 bike and scene 08 hull take precedence.

Asset collections with alpha are references for extraction and redraw. Transparency alone does not establish clean production edges or correct layer separation. Keep assets on the native grid and remap lighting through palette slots when implementing. Inspect light and dark backdrops, repeat seams and moving weather before accepting production assets.
