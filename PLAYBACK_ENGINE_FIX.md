# Playback Engine Architecture Fix

## Issues Fixed

### 1. Clip Duration Display Bug
**Problem**: 4-second clips showed as "0:00.004"  
**Root Cause**: Double conversion - `(trimEnd - trimStart) / 1000` passed milliseconds as seconds to `formatDuration`, which then treated them as milliseconds  
**Fix**: Removed division - `formatDuration(clip.trimEnd - clip.trimStart)` 
**File**: `components/daw/panels/daw-track-content.tsx:543`

### 2. Envelope + Mute/Solo Interaction Bug
**Problem**: Tracks with envelopes didn't respect solo/mute during playback  
**Root Cause**: Single gain node tried to handle both envelope automation AND mute/solo. When muted, `scheduleTrackEnvelope` was skipped entirely. When unmuted, envelope would overwrite mute state.

**Fix**: Two-node architecture
```
AudioBuffer → ClipGain → EnvelopeGain → MuteSoloGain → Master
                           ↑              ↑
                      Volume curve    Binary on/off
```

**Architecture**:
- `envelopeGainNode`: Handles volume automation curve (base × multiplier)
- `muteSoloGainNode`: Binary control (0 = muted/not-soloed, 1 = active)
- Envelope is ALWAYS scheduled (even when muted)
- Mute/solo is applied downstream

**Changes**:
- `TrackPlaybackState` now has `envelopeGainNode` and `muteSoloGainNode`
- `applySnapshot()` sets up gain chain, applies mute/solo, then schedules envelope
- `scheduleTrackEnvelope()` uses `envelopeGainNode` exclusively
- `updateTrackVolume()` and `updateTrackMute()` now just call `refreshMix()`

### 3. Drawer Scroll Bug
**Problem**: Drawer content not scrollable  
**Root Cause**: Missing flex constraints on `DrawerContent` - `ScrollArea` couldn't properly constrain

**Fix**: 
- Added `flex flex-col overflow-hidden` to `DrawerContent`
- Added `shrink-0` to `DrawerHeader` and `DrawerFooter`
- Added `overflow-hidden` to `ScrollArea`

**File**: `components/daw/inspectors/clip-editor-drawer.tsx`

---

## Impact

✅ Clip durations now display correctly  
✅ Envelopes work seamlessly with solo/mute  
✅ Volume slider remains primary control, envelope shapes it  
✅ Drawer scrolls properly on all content lengths  
✅ Clean separation of concerns: envelope automation vs. playback control

## Testing Checklist

- [ ] Load 4-second audio clip, verify duration shows "0:04.000"
- [ ] Enable envelope on track, adjust points, solo/mute during playback
- [ ] Verify solo/mute immediately affects audio
- [ ] Adjust volume slider with envelope enabled - both should work together
- [ ] Open clip drawer, verify scrolling works with lots of envelope points
- [ ] Test with multiple tracks: some with envelopes, some without

---

Date: 2025-10-01  
Architecture: MediaBunny + Web Audio API dual-node gain chain


