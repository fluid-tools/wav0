# ElevenLabs API Comparison & Integration Matrix

## Quick Reference: All Available APIs

| API | Input | Output | Cost | Use Case | Tier |
|-----|-------|--------|------|----------|------|
| **Speech-to-Text (Scribe)** | Audio/Video file | Transcript + timestamps | ~$0.01/min | Transcription, lyrics extraction | Free+ |
| **Realtime STT (Scribe v2)** | Audio stream | Live transcript | ~$0.01/min | Live recording transcription | Pro+ |
| **Music Generation** | Text/Composition Plan | Full Song (3-300s) | ~$0.30-0.50/30s | Backing tracks, beats | Pro+ |
| **Text-to-Speech** | Text + Voice | Speech Audio | ~$0.003-0.01/min | Vocals, narration | Free+ |
| **Voice Cloning (IVC)** | 11s audio sample | Voice model | ~$0.0 (via TTS) | Personal voice | Free+ |
| **Voice Cloning (PVC)** | 30+ min audio | High-fidelity model | Custom pricing | Professional clones | Enterprise |
| **Voice Changer** | Audio file + Voice ID | Transformed audio | ~$0.05/min | Voice effects, transformation | Pro+ |
| **Audio Isolation** | Audio/Video file | Clean speech | 1000 chars/min | Noise removal, cleanup | Free+ |
| **Dubbing** | Audio/Video + Language | Dubbed audio | Per minute | Multi-language | Pro+ |

---

## API Details for AI Producer Implementation

### **Speech-to-Text (Scribe)** (TRANSCRIPTION: Audio → Text)

```
POST /v1/speech-to-text

KEY PARAMETERS:
├─ file (audio/video, required, up to 3GB)
│  └─ All major audio/video formats supported
│
├─ model_id (required)
│  ├─ "scribe_v1" - Production model
│  └─ "scribe_v1_experimental" - Experimental features
│
├─ language_code (ISO-639-1/3, optional)
│  └─ Auto-detects if omitted
│
├─ diarize (boolean, default false)
│  └─ Annotate which speaker is talking
│
├─ num_speakers (1-32, optional)
│  └─ Max speakers to detect (helps accuracy)
│
├─ tag_audio_events (boolean, default true)
│  └─ Tag (laughter), (applause), (footsteps), etc.
│
├─ timestamps_granularity (enum, default "word")
│  ├─ "word" - Word-level timestamps
│  ├─ "character" - Character-level per word
│  └─ "none" - No timestamps
│
├─ use_multi_channel (boolean, default false)
│  └─ Transcribe each channel independently (up to 5)
│
├─ webhook (boolean, default false)
│  └─ Async processing for large files
│
└─ cloud_storage_url (string, optional)
   └─ HTTPS URL instead of file upload (up to 2GB)

RESPONSE:
├─ text: Full transcript
├─ words: [{ text, start, end, speaker_id?, channel_index? }]
├─ language_code: Detected language
└─ language_probability: Confidence score

TIER: Free+ (limited), Pro recommended
LATENCY: ~10-30s for typical audio files
```

**For AI Producer**:
- Use `diarize=true` for multi-speaker recordings
- Use `tag_audio_events=true` to capture non-verbal cues
- Word-level timestamps enable lyric sync to waveform
- Webhook mode for files >100MB to avoid timeouts

---

### **Realtime Speech-to-Text (Scribe v2)** (LIVE TRANSCRIPTION)

```
WebSocket /v1/speech-to-text/realtime

KEY FEATURES:
├─ 150ms latency (ultra-low)
├─ Live audio stream → text as you speak
├─ Partial results for immediate feedback
├─ Final results with timestamps
└─ 90+ languages supported

USE CASE:
├─ "Record vocals" workflow
├─ Live transcription during recording
└─ Real-time lyric capture
```

**For AI Producer**:
- Ideal for browser recording with live feedback
- Show lyrics appearing as user sings/speaks
- Allow real-time editing during recording

---

### **Music Generation** (PRIMARY: Backing Tracks)

```
POST /v1/music/compose

KEY PARAMETERS:
├─ prompt (string, ≤4100 chars)
│  └─ "upbeat trap beat with 808 bass, 120 BPM, synthwave vibes"
│
├─ composition_plan (object, optional - replaces prompt)
│  ├─ verses: [{ duration_ms, description }]
│  ├─ chorus: [{ duration_ms, description }]
│  └─ bridge: [{ duration_ms, description }]
│
├─ music_length_ms (3000-300000)
│  └─ Only used with prompt, not composition_plan
│
├─ force_instrumental (boolean, default false)
│  └─ true = no vocals
│
├─ model_id ("music_v1" only currently)
│
├─ output_format (default "mp3_44100_128")
│
└─ store_for_inpainting (boolean, Enterprise only)
   └─ Allow later regeneration of specific sections

TIER REQUIREMENT: Pro tier or higher
LATENCY: 30-60 seconds typical
DETERMINISM: Non-deterministic
```

**For AI Producer**:
- Prefer explicit prompt over composition_plan for MVP
- Store `store_for_inpainting=true` if enterprise access
- Allow easy regeneration with modified prompts

---

### **Text-to-Speech** (VOCALS: Generate Singing/Speaking)

```
POST /v1/text-to-speech/{voice_id}

KEY PARAMETERS:
├─ text (string, required)
│  └─ Can include emotional cues: "she said excitedly"
│
├─ model_id (default "eleven_multilingual_v2")
│  ├─ "eleven_v3" - Most emotional (Alpha)
│  ├─ "eleven_multilingual_v2" - Stable long-form
│  └─ "eleven_flash_v2_5" - Ultra-fast (~75ms latency)
│
├─ voice_settings (object, optional)
│  ├─ stability (0-1, default 0.5)
│  └─ similarity_boost (0-1, default 0.75)
│
├─ language_code (ISO 639-1, optional)
│  └─ "en", "es", "fr", "ja", "zh", etc.
│
├─ seed (0-4294967295, optional)
│  └─ For deterministic generation
│
├─ previous_text (string, optional)
│  └─ Context from earlier generation
│
├─ previous_request_ids (array of IDs, optional)
│  └─ Link to earlier requests for continuity
│
└─ output_format (default "mp3_44100_128")
   └─ PCM/μ-law/A-law for special cases

COST: Per character (~1000 chars = ~$0.03)
TIER: Free (limited) to Pro (high quality)
```

**For AI Producer**:
- Use `previous_text` / `previous_request_ids` for multi-part vocals
- Choose model based on use:
  - **Eleven v3**: Emotional performances, dialogue
  - **Multilingual v2**: Consistent long vocals
  - **Flash v2.5**: Real-time, conversational
- Emotional cues in text matter: "she whispered softly" vs "she screamed"

---

### **Voice Changer** (TRANSFORMATION: Apply Voice to Audio)

```
POST /v1/speech-to-speech/{voice_id}

KEY PARAMETERS:
├─ audio (file, required, multipart form)
│  └─ Input audio to transform
│
├─ model_id (optional)
│  ├─ "eleven_english_sts_v2" (default, recommended)
│  └─ Other models available
│
├─ remove_background_noise (boolean, default false)
│  └─ Auto-clean input before voice change
│
├─ voice_settings (object, optional)
│  ├─ stability (0-1)
│  └─ similarity_boost (0-1)
│
├─ seed (optional, for consistency)
│
├─ file_format (default "other")
│  ├─ "pcm_s16le_16" - Fast PCM format
│  └─ "other" - Any common audio format
│
└─ output_format (default "mp3_44100_128")

PRESERVES: Emotion, timing, delivery from input
COST: ~1000 characters per minute
TIER: Pro+
```

**For AI Producer**:
- Perfect for "describe effect" workflow
- User records casual vocal → Voice Changer applies professional voice
- Set `remove_background_noise=true` for user recordings
- Use `stability` and `similarity_boost` for voice character intensity

---

### **Audio Isolation** (CLEANUP: Extract Clean Speech)

```
POST /v1/audio-isolation

KEY PARAMETERS:
├─ audio (file, required, multipart form)
│  └─ Audio or video file (up to 500MB, 1 hour max)
│
├─ file_format (default "other")
│  ├─ "pcm_s16le_16" - Fast format
│  └─ "other" - Standard audio/video
│
└─ preview_b64 (optional)
   └─ Base64 image for tracking

SUPPORTED FORMATS:
├─ Audio: AAC, AIFF, OGG, MP3, OPUS, WAV, FLAC, M4A
└─ Video: MP4, AVI, MKV, MOV, WMV, FLV, WEBM, MPEG, 3GPP

COST: 1000 characters per minute
LIMITATION: Not optimized for vocal extraction from music
TIER: Free+ (limited character count)
```

**For AI Producer**:
- Ideal for user-recorded vocals with background noise
- Run before Voice Changer for best results
- Store isolated audio for later use
- Not for separating vocals from instrumental music

---

### **Dubbing** (TRANSLATION: Multi-Language Export)

```
POST /v1/dubbing

KEY PARAMETERS:
├─ file (file, required - audio or video)
│
├─ target_language (enum, required)
│  └─ 32 languages supported
│     (e.g., "es", "fr", "de", "ja", "pt", "hi", etc.)
│
├─ source_language (string, optional)
│  └─ Auto-detected if omitted
│
├─ num_speakers (int, optional)
│  └─ Override speaker detection
│
├─ drop_background_audio (boolean, default false)
│  └─ true = remove background music before dubbing
│
└─ output_format (audio format)

PRESERVES: Emotion, timing, tone, speaker characteristics
COST: Per minute
TIER: Pro+
```

**For AI Producer**:
- Post-production step: "export to Spanish", "dub to Japanese"
- Preserve original timing and emotion
- Option to drop background for cleaner dub

---

## Voice Library Integration

### **Access Voice Data**
```typescript
const voices = await api.voices.getVoicesByCategory()
// Returns: { premade, cloned, generated, professional, other }

const voice = await api.voices.getVoice("voice_id")
// Returns: Full voice object with metadata
```

### **Use in Generations**
```typescript
// TTS with specific voice
await api.generateVocals({
  text: "Hello world",
  voiceId: "voice_abc123",
  emotion: "excited"  // Infer from voice type
})

// Voice Changer with selected voice
await api.changeVoice({
  audioUrl: "s3://...",
  voiceId: "voice_def456",
  removeNoise: true
})
```

---

## Integration Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    AI PRODUCER SESSION                      │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
    ┌─────────┐         ┌─────────┐      ┌──────────┐
    │  Music  │         │   TTS   │      │  Upload/ │
    │   Gen   │         │ (Vocals)│      │  Record  │
    └────┬────┘         └────┬────┘      └─────┬────┘
         │                   │                 │
         │                   │           ┌─────┴─────┐
         │                   │           │           │
         │                   │           ▼           ▼
         │                   │     ┌──────────┐ ┌────────────┐
         │                   │     │ Audio    │ │  Scribe    │
         │                   │     │Isolation │ │   (STT)    │
         │                   │     └─────┬────┘ └──────┬─────┘
         │                   │           │            │
         │                   │           │      ┌─────┴─────┐
         │                   │           │      │ Transcript │
         │                   │           │      │  + Sync   │
         │                   │           │      └─────┬─────┘
         │                   │           │            │
         │                   │           │      ┌─────┴─────┐
         │                   │           │      │   Edit    │
         │                   │           │      │ Lyrics    │
         │                   │           │      └─────┬─────┘
         │                   │           │            │
         │                   │           │      ┌─────┴─────┐
         │                   │           │      │Regenerate │
         │                   │           │      │ via TTS   │
         │                   │           │      └─────┬─────┘
         │                   │           │            │
         └───────────┬───────┴───────────┴────────────┘
                     │
                     ▼
            ┌────────────────┐
            │ Voice Changer  │ (Apply effect)
            │ (Optional)     │
            └────────┬───────┘
                     │
                     ▼
            ┌────────────────┐
            │  Timeline UI   │
            │  (Multi-lane)  │
            └────────┬───────┘
                     │
            ┌────────┴────────┐
            │                 │
            ▼                 ▼
        ┌────────┐      ┌──────────┐
        │ Export │      │ Dubbing  │
        │(Mixed) │      │(Optional)│
        └────────┘      └──────────┘
```

### Transcription Flow (Detail)

```
┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│  Upload/Record │────▶│   Scribe STT   │────▶│   Transcript   │
│     Audio      │     │  (scribe_v1)   │     │  + Timestamps  │
└────────────────┘     └────────────────┘     └───────┬────────┘
                                                      │
                              ┌────────────────────────┤
                              │                        │
                              ▼                        ▼
                       ┌────────────┐          ┌────────────┐
                       │  Display   │          │   Edit     │
                       │  Synced    │          │  Lyrics    │
                       │  Lyrics    │          │            │
                       └────────────┘          └──────┬─────┘
                                                      │
                                                      ▼
                                               ┌────────────┐
                                               │ Regenerate │
                                               │  via TTS   │
                                               └──────┬─────┘
                                                      │
                                                      ▼
                                               ┌────────────┐
                                               │    New     │
                                               │   Audio    │
                                               └────────────┘
```

---

## Cost Breakdown Example

**Project: "Generate synthwave track with vocals, 2 versions"**

| Step | API | Input | Cost |
|------|-----|-------|------|
| 1 | Music Gen | 1 × 3-min track | $0.40 |
| 2 | Music Gen | 1 × 3-min track (regeneration) | $0.40 |
| 3 | TTS | 60 seconds of lyrics | $0.05 |
| 4 | TTS | 30 seconds of harmony | $0.02 |
| 5 | Voice Changer | Apply 2nd voice to vocals | $0.10 |
| 6 | Dubbing | Export to Spanish (3 min) | $0.20 |
| **TOTAL** | | | **$1.17** |

---

## Recommended Tier for MVP

### **Free Tier**
- Limited character TTS
- Audio Isolation (limited)
- No Music Generation
- No Voice Changer
- **Verdict**: Can prototype voices only

### **Creator Tier** ($11/month)
- 50K TTS characters/month
- Music Generation (limited)
- Voice Changer
- Audio Isolation
- **Verdict**: Good for MVP development

### **Pro Tier** ($99/month)
- 500K TTS characters
- Full Music Generation
- Full Voice Changer
- Dubbing
- Professional Voice Cloning option
- **Verdict**: Recommended for MVP

---

## Transcription - Native Support via Scribe

ElevenLabs provides **native speech-to-text** via the Scribe API. No third-party integration needed.

### **File-based Transcription**
```typescript
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js"

const elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY })

const transcription = await elevenlabs.speechToText.convert({
  file: audioFile,
  model_id: "scribe_v1",
  diarize: true,           // Identify speakers
  tag_audio_events: true,  // Tag (laughter), (applause), etc.
  language_code: "eng",    // Or omit for auto-detect
})

// Returns:
// {
//   text: "Hello, how are you today?",
//   words: [
//     { text: "Hello", start: 0.0, end: 0.5, speaker_id: "speaker_0" },
//     { text: "how", start: 0.6, end: 0.8, speaker_id: "speaker_0" },
//     ...
//   ],
//   language_code: "eng",
//   language_probability: 0.98
// }
```

### **Real-time Transcription (Scribe v2)**
```typescript
// WebSocket connection for live transcription
// 150ms latency - ideal for recording workflow
// Show lyrics appearing as user sings/speaks
```

### **AI Producer Use Cases**
1. **Transcribe recorded vocals** → Display synced lyrics
2. **Live recording feedback** → Show text as user speaks
3. **Edit transcript** → Regenerate with TTS
4. **Multi-speaker sessions** → Identify who said what
5. **Audio event capture** → Note (laughter), (applause) in timeline

**Recommendation**: Implement transcription in Phase 2 alongside TTS and Voice Changer.

