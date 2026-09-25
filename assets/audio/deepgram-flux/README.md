# Flux interruption proof audio

These four clips support the private Deepgram editorial proposal at `private/for-deepgram.html`.

## Generation

- Product: Deepgram Flux TTS batch endpoint
- Endpoint: `/v2/speak`
- Agent voice: `flux-haley-en`
- Caller voice: `flux-hannah-en`
- Output: MP3, 24 kHz, mono
- Purpose: fixed browser playback for the editorial proof panel

## Clips

- `agent-opening.mp3`: "Your account ends in four eight two one."
- `caller-correction.mp3`: "No, it is four nine two one."
- `flux-recovery.mp3`: "Four nine two one. What would you like to change?"
- `baseline-replay.mp3`: "Your account ends in four eight two one."

The baseline is a deliberately repeated response generated with the same Flux TTS voice and opening line. It is a behavioral comparison, not a claim about another model.

The clips demonstrate the editorial argument. They do not replace a live Flux STT plus Flux TTS interruption test. Deepgram's live pattern uses Flux STT to detect the caller's turn, stops playback locally, sends `Interrupt` to Flux TTS with the playback offset, and uses the returned spoken and remaining text to continue the conversation.
