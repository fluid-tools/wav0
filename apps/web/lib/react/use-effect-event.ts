import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

export function useEffectEvent<T extends (...args: unknown[]) => unknown>(handler: T): T {
	const handlerRef = useRef(handler)
	useIsoLayoutEffect(() => {
		handlerRef.current = handler
	}, [handler])
	return useCallback((
		((...args: Parameters<T>) => handlerRef.current(...args)) as T
	), [])
}


