const CONFIG = {
	maxBlur: 8,
	maxStretch: 0.01,
	fadeOutMs: 500,
	fullSpeed: 2.5,
	idleMs: 80,
	applyToAll: true,
	discover: true,
}

export default plugin({
	start({ cleanup, unscoped }) {
		const { react, patcher } = unscoped
		const { ReactNative, React, jsxRuntime, ReactJSXRuntime } = react
		const { StyleSheet, View, Alert } = ReactNative

		const listeners = new Set<(level: number) => void>()
		let shown = 0
		let level = 0
		let lastY: number | null = null
		let lastT = 0
		let idleTimer: ReturnType<typeof setTimeout> | undefined
		let fadeTimer: ReturnType<typeof setInterval> | undefined

		const show = (v: number) => {
			const q = Math.round(v)
			if (q === shown) return
			shown = q
			listeners.forEach((l) => l(q))
		}

		const stopFade = () => {
			if (fadeTimer) {
				clearInterval(fadeTimer)
				fadeTimer = undefined
			}
		}

		const startFade = () => {
			stopFade()
			lastY = null
			const from = level
			const t0 = Date.now()
			fadeTimer = setInterval(() => {
				const t = (Date.now() - t0) / CONFIG.fadeOutMs
				if (t >= 1) {
					level = 0
					show(0)
					stopFade()
					return
				}
				level = from * (1 - t) * (1 - t)
				show(level)
			}, 40)
		}

		const handleScroll = (e: any) => {
			const y = e?.nativeEvent?.contentOffset?.y
			if (typeof y !== 'number') return
			const now = Date.now()
			if (lastY !== null && now > lastT) {
				const speed = Math.abs(y - lastY) / (now - lastT)
				const target = Math.min(1, speed / CONFIG.fullSpeed) * CONFIG.maxBlur
				stopFade()
				level = Math.max(target, level * 0.85)
				show(level)
			}
			lastY = y
			lastT = now
			if (idleTimer) clearTimeout(idleTimer)
			idleTimer = setTimeout(startFade, CONFIG.idleMs) as unknown as ReturnType<typeof setTimeout>
		}

		const Wrapper = (props: { children?: unknown }) => {
			const [blur, setBlur] = React.useState(shown)
			React.useEffect(() => {
				listeners.add(setBlur)
				return () => {
					listeners.delete(setBlur)
				}
			}, [])
			const style: any = { flex: 1 }
			if (blur > 0) {
				style.filter = [{ blur }]
				if (CONFIG.maxStretch > 0) {
					style.transform = [{ scaleY: 1 + CONFIG.maxStretch * (blur / CONFIG.maxBlur) }]
				}
			}
			return React.createElement(View, { style, collapsable: false }, props.children as any)
		}

		const wrapOnScroll = (original: unknown) => (e: any) => {
			handleScroll(e)
			return typeof original === 'function' ? original(e) : undefined
		}

		const isInverted = (style: unknown) => {
			const flat = StyleSheet.flatten(style as any) as any
			const transform = flat?.transform
			return Array.isArray(transform) && transform.some((t: any) => t && t.scaleY === -1)
		}

		const unpatchLists = jsxRuntime.insteadJSX('RCTScrollView', ([type, props, key], jsx) => {
			const p = props as any
			if (!CONFIG.applyToAll || p.horizontal || isInverted(p.style)) return jsx(type, props, key)
			const patched = { ...p, onScroll: wrapOnScroll(p.onScroll) }
			return React.createElement(Wrapper, null, jsx(type, patched, key)) as any
		})

		const seen = new Set<string>()
		const chatHook = function (this: any, args: any[], original: (...a: any[]) => unknown) {
			const [type, props, key] = args
			if (props && props.inverted === true && typeof type !== 'string' && typeof props.renderItem === 'function') {
				if (CONFIG.discover) {
					const name = String(type?.displayName || type?.name || type?.render?.name || 'anonymous')
					if (!seen.has(name) && seen.size < 2) {
						seen.add(name)
						setTimeout(() => {
							try {
								Alert.alert(
									'Scroll Blur: chat list found',
									`${name}\nonScroll=${typeof props.onScroll}\nkeys: ${Object.keys(props).slice(0, 18).join(',')}`,
								)
							} catch {}
						}, 0)
					}
				}
				const patched =
					props.onScroll === undefined || typeof props.onScroll === 'function'
						? { ...props, onScroll: wrapOnScroll(props.onScroll) }
						: props
				return React.createElement(Wrapper, null, original(type, patched, key) as any)
			}
			return original(...args)
		}
		const unJsx = patcher.instead(ReactJSXRuntime as any, 'jsx', chatHook as any)
		const unJsxs = patcher.instead(ReactJSXRuntime as any, 'jsxs', chatHook as any)

		cleanup(unpatchLists)
		cleanup(unJsx)
		cleanup(unJsxs)
		cleanup(() => {
			if (idleTimer) clearTimeout(idleTimer)
			stopFade()
			show(0)
		})
	},
})
