const CONFIG = {
	maxStretch: 0.12,
	minOpacity: 0.5,
	fadeOutMs: 500,
	fullSpeed: 2.5,
	attackMs: 70,
	idleMs: 60,
	debug: true,
	applyToAll: true,
}

export default plugin({
	start({ cleanup, unscoped }) {
		const { react } = unscoped
		const { ReactNative, React, jsxRuntime } = react
		const { Animated, Easing, StyleSheet, Alert } = ReactNative

		const say = (title: string, msg: string) => {
			if (!CONFIG.debug) return
			setTimeout(() => {
				try {
					Alert.alert(title, msg)
				} catch {}
			}, 0)
		}
		let popups = 0
		const reported = new Set<string>()

		const intensity = new Animated.Value(0)
		let current = 0
		let lastY: number | null = null
		let lastT = 0
		let idleTimer: ReturnType<typeof setTimeout> | undefined
		let testDone = false
		let holdUntil = 0

		const fadeOut = () => {
			current = 0
			lastY = null
			intensity.stopAnimation()
			Animated.timing(intensity, {
				toValue: 0,
				duration: CONFIG.fadeOutMs,
				easing: Easing.out(Easing.cubic),
				useNativeDriver: false,
			}).start()
		}

		const handleScroll = (e: any) => {
			const y = e?.nativeEvent?.contentOffset?.y
			if (typeof y !== 'number') return

			const now = Date.now()
			if (CONFIG.debug && !testDone) {
				testDone = true
				holdUntil = now + 1500
				intensity.setValue(1)
				setTimeout(fadeOut, 1500)
				say('Scroll Blur test', 'Full-strength effect for 1.5s. Did the chat stretch/fade?')
			}
			if (now < holdUntil) return
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
						useNativeDriver: false,
					}).start()
				}
			}
			lastY = y
			lastT = now

			if (idleTimer) clearTimeout(idleTimer)
			idleTimer = setTimeout(fadeOut, CONFIG.idleMs) as unknown as ReturnType<typeof setTimeout>
		}

		const isInverted = (style: unknown) => {
			const flat = StyleSheet.flatten(style as any) as any
			const transform = flat?.transform
			return Array.isArray(transform) && transform.some((t: any) => t && t.scaleY === -1)
		}

		const wrapperStyle = {
			flex: 1,
			borderWidth: CONFIG.debug ? 3 : 0,
			borderColor: 'red',
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
			const inverted = isInverted(p.style)

			const tf = (StyleSheet.flatten(p.style as any) as any)?.transform
			const desc = `props: ${Object.keys(p).filter((k) => k !== 'children').slice(0, 16).join(',')} | onScroll=${typeof p.onScroll} | inverted=${String(p.inverted)} | transform=${JSON.stringify(tf)}`

			if (p.horizontal || !(inverted || CONFIG.applyToAll)) return jsx(type, props, key)

			const original = p.onScroll
			const patched = {
				...p,
				onScroll: (e: any) => {
					handleScroll(e)
					if (popups < 3 && !reported.has(desc)) {
						reported.add(desc)
						popups++
						say(`Scroll event #${popups}`, `y=${Math.round(e?.nativeEvent?.contentOffset?.y ?? -1)}\n${desc}`)
					}
					return typeof original === 'function' ? original(e) : undefined
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
