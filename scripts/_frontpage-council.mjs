// Frontpage hero council: fan a real brief (current hero markup/CSS, the two
// picture-lock videos, the .hero-sys cinemagraph that must survive) out to five
// expert lenses, then an Opus adjudicator synthesizes ONE buildable spec.
// Usage: node scripts/_frontpage-council.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, renameSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const OUT = 'output/design-council-hero';
const STAGE = `${OUT}.staging-${process.pid}`;
mkdirSync(STAGE, { recursive: true });
const env = p => existsSync(p) ? readFileSync(p, 'utf8') : '';
const CAREER = env(join(homedir(), 'Documents', 'career-ops', '.env'));
const LOCAL = env('.env');
const get = (src, k) => src.match(new RegExp(`^${k}=([^#\\n]+)`, 'm'))?.[1]?.trim();
const GEMINI = get(LOCAL, 'GEMINI_API_KEY') ?? get(CAREER, 'GEMINI_API_KEY');
const OPENAI = get(LOCAL, 'OPENAI_API_KEY') ?? get(CAREER, 'OPENAI_API_KEY');
const ANTHROPIC = get(LOCAL, 'ANTHROPIC_API_KEY') ?? get(CAREER, 'ANTHROPIC_API_KEY');
const OPUS = get(LOCAL, 'ANTHROPIC_MODEL_OPUS') ?? get(CAREER, 'ANTHROPIC_MODEL_OPUS') ?? 'claude-opus-4-7';
const GPT = get(LOCAL, 'OPENAI_MODEL_PRO') ?? get(CAREER, 'OPENAI_MODEL_PRO') ?? 'gpt-5.5-pro';
const GEMINI_MODEL = 'gemini-3.1-pro-preview';

const CONTEXT = `SITE: thestorytellermitch.com, Mitchell Williams' portfolio. Hand-built HTML/CSS/JS, no framework. Engraved/editorial aesthetic: near-black bg, bone-cream text, one oxblood/rust accent, JetBrains Mono for data/labels, Archivo for display type. Every claim on the site links to a source; captions say how illustrations were made.

CURRENT HERO (index.html, header#top > .wrap > .hero-grid, two columns: minmax(0,1fr) 400px, gap 64px):

LEFT (.hero-main): kicker "Mitchell Williams · Production AI since 2024", h1.display "Forward / deployed (accent) / creative.", three .hero-sub paragraphs, .hero-facts (three label/value rows: Current search, Core proof, Logistics), .hero-cta (three buttons: "See the work", "Resume by role", "Role fit"), .hero-routes nav ("Reviewing for a specific role? The role-fit page routes you").

RIGHT (.hero-sys, a single <a href="picture-lock.html"> card, 400px wide, opacity-staged in on a ~1s delay after the left column, "the machine wakes" per an existing code comment):
- .sys-cine: a looping cinemagraph video (desktop: assets/cinemagraphs/hero-machine-plate-loop.mp4/.webm, mobile: hero-machine-plate-loop-m.mp4/.webm) of an exploded technical illustration of picture-lock as a machine (seven chambers process voice/film/score/sound, a finished short comes out), grayscale(0.12) contrast(1.03) filter that clears to full color/contrast on hover, height 190px, object-fit cover.
- .sys-body: .sys-k header row ("PICTURELOCK" / "RUN RECEIPT $8.26"), a .sys-diagram (monospace ASCII pipeline diagram: input/script.md -> voiceover/visuals/score/sfx -> assemble -> short.mp4 -> dub -> short.es.mp4), .sys-cap caption ("One script in, a produced short out. Every API call logged and costed. See the teardown ->").

MOBILE (<=1120px): .hero-grid collapses to one column, .hero-sys gets max-width 520px and margin-top:-8vh so it peeks up into the first viewport under the CTA row (which gets z-index 2 and its own background so it never loses legibility to the overlap). DOM order is unchanged: H1 always first.

MITCHELL'S HARD CONSTRAINT: he loves .hero-sys (the machine cinemagraph card) and it must not be degraded, hidden by default, or removed. Whatever you propose must keep that machine illustration/animation meaningfully present and readable in the initial hero view, not demoted to a footnote.

THE ASSET BEING ADDED: assets/picture-lock-short-n16.mp4, a 53-second VERTICAL (1080x1920) product-demo film -- picture-lock demoing itself, script to produced short, already used elsewhere on the site as a horizontal-cropped tile with poster assets/posters/home-picture-lock.jpg. Mitchell has confirmed: THIS 53s vertical film is the one that headlines the front-page hero (not the separate 92-second landscape explainer, which needs a different home elsewhere on the site -- you may suggest where, e.g. an about page or a dedicated "how this site works" section, but that placement is secondary to your hero answer).

THE PROBLEM: today this 53s film only appears as a small tile below the fold, in section#ai-native's film grid. Mitchell wants it elevated into a featured, premium position in the hero itself, sharing space with (not replacing/hiding) the .hero-sys machine card. The film is VERTICAL 1080x1920 -- a real constraint against a 400px-wide right column and a wide left column; a naive drop-in will either crop badly or blow out the layout.

CAPTURE CONSTRAINT: a video crew will do a slow push-in screen capture of this hero within days of launch (for a separate explainer video that references "the film on this site's front page"). The hero must look intentional and complete within the first few seconds of any capture -- no layout shift, no pop-in, no autoplay-then-jarring-crop. Whatever enters on load should already be settled by ~1-2s.

FIVE-LENS BRIEF -- answer from YOUR lens specifically:
- WEB DESIGNER: propose 2-3 concrete DOM/grid layout options for fitting a 400px-column machine card AND a vertical 53s film into the existing two-column hero without breaking .hero-routes/.hero-cta or pushing the fold down badly. Consider: three-column hero, tabbed/toggle card (machine <-> film) in the same 400px slot, a taller right column with both stacked, a bleed treatment for the vertical video, etc.
- VISUAL DESIGNER: how does the film's poster/thumbnail/frame treatment match the engraved aesthetic (grayscale-clears-on-hover like the machine art, a receipt-style caption matching .sys-cap, oxblood accent usage) so it reads as one system with the machine card, not a bolted-on video player.
- MOTION/ANIMATOR: the entrance choreography -- how the film and the machine card share the "two-act" reveal (left column ~0-0.5s, right column wakes ~1s) without competing for attention or causing a jump cut when the film's own video starts playing. Should the film autoplay muted/loop like a cinemagraph, or use a static poster + play-on-hover/click? Address the capture constraint explicitly (settled by 1-2s).
- VIDEOGRAPHER: given the film is native VERTICAL 1080x1920, what's the least-lossy way to feature it in a hero card (crop strategy, safe-crop framing since you don't have the source shot list, letterbox vs crop vs a portrait-shaped card carved out of the grid, whether a horizontal re-crop already exists site-wide that should be reused) -- and whether autoplay-muted-loop vs poster-click is right for a 53s clip specifically (too long to loop ambiently vs a cinemagraph).
- GRAPHICS/BRAND: is there a unifying visual/verbal device that ties the machine card and the film together as "one hero, two proofs" (e.g. a shared card chrome, a toggle/tab label pattern, a shared run-receipt style caption on both) so it doesn't read as two unrelated widgets glued together.

Be concrete and buildable -- reference actual CSS properties, class names you'd add, and rough dimensions. No fluff, no restating the brief back.`;

async function retry(name, fn, tries = 3) {
  for (let a = 1; ; a++) { try { return await fn(); }
    catch (e) { if (a >= tries) throw e; console.log(`${name} try ${a}: ${String(e).slice(0,200)}`); await new Promise(r=>setTimeout(r,15000*a)); } }
}

for (const [name, key] of [['GEMINI_API_KEY', GEMINI], ['OPENAI_API_KEY', OPENAI], ['ANTHROPIC_API_KEY', ANTHROPIC]]) {
  if (!key) throw new Error(`${name} not found in .env or ~/Documents/career-ops/.env`);
}

const lensPrompt = (role) => `You are a senior ${role}. ${CONTEXT}`;

const nonEmpty = (name, t) => { if (!t || !t.trim()) throw new Error(`${name} returned empty`); return t; };
const gemini = (prompt) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
  method:'POST', headers:{'Content-Type':'application/json','x-goog-api-key':GEMINI}, signal:AbortSignal.timeout(300000),
  body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})}).then(async r=>{ if(!r.ok) throw new Error('gemini '+r.status+await r.text()); const j=await r.json();
    if (!j.candidates?.length) throw new Error('gemini blocked: '+(j.promptFeedback?.blockReason||'unknown'));
    return nonEmpty('gemini', j.candidates[0].content.parts.map(p=>p.text||'').join('')); });
const gpt = (prompt) => fetch('https://api.openai.com/v1/responses', {
  method:'POST', headers:{'content-type':'application/json',authorization:`Bearer ${OPENAI}`}, signal:AbortSignal.timeout(300000),
  body:JSON.stringify({model:GPT,input:[{role:'user',content:[{type:'input_text',text:prompt}]}]})}).then(async r=>{ if(!r.ok) throw new Error('gpt '+r.status+await r.text()); const j=await r.json(); return nonEmpty('gpt', j.output_text ?? j.output.flatMap(o=>o.content??[]).filter(c=>c.type==='output_text').map(c=>c.text).join('')); });
const opus = (prompt) => fetch('https://api.anthropic.com/v1/messages', {
  method:'POST', headers:{'content-type':'application/json','x-api-key':ANTHROPIC,'anthropic-version':'2023-06-01'}, signal:AbortSignal.timeout(300000),
  body:JSON.stringify({model:OPUS,max_tokens:4000,messages:[{role:'user',content:prompt}]})}).then(async r=>{ if(!r.ok) throw new Error('opus '+r.status+await r.text()); const j=await r.json(); return nonEmpty('opus', j.content.filter(b=>b.type==='text').map(b=>b.text).join('')); });

// five lenses distributed across three model backends (each backend covers ~2 lenses)
const panel = [
  ['web-designer', () => gemini(lensPrompt('web designer'))],
  ['visual-designer', () => gpt(lensPrompt('visual designer'))],
  ['motion-animator', () => opus(lensPrompt('motion designer / animator'))],
  ['videographer', () => gemini(lensPrompt('videographer / video editor'))],
  ['graphics-brand', () => gpt(lensPrompt('graphic designer specializing in brand systems'))],
];

const results = await Promise.allSettled(panel.map(async ([n,f])=>{ const t=await retry(n,f); writeFileSync(join(STAGE,`${n}.md`),`# ${n}\n\n${t}\n`); console.log(`OK ${n} (${t.length}b)`); return {n,t}; }));
const ok = results.filter(r=>r.status==='fulfilled').map(r=>r.value);
results.forEach((r,i)=>{ if(r.status==='rejected') console.log(`FAIL ${panel[i][0]}: ${String(r.reason).slice(0,200)}`); });
console.log(`\n${ok.length}/${panel.length} lenses responded`);

if (ok.length) {
  const combined = ok.map(o=>`### ${o.n}\n${o.t}`).join('\n\n---\n\n');
  const ADJ = `You are the adjudicator for a five-lens design council on Mitchell Williams' portfolio site frontpage hero. Below are ${ok.length} lens proposals (web designer, visual designer, motion/animator, videographer, graphics/brand) for the same brief: feature a 53-second VERTICAL picture-lock demo film in a premium position in the hero, alongside (never hiding or degrading) the existing .hero-sys machine-cinemagraph card that Mitchell explicitly loves.

${CONTEXT}

PROPOSALS:

${combined}

Read them all, then output ONE final, buildable synthesis:
1. THE LAYOUT DECISION: pick or synthesize the best hero layout (name it). Justify in 2-3 lines against the alternatives, specifically on: keeps .hero-sys fully present and undiminished, handles the vertical 53s asset without ugly cropping, doesn't blow the fold on desktop or mobile, settles within 1-2s for a clean screen capture.
2. PRECISE BUILD SPEC: exact DOM structure changes to index.html's .hero-grid (new class names, where they nest), the CSS needed (grid-template-columns changes, new component classes with concrete property values, mobile breakpoint behavior at the existing 1120px cutoff), and the entrance choreography (what animates when, in what order, referencing the existing two-act timing: left column ~0-0.5s, right column ~1s).
3. AUTOPLAY DECISION for the 53s film: autoplay-muted-loop, poster+click-to-play, or poster+hover-preview -- pick one and say why, accounting for the screen-capture constraint (must look complete/intentional within 1-2s of load).
4. WHERE THE 92-SECOND LANDSCAPE EXPLAINER GOES: Mitchell asked for a recommendation on a secondary home for it elsewhere on the site (not the hero). Give one concrete recommendation with a reason.
5. Note any proposals you rejected and why, in one line each.

Be concrete and implementation-focused. An engineer should be able to build this directly from your answer.`;
  const final = await retry('adjudicator', ()=>opus(ADJ));
  writeFileSync(join(STAGE,'ADJUDICATED.md'),`# Adjudicated frontpage hero spec\n\n${final}\n`);
  console.log('\n===== ADJUDICATED =====\n'+final);
}
// publish atomically: only replace the last run's output once this run is done
rmSync(OUT, { recursive: true, force: true });
renameSync(STAGE, OUT);
console.log('done');
