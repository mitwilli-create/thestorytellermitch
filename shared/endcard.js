// shared/endcard.js - end-of-playback card for the site's players.
// Any <video data-endcard> gets an overlay when its cut finishes ('ended'):
// the review-path CTA in the sitewide button grammar (same copy and classes
// as the index hero). The card hides the moment playback restarts or the
// viewer scrubs away from the end, so replays stay unobstructed. Injected
// only from here: no-JS pages keep the plain final frame. Styles live in
// shared/theme.css (.endcard); the video's parent box supplies the
// position:relative frame (.cs-video, .wt-frame).
(() => {
  document.querySelectorAll('video[data-endcard]').forEach(video => {
    const host = video.parentElement;
    if (!host) return;
    let card = null;
    const show = () => {
      if (!card) {
        card = document.createElement('div');
        card.className = 'endcard';
        const cta = document.createElement('a');
        cta.className = 'btn solid';
        cta.href = 'for-elevenlabs.html';
        const label = document.createElement('span');
        label.textContent = 'Start the 12-minute review path';
        cta.appendChild(label);
        card.appendChild(cta);
        host.appendChild(card);
      }
      card.classList.add('is-on');
      card.querySelector('a').focus({ preventScroll: true });
    };
    const hide = () => { if (card) card.classList.remove('is-on'); };
    video.addEventListener('ended', show);
    video.addEventListener('play', hide);
    video.addEventListener('seeking', hide);
  });
})();
