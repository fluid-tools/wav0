"use client"

import { useEffect, useRef } from "react"

export { useDAWInitialization } from "./use-daw-initialization"

/**
 * Consolidated hook for playback time synchronization
 * Replaces scattered useEffect patterns for time updates
 */
export function usePlaybackSync(
	isPlaying: boolean,
	currentTime: number,
	callback: (time: number) => void,
) {
	const callbackRef = useRef(callback)
	callbackRef.current = callback

	useEffect(() => {
		if (!isPlaying) return

		let frameId: number
		const update = () => {
			callbackRef.current(currentTime)
			frameId = requestAnimationFrame(update)
		}

		frameId = requestAnimationFrame(update)

		return () => {
			cancelAnimationFrame(frameId)
		}
	}, [isPlaying, currentTime])
}

/**
 * Hook for managing scroll synchronization between multiple elements
 */
export function useScrollSync(
	refs: React.RefObject<HTMLElement>[],
	onScroll?: (scrollLeft: number, scrollTop: number) => void,
) {
	const scrollingRef = useRef(false)
	const onScrollRef = useRef(onScroll)
	onScrollRef.current = onScroll

	useEffect(() => {
		const elements = refs
			.map((ref) => ref.current)
			.filter((el): el is HTMLElement => el !== null)
		if (elements.length === 0) return

		const handleScroll = (e: Event) => {
			if (scrollingRef.current) return
			scrollingRef.current = true

			const target = e.target as HTMLElement
			const { scrollLeft, scrollTop } = target

			for (const el of elements) {
				if (el !== target) {
					el.scrollLeft = scrollLeft
					el.scrollTop = scrollTop
				}
			}

			onScrollRef.current?.(scrollLeft, scrollTop)

			requestAnimationFrame(() => {
				scrollingRef.current = false
			})
		}

		for (const el of elements) {
			el.addEventListener("scroll", handleScroll)
		}

		return () => {
			for (const el of elements) {
				el.removeEventListener("scroll", handleScroll)
			}
		}
	}, [refs])
}

/**
 * Hook for managing resize observers
 */
export function useResizeObserver(
	ref: React.RefObject<HTMLElement>,
	callback: (entry: ResizeObserverEntry) => void,
) {
	const callbackRef = useRef(callback)
	callbackRef.current = callback

	useEffect(() => {
		const el = ref.current
		if (!el) return

		const ro = new ResizeObserver((entries) => {
			for (const entry of entries) {
				callbackRef.current(entry)
			}
		})

		ro.observe(el)

		return () => {
			ro.disconnect()
		}
	}, [ref])
}

/**
 * Hook for managing document event listeners
 */
export function useDocumentEvent<K extends keyof DocumentEventMap>(
	event: K,
	handler: (e: DocumentEventMap[K]) => void,
	options?: AddEventListenerOptions,
) {
	const handlerRef = useRef(handler)
	handlerRef.current = handler

	useEffect(() => {
		const listener = (e: DocumentEventMap[K]) => handlerRef.current(e)
		document.addEventListener(event, listener, options)
		return () => {
			document.removeEventListener(event, listener, options)
		}
	}, [event, options])
}

/**
 * Hook for managing window event listeners
 */
export function useWindowEvent<K extends keyof WindowEventMap>(
	event: K,
	handler: (e: WindowEventMap[K]) => void,
	options?: AddEventListenerOptions,
) {
	const handlerRef = useRef(handler)
	handlerRef.current = handler

	useEffect(() => {
		const listener = (e: WindowEventMap[K]) => handlerRef.current(e)
		window.addEventListener(event, listener, options)
		return () => {
			window.removeEventListener(event, listener, options)
		}
	}, [event, options])
}

/**
 * Hook for managing custom events
 */
export function useCustomEvent<T = unknown>(
	event: string,
	handler: (detail: T) => void,
) {
	const handlerRef = useRef(handler)
	handlerRef.current = handler

	useEffect(() => {
		const listener = (e: Event) => {
			const customEvent = e as CustomEvent<T>
			handlerRef.current(customEvent.detail)
		}
		window.addEventListener(event, listener)
		return () => {
			window.removeEventListener(event, listener)
		}
	}, [event])
}
