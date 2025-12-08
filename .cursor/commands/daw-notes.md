## DAW Architecture Guidelines

For playback engine (specifically, the audio manager/context), we have chosen the MediaBunny library.

It's structured like this:
- `packages/daw-sdk` for typescript primitives.
- `packages/daw-react` for react bindings.
- `apps/web` is a web app and wires up the interfaces with these primitives.

---

### Relevant Links

* MEDIA BUNNY LLMS ENTRY POINT: https://mediabunny.dev/llms.txt

* MEDIA BUNNY TYPESCRIPT DEFINITIONS: https://mediabunny.dev/mediabunny.d.ts

* MEDIA BUNNY INFO THROUGH CONTEXT7 MCP SERVER: https://context7.com/vanilagy/mediabunny/llms.txt?topic=how+would+one+architect+an+audio-daw+like+logic+pro+with+media+bunny+in+the+browser.

* MEDIA BUNNY GUIDE: https://mediabunny.dev/guide/introduction

* MEDIA BUNNY EXAMPLES: https://mediabunny.dev/examples

* WEB AUDIO API DOCS: https://webaudio.github.io/web-audio-api/