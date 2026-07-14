# motion-animator

# MOTION/ANIMATOR LENS — Entrance choreography for the two-proof hero

## The core problem I'm solving

You already have a working two-act reveal: left column paints ~0–0.5s, `.hero-sys` opacity-stages in ~1s later ("the machine wakes"). Dropping a 53s vertical film into that same viewport gives me a **third motion event competing for the same 2-second attention window**, and the film's own internal motion (script-to-short demo) will fight the cinemagraph's ambient loop. Plus the capture crew is doing a slow push-in — so anything that pops, shifts, or first-frame-flashes at 3s ruins their take.

Here's the choreography.

---

## Recommended structure (assumes Web Designer's "stacked right column" option)

Right column becomes:
- `.hero-sys` (machine card, unchanged, ~360–400px tall)
- `.hero-film` (new, vertical film card, ~360–420px tall, portrait 9:16-ish crop)

Both live in a single 400px column. Total right-column height ≈ 740–820px, which is fine because the left column's facts+CTAs+routes are similarly tall.

---

## The three-act reveal (revised from your current two-act)

```
t=0.00s   left column paints (kicker, h1, sub, facts, CTAs, routes)
          — unchanged from today
t=0.55s   .hero-sys fades in (opacity 0→1, translateY 8px→0, 450ms ease-out)
          cinemagraph <video> begins playing immediately, muted, loop
          this preserves "the machine wakes" — do not touch it
t=1.10s   .hero-film fades in (same transform curve, 450ms)
          BUT video element is NOT yet playing — poster frame only
t=1.55s   film card fully settled, still on poster. Capture-safe.
t=1.55s+  ambient behavior kicks in (see below)
```

Everything is settled by **~1.55s**. Push-in captures from 2s onward see a static, intentional composition.

### CSS for the stagger

```css
.hero-sys  { animation: wake 450ms ease-out 550ms both; }
.hero-film { animation: wake 450ms ease-out 1100ms both; }

@keyframes wake {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .hero-sys, .hero-film { animation: none; opacity: 1; }
}
```

---

## The autoplay question for the 53s film — DO NOT loop it ambiently

Strong recommendation: **poster + hover-to-preview + click-to-play-full**. Reasons specific to motion:

1. **A 53s film is not a cinemagraph.** The machine card's loop is 4–8s of subtle, non-narrative motion — it reads as ambient texture. A 53-second narrative product demo playing on loop next to it turns the hero into a TV showroom. Two moving things in the same eye-path both demanding narrative attention = viewer looks at neither.

2. **The capture crew.** A slow push-in over 8–15s that lands on a film mid-scene (say, at the 34s mark showing a random UI beat) is unusable B-roll. A static, engraved poster frame with a subtle play affordance is a hero shot.

3. **The machine card owns "ambient motion." The film card owns "on-demand proof."** This is your visual/verbal division of labor — the animator's job is to enforce it.

### The hover-preview behavior

```css
.hero-film-video {
  opacity: 0;
  transition: opacity 300ms ease-out;
}
.hero-film:hover .hero-film-video,
.hero-film:focus-within .hero-film-video {
  opacity: 1;
}
```

On hover/focus:
- Poster fades out over 300ms
- `<video>` fades in, `play()` called via JS, muted, starts from `currentTime = 0` (or from a curated in-point like 6s where the script-to-visuals beat hits — pick a frame that reads as "the machine is working")
- On mouseleave: `pause()`, reset `currentTime = 0`, fade poster back in

On click: routes to `picture-lock.html` (or opens a lightbox with sound — your call, but the hero card itself is not the viewing venue for a 53s film).

### Grayscale-clears-on-hover parity

Match the machine card exactly. Both cards share:

```css
.hero-sys .sys-cine video,
.hero-film .hero-film-poster,
.hero-film .hero-film-video {
  filter: grayscale(0.12) contrast(1.03);
  transition: filter 400ms ease-out;
}
.hero-sys:hover .sys-cine video,
.hero-film:hover .hero-film-poster,
.hero-film:hover .hero-film-video {
  filter: grayscale(0) contrast(1);
}
```

Same curve, same duration. That's the motion signature that says "one system, two proofs."

---

## Avoiding the jump-cut on hover

The failure mode: user hovers, poster snaps to black, video pops in on frame 1 with a compression artifact. Fix:

1. **Preload the video** — `<video preload="metadata">` on desktop, `preload="none"` on mobile (data cost).
2. **Cross-fade, don't cut.** Poster and video are stacked absolutely; both are visible during the 300ms crossfade. The video's opacity ramps 0→1 while poster ramps 1→0.
3. **The poster IS a frame from the film.** Not a designed thumbnail — an actual export from the film at the same timecode you'll `currentTime`-seek to. So when video takes over, the visual is continuous. This is critical.

```html
<div class="hero-film-media">
  <img class="hero-film-poster" src="assets/posters/hero-picture-lock-vertical.jpg" alt="">
  <video class="hero-film-video" 
         src="assets/picture-lock-short-n16.mp4"
         muted playsinline preload="metadata"></video>
  <button class="hero-film-play" aria-label="Play PictureLock demo">▶ 0:53</button>
</div>
```

---

## Mobile (<=1120px)

With single-column collapse and `margin-top: -8vh` on `.hero-sys`, adding `.hero-film` below it means two peek-up cards, which is one too many. Options:

- **Only `.hero-sys` peeks** (preserves your current design). `.hero-film` sits below it in normal flow with a `margin-top: 32px`, poster-only, no hover-preview on touch — tap goes straight to `picture-lock.html`.
- Kill the film's entrance stagger on mobile (`animation: none`) since it's below the fold anyway; it just needs to render, not perform.

```css
@media (max-width: 1120px) {
  .hero-film { animation: none; opacity: 1; }
  .hero-film-video { display: none; } /* poster only on touch */
}
```

---

## The capture-day checklist

Give this to the video crew or verify before they arrive:

- [ ] Load hero, wait 2s, take a still. Nothing should be moving except the machine cinemagraph's slow loop. Film card is on poster.
- [ ] `prefers-reduced-motion` OFF for the capture browser (or the reveal won't happen and they'll capture a static page).
- [ ] Cinemagraph loop point verified — no visible seam at loop restart during a 15s push-in.
- [ ] Film poster is a real frame from the film, color-graded to match the engraved palette (grayscale 0.12 baked in, so it matches even before the CSS filter).
- [ ] Cursor parked off-card so no accidental hover-preview fires mid-take.

---

## What I'm explicitly rejecting

- **Autoplay-loop the 53s film.** Kills the machine card's ambient authority; unusable for capture.
- **Tabbed toggle in one 400px slot** (if Web Designer proposes it). A tab click is a motion event that ruins the "settled by 2s" rule and hides one proof behind the other — Mitchell's constraint says the machine stays visible.
- **Ken Burns / auto push-in on the poster.** The real crew is doing the push-in. Don't compete with them.

The hero's motion story becomes: *left column states the thesis, machine card breathes as proof-of-system, film card waits as proof-of-output.* Three beats, one system, settled in under two seconds.
