# Groundmasters — card design directions

Five proposed designs for the first Special edition, the one-off
"Groundmasters" cards for the Players who helped renew the pitch agreement.
The product rules, the integration proposal and the open decisions are in
[`docs/ROADMAP.md`](../../docs/ROADMAP.md), "Groundmasters — the first Special
edition". **Nothing here is built, and no direction has been chosen yet.**

| Artboard | Direction |
|---|---|
| `Reference.dc.html` | Today's Live tiers (Common to Holo), for comparison |
| `Main.dc.html` | 1 · Mown stripes: the pitch itself |
| `Deed.dc.html` | 2 · The agreement: the signed renewal |
| `Keys.dc.html` | 3 · Keys to the ground: enamel and brass |
| `Honours.dc.html` | 4 · Honours board: mahogany and gilt |
| `Plan.dc.html` | 5 · Site plan: a cyanotype drawing |

Each direction shows the Groundmaster at detail size (with a "No. 04 / 10"
serial, toggled by the `showSerial` tweak), two Groundmasters at collection
size, and the same Player's **unchanged** Live card for comparison.

Assumptions in the mocks: invented Players from
`design/midweek/sample-tournament.json`; each Groundmaster rated at Live OVR +8;
2026 as the issue year. The pack reveal, uploaded photos and the Midweek mini
card are not mocked yet.

## Regenerating

```sh
node design/groundmasters/build/build.mjs
```

The generator renders the real `LiveCard` and `src/app/globals.css` through
`design/midweek/build/source.mjs`, then re-dresses each card through a
`data-gm` attribute styled in `build/gm.css`. Edit the generator, not the
`.dc.html` files. `canvas.json` is the Claude Design canvas index (v3).
