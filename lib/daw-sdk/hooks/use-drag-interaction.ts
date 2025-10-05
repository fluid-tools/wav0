"use client"

import { useState, useEffect, useCallback, useRef } from "react"

export interface DragState {
	active: boolean
	startX: number
	startY: number
	currentX: number
	currentY: number
	deltaX: number
	deltaY: number
}

/**
 * Consolidated hook for drag interactions
 * Replaces scattered useEffect patterns for mouse/pointer events
 */
export function useDragInteraction(options: {
	onDragStart?: (e: PointerEvent, state: DragState) => void
	onDragMove?: (e: PointerEvent, state: DragState) => void
	onDragEnd?: (e: PointerEvent, state: DragState) => void
	preventDefault?: boolean
	lockScroll?: boolean
}) {
	const [isDragging, setIsDragging] = useState(false)
	const dragStateRef = useRef<DragState>({
		active: false,
		startX: 0,
		startY: 0,
		currentX: 0,
		currentY: 0,
		deltaX: 0,
		deltaY: 0,
	})

	const optionsRef = useRef(options)
	optionsRef.current = options

	const startDrag = useCallback((e: PointerEvent) => {
		const state: DragState = {
			active: true,
			startX: e.clientX,
			startY: e.clientY,
			currentX: e.clientX,
			currentY: e.clientY,
			deltaX: 0,
			deltaY: 0,
		}
		dragStateRef.current = state
		setIsDragging(true)
		optionsRef.current.onDragStart?.(e, state)
	}, [])

	useEffect(() => {
		if (!isDragging) return

		const handleMove = (e: PointerEvent) => {
			if (optionsRef.current.preventDefault) {
				e.preventDefault()
			}

			const state = dragStateRef.current
			state.currentX = e.clientX
			state.currentY = e.clientY
			state.deltaX = e.clientX - state.startX
			state.deltaY = e.clientY - state.startY

			optionsRef.current.onDragMove?.(e, state)
		}

		const handleEnd = (e: PointerEvent) => {
			const state = dragStateRef.current
			state.active = false
			optionsRef.current.onDragEnd?.(e, state)
			setIsDragging(false)
		}

		document.addEventListener("pointermove", handleMove)
		document.addEventListener("pointerup", handleEnd)
		document.addEventListener("pointercancel", handleEnd)

		// Lock scroll if requested
		if (optionsRef.current.lockScroll) {
			const style = document.body.style.overflow
			document.body.style.overflow = "hidden"
			return () => {
				document.body.style.overflow = style
				document.removeEventListener("pointermove", handleMove)
				document.removeEventListener("pointerup", handleEnd)
				document.removeEventListener("pointercancel", handleEnd)
			}
		}

		return () => {
			document.removeEventListener("pointermove", handleMove)
			document.removeEventListener("pointerup", handleEnd)
			document.removeEventListener("pointercancel", handleEnd)
		}
	}, [isDragging])

	return { isDragging, startDrag, dragState: dragStateRef.current }
}

/**
 * Hook for managing keyboard shortcuts
 */
export function useKeyboardShortcut(
	keys: string[],
	handler: (e: KeyboardEvent) => void,
	options?: { preventDefault?: boolean },
) {
	const handlerRef = useRef(handler)
	handlerRef.current = handler

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const keyCombo = [
				e.ctrlKey && "ctrl",
				e.metaKey && "meta",
				e.shiftKey && "shift",
				e.altKey && "alt",
				e.key.toLowerCase(),
			]
				.filter(Boolean)
				.join("+")

			const matches = keys.some((k) => {
				const normalized = k.toLowerCase().replace(/ /g, "+")
				return keyCombo === normalized
			})

			if (matches) {
				if (options?.preventDefault) {
					e.preventDefault()
				}
				handlerRef.current(e)
			}
		}

		document.addEventListener("keydown", handleKeyDown)
		return () => {
			document.removeEventListener("keydown", handleKeyDown)
		}
	}, [keys, options?.preventDefault])
}
