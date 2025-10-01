"use client";

// OPFS (Origin Private File System) utilities for storing audio files locally

export class OPFSManager {
	private static instance: OPFSManager;
	private opfsRoot: FileSystemDirectoryHandle | null = null;

	private constructor() {}

	static getInstance(): OPFSManager {
		if (!OPFSManager.instance) {
			OPFSManager.instance = new OPFSManager();
		}
		return OPFSManager.instance;
	}

	async init(): Promise<void> {
		if (typeof window === "undefined" || !("navigator" in window)) {
			throw new Error("OPFS is only available in browser environments");
		}

		if (!("storage" in navigator) || !navigator.storage.getDirectory) {
			throw new Error("OPFS is not supported in this browser");
		}

		try {
			this.opfsRoot = await navigator.storage.getDirectory();
		} catch (error) {
			throw new Error(`Failed to initialize OPFS: ${error}`);
		}
	}

	private async ensureInit(): Promise<void> {
		if (!this.opfsRoot) {
			await this.init();
		}
	}

	async saveAudioFile(fileId: string, audioBuffer: ArrayBuffer): Promise<void> {
		await this.ensureInit();

		if (!this.opfsRoot) {
			throw new Error("OPFS not initialized");
		}

		try {
			// Create audio directory if it doesn't exist
			const audioDir = await this.opfsRoot.getDirectoryHandle("audio", {
				create: true,
			});

			// Save the audio file
			const fileHandle = await audioDir.getFileHandle(`${fileId}.wav`, {
				create: true,
			});
			const writable = await fileHandle.createWritable();

			await writable.write(audioBuffer);
			await writable.close();
		} catch (error) {
			throw new Error(`Failed to save audio file: ${error}`);
		}
	}

	async loadAudioFile(fileId: string): Promise<ArrayBuffer | null> {
		await this.ensureInit();

		if (!this.opfsRoot) {
			throw new Error("OPFS not initialized");
		}

		try {
			const audioDir = await this.opfsRoot.getDirectoryHandle("audio");
			const fileHandle = await audioDir.getFileHandle(`${fileId}.wav`);
			const file = await fileHandle.getFile();

			return await file.arrayBuffer();
		} catch (error) {
			if (error instanceof DOMException && error.name === "NotFoundError") {
				return null;
			}
			throw new Error(`Failed to load audio file: ${error}`);
		}
	}

	async deleteAudioFile(fileId: string): Promise<void> {
		await this.ensureInit();

		if (!this.opfsRoot) {
			throw new Error("OPFS not initialized");
		}

		try {
			const audioDir = await this.opfsRoot.getDirectoryHandle("audio");
			await audioDir.removeEntry(`${fileId}.wav`);
		} catch (error) {
			if (error instanceof DOMException && error.name === "NotFoundError") {
				return; // File doesn't exist, consider it deleted
			}
			throw new Error(`Failed to delete audio file: ${error}`);
		}
	}

	async listAudioFiles(): Promise<string[]> {
		await this.ensureInit();

		if (!this.opfsRoot) {
			throw new Error("OPFS not initialized");
		}

		try {
			const audioDir = await this.opfsRoot.getDirectoryHandle("audio");
			const files: string[] = [];

			// Iterate directory entries (File System Access API)
			// TypeScript lacks async iterator typing on FileSystemDirectoryHandle.entries()
			// so we use a for-await over `as unknown as AsyncIterable<[string, FileSystemHandle]>`.
			for await (const [name, handle] of audioDir as unknown as AsyncIterable<
				[string, FileSystemHandle]
			>) {
				if (handle.kind === "file" && name.endsWith(".wav")) {
					files.push(name.replace(".wav", ""));
				}
			}

			return files;
		} catch (error) {
			if (error instanceof DOMException && error.name === "NotFoundError") {
				return [];
			}
			throw new Error(`Failed to list audio files: ${error}`);
		}
	}

	async getStorageUsage(): Promise<{ used: number; quota: number }> {
		if (typeof window === "undefined" || !("navigator" in window)) {
			return { used: 0, quota: 0 };
		}

		if (!navigator.storage || !navigator.storage.estimate) {
			return { used: 0, quota: 0 };
		}

		try {
			const estimate = await navigator.storage.estimate();
			return {
				used: estimate.usage || 0,
				quota: estimate.quota || 0,
			};
		} catch {
			return { used: 0, quota: 0 };
		}
	}

	async clearAllData(): Promise<void> {
		await this.ensureInit();

		if (!this.opfsRoot) {
			throw new Error("OPFS not initialized");
		}

		try {
			await this.opfsRoot.removeEntry("audio", { recursive: true });
		} catch (error) {
			if (error instanceof DOMException && error.name === "NotFoundError") {
				return; // Directory doesn't exist, consider it cleared
			}
			throw new Error(`Failed to clear data: ${error}`);
		}
	}
}

// Utility functions for working with audio files
export async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as ArrayBuffer);
		reader.onerror = () => reject(reader.error);
		reader.readAsArrayBuffer(file);
	});
}

export async function arrayBufferToAudioBuffer(
	arrayBuffer: ArrayBuffer,
	audioContext: AudioContext,
): Promise<AudioBuffer> {
	return await audioContext.decodeAudioData(arrayBuffer.slice(0));
}

export function generateTrackId(): string {
	return crypto.randomUUID();
}

export function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 Bytes";

	const k = 1024;
	const sizes = ["Bytes", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

export function formatDuration(durationMs: number): string {
	if (!Number.isFinite(durationMs)) return "0:00.000";
	const totalMs = Math.max(0, Math.round(durationMs));
	const minutes = Math.floor(totalMs / 60000);
	const seconds = Math.floor((totalMs % 60000) / 1000)
		.toString()
		.padStart(2, "0");
	const milliseconds = (totalMs % 1000).toString().padStart(3, "0");
	return `${minutes}:${seconds}.${milliseconds}`;
}

// Export singleton instance
export const opfsManager = OPFSManager.getInstance();
