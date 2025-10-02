# Audio Curves Implementation Plan

**Date**: 2025-10-02  
**Status**: 🔨 **In Progress - Research & Design Complete**

---

## Current State Analysis

### ✅ Confirmed: Only Partial Implementation

**Defined Curve Types** (in `daw-store.ts`):
```typescript
export type TrackEnvelopeCurve = "linear" | "easeIn" | "easeOut" | "sCurve";
```

**Actually Implemented** (in `playback-engine.ts`):
```typescript
switch (point.curve) {
	case "easeIn":
		envelopeGain.gain.exponentialRampToValueAtTime(targetGain, at);
		break;
	default: // ← "linear", "easeOut", "sCurve" all fall through here
		envelopeGain.gain.linearRampToValueAtTime(targetGain, at);
		break;
}
```

**Result**: Only `easeIn` (exponential) and `linear` are functional. `easeOut` and `sCurve` are defined but not implemented.

---

## Professional DAW Curve Standards

### 1. **Linear** ✅ *Implemented*
- **Math**: Constant rate of change
- **Use**: Quick, mechanical transitions
- **Web Audio**: `linearRampToValueAtTime()`

### 2. **Exponential (EaseIn)** ✅ *Implemented*
- **Math**: Slow start, accelerating end
- **Use**: Natural-sounding fade-ins, attack curves
- **Web Audio**: `exponentialRampToValueAtTime()`
- **Note**: Cannot reach 0 (use 0.0001 floor)

### 3. **Logarithmic (EaseOut)** ❌ *Missing*
- **Math**: Fast start, decelerating end
- **Use**: Natural-sounding fade-outs, release curves
- **Perception**: Matches human hearing (dB scale)
- **Implementation**: Custom curve via `setValueCurveAtTime()`

### 4. **S-Curve (Cosine)** ❌ *Missing*
- **Math**: Slow → Fast → Slow (smooth bell curve)
- **Use**: Crossfades, smooth transitions
- **Formula**: `0.5 - 0.5 * cos(π * t)` where t ∈ [0,1]
- **Implementation**: Custom curve via `setValueCurveAtTime()`

### 5. **Additional Pro Curves** (Future Consideration)
- **Sine**: Similar to cosine, different phase
- **Quadratic**: Parabolic curves
- **Cubic**: More extreme S-curves

---

## Curve Shape Parameter (0–1)

Professional DAWs (Logic Pro, Pro Tools, Reaper) include a **curve tension/shape parameter**:

### **Purpose**
- Adjusts the "steepness" or "gentleness" of non-linear curves
- Value range: 0.0 (gentlest) to 1.0 (steepest)
- Default: 0.5 (balanced)

### **Application by Curve Type**

#### **Logarithmic (EaseOut)**
```
value(t) = 1 - (1 - t)^(1 + shape * 3)

shape = 0.1 → gentle slope (long fade, sudden end)
shape = 0.5 → balanced
shape = 0.9 → steep slope (sudden start, long fade)
```

#### **Exponential (EaseIn)**
```
value(t) = t^(1 + shape * 3)

shape = 0.1 → gentle curve
shape = 0.5 → balanced
shape = 0.9 → steep curve
```

#### **S-Curve**
```
// Adjust cosine frequency
freq = 1 + shape * 2
value(t) = 0.5 - 0.5 * cos(π * freq * t) / cos(π * (freq - 1) * 0.5)

shape = 0.1 → wide, gentle S
shape = 0.5 → balanced S
shape = 0.9 → tight, sharp S
```

---

## Implementation Strategy

### **Phase 1: Core Curve Functions** ✅ *Ready to Implement*

Create `lib/audio/curve-functions.ts`:

```typescript
export type CurveType = "linear" | "easeIn" | "easeOut" | "sCurve";

/**
 * Generate curve values for Web Audio API
 * @param type - Curve type
 * @param startValue - Starting value
 * @param endValue - Ending value
 * @param duration - Duration in seconds
 * @param shape - Curve shape parameter (0-1, default 0.5)
 * @param sampleRate - Audio context sample rate
 * @returns Float32Array of curve values
 */
export function generateCurve(
	type: CurveType,
	startValue: number,
	endValue: number,
	duration: number,
	shape: number = 0.5,
	sampleRate: number = 48000,
): Float32Array {
	const numSamples = Math.max(2, Math.ceil(duration * sampleRate));
	const curve = new Float32Array(numSamples);
	const delta = endValue - startValue;

	// Clamp shape to valid range
	const s = Math.max(0, Math.min(1, shape));

	for (let i = 0; i < numSamples; i++) {
		const t = i / (numSamples - 1); // 0 to 1

		let value: number;
		switch (type) {
			case "linear":
				value = startValue + delta * t;
				break;

			case "easeIn": // Exponential
				// Exponent increases with shape (steeper curve)
				const expPower = 1 + s * 3; // Range: 1 to 4
				value = startValue + delta * Math.pow(t, expPower);
				break;

			case "easeOut": // Logarithmic
				// Inverse of easeIn
				const logPower = 1 + s * 3;
				value = startValue + delta * (1 - Math.pow(1 - t, logPower));
				break;

			case "sCurve": // Cosine
				// Adjust frequency for shape
				const freq = 1 + s * 2; // Range: 1 to 3
				const normalized = 0.5 - 0.5 * Math.cos(Math.PI * freq * t);
				// Normalize to [0,1] range
				const rangeMax = 0.5 - 0.5 * Math.cos(Math.PI * freq);
				value = startValue + delta * (normalized / rangeMax);
				break;

			default:
				value = startValue + delta * t;
		}

		curve[i] = value;
	}

	return curve;
}

/**
 * Apply curve to AudioParam using appropriate Web Audio method
 */
export function applyCurveToParam(
	param: AudioParam,
	type: CurveType,
	startValue: number,
	endValue: number,
	startTime: number,
	duration: number,
	shape: number = 0.5,
	audioContext: AudioContext,
): void {
	const now = audioContext.currentTime;
	const at = Math.max(startTime, now);

	// Cancel any scheduled changes after current time
	param.cancelScheduledValues(at);
	param.setValueAtTime(startValue, at);

	switch (type) {
		case "linear":
			param.linearRampToValueAtTime(endValue, at + duration);
			break;

		case "easeIn":
			// Use exponential ramp (native Web Audio)
			const safeEnd = Math.max(endValue, 0.0001); // Avoid 0
			param.exponentialRampToValueAtTime(safeEnd, at + duration);
			break;

		case "easeOut":
		case "sCurve":
			// Use custom curve
			const curve = generateCurve(
				type,
				startValue,
				endValue,
				duration,
				shape,
				audioContext.sampleRate,
			);
			param.setValueCurveAtTime(curve, at, duration);
			break;

		default:
			param.linearRampToValueAtTime(endValue, at + duration);
	}
}
```

---

### **Phase 2: Update Type Definitions**

#### **A. Add Shape Parameter to EnvelopePoint**

`lib/state/daw-store.ts`:
```typescript
export type TrackEnvelopePoint = {
	id: string;
	time: number;
	value: number; // 0-4 linear gain multiplier
	curve?: TrackEnvelopeCurve;
	curveShape?: number; // NEW: 0-1, default 0.5
};
```

#### **B. Add Fade Curve Types**

```typescript
export type FadeCurve = "linear" | "exponential" | "logarithmic" | "sCurve";

export type Clip = {
	// ... existing fields
	fadeIn?: number;
	fadeOut?: number;
	fadeInCurve?: FadeCurve; // NEW: default "logarithmic"
	fadeOutCurve?: FadeCurve; // NEW: default "logarithmic"
	fadeInShape?: number; // NEW: 0-1, default 0.5
	fadeOutShape?: number; // NEW: 0-1, default 0.5
};
```

---

### **Phase 3: Update PlaybackEngine**

`lib/audio/playback-engine.ts`:

```typescript
import { applyCurveToParam } from "./curve-functions";

// In scheduleTrackEnvelope():
for (let i = 1; i < sorted.length; i++) {
	const prevPoint = sorted[i - 1];
	const point = sorted[i];
	
	const prevTime = prevPoint.time / 1000;
	const curTime = point.time / 1000;
	const duration = curTime - prevTime;
	
	const startValue = baseVolume * prevPoint.value;
	const endValue = baseVolume * point.value;
	const shape = prevPoint.curveShape ?? 0.5;
	const curve = prevPoint.curve || "linear";
	
	applyCurveToParam(
		envelopeGainNode.gain,
		curve,
		startValue,
		endValue,
		this.startTime + prevTime,
		duration,
		shape,
		this.audioContext,
	);
}
```

---

### **Phase 4: Update UI Components**

#### **A. Envelope Editor** (`components/daw/inspectors/envelope-editor.tsx`)

Add curve shape slider for each point:

```typescript
<div className="space-y-1.5">
	<label className="text-xs font-medium text-muted-foreground">
		Curve Shape
	</label>
	<div className="flex items-center gap-2">
		<input
			type="range"
			min={0}
			max={100}
			step={1}
			value={(point.curveShape ?? 0.5) * 100}
			onChange={(e) =>
				handlePointChange(originalIndex, {
					curveShape: parseInt(e.target.value, 10) / 100,
				})
			}
			className="flex-1"
		/>
		<span className="text-xs font-mono text-muted-foreground w-12">
			{((point.curveShape ?? 0.5) * 100).toFixed(0)}%
		</span>
	</div>
	<div className="flex justify-between text-[10px] text-muted-foreground">
		<span>Gentle</span>
		<span>Steep</span>
	</div>
</div>
```

#### **B. Clip Fade Editor** (`components/daw/inspectors/clip-editor-drawer.tsx`)

Add fade curve type and shape controls:

```typescript
<div className="space-y-3">
	<div>
		<label className="text-xs font-medium">Fade In Curve</label>
		<Select
			value={clip.fadeInCurve || "logarithmic"}
			onValueChange={(value) =>
				updateClip(track.id, clip.id, { fadeInCurve: value as FadeCurve })
			}
		>
			<SelectItem value="linear">Linear</SelectItem>
			<SelectItem value="exponential">Exponential</SelectItem>
			<SelectItem value="logarithmic">Logarithmic (Natural)</SelectItem>
			<SelectItem value="sCurve">S-Curve (Smooth)</SelectItem>
		</Select>
	</div>
	
	<div>
		<label className="text-xs font-medium">Shape</label>
		<input
			type="range"
			min={0}
			max={100}
			value={(clip.fadeInShape ?? 0.5) * 100}
			onChange={(e) =>
				updateClip(track.id, clip.id, {
					fadeInShape: parseInt(e.target.value, 10) / 100,
				})
			}
		/>
	</div>
</div>
```

#### **C. Automation Lane** (`components/daw/panels/automation-lane.tsx`)

Update segment context menu to show shape slider when non-linear curve is selected.

---

### **Phase 5: Visual Curve Previews**

Create `components/daw/controls/curve-preview.tsx`:

```typescript
export function CurvePreview({ 
	type, 
	shape = 0.5,
	width = 80,
	height = 40,
}: {
	type: CurveType;
	shape?: number;
	width?: number;
	height?: number;
}) {
	// Generate SVG path from curve
	const points = generateCurve(type, 0, 1, 0.1, shape, 100);
	const pathData = points.map((value, i) => {
		const x = (i / (points.length - 1)) * width;
		const y = height - value * height;
		return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
	}).join(" ");
	
	return (
		<svg width={width} height={height} className="inline-block">
			<path
				d={pathData}
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
			/>
		</svg>
	);
}
```

---

## Testing Strategy

### Unit Tests
- [ ] `generateCurve()` for each curve type
- [ ] Edge cases (duration = 0, startValue = endValue)
- [ ] Shape parameter boundaries (0, 0.5, 1)

### Integration Tests
- [ ] Automation curves during playback
- [ ] Fade curves on clips
- [ ] Curve switching mid-playback

### Audio Quality Tests
- [ ] Listen to each curve type (fade in/out)
- [ ] Verify no clicks/pops at curve boundaries
- [ ] Compare to Logic Pro/Pro Tools reference

---

## Migration Strategy

### Backward Compatibility
```typescript
// Default curve type for existing clips without fadeInCurve
const effectiveFadeInCurve = clip.fadeInCurve || "logarithmic";
const effectiveFadeInShape = clip.fadeInShape ?? 0.5;

// Default curve shape for existing envelope points
const effectiveShape = point.curveShape ?? 0.5;
```

### Data Migration (Optional)
```typescript
// One-time migration to add default values
export const migrateToV2 = (tracks: Track[]): Track[] => {
	return tracks.map(track => ({
		...track,
		clips: track.clips?.map(clip => ({
			...clip,
			fadeInCurve: clip.fadeInCurve || "logarithmic",
			fadeOutCurve: clip.fadeOutCurve || "logarithmic",
			fadeInShape: clip.fadeInShape ?? 0.5,
			fadeOutShape: clip.fadeOutShape ?? 0.5,
		})),
		volumeEnvelope: track.volumeEnvelope ? {
			...track.volumeEnvelope,
			points: track.volumeEnvelope.points.map(p => ({
				...p,
				curveShape: p.curveShape ?? 0.5,
			})),
		} : undefined,
	}));
};
```

---

## Timeline

### Sprint 1: Core Implementation (2-3 days)
- [x] Research complete
- [ ] Create `curve-functions.ts`
- [ ] Update type definitions
- [ ] Implement in `PlaybackEngine`
- [ ] Basic unit tests

### Sprint 2: UI Integration (2-3 days)
- [ ] Envelope editor curve shape controls
- [ ] Clip fade curve type + shape selectors
- [ ] Curve preview components
- [ ] Visual feedback in automation lane

### Sprint 3: Polish & Testing (1-2 days)
- [ ] Audio quality testing
- [ ] Performance optimization
- [ ] Documentation
- [ ] User guide updates

---

## Success Criteria

✅ **Functional**
- All 4 curve types work correctly in playback
- Shape parameter (0-1) produces audible differences
- No audio artifacts (clicks, pops)

✅ **UI**
- Intuitive curve selection (dropdown/buttons)
- Visual curve preview
- Shape slider with real-time feedback

✅ **Performance**
- No performance degradation
- Smooth playback with complex automation

✅ **Quality**
- Matches professional DAW standards
- Natural-sounding fades
- Accurate automation curves

---

## Next Steps

1. **Create `lib/audio/curve-functions.ts`** with production-ready implementations
2. **Update type definitions** in `daw-store.ts`
3. **Refactor `PlaybackEngine.scheduleTrackEnvelope()`** to use new curve system
4. **Build UI components** for curve selection and shape adjustment
5. **Test thoroughly** with audio quality focus
6. **Document** curve behavior for users

**Estimated Total Time**: 5-8 days for complete, production-ready implementation.

**Priority**: High - This is fundamental DAW functionality that users expect.

