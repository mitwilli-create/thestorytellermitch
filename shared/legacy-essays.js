/* Preserve essay links printed in earlier application attachments. */
(() => {
  const destinations = {
    '#chinese-models': 'https://storytellermitch.substack.com/p/are-chinese-models-cheaper',
    '#executive-voice': 'https://storytellermitch.substack.com/p/i-engineered-a-vps-voice-the-ai-infrastructure',
    '#what-do-ai-employees-know': 'https://storytellermitch.substack.com/p/what-do-ai-employees-know-about-using'
  };
  function followEssay() {
    const destination = destinations[location.hash];
    if (destination) location.replace(destination);
  }
  window.addEventListener('hashchange', followEssay);
  followEssay();
})();
