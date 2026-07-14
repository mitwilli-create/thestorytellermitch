# videographer

Here is the solution from the **Senior Videographer / Video Editor** lens. 

As an editor, my primary concerns are narrative pacing, safe-action framing (not amputating UI or talking heads with bad CSS crops), and hitting your capture crew's 1-2s "settled" constraint. 

A 53-second product film is a narrative arc, not a texture. It cannot be treated like a looping cinemagraph without ruining the opening hook. Furthermore, a native 9:16 (vertical) film is fundamentally hostile to a horizontal layout block; forcing it into a 16:9 box via `object-fit: cover` will destroy the framing of a software demo.

Here is the buildable execution plan.

### 1. Playback & The Capture Constraint
**Do not autoplay the 53-second film.** 
If you autoplay a 53s narrative clip (even muted), the user reads the H1 for 4 seconds, looks over, and is dropped into the middle of a visual sentence. For the screen capture crew, a loading `video` tag risks a black-frame buffer flash or layout jump right as they push in. 

*   **The Fix:** Use a static poster image (`assets/posters/home-picture-lock.jpg`). 
*   **The Choreography:** Left column fades in at 0s. The right column (both the Film Card and Machine Card) wakes up together at ~1s via your existing `.hero-sys` delay. By 1.5s, the hero is entirely static, settled, and ready for the camera crew.
*   **The Trigger:** Center a prominent oxblood play button on the poster. Playback is intent-based. Clicking triggers a native `<dialog>` modal to play the film uncropped and with sound.

### 2. Crop Strategy & Grid Layout Options
To keep the machine card meaningfully present while adding a vertical video, we have two layout options. 

#### Option A: The 3-Column "True 9:16" (Videographer's Choice)
If we must show the video in its native vertical shape without scaling it to a massive 711px height (which would happen at 400px wide), we change `.hero-grid` to an asymmetric three-column layout. This treats the vertical format as an intentional editorial shape.

*   **Grid CSS:** `grid-template-columns: minmax(0, 1fr) 240px 380px; gap: 48px;`
*   **Column 2 (`.hero-film`):** A 240px wide native portrait card.
    *   Height naturally falls to ~426px (perfect 9:16).
    *   Poster uses `object-fit: cover` but because the box is 9:16, there is zero cropping. Safe-action areas remain perfectly intact.
*   **Column 3 (`.hero-sys`):** Your existing 380-400px machine card, unaltered.
*   **Mobile:** Collapses to 1 column. Order: H1 -> `.hero-film` (max-width: 320px, centered) -> `.hero-sys` (peeking up with negative top margin).

#### Option B: The "Safe-Crop Stack" (Minimal DOM Disturbance)
If you must maintain the strict 2-column grid (`minmax(0,1fr) 400px`), we stack the film *above* the machine card in the right column. 

*   **The Video Compromise:** We *must* use the existing horizontal crop for the poster state to prevent the right column from becoming 1200px tall. 
*   **DOM Structure:** Right column gets a wrapper `.hero-proofs { display: flex; flex-direction: column; gap: 32px; }`.
*   **Top Element (`.hero-film`):** 400px wide by 225px tall (16:9). We use the horizontal `home-picture-lock.jpg` poster. 
*   **Bottom Element (`.hero-sys`):** The existing machine card.
*   **Critical Constraint:** Because we are using a horizontal safe-crop for the thumbnail, **the video cannot play inline**. Clicking the 16:9 poster must open the 9:16 video in a modal lightbox. If you play a 9:16 video inside a 16:9 CSS box, you will cut off the top and bottom 30% of the film, destroying the UI demo.

### 3. Visual Unity (Tying the Proofs Together)
To ensure the film doesn't look like a bolted-on YouTube embed, we run it through the exact same visual pipeline as the machine art.

*   **Filter Match:** Apply `filter: grayscale(0.12) contrast(1.03);` to the film poster, matching `.sys-cine`. Add `transition: filter 0.4s ease;` to clear to full color on hover.
*   **Shared Chrome:** Give the `.hero-film` card a matching header and caption row in JetBrains Mono. 
    *   Header: `div.sys-k > span { content: "DEMO FILM"; } span.accent { color: var(--oxblood); content: "00:53"; }`
    *   This establishes a clear pattern: "Here is the film (53s), and below is the machine that made it (Receipt $8.26)."

### 4. Secondary Video Placement
You mentioned a 92-second landscape explainer. Keep it out of the hero. A 92s landscape deep-dive is mid-funnel content. Place it as the masthead of a dedicated `<section id="architecture">` or an `/about` page where the user has transitioned from "scanning for role fit" to "auditing the tech stack."
