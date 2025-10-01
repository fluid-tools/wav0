# Volume Envelope System Design

## Overview
WAV0's volume envelope system provides **multiplicative automation** — envelope points are multipliers applied to the track's base volume, not absolute gain values.

## Core Concept

```
Final Gain = Base Volume (from slider) × Envelope Multiplier
```

### Example
- Track base volume: **70%**
- Envelope point multiplier: **50%**
- **Effective volume: 35%** (70% × 0.5)

## Why Multipliers?

1. **Predictable behavior**: Moving the track slider scales all automation proportionally
2. **Non-destructive**: Envelope doesn't override your mix levels
3. **Industry standard**: Matches Logic Pro, Ableton, Pro Tools automation behavior
4. **Composability**: Base volume + automation = clean separation of concerns

## UI Implementation

### Envelope Editor Features

1. **Card-based layout** (not cramped grid)
   - Each point is a full-width card
   - Shows time, multiplier, and effective volume
   - Hover to reveal delete button
   - Automatically sorted by time

2. **Clear labels**
   - "Multiplier (%)" not "Gain"
   - Shows both multiplier (100%) and effective volume (70%)
   - Base volume displayed at top

3. **Help text**
   - Explains multiplier concept
   - Shows examples: 100% = no change, 50% = half, 200% = double

4. **Visual hierarchy**
   ```
   Base volume: 70% · 3 automation points
   
   [Card 1] 00:00.000 → 70%    (100% of base)
   [Card 2] 00:05.000 → 35%    (50% of base)
   [Card 3] 00:10.000 → 140%   (200% of base)
   ```

## Playback Engine Logic

### scheduleTrackEnvelope() Algorithm

```typescript
const baseVolume = track.volume / 100;  // 0.70 for 70%

for (const point of envelopePoints) {
  const multiplier = point.value;       // 0.5 for 50%
  const targetGain = baseVolume * multiplier;  // 0.35
  gainNode.gain.linearRampToValueAtTime(targetGain, time);
}
```

### Key Benefits

- **Slider updates work correctly**: When user moves track slider from 70% → 80%, all envelope points scale proportionally
- **Mix consistency**: Automation doesn't break your relative mix levels
- **Undo-friendly**: Disabling envelope returns to base volume exactly

## Data Model

```typescript
type TrackEnvelopePoint = {
  id: string;
  time: number;      // milliseconds from track start
  value: number;     // multiplier: 1.0 = 100%, 0.5 = 50%, 2.0 = 200%
  curve: "linear" | "easeIn" | "easeOut" | "sCurve";
};

type TrackEnvelope = {
  enabled: boolean;
  points: TrackEnvelopePoint[];
};
```

### Valid Ranges
- **Multiplier**: 0–400% (0.0–4.0)
- **Time**: 0–∞ milliseconds
- **Default**: Single point at time 0, value 1.0 (100% = no change)

## User Experience

### Before (problematic)
- Envelope point at "80%" showed 80% gain
- Moving track slider to 50% didn't affect envelope
- **Confusion**: "Why is automation ignoring my slider?"

### After (correct)
- Envelope point at "100%" means "use base volume as-is"
- Point at "50%" means "half of whatever base volume is"
- Moving slider to 50% → all automation scales to 50% of multipliers
- **Clarity**: "Automation shapes my mix, slider controls overall level"

## Edge Cases Handled

1. **Empty envelope**: Falls back to base volume
2. **Disabled envelope**: Uses base volume only
3. **Exponential ramps**: Clamps to 0.0001 minimum (Web Audio API requirement)
4. **Point sorting**: Always sorted by time, UI matches playback order
5. **Playback resume**: Finds correct multiplier for current time

## Future Enhancements

- [ ] Visual waveform with envelope overlay
- [ ] Drag points directly on waveform
- [ ] Preset curves (fade in/out, ducking, swell)
- [ ] Copy/paste envelope between tracks
- [ ] MIDI CC → envelope conversion

## References

- Logic Pro: Track automation system
- Web Audio API: `AudioParam.linearRampToValueAtTime()`
- MediaBunny: Audio scheduling architecture

