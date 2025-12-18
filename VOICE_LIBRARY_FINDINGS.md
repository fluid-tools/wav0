# ElevenLabs Voice Library Integration

## Key Finding: Use the Official API

After researching the ElevenLabs voice library, I discovered that **you should use the official ElevenLabs SDK** (`@elevenlabs/elevenlabs-js`) rather than parsing the web page or creating a custom schema from scratch.

### Why the SDK is Better

1. **Type Safety**: The SDK is fully typed with TypeScript
2. **Pagination Support**: Built-in pagination with `has_more` flag and `next_page_token`
3. **Filtering**: Supports filtering by:
   - `category`: premade, cloned, generated, professional
   - `voice_type`: personal, community, default, workspace, non-default
   - `fine_tuning_state`: various states for professional voices
   - `search`: full-text search across name, description, labels, category
4. **Sorting**: Sort by `created_at_unix` or `name` in ascending/descending order
5. **Live Updates**: The API returns fresh data, not a static list

### Official API Reference

- **Endpoint**: `GET /v1/voices`
- **Documentation**: https://elevenlabs.io/docs/api-reference/voices/search
- **SDK Docs**: https://www.npmjs.com/package/@elevenlabs/elevenlabs-js

## Implementation

### 1. Install the SDK

```bash
npm install @elevenlabs/elevenlabs-js
```

### 2. Use it in Your Code

```typescript
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
})

// Get all voices with pagination
const response = await elevenlabs.voices.search({
  pageSize: 50,
  sort: 'name',
  sortDirection: 'asc',
})

// Search for specific voices
const searched = await elevenlabs.voices.search({
  search: 'professional narrator',
  category: 'professional',
})
```

### 3. Convex Schema

Created: `packages/server/src/schemas/voice-library.ts`

This provides Convex-compatible validators for the ElevenLabs API response, including:
- `Voice`: Full voice object schema
- `VoiceSearchResponse`: API response schema
- `VoiceSearchQuery`: Query parameters
- Enums for categories, voice types, and fine-tuning states

## Why NOT Parse the Web Page

The web page only shows:
- Static category listings (no actual voice data)
- No voice IDs, which are required for the API
- No filtering/search capabilities
- No pagination
- Manual maintenance would be needed as voices are added/removed

## Next Steps

1. Add `@elevenlabs/elevenlabs-js` to `packages/server/package.json`
2. Create a Convex mutation to call the ElevenLabs API
3. Cache responses if needed (voices don't change frequently)
4. Use the schema validators from `voice-library.ts` to validate responses

