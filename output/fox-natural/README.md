# Painted fox walk

New eight-frame two-step cycle with smaller paws, shorter forward reach, arm motion and a small painted rise and fall. Rain and winter outfits reuse the same painted body in the sprite builder so clothing cannot change the gait. This is a local candidate, not deployed to the livestream.

The images were created with the built-in imagegen tool. The first twelve-frame result repeated the old stiff pose and was rejected. The accepted eight-frame source is [walk8.png](../../assets/scene/fox/walk8.png), with [rain](../../assets/scene/fox/walk8-rain.png) and [winter](../../assets/scene/fox/walk8-snow.png) costume references.

Exact generation prompts: [base](prompt-v2.txt), [rain](prompt-rain.txt), [winter](prompt-snow.txt). The generated backgrounds are near-magenta, not exact solid #FF00FF. The existing sprite builder keys them out; [source validation](source-validation.json) records that distinction.

Motion references were studied for foot planting, contact/down/passing/up poses and weight transfer:

- [Pedro Medeiros's pixel-art tutorials](https://saint11.art/blog/pixel-art-tutorials/) and [original walk diagram](https://github.com/saint11/Saint11Tutorials/blob/master/Walk.gif), CC BY 4.0.
- [Studio VDS's walk template](https://nathanvanderstoep.itch.io/walk-cycle-template), from the artist of Astral Flux.

The existing OpenPost fox is the character reference. Neither game artist's character is used in the stream.

The [nine-second scene sample](walk.mp4) shows the actual scene at real time, three seconds each in clear weather, rain and snow. Native sprites remain on the 640x360 scene grid. Regression checks cover both steps, compact paw reach, planted baseline, bounded head motion, facial identity and one complete walking body.
