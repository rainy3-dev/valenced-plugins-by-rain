const CONFIG = {
	// Extra vertical stretch at full speed (0.035 = 3.5%). Higher = more smear.
	maxStretch: 0.12,
	// Opacity at full speed. 1 = no fade, lower = ghostier.
	minOpacity: 0.5,
	// How long the smear fades out after you stop scrolling (ms).
	fadeOutMs: 500,
	// Scroll speed (px per ms) that counts as "full blur".
	fullSpeed: 2.5,
	// How fast the smear ramps up (ms).
	attackMs: 70,
	// How long without scroll events before we call it "stopped" (ms).
	idleMs: 60,
}

export default plugin({
	start({ cleanup, unscoped }) {
		const { react } = unscoped
		const { ReactNative, React, jsxRuntime } = react
		const { Animated, Easing, StyleSheet } = ReactNative

		const intensity = new Animated.Value(0)
		let current = 0
		let lastY: number | null = null
		let lastT = 0
		let idleTimer: ReturnType<typeof setTimeout> | undefined
		let loggedMatch = false

		const fadeOut = () => {
			current = 0
			lastY = null
			intensity.stopAnimation()
			Animated.timing(intensity, {
				toValue: 0,
				duration: CONFIG.fadeOutMs,
				easing: Easing.out(Easing.cubic),
				useNativeDriver: true,
			}).start()
		}

		const handleScroll = (e: any) => {
			const y = e?.nativeEvent?.contentOffset?.y
			if (typeof y !== 'number') return

			const now = Date.now()
			if (lastY !== null && now > lastT) {
				const speed = Math.abs(y - lastY) / (now - lastT)
				const target = Math.min(1, speed / CONFIG.fullSpeed)
				const next = Math.max(target, current * 0.85)
				if (Math.abs(next - current) > 0.03) {
					current = next
					intensity.stopAnimation()
					Animated.timing(intensity, {
						toValue: next,
						duration: CONFIG.attackMs,
						easing: Easing.out(Easing.quad),
						useNativeDriver: true,
					}).start()
				}
			}
			lastY = y
			lastT = now

			if (idleTimer) clearTimeout(idleTimer)
			idleTimer = setTimeout(fadeOut, CONFIG.idleMs) as unknown as ReturnType<typeof setTimeout>
		}

		// The chat is an inverted list, which React Native draws with scaleY: -1.
		const isInverted = (style: unknown) => {
			const flat = StyleSheet.flatten(style as any) as any
			const transform = flat?.transform
			return Array.isArray(transform) && transform.some((t: any) => t && t.scaleY === -1)
		}

		const wrapperStyle = {
			flex: 1,
			opacity: intensity.interpolate({
				inputRange: [0, 1],
				outputRange: [1, CONFIG.minOpacity],
			}),
			transform: [
				{
					scaleY: intensity.interpolate({
						inputRange: [0, 1],
						outputRange: [1, 1 + CONFIG.maxStretch],
					}),
				},
			],
		}

		const Wrapper = (props: { children?: unknown }) =>
			React.createElement(Animated.View, { style: wrapperStyle, collapsable: false }, props.children as any)

		const unpatch = jsxRuntime.insteadJSX('RCTScrollView', ([type, props, key], jsx) => {
			const p = props as any
			if (p.horizontal || !isInverted(p.style)) return jsx(type, props, key)

			if (!loggedMatch) {
				loggedMatch = true
				console.log('[scroll-blur] hooked an inverted scroll view (chat list)')
			}

			const original = p.onScroll
			const patched = {
				...p,
				onScroll: (e: unknown) => {
					handleScroll(e)
					return original?.(e)
				},
			}

			return React.createElement(Wrapper, null, jsx(type, patched, key)) as any
		})

		cleanup(unpatch)
		cleanup(() => {
			if (idleTimer) clearTimeout(idleTimer)
			intensity.stopAnimation()
			intensity.setValue(0)
		})
	},
})
