# AI Producer Interface Plan
## AI-First Producer Sessions in a Sampler Environment

---

## Executive Summary

Build an **AI-driven music production interface** leveraging ElevenLabs' full audio API suite. The system combines generation, transformation, and cleanup capabilities in a unified workflow where AI and human control work together iteratively.

**Core Philosophy**: AI generates, humans refine. Minimal manual editing tools—instead, use AI to describe and apply effects.

---

## Available ElevenLabs APIs

### 1. **Music Generation** (`eleven_music_v1`)
- **Input**: Text prompt or detailed composition plan
- **Output**: Full instrumental/vocal songs (3-300 seconds)
- **Key Features**:
  - Style/genre control via prompt
  - Optional `force_instrumental` flag
  - Composition plan support (structure sections with durations)
  - Inpainting support (Enterprise only)
  - C2PA signing for authenticity
- **Cost**: Varies by duration (Pro tier required)
- **Use Case**: Generate backing tracks, full songs, instrumental beds

### 2. **Text-to-Speech (TTS)** (`eleven_v3`, `multilingual_v2`, `flash_v2.5`)
- **Input**: Text + voice selection
- **Output**: Speech audio
- **Key Features**:
  - Emotional delivery via textual cues ("she said excitedly")
  - Stability & similarity controls
  - 32 languages supported
  - Seed-based determinism
  - Previous/next text context for continuity
- **Cost**: Per character
- **Models**:
  - **Eleven v3** (Alpha): Most emotional, best for performance/dialogue
  - **Multilingual v2**: Most stable long-form
  - **Flash v2.5**: Ultra-low latency (~75ms), 50% cheaper
- **Use Case**: Generate vocals, voiceovers, singing voice effects

### 3. **Voice Cloning**
- **Instant Voice Cloning (IVC)**: Quick clone from ~11 seconds of audio
- **Professional Voice Cloning (PVC)**: High-fidelity clone (requires 30+ minutes audio)
- **Use Case**: Replicate user's voice for personalization

### 4. **Voice Changer** (Speech-to-Speech)
- **Input**: Audio file + target voice
- **Output**: Same content, different voice
- **Key Features**:
  - Preserves emotion, timing, delivery from input
  - Optional background noise removal
  - Multiple models available
  - Seed control for consistency
- **Cost**: Per minute (1000 characters ≈ 1 minute)
- **Use Case**: Apply voice from voice library to any recording

### 5. **Audio Isolation** (Voice Isolator)
- **Input**: Audio/video file (up to 500MB, 1 hour)
- **Output**: Clean speech isolated from background
- **Key Features**:
  - Removes background noise, music, ambient sounds
  - Supports AAC, AIFF, OGG, MP3, OPUS, WAV, FLAC, M4A (audio)
  - Supports MP4, AVI, MKV, MOV, WMV, FLV, WEBM, MPEG, 3GPP (video)
- **Cost**: 1000 characters per minute
- **Limitation**: Not optimized for vocal isolation from music
- **Use Case**: Clean up user recordings, extract clean voice from noisy input

### 6. **Dubbing**
- **Input**: Audio/video + target language
- **Output**: Dubbed audio in target language
- **Key Features**:
  - Preserves emotion, timing, tone, speaker characteristics
  - 32 languages
  - Optional background audio drop
- **Cost**: Per minute
- **Use Case**: Translate generated content to multiple languages

### 7. **Speech-to-Text (Scribe)** (`scribe_v1`)
- **Input**: Audio/video file (up to 3GB) or real-time audio stream
- **Output**: Transcript with word-level timestamps
- **Key Features**:
  - Speaker diarization (up to 32 speakers)
  - Audio event tagging: (laughter), (applause), (footsteps), etc.
  - Word/character-level timestamps for lyric sync
  - Multi-channel transcription (up to 5 channels)
  - Real-time mode via Scribe v2 (150ms latency)
  - Language auto-detection or manual specification
  - Webhook support for async processing of large files
- **Cost**: ~$0.01/minute (estimated)
- **Use Case**: Transcribe recordings, extract lyrics, sync text to audio, live recording feedback

### 8. **Realtime Speech-to-Text (Scribe v2)**
- **Input**: Live audio stream (WebSocket)
- **Output**: Real-time transcript with partial results
- **Key Features**:
  - 150ms latency (ultra-low)
  - Partial results for immediate feedback
  - 90+ languages supported
- **Cost**: ~$0.01/minute (estimated)
- **Use Case**: Live transcription during recording, real-time lyric capture

---

## Proposed Architecture

### **Session Structure**

```
┌─────────────────────────────────────────────────────────────┐
│              AI PRODUCER SESSION (Sampler)                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  GENERATION PHASE                                            │
│  ├─ Music: Generate backing track from prompt               │
│  ├─ Vocals: Generate singing voice or voiceover             │
│  ├─ Effects: Voice transformation (voice changer)           │
│  └─ Cleanup: Remove noise from uploaded recordings          │
│                                                              │
│  ORGANIZATION PHASE                                          │
│  ├─ Arrange samples in timeline                             │
│  ├─ Tag/categorize generations                              │
│  ├─ Version management (track iterations)                   │
│  └─ Manage vocal/instrumental stems                         │
│                                                              │
│  REFINEMENT PHASE                                            │
│  ├─ AI-assisted editing ("make it brighter")                │
│  ├─ Parametric controls (pitch, speed, trim)                │
│  ├─ Chopped/screwed/reverse effects                         │
│  └─ Regenerate sections ("redo verse 2 with more energy")   │
│                                                              │
│  EXPORT PHASE                                                │
│  ├─ Mixed stems                                              │
│  ├─ Final master                                             │
│  └─ Alternate language versions (via Dubbing)               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Workflows

### **Workflow 1: Generate Song from Scratch**

1. **User Input**: Text prompt describing song
   - "Upbeat trap beat with 808 bass, 120 BPM, synthwave vibes"

2. **Music Generation**
   ```
   POST /v1/music/compose
   - prompt: string
   - music_length_ms: 180000 (3 min)
   - model_id: "music_v1"
   - force_instrumental: true/false
   ```

3. **Result**: Full beat/instrumental bed
   - Store as "Backing Track - v1"
   - Show waveform preview
   - Allow regeneration with tweaked prompt

4. **Add Vocals**
   - Generate singing voice: TTS → Multilingual v2
   - Or upload recording → Voice Changer for effect
   - Or use user's cloned voice (IVC)

---

### **Workflow 2: Vocal Effects & Transformation**

1. **User Records Vocal**
   - Upload recording or record in browser

2. **Optional Cleanup**
   ```
   POST /v1/audio-isolation
   - audio: file
   ```
   - Isolate clean voice from background

3. **Transform Voice**
   ```
   POST /v1/speech-to-speech/{voice_id}
   - audio: file
   - voice_id: selected from voice library
   - remove_background_noise: true
   ```
   - Apply different voice character while keeping delivery
   - Preview result
   - Allow regeneration

---

### **Workflow 3: Describe Effect → AI Applies It**

Instead of manual parameter tweaking:

1. **User Input**: "make it sound chipmunk" / "slow it down and make it spooky" / "reverse this part"

2. **AI Interprets** → **Applies Effect**
   - Chipmunk: Voice Changer to high-pitched voice + speed up
   - Spooky: Reverse segment + apply dark voice
   - etc.

3. **Result**: Preview immediately, accept/reject/refine

---

### **Workflow 4: Iterative Refinement**

1. **Initial Generation**: "80s synthwave song with female vocals"
   - Generates backing track + TTS vocals

2. **Refine Verse**: "redo the second verse with more attitude"
   - Regenerate only that section maintaining context
   - Use `previous_request_ids` / `previous_text` for continuity

3. **Add Harmonies**: "generate backing harmonies for the chorus"
   - Generate second vocal track
   - Layer on timeline

4. **Final Mix**: Export separate stems, mix, or use as-is

---

### **Workflow 5: Transcribe Recording → Edit → Regenerate**

1. **User Records Vocal**
   - Upload existing recording or record in browser
   - Supports all major audio/video formats

2. **Transcribe via Scribe**
   ```
   POST /v1/speech-to-text
   - file: audio
   - model_id: "scribe_v1"
   - diarize: true (if multi-speaker)
   - tag_audio_events: true
   - timestamps_granularity: "word"
   ```
   - Returns transcript with word-level timestamps
   - Identifies speakers if multiple present
   - Tags non-verbal cues: (laughter), (applause), etc.

3. **Display Synced Lyrics**
   - Show transcript aligned to waveform
   - Highlight words as audio plays (karaoke-style)
   - Display speaker labels if diarized
   - Show audio events in timeline

4. **Edit Transcript**
   - User modifies lyrics/text
   - Fix transcription errors
   - Add/remove sections
   - Change words or phrasing

5. **Regenerate from Edited Text**
   - Feed edited transcript to TTS
   - Select voice from library (or use cloned voice)
   - Generate new audio matching edited lyrics
   - Replace original audio section or create new track

6. **Optional: Voice Transform**
   - Apply Voice Changer to keep original delivery
   - Transform to different voice while preserving emotion/timing

---

### **Workflow 6: Live Recording with Real-time Transcription**

1. **Start Recording**
   - Open WebSocket to Scribe v2 realtime endpoint
   - Begin audio capture in browser

2. **Live Transcription**
   - 150ms latency feedback
   - Partial results appear as user speaks/sings
   - Final results with timestamps on completion

3. **Review & Edit**
   - Transcript ready immediately after recording
   - Edit in-place with synced waveform
   - Regenerate sections as needed

---

## Database Schema (Convex)

### **Session**
```typescript
{
  _id: Id,
  userId: string,
  projectName: string,
  createdAt: number,
  updatedAt: number,
  
  // Metadata
  tempo: number,
  key: string,
  genre: string,
  
  // Relations
  tracks: Id[],
  generations: Id[],
  timeline: TimelineItem[],
}
```

### **Generation**
```typescript
{
  _id: Id,
  sessionId: Id,
  type: "music" | "tts" | "voice-change" | "isolate" | "dub",
  
  // Input
  prompt?: string,
  sourceAudioUrl?: string,
  voiceId?: string,
  language?: string,
  
  // Output
  audioUrl: string,
  duration: number,
  waveformData?: number[],
  
  // Metadata
  model: string,
  cost: number,
  timestamp: number,
  tags: string[],
  version: number,
  
  // Parent generation (for regenerations/edits)
  parentId?: Id,
  editDescription?: string,
}
```

### **TimelineItem**
```typescript
{
  _id: Id,
  sessionId: Id,
  generationId: Id,
  
  // Position
  startMs: number,
  durationMs: number,
  lane: "melody" | "harmony" | "bass" | "drums" | "percussion" | "fx" | number,
  
  // State
  muted: boolean,
  volume: number,
  pan: number,
  effects: Effect[],
}
```

### **Effect** (for parametric editing)
```typescript
{
  type: "pitch_shift" | "time_stretch" | "reverse" | "trim" | "eq" | "custom",
  
  // Common
  startMs?: number,
  endMs?: number,
  
  // Specific
  pitchShift?: number,
  timeScale?: number,
  eqBands?: { freq: number, gain: number }[],
  description?: string, // "make it brighter" → AI interprets
}
```

### **Transcript** (for transcribed audio)
```typescript
{
  _id: Id,
  generationId: Id,  // Links to source audio Generation
  sessionId: Id,
  
  // Content
  text: string,  // Full transcript text
  words: [{
    text: string,
    startMs: number,
    endMs: number,
    speakerId?: string,  // If diarized
    channelIndex?: number,  // If multi-channel
  }],
  
  // Audio Events (non-verbal cues)
  audioEvents: [{
    type: string,  // "laughter", "applause", "music", etc.
    startMs: number,
    endMs?: number,
  }],
  
  // Speaker Info
  speakers: string[],  // List of speaker IDs
  
  // Metadata
  language: string,  // Detected or specified language code
  languageProbability: number,  // Confidence score
  model: string,  // "scribe_v1" or "scribe_v1_experimental"
  
  // Editing State
  editedText?: string,  // User modifications to transcript
  editedWords?: [{  // If user edited specific words
    originalIndex: number,
    newText: string,
  }],
  
  // Timestamps
  createdAt: number,
  updatedAt: number,
}
```

---

## API Endpoints (Convex Actions)

### **Generation**
- `generateMusic(sessionId, prompt, duration, style, forceInstrumental)` → Generation
- `generateVocals(sessionId, text, voiceId, emotion, language)` → Generation
- `changeVoice(sessionId, audioUrl, voiceId, removeNoise)` → Generation
- `isolateVoice(sessionId, audioUrl)` → Generation
- `dubAudio(sessionId, audioUrl, targetLanguage)` → Generation
- `regenerateGeneration(generationId, editDescription)` → Generation

### **Transcription**
- `transcribeAudio(sessionId, audioUrl, options)` → Transcript
  - `options`: `{ diarize?: boolean, tagAudioEvents?: boolean, languageCode?: string, numSpeakers?: number }`
- `transcribeRealtime(sessionId)` → WebSocket connection for live transcription
- `updateTranscript(transcriptId, editedText, editedWords)` → Transcript
- `regenerateFromTranscript(transcriptId, voiceId, sections?)` → Generation
  - Generates new audio from edited transcript
  - Optional `sections` to regenerate only specific parts

### **Management**
- `createSession(projectName, tempo, key, genre)` → Session
- `updateSession(sessionId, metadata)` → void
- `getSession(sessionId)` → Session + generations + timeline
- `deleteGeneration(generationId)` → void
- `tagGeneration(generationId, tags)` → void

### **Timeline**
- `addToTimeline(sessionId, generationId, startMs, lane)` → TimelineItem
- `updateTimelineItem(itemId, startMs, durationMs, volume, pan)` → void
- `applyEffect(itemId, effect)` → void
- `describeEffect(itemId, description)` → applies AI-interpreted effect

### **Export**
- `exportSession(sessionId, format)` → audio file (mixed or stems)
- `exportStem(generationId, format)` → individual audio
- `getSessionMix(sessionId)` → real-time mix preview

---

## UI Components

### **Main Editor**
1. **Toolbar**
   - Generate Music, Generate Vocals, Upload Audio, Voice Changer, Isolate, Dub
   - Undo/Redo, Save, Export

2. **Generation Panel** (Left)
   - List all generations with thumbnails (waveforms)
   - Tags, version history, cost
   - Drag-to-timeline support

3. **Timeline** (Center)
   - Multi-lane audio editor
   - Drag-drop arrangements
   - Right-click context menu (trim, reverse, pitch, speed)
   - "Describe effect" button for AI tweaks

4. **Inspector** (Right)
   - Selected item details
   - Parametric controls (pitch, speed, volume, pan)
   - Effect list with AI description input
   - Preview button

5. **Generation Modal** (Overlay)
   - Natural language input ("80s synthwave with female singer")
   - Optional advanced options (duration, model, quality)
   - Real-time cost estimate
   - Generate button with queue status

---

## Key Design Decisions

### **1. Why Minimal Manual Editing?**
- Music producers expect fast iteration
- AI generation is faster than manual tweaking
- "Describe effect" pattern is more intuitive than parameter knobs
- Focus on generation-heavy workflow, not DAW replacement

### **2. Why No Transcription API?**
- ElevenLabs doesn't offer speech-to-text
- Use Whisper API (OpenAI) or alternative if needed
- Or skip—UI focuses on generation/sampling, not transcription

### **3. Cost Strategy**
- Music gen: ~$0.30-0.50 per 30-second track
- TTS: Per character (roughly $0.003-0.01 per minute)
- Voice Changer: ~$0.05 per minute
- Isolation: ~$0.06 per minute
- Each generation tracked for cost visibility

### **4. User Ownership**
- Users retain audio rights
- Can export and commercialize (with appropriate ElevenLabs tier)
- Version history preserved for audit trail

---

## Implementation Phases

### **Phase 1: MVP (Weeks 1-2)**
- Session CRUD
- Music generation endpoint
- Simple timeline UI (single lane)
- Basic export (mixed audio)
- Cost tracking

### **Phase 2: Vocal & Transcription (Weeks 3-4)**
- TTS generation
- Voice Changer integration
- Voice library integration
- **Scribe transcription (file-based)**
- **Transcript display with word-level sync**
- **Edit transcript → regenerate via TTS**
- Multi-lane timeline
- Parametric pitch/speed controls

### **Phase 3: AI Assistants (Weeks 5-6)**
- "Describe effect" → AI applies
- Regeneration with context (previous_text, previous_request_ids)
- Audio Isolation integration
- Waveform preview generation
- **Real-time transcription (Scribe v2)**
- **Live lyric capture during recording**

### **Phase 4: Polish (Weeks 7-8)**
- Dubbing integration
- Stem export
- Version history UI
- Tag management
- Real-time mix preview
- **Speaker diarization UI**
- **Audio event markers in timeline**

---

## Questions for User

1. ~~**Transcription**: Do you want speech-to-text?~~ → **RESOLVED: Use ElevenLabs Scribe (native)**
2. **Sampling**: Should the timeline support "chopped" samples at any length, or enforce musical bars?
3. **AI Voice Clone**: Should users be able to upload samples for instant voice cloning (IVC) in this phase?
4. **Stem Export**: Which stems? (Full mix, vocals, instrumental, or more granular?)
5. **Collaboration**: Multi-user editing in same session, or single-user for MVP?
6. **Real-time Playback**: Browser playback with Web Audio API, or server-side generation only?

### Suggested Defaults (if no preference specified)

| Question | Suggested Default | Rationale |
|----------|-------------------|-----------|
| Sampling | Any-length with snap-to-grid option | Flexibility for creativity, grid for precision |
| Voice Clone (IVC) | Yes, include in Phase 2 | IVC is fast (~11 sec samples), high value feature |
| Stem Export | Full mix + vocals + instrumental (3 outputs) | Covers 90% of use cases |
| Collaboration | Single-user for MVP | Simplifies state management |
| Playback | Browser (Web Audio API) | Already have DAW infrastructure, no server load |

---

## Technical Stack

- **Frontend**: React + Convex SDK
- **Backend**: Convex (for session/generation management)
- **Audio**: ElevenLabs APIs (main), Web Audio API (playback/visualization)
- **Storage**: Convex + external audio storage (S3 or ElevenLabs CDN)
- **Real-time**: Convex subscriptions for live updates

