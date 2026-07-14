# web-designer

Here is the concrete, buildable plan to elevate the 53s vertical film into the hero without sacrificing the existing machine card or triggering layout shifts during the upcoming video capture.

### 1. WEB DESIGNER (DOM & Grid Layouts)
The native 9:16 vertical format (1080x1920) is severe. Scaling it to fit a 400px column makes it 711px tall, breaking the fold. Instead of fighting the aspect ratio, we leverage it. 

Here are three concrete layout options to integrate a new `.hero-film` node alongside `.hero-sys`.

**Option A: The Flat Triptych (Recommended)**
Flatten the hierarchy. Turn the 2-column grid into a 3-column grid, making the film a bridge between the left text and the right machine.
*   **CSS:** Update `.hero-grid` to `grid-template-columns: minmax(0, 1fr) 260px 400px; gap: 48px;`. 
*   **DOM:** Insert `<a class="hero-film sys-card">` directly between `.hero-main` and `.hero-sys`.
*   **Sizing:** The film card is `width: 100%; aspect-ratio: 9/16;` (yielding a perfectly managed 462px height). 
*   **Mobile (<=1120px):** Single column. `order: 1` (Main), `order: 2` (Film), `order: 3` (Machine). The `-8vh` overlap moves to `.hero-film`, letting it peek up behind the CTA.

**Option B: The Expanded Diptych Container**
Keep `.hero-grid` as two columns but expand the right column to hold a sub-grid of both assets. 
*   **CSS:** `.hero-grid { grid-template-columns: minmax(0, 1fr) min-content; gap: 64px; }`
*   **DOM:** Wrap the right side in `<div class="hero-diptych">` containing both the film and the machine.
*   **Sub-grid:** `.hero-diptych { display: flex; gap: 24px; align-items: flex-end; }`. The film is `width: 240px`, the machine card remains `width: 400px`. Total right-rail width: 664px. 
*   **Advantage:** Visually groups the two visual proofs ("The Output" and "The Engine") away from the text.

**Option C: The Editorial Overlap (Z-Axis)**
Keep the grid exactly as it is (`1fr 400px`). Float the vertical video so it breaks the grid, overlapping the gap.
*   **CSS:** `.hero-grid` stays unchanged. The right column becomes `position: relative`. `.hero-film` gets `position: absolute; left: -140px; top: 64px; width: 220px; z-index: 10;`. 
*   **Advantage:** Highly editorial, looks like physical polaroids/receipts stacked on a desk. Uses the 64px gap as free real estate. 

### 2. VISUAL DESIGNER (Aesthetic System)
To prevent the film from looking like a bolted-on YouTube embed, it must be ingested into the site's "engraved/receipt" aesthetic and share the exact same CSS class architecture (`.sys-card`) as the machine illustration.

*   **Filter & Hover:** Apply `filter: grayscale(1) contrast(1.1) brightness(0.9); transition: filter 0.4s ease;` to the film's poster. On hover, it clears to full color to match the machine cinemagraph.
*   **Play Indicator:** Center a minimal, crosshair-style SVG play button in bone-cream over the poster. On hover, the play button's `fill` or `stroke` snaps to the oxblood/rust accent (`#8a2e2e` or similar).
*   **Chrome:** Wrap the video in a 1px solid border (`rgba(245, 245, 240, 0.15)`). 
*   **Typography:** The film gets a `.sys-k` top label ("PICTURELOCK: OUTPUT") and a `.sys-cap` bottom caption matching the machine ("53s FILM // DEMO REEL ->"). All JetBrains Mono, 11px, `letter-spacing: 0.05em`.

### 3. MOTION / ANIMATOR (The Capture Constraint)
The video capture crew requires the hero to be visually settled within 1-2 seconds. **Do not autoplay the 53s film.** An autoplaying 53s video triggers network buffering (layout shift risk) and draws the eye aggressively away from the H1.

*   **Choreography:** 
    *   `0.0s`: Left column text is visible.
    *   `1.0s`: BOTH the `.hero-sys` and `.hero-film` cards fade in exactly simultaneously (`opacity: 0` to `1`, `transform: translateY(10px)` to `0`, duration `0.8s ease-out`). 
*   **The Player:** Use a static `<img class="film-poster">` or a `<video poster="...">` with `preload="none"`. This guarantees zero DOM reflows and instantaneous rendering for the screen capture. 
*   **Interaction:** Clicking the card triggers a full-screen, near-black modal takeover where the 53s vertical film plays with audio. 

### 4. VIDEOGRAPHER (Asset Handling)
*   **Crop Strategy:** Do not apply a lossy horizontal crop to a native 9:16 film just to fit standard div blocks. Lock the container to `aspect-ratio: 9/16` and use the existing `assets/posters/home-picture-lock.jpg` as the vertical poster. 
*   **Placement of the 92s Landscape Explainer:** Keep it off the front page. The front page hero is for the visceral *proof* (the 53s output). Move the 92s explainer to an `/about.html` or dedicated `/teardown.html` page where users have explicitly opted in for a deep-dive. 

### 5. GRAPHICS / BRAND (Unifying the Proofs)
We tie the machine and the film together through a "Diptych" concept: **The Engine** and **The Output**.
*   They are two halves of the same promise. By giving both cards identical JetBrains Mono receipt headers—`.sys-k` containing "THE ENGINE" on the 400px card, and "THE OUTPUT" on the 9:16 film card—they stop fighting for dominance. 
*   They read left-to-right as a logical sequence: *Here is the finished 53s film (Output), and right next to it is the API pipeline that built it (Engine).* 

**Recommendation to Mitchell:** Execute **Option A (The Flat Triptych)** with the static poster and oxblood crosshair play button. It requires changing exactly one line of grid CSS, injects the vertical film without a single layout shift, and guarantees the capture crew gets a flawless, instantly-loaded, editorial hero.
