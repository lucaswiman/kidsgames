# Slimy Stretch

A game designed by Berty. You're a see-through green slime that **can't jump**. Drag part of the
slime to stretch it; let go next to a wall and it sticks, let go in the air and it boings back.
Climb like an inchworm!

- **The Lab:** lasers and water
- **The Tundra:** ice walls you can't stick to, and a giant snowball
- **The Volcano:** lava, and a robot boss that throws bombs (grab one and flick it back!)

## Running it

```bash
npm install
npm run dev     # play at http://localhost:5173 (add ?all to unlock every level)
npm test        # run the tests
npm run build   # build the website into dist/
```

It deploys with the rest of the repo to GitHub Pages at `slimy-stretch/`.

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
| `.`    | empty space                                       |

Every row of a map must be the same length. Then run `npm test`: the tests play every level
automatically and tell you if the exit or any token can't be reached.
