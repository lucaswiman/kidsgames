# Slimy Stretch

A game designed by Berty. You're a see-through green slime that **can't jump**. Drag part of the
slime to stretch it; let go next to a wall and it sticks, let go in the air and it boings back.
Climb like an inchworm!

- **The Lab:** lasers and water
- **The Tundra:** ice walls you can't stick to, and a giant snowball
- **The Volcano:** lava, and a robot boss that throws bombs (grab one and flick it back!)
- **The Canyon:** crumbling rocks, wind gusts, falling boulders, colored keys and laser gates, and
  metal boxes you eat with your tongue

Bosses only show up in worlds that are multiples of 3. Beating a boss gives the slime a new
ability: the robot gives you a **tongue**. Tap 👅, then drag to stick it out and eat metal boxes.

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
| `.`    | empty space                                       |

To put something inside metal boxes, add `boxItems` to the level, listing what's in each box in
reading order, for example `boxItems: [null, 'token', 'key-blue', 'core']`. Add
`wind: { every: 5, gust: 2, strength: 90, dir: 1 }` for wind gusts.

Every row of a map must be the same length. Then run `npm test`: the tests play every level
automatically and tell you if the exit or any token can't be reached.
