/**
 * MIDIService - Direct Web MIDI API wrapper
 *
 * Features:
 * - Device enumeration and hot-plug detection
 * - Message parsing (noteOn/Off, CC, pitchBend)
 * - Channel filtering
 * - EventTarget for reactive updates
 *
 * Usage:
 * ```typescript
 * const midi = new MIDIService()
 * await midi.enable()
 *
 * midi.addEventListener('noteon', (e) => {
 *   const event = (e as CustomEvent<MIDINoteOnEvent>).detail
 *   console.log(`Note ${event.note} velocity ${event.velocity}`)
 * })
 *
 * const inputs = midi.getInputs()
 * if (inputs.length > 0) {
 *   midi.connectInput(inputs[0].id)
 * }
 * ```
 */

import type {
	MIDIControlChangeEvent,
	MIDIDeviceInfo,
	MIDIInputEvent,
	MIDINoteOffEvent,
	MIDINoteOnEvent,
	MIDIPitchBendEvent,
} from "../types/midi";

// ============================================================================
// MIDIService Class
// ============================================================================

export class MIDIService extends EventTarget {
	private access: MIDIAccess | null = null;
	private connectedInputs = new Map<string, MIDIInput>();
	private channelFilter: number | "all" = "all";
	private enabled = false;

	// ===========================================================================
	// Static Methods
	// ===========================================================================

	/**
	 * Check if Web MIDI API is supported in this browser
	 * Note: Safari does not support Web MIDI API
	 */
	static isSupported(): boolean {
		return typeof navigator !== "undefined" && "requestMIDIAccess" in navigator;
	}

	// ===========================================================================
	// Lifecycle
	// ===========================================================================

	/**
	 * Request MIDI access and start listening for device changes
	 * @throws Error if Web MIDI API is not supported
	 */
	async enable(): Promise<void> {
		if (this.enabled) return;

		if (!MIDIService.isSupported()) {
			throw new Error(
				"Web MIDI API is not supported in this browser. " +
					"Safari and some mobile browsers do not support MIDI. " +
					"Please use Chrome, Firefox, or Edge on desktop.",
			);
		}

		try {
			// Request MIDI access without SysEx (not needed for note input)
			this.access = await navigator.requestMIDIAccess({ sysex: false });
			this.enabled = true;

			// Listen for device hot-plug events
			this.access.addEventListener("statechange", this.handleStateChange);

			// Emit initial device list
			this.emitDeviceChange();
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			throw new Error(`Failed to enable MIDI: ${message}`);
		}
	}

	/**
	 * Disconnect all inputs and release MIDI access
	 */
	disable(): void {
		if (!this.enabled) return;

		this.disconnectAll();

		if (this.access) {
			this.access.removeEventListener("statechange", this.handleStateChange);
		}

		this.access = null;
		this.enabled = false;
	}

	/**
	 * Check if MIDI is currently enabled
	 */
	isEnabled(): boolean {
		return this.enabled;
	}

	// ===========================================================================
	// Device Management
	// ===========================================================================

	/**
	 * Get list of available MIDI input devices
	 */
	getInputs(): MIDIDeviceInfo[] {
		if (!this.access) return [];

		const inputs: MIDIDeviceInfo[] = [];
		this.access.inputs.forEach((input) => {
			inputs.push({
				id: input.id,
				name: input.name ?? "Unknown Device",
				manufacturer: input.manufacturer ?? "Unknown",
				state: input.state as "connected" | "disconnected",
			});
		});
		return inputs;
	}

	/**
	 * Connect to a MIDI input device by ID
	 * @throws Error if MIDI not enabled or device not found
	 */
	connectInput(deviceId: string): void {
		if (!this.access) {
			throw new Error("MIDI not enabled. Call enable() first.");
		}

		const input = this.access.inputs.get(deviceId);
		if (!input) {
			throw new Error(`MIDI input device not found: ${deviceId}`);
		}

		// Avoid duplicate connections
		if (this.connectedInputs.has(deviceId)) return;

		input.addEventListener("midimessage", this.handleMIDIMessage);
		this.connectedInputs.set(deviceId, input);

		this.dispatchEvent(
			new CustomEvent("inputconnected", {
				detail: {
					id: deviceId,
					name: input.name ?? "Unknown Device",
				},
			}),
		);
	}

	/**
	 * Disconnect from a MIDI input device
	 */
	disconnectInput(deviceId: string): void {
		const input = this.connectedInputs.get(deviceId);
		if (input) {
			input.removeEventListener("midimessage", this.handleMIDIMessage);
			this.connectedInputs.delete(deviceId);

			this.dispatchEvent(
				new CustomEvent("inputdisconnected", {
					detail: { id: deviceId },
				}),
			);
		}
	}

	/**
	 * Disconnect from all MIDI input devices
	 */
	disconnectAll(): void {
		for (const input of this.connectedInputs.values()) {
			input.removeEventListener("midimessage", this.handleMIDIMessage);
		}
		this.connectedInputs.clear();
	}

	/**
	 * Get list of currently connected input device IDs
	 */
	getConnectedInputIds(): string[] {
		return Array.from(this.connectedInputs.keys());
	}

	/**
	 * Check if a specific device is currently connected
	 */
	isInputConnected(deviceId: string): boolean {
		return this.connectedInputs.has(deviceId);
	}

	// ===========================================================================
	// Channel Filtering
	// ===========================================================================

	/**
	 * Set channel filter (0-15 for specific channel, 'all' for omni)
	 * @throws Error if channel is out of range
	 */
	setChannelFilter(channel: number | "all"): void {
		if (typeof channel === "number" && (channel < 0 || channel > 15)) {
			throw new Error('Channel must be 0-15 or "all"');
		}
		this.channelFilter = channel;
	}

	/**
	 * Get current channel filter
	 */
	getChannelFilter(): number | "all" {
		return this.channelFilter;
	}

	// ===========================================================================
	// Event Handlers (Arrow functions for correct 'this' binding)
	// ===========================================================================

	private handleStateChange = (_event: Event): void => {
		this.emitDeviceChange();
	};

	private handleMIDIMessage = (event: Event): void => {
		const midiEvent = event as MIDIMessageEvent;
		if (!midiEvent.data) return;

		const parsed = this.parseMessage(midiEvent.data, midiEvent.timeStamp);

		if (parsed) {
			this.dispatchEvent(new CustomEvent(parsed.type, { detail: parsed }));
		}
	};

	// ===========================================================================
	// Message Parsing
	// ===========================================================================

	private parseMessage(
		data: Uint8Array,
		timestamp: number,
	): MIDIInputEvent | null {
		if (data.length < 2) return null;

		const status = data[0];
		const channel = status & 0x0f;
		const command = status & 0xf0;

		// Apply channel filter
		if (this.channelFilter !== "all" && channel !== this.channelFilter) {
			return null;
		}

		switch (command) {
			case 0x90: // Note On
				// Velocity 0 on Note On is treated as Note Off per MIDI spec
				if (data[2] > 0) {
					return {
						type: "noteon",
						note: data[1],
						velocity: data[2],
						channel,
						timestamp,
					} satisfies MIDINoteOnEvent;
				}
				// Fall through to Note Off handling
				return {
					type: "noteoff",
					note: data[1],
					velocity: 0,
					channel,
					timestamp,
				} satisfies MIDINoteOffEvent;

			case 0x80: // Note Off
				return {
					type: "noteoff",
					note: data[1],
					velocity: data[2],
					channel,
					timestamp,
				} satisfies MIDINoteOffEvent;

			case 0xb0: // Control Change
				return {
					type: "controlchange",
					controller: data[1],
					value: data[2],
					channel,
					timestamp,
				} satisfies MIDIControlChangeEvent;

			case 0xe0: {
				// Pitch Bend
				// Pitch bend is 14-bit: LSB (data[1]) + MSB (data[2])
				// Center is 8192 (0x2000), range is 0-16383
				// We convert to -8192 to +8191 for easier use
				const rawValue = (data[2] << 7) | data[1];
				const centeredValue = rawValue - 8192;
				return {
					type: "pitchbend",
					value: centeredValue,
					channel,
					timestamp,
				} satisfies MIDIPitchBendEvent;
			}

			default:
				// Ignore other message types for now:
				// 0xA0 = Aftertouch (polyphonic)
				// 0xC0 = Program Change
				// 0xD0 = Channel Pressure (aftertouch)
				// 0xF0+ = System messages
				return null;
		}
	}

	// ===========================================================================
	// Internal Helpers
	// ===========================================================================

	private emitDeviceChange(): void {
		this.dispatchEvent(
			new CustomEvent("devicechange", {
				detail: { inputs: this.getInputs() },
			}),
		);
	}
}

// ============================================================================
// Type Augmentation for Event Listeners
// ============================================================================

/**
 * Event map for MIDIService event listeners
 *
 * Usage with type-safe addEventListener:
 * ```typescript
 * midi.addEventListener('noteon', (e) => {
 *   const event = (e as CustomEvent<MIDINoteOnEvent>).detail
 *   // event is typed as MIDINoteOnEvent
 * })
 * ```
 */
export interface MIDIServiceEventMap {
	noteon: CustomEvent<MIDINoteOnEvent>;
	noteoff: CustomEvent<MIDINoteOffEvent>;
	controlchange: CustomEvent<MIDIControlChangeEvent>;
	pitchbend: CustomEvent<MIDIPitchBendEvent>;
	devicechange: CustomEvent<{ inputs: MIDIDeviceInfo[] }>;
	inputconnected: CustomEvent<{ id: string; name: string }>;
	inputdisconnected: CustomEvent<{ id: string }>;
}

// ============================================================================
// Singleton Instance (Optional)
// ============================================================================

let _sharedInstance: MIDIService | null = null;

/**
 * Get a shared singleton instance of MIDIService
 * Useful for applications that only need one MIDI service
 */
export function getSharedMIDIService(): MIDIService {
	if (!_sharedInstance) {
		_sharedInstance = new MIDIService();
	}
	return _sharedInstance;
}
