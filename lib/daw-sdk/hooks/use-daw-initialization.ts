"use client"

import { useEffect, useState } from "react"
import { audioService } from "../core/audio-service"
import { playbackService } from "../core/playback-service"

/**
 * Initialize DAW SDK on app mount
 * This hook ensures services are ready before use
 */
export function useDAWInitialization() {
	const [isInitialized, setIsInitialized] = useState(false)
	const [error, setError] = useState<Error | null>(null)

	useEffect(() => {
		let mounted = true

		async function initialize() {
			try {
				// Initialize audio context
				await audioService.getAudioContext()
				
				if (mounted) {
					setIsInitialized(true)
					console.log("[DAW SDK] Initialized successfully")
				}
			} catch (err) {
				if (mounted) {
					const error = err instanceof Error ? err : new Error(String(err))
					setError(error)
					console.error("[DAW SDK] Initialization failed:", error)
				}
			}
		}

		initialize()

		return () => {
			mounted = false
		}
	}, [])

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			Promise.all([
				audioService.cleanup(),
				playbackService.cleanup(),
			]).catch((err) => {
				console.error("[DAW SDK] Cleanup failed:", err)
			})
		}
	}, [])

	return { isInitialized, error }
}
