# Slimy Stretch

A game designed by Berty. You're a see-through green slime that **can't jump**. Drag part of the
slime to stretch it; let go next to a wall and it sticks, let go in the air and it boings back.
Climb like an inchworm!

- **The Lab:** lasers and water
- **The Tundra:** ice walls you can't stick to, and a giant snowball
- **The Volcano:** lava, and a robot boss that throws bombs (grab one and flick it back!)
- **The Canyon:** crumbling rocks, wind gusts, falling boulders, colored keys and laser gates, and
  metal boxes you eat with your tongue
- **The Warehouse:** boxes everywhere (some hide bombs that make your tongue too sore to use for 10
  seconds!), conveyor belts, crane claws (green base = nice, red base = mean), slime cannons, and
  one-way platforms
- **The Cave:** dark tunnels, falling stalactites, friendly bats, mining machines with swinging
  pickaxes (they smash boxes open), mine carts, and a crystal robot boss you trick into crashing
  into a mining machine
- **The Island:** waves that wash over the sand (get up on a rock!), falling coconuts, crabs (a
  slime shot flips them over, and a coconut knocks them out), palm trees, hammocks that bounce you
  up high, wobbly rope bridges, pearls to collect, a hidden treasure chest worth 10 tokens in every
  level, and seagulls. Some seagulls carry you somewhere useful; others eat you and barf you up at
  half size, and you have to find the 2 missing blobs of you. They all look the same!
- **The Jungle:** quicksand (you can't stretch far, and if you stay in it for 3 seconds you sink),
  monkeys that throw bananas (a slime shot scares them into hiding; catch a banana with your tongue
  and eat it to get a missing blob of slime back), snakes that snap down from above (wait for them
  to pull back up, then sneak past), leafy traps over snake pits, piranha rivers with floating logs
  to ride, vines to swing on, ziplines, bouncy flowers, big leaves that tip over if you sit on them
  too long, and golden idols to collect
- **The Factory:** stamping presses, saw blades that roll along floors and walls, steam vents that
  blast you up into the air, and slime machines: shoot a blob of slime into one to make a platform
  move, then climb in the other side to get your blob back. Plus lasers, laser gates, metal boxes,
  conveyor belts, ice and lava from the earlier worlds, and the big machine boss: shoot a blob into
  its mouth to run its belt backwards, and when a bomb box goes in, climb up and press the button!
- **Sky City:** way up in the sky, where falling off the bottom of the screen is the big danger.
  Lightning clouds (they rumble and flicker, then zap straight down), strong wind gusts, sleeping
  clouds that block the way (hit one with a slime shot and it wakes up and floats off, and your
  blob comes right back), fluffy clouds you slowly sink through if you sit on them too long, hot
  air balloons, rainbow slides, floating islands that carry you along, kites the wind pulls you
  around with (tap to let go), and stars to collect

Bosses only show up in worlds that are multiples of 3. Beating a boss gives the slime new
abilities:

- The robot gives you a **tongue**. Tap 👅, then drag to stick it out and eat metal boxes.
- The crystal robot gives you **glow** (dark levels aren't dark anymore) and **slime shot**: tap
  💧, then tap where to shoot a blob of slime. Each blob out costs 25% of your reach (3 at most);
  touch a blob to soak it back up. Blobs knock down stalactites.
- The big machine gives you **split**: getting hurt splits you into two half-size slimes (half the
  reach each) instead of killing you. The exit door won't open until you bring the halves back
  together. If a half gets hurt it's gone; get hurt as a half-size slime and you really die.

## Running it

```bash
npm install
npm run dev     # play at http://localhost:5173 (add ?all to unlock every level)
npm test        # run the tests
npm run build   # build the website into dist/
```

It deploys with the rest of the repo to GitHub Pages at `slimy-stretch/`.

## Putting it on the iPad Home Screen

Open the game in Safari, tap the Share button, then **Add to Home Screen**. It opens full screen
like an app and works without Wi-Fi after the first visit. (The Home Screen app keeps its own
saved progress, separate from Safari's.)

The icons in `public/` are drawn by `scripts/make-icons.py`; run `python3 scripts/make-icons.py`
to redraw them.

## Making your own level

Levels live in `src/levels/levels.js`. Each one has a map drawn with letters:

| Letter | What it is                                        |
| ------ | ------------------------------------------------- |
| `#`    | wall (sticky)                                     |
| `I`    | ice (you can't stick to it)                       |
| `L`    | lava (ouch!)                                      |
| `W`    | water (ouch!)                                     |
| `^`    | spikes (they just look cool)                      |
| `S`    | where the slime starts                            |
| `E`    | the exit door                                     |
| `C`    | checkpoint                                        |
| `T`    | token (more points)                               |
| `P`    | power core (collect levels need all of them)      |
| `r`    | laser shooting right (`l` left, `u` up, `d` down) |
| `X`    | crumbling rock (falls apart 3 s after you stick)  |
| `M`    | metal box (eat it with the tongue)                |
| `O`    | crack in the ceiling that drops boulders          |
| `1`    | red key (`2` blue, `3` yellow)                    |
| `a`    | red laser gate (`b` blue, `c` yellow)             |
| `>`    | conveyor belt moving right (`<` moves left)       |
| `-`    | one-way platform (go up through, stick on top)    |
| `U`    | slime cannon                                      |
| `V`    | stalactite (hangs from the ceiling)               |
| `B`    | bat (just flies around)                           |
| `K`    | mining machine (pickaxe hurts, smashes boxes)     |
| `=`    | mine cart track (`H` is the cart)                 |
| `G`    | glowing crystal (lights up dark levels)           |
| `z`    | sand (waves wash over it)                         |
| `Y`    | palm tree trunk (sticky)                          |
| `F`    | palm fronds (a one-way platform)                  |
| `Q`    | coconut (falls when you go under it)              |
| `~`    | rope bridge (a one-way platform)                  |
| `J`    | hammock (bounces you up high)                     |
| `Z`    | crab                                              |
| `$`    | treasure chest (worth 10 tokens)                  |
| `q`    | quicksand (short stretch; you sink after 3 s)     |
| `m`    | monkey (throws bananas)                           |
| `s`    | snake (snaps down from the branch above)          |
| `%`    | leafy trap (breaks as soon as you touch it)       |
| `x`    | snake pit (ouch!)                                 |
| `*`    | bouncy flower (bounces you up high)               |
| `_`    | big leaf (tips over if you sit on it too long)    |
| `A`    | stamping press (hangs from the ceiling)           |
| `o`    | saw blade                                         |
| `v`    | steam vent                                        |
| `N`    | slime machine (slippery)                          |
| `n`    | a slime machine's platform                        |
| `!`    | lightning cloud (zaps straight down now and then) |
| `@`    | sleeping cloud (a slime shot wakes it up)         |
| `f`    | fluffy cloud (you sink through after 2 s)         |
| `k`    | kite (the wind pulls it along)                    |
| `.`    | empty space                                       |

To put something inside metal boxes, add `boxItems` to the level, listing what's in each box in
reading order, for example `boxItems: [null, 'token', 'key-blue', 'core', 'bomb']`. Add
`wind: { every: 5, gust: 2, strength: 90, dir: 1 }` for wind gusts, and crane claws with
`claws: [{ row: 0, from: 4, to: 9, drop: 12, nice: true }]` (the claw runs along the ceiling in
`row` between columns `from` and `to`, and drops you at column `drop`). Add `dark: true` to make a
level dark.

Island levels can have `waves: { every: 8, from: 'right' }` (a wave every 8 seconds from the
ocean on the right) and seagulls with `gulls: [{ from: 3, to: 12, drop: [27, 7], nice: true }]`
(the gull flies between columns `from` and `to`; nice ones drop you at `drop`). Levels with mean
seagulls need `blobSpots: [[col, row], ...]` where your barfed-up blobs can turn up.

Jungle levels can have vines with `vines: [{ at: [27, 6], length: 5 }]` (the vine hangs from the
top of the empty cell at column 27, row 6, and is 5 tiles long), ziplines with
`ziplines: [{ from: [10, 5], to: [25, 10] }]` (the handle starts at `from` and zooms you to `to`)
and floating logs with `logs: [{ row: 13, from: 8, to: 19 }]` (a log floats back and forth on the
river in `row` between columns `from` and `to`; add `speed` to change how fast).

Factory levels can have slime machines with
`slimeMachines: [{ at: [11, 8], shot: 'left', platform: { from: [13, 2], to: [10, 11], width: 4 } }]`
(the machine `N` at column 11, row 8 takes slime shots on its left side; its platform of `n`
blocks moves from `from` to `to`). The big machine boss is `boss: 'machine'`, with `R` at its
mouth, `button: [col, row]` and the columns of its crushers in `crushers: [10, 15]`.

Sky City levels can have hot air balloons with
`balloons: [{ path: [[17, 11], [17, 3], [30, 3], [30, 5]] }]` (the basket waits at the first
point, carries you along the path and drops you off at the last one), rainbow slides with
`rainbows: [{ from: [39, 8], to: [50, 8] }]` (touch the `from` end to zoom over to `to`) and
floating islands with `islands: [{ from: [26, 9], to: [31, 9], width: 3 }]` (the island's left
tile floats back and forth between `from` and `to`, sideways or up and down; add `speed` to change
how fast). Kites (`k`) need `wind`: it pulls them along, and they sink slowly while it's calm.

Every row of a map must be the same length. Then run `npm test`: the tests play every level
automatically and tell you if the exit or any token can't be reached.
