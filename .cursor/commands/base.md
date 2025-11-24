## Important Guidelines

* use the tools and resources strategically to come up with concrete fixes.
* be thorough and precise.
* use relevant resources and tools to implement a solid plan with executable steps.
* when using convex, follow the domain/model/lib/functions pattern.

---

## MCP Server Instructions

* Firecrawl MCP for crawling, scraping, and more.
* Context7 MCP for docs - !! use context7 !! use ctx7

---

## Relevant Links when building with Convex

Zen Of Convex - https://docs.convex.dev/understanding/zen

Best Practices with Convex - https://docs.convex.dev/understanding/best-practices/

TypeScript Best Practices with Convex - https://docs.convex.dev/understanding/best-practices/typescript

Technical Blog by Convex for hidden gems - http://stack.convex.dev/

Convex Helpers - https://github.com/get-convex/convex-helpers - use these for rls, triggers, and other helpers for ergonomics + adopting clean patterns.

- never fucking using convex codegen - it's not a real command anymore.

---

## Web Interface Guidelines

* https://vercel.com/design/guidelines

---

## DAW Architecture Guidelines

For playback engine (specifically, the audio manager/context), we have chosen the MediaBunny library.

### Relevant Links

* MEDIA BUNNY LLMS ENTRY POINT: https://mediabunny.dev/llms.txt

* MEDIA BUNNY TYPESCRIPT DEFINITIONS: https://mediabunny.dev/mediabunny.d.ts

* MEDIA BUNNY INFO THROUGH CONTEXT7 MCP SERVER: https://context7.com/vanilagy/mediabunny/llms.txt?topic=how+would+one+architect+an+audio-daw+like+logic+pro+with+media+bunny+in+the+browser.

* MEDIA BUNNY GUIDE: https://mediabunny.dev/guide/introduction

* MEDIA BUNNY EXAMPLES: https://mediabunny.dev/examples

* WEB AUDIO API DOCS: https://webaudio.github.io/web-audio-api/

---

## Additional Notes

* cursor rules - @wav0_daw.mdc
* mediabunny docs - @MediaBunny
* when working with installed packages, you can dig into their node_modules folder to see the source code. especially helpful to work with types - you can see the types usually in the index.d.ts file or something similar.
