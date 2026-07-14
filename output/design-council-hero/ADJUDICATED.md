# Adjudicated frontpage hero spec

> Raw council output, kept for provenance. The shipped implementation
> (index.html, systems.html) deviates in specifics: it reuses the site's
> existing `.film[data-clip]` tile + shared theater (shared/clipplay.js)
> instead of the bespoke `.sys-card`/`<dialog>` markup sketched below, since
> that sitewide contract already implements poster/hover-preview/click-to-play
> and is accessibility-tested. Layout decision, autoplay policy, and the
> 92s explainer's placement recommendation all held; only the DOM/class
> names differ from what's implemented.

# FINAL SYNTHESIS — Mitchell Williams Hero, Two-Proof Build Spec

## 1. THE LAYOUT DECISION: "The Portrait Diptych" (3-column asymmetric hero)

Change `.hero-grid` from `minmax(0,1fr) 400px` to a **three-column asymmetric grid: `minmax(0, 1fr) 240px 400px`, gap 48px.** The 240px middle column holds a new `.hero-film` card in native 9:16 (~426px tall); the 400px right column keeps `.hero-sys` completely unchanged.

**Why this beats the alternatives:**
- **Machine card is untouched** — same 400px width, same cinemagraph, same wake behavior. Mitchell's hard constraint is honored literally, not just in spirit.
- **Native 9:16 at 240px = zero crop.** A vertical software demo shown vertical. No `object-fit: cover` amputating UI, no forced 16:9 re-crop, no letterbox.
- **Fold is safe.** Film card height (~426px) is *shorter* than the machine card (~460px including chrome), so the right side of the hero doesn't grow taller than it is today. Left column's facts+CTAs+routes remain the height driver.
- **Reads as a sequence.** Left: thesis. Middle: the output. Right: the engine. Left-to-right narrative.

## 2. PRECISE BUILD SPEC

### DOM (index.html, inside `header#top > .wrap`)

```html
<div class="hero-grid">
  <div class="hero-main"><!-- unchanged --></div>

  <a class="hero-film sys-card" href="picture-lock.html" aria-label="Play PictureLock demo film, 53 seconds">
    <div class="film-k sys-k">
      <span>PICTURELOCK · OUTPUT</span>
      <span class="accent">00:53</span>
    </div>
    <div class="film-media">
      <img class="film-poster" src="assets/posters/hero-picture-lock-vertical.jpg" alt="">
      <video class="film-video"
             src="assets/picture-lock-short-n16.mp4"
             muted playsinline preload="metadata"></video>
      <span class="film-play" aria-hidden="true">▶</span>
    </div>
    <div class="film-cap sys-cap">Script in, produced short out. Watch the 53s cut →</div>
  </a>

  <a class="hero-sys" href="picture-lock.html"><!-- unchanged --></a>
</div>
```

Both cards share the `.sys-card` class (new — extract the current `.hero-sys` chrome into it) and the `.sys-k` / `.sys-cap` header/caption pattern. This is the brand device that ties them together.

### CSS

```css
/* GRID */
.hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 240px 400px;
  gap: 48px;
  align-items: start;
}

/* SHARED CARD CHROME */
.sys-card {
  display: block;
  border: 1px solid rgba(245, 240, 225, 0.14);
  background: rgba(0,0,0,0.35);
  text-decoration: none;
  color: inherit;
}
.sys-k {
  display: flex; justify-content: space-between;
  font: 11px/1 "JetBrains Mono", monospace;
  letter-spacing: 0.05em; text-transform: uppercase;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(245,240,225,0.10);
}
.sys-k .accent { color: var(--oxblood); }
.sys-cap {
  font: 12px/1.4 "JetBrains Mono", monospace;
  padding: 10px 12px; color: rgba(245,240,225,0.72);
}

/* FILM CARD */
.hero-film { display: flex; flex-direction: column; }
.film-media {
  position: relative;
  aspect-ratio: 9 / 16;   /* 240px × ~426px, native, no crop */
  overflow: hidden;
  background: #000;
}
.film-poster, .film-video {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover;      /* safe: box IS 9:16, so this is a no-op */
  filter: grayscale(0.12) contrast(1.03);
  transition: filter 400ms ease-out, opacity 300ms ease-out;
}
.film-video { opacity: 0; }
.film-play {
  position: absolute; inset: 0; margin: auto;
  width: 44px; height: 44px; display: grid; place-items: center;
  color: var(--bone); background: rgba(0,0,0,0.35);
  border: 1px solid rgba(245,240,225,0.5);
  border-radius: 50%; font-size: 14px;
  transition: color 200ms, border-color 200ms;
}
.hero-film:hover .film-poster,
.hero-film:hover .film-video,
.hero-sys:hover .sys-cine video {
  filter: grayscale(0) contrast(1);
}
.hero-film:hover .film-video { opacity: 1; }
.hero-film:hover .film-play { color: var(--oxblood); border-color: var(--oxblood); }

/* ENTRANCE — three-act reveal */
.hero-sys  { animation: wake 450ms ease-out 550ms both; }
.hero-film { animation: wake 450ms ease-out 1100ms both; }
@keyframes wake {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .hero-sys, .hero-film { animation: none; opacity: 1; transform: none; }
}

/* MOBILE */
@media (max-width: 1120px) {
  .hero-grid { grid-template-columns: 1fr; gap: 32px; }
  .hero-film, .hero-sys {
    max-width: 520px; width: 100%; justify-self: center;
    animation: none; opacity: 1; transform: none;
  }
  .hero-film { max-width: 320px; margin-top: 8px; }
  .hero-sys  { margin-top: -8vh; }   /* preserve existing peek */
  .film-video { display: none; }     /* poster-only on touch; tap routes to picture-lock.html */
}
```

### Entrance choreography (three-act, all settled by 1.55s)

- **t=0.00s** — Left column renders (unchanged).
- **t=0.55s** — `.hero-sys` fades + translates in (450ms). Cinemagraph starts looping. "The machine wakes" — preserved verbatim.
- **t=1.10s** — `.hero-film` fades + translates in (450ms). Poster only, no playback.
- **t≈1.55s** — Fully settled. Capture crew's push-in from ~2s onward sees a static, intentional composition with one point of ambient motion (the machine loop).

## 3. AUTOPLAY DECISION: **Poster + hover-preview + click-to-full**

- **Static poster on load** (an actual frame exported from the film at ~t=6s, color-graded to match the engraved palette so grayscale(0.12) sits on already-quiet pixels). Guarantees zero buffer flash, zero layout shift, zero mid-scene dropping — the capture crew gets a clean take at 2s every time.
- **Hover crossfades to muted inline preview** (video seeks to a curated in-point, plays muted, resets on mouseleave). Feels alive without competing with the cinemagraph for narrative attention.
- **Click opens the 53s film full in a `<dialog>` lightbox with sound** — the native 9:16 gets its proper viewing venue.
- **Autoplay-loop rejected:** a 53s narrative demo playing ambiently next to a real cinemagraph turns the hero into a TV showroom, and a push-in that lands mid-scene at ~t=34s is unusable B-roll. The machine card owns ambient motion; the film card owns on-demand proof. Clear division of labor.

## 4. THE 92-SECOND LANDSCAPE EXPLAINER

Place it as the masthead video of a new **`/how-this-site-works.html`** page (or a `<section id="teardown">` at the top of an about/colophon page), linked from the existing `.sys-cap` "See the teardown →" copy that's already in the machine card. That link is currently pointing at `picture-lock.html`; retarget the machine card's caption to the teardown page and let the 92s landscape film be the hero of *that* page. It's the natural home: users who click "teardown" have opted into a long-form architectural explainer, which is exactly what a 92s landscape cut is for.

## 5. REJECTED PROPOSALS (one line each)

- **Tabbed toggle machine↔film in one 400px slot** — hides one proof behind the other, violates Mitchell's constraint and adds a click-driven motion event that breaks the 1-2s settle rule.
- **Editorial overlap / absolute-positioned floating film (Web Designer Option C)** — visually cute but fragile at responsive breakpoints and hostile to the capture crew's clean framing.
- **Expanded diptych container at 664px right rail (Web Designer Option B)** — compresses the left column's text measure and pushes the H1 into awkward line breaks.
- **Safe-crop 16:9 stack (Videographer Option B)** — forces a horizontal re-crop of a native vertical asset just to fit an existing grid; concedes the whole point of featuring the vertical film.
- **Autoplay-muted-loop the 53s film** — kills the machine card's ambient authority, guarantees a mid-scene freeze frame for the capture crew.
- **Ken Burns / auto push-in on the poster** — competes with the real camera crew's actual push-in.
