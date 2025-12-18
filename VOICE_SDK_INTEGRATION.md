# ElevenLabs Voice Library - SDK Integration

## What We Created

Three type-safe Convex actions in `packages/server/convex/voices.ts` that fetch voice data from ElevenLabs and organize it for your UI.

### 1. `getVoicesByCategory()`

Fetches **all** voices and groups them by category.

**Returns:**
```typescript
{
  "premade": [...voices],
  "cloned": [...voices],
  "generated": [...voices],
  "professional": [...voices],
  "other": [...voices]
}
```

**Usage in UI:**
```typescript
const voices = await api.voices.getVoicesByCategory()
// Display voices organized by tabs/sections
```

### 2. `searchVoices(query: string)`

Search voices by name, description, or labels.

**Returns:** Array of matching voices
```typescript
[
  {
    id: "voice123",
    name: "Professional Narrator",
    category: "professional",
    description: "...",
    previewUrl: "...",
    labels: {...}
  }
]
```

**Usage in UI:**
```typescript
const results = await api.voices.searchVoices("narrator")
```

### 3. `getVoice(voiceId: string)`

Get full details for a specific voice including samples and settings.

**Returns:** Complete voice object with metadata
```typescript
{
  id: "voice123",
  name: "...",
  category: "...",
  previewUrl: "...",
  labels: {...},
  settings: { stability, similarity_boost },
  samples: [...]
}
```

**Usage in UI:**
```typescript
const voice = await api.voices.getVoice("voice123")
```

## Key Features

✅ **Type-Safe** - Full TypeScript support through Convex + ElevenLabs SDK  
✅ **Organized by Categories** - Automatically grouped for UI display  
✅ **Pagination** - Handles all voices even if there are thousands  
✅ **Live Data** - Always gets fresh voices from ElevenLabs  
✅ **Searchable** - Full-text search across name, description, labels  

## Setup

1. Install the SDK:
```bash
npm install @elevenlabs/elevenlabs-js
```

2. Add API key to `.env`:
```
ELEVENLABS_API_KEY=your_key_here
```

3. Use in your React components:
```typescript
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"

export function VoiceLibrary() {
  const voices = useQuery(api.voices.getVoicesByCategory)
  
  if (!voices) return <div>Loading...</div>
  
  return Object.entries(voices).map(([category, categoryVoices]) => (
    <div key={category}>
      <h2>{category}</h2>
      {categoryVoices.map(voice => (
        <div key={voice.id}>
          <p>{voice.name}</p>
          {voice.previewUrl && <audio src={voice.previewUrl} />}
        </div>
      ))}
    </div>
  ))
}
```

## No Manual Schema Needed

We don't maintain a static voice list. The SDK handles:
- API changes automatically
- Type definitions
- Pagination
- Error handling

This is the correct approach because ElevenLabs constantly adds/removes voices.

