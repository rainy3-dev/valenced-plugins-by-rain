/// <reference types="@valenced/themes-api" />

import type { ThemeColors } from '@valenced/themes-api/types'

interface Settings {
	color: string
	strength: 'subtle' | 'medium' | 'strong'
	bar: boolean
}

const DEFAULTS: Settings = { color: '#f8a300', strength: 'medium', bar: false }

const SWATCHES = [
	'#f23f43', '#ff7a2f', '#f8a300', '#ffd23f', '#9ccc3c', '#23a559',
	'#1abc9c', '#17c3e6', '#3ba0ff', '#4f6bff', '#5865f2', '#9b59ff',
	'#d63bd6', '#ff6fb5', '#ff2d8a', '#ffffff', '#97979f', '#000000',
]

const STRENGTHS = {
	subtle: { label: 'Subtle', hint: 'Like stock Discord', def: '14', hover: '0a', hoverLight: '1f' },
	medium: { label: 'Medium', hint: 'Easy to spot', def: '26', hover: '14', hoverLight: '33' },
	strong: { label: 'Strong', hint: 'Hard to miss', def: '40', hover: '26', hoverLight: '4d' },
} as const

const BASES = ['dark', 'darker', 'light', 'midnight'] as const

const normalizeHex = (input: string): string | null => {
	let h = input.trim().replace(/^#/, '').toLowerCase()
	if (/^[0-9a-f]{3}$/.test(h)) h = h.split('').map((c) => c + c).join('')
	return /^[0-9a-f]{6}$/.test(h) ? `#${h}` : null
}

const buildColors = (s: Settings): ThemeColors => {
	const hex = normalizeHex(s.color) ?? DEFAULTS.color
	const st = STRENGTHS[s.strength] ?? STRENGTHS.medium
	const semantic: NonNullable<ThemeColors['semantic']> = {}
	for (const base of BASES) {
		const colors: Record<string, string> = {
			MESSAGE_MENTIONED_BACKGROUND_DEFAULT: hex + st.def,
			MESSAGE_MENTIONED_BACKGROUND_HOVER: hex + (base === 'light' ? st.hoverLight : st.hover),
		}
		if (s.bar) {
			colors.STATUS_WARNING = hex
			colors.BORDER_FEEDBACK_WARNING = hex
		}
		semantic[base] = colors
	}
	return { semantic }
}

let store: { cache?: unknown } | undefined
const current = (): Settings => ({ ...DEFAULTS, ...((store?.cache as Partial<Settings>) ?? {}) })

export default plugin<{ jsonStorage: Settings }>({
	jsonStorage: { default: DEFAULTS, load: true },

	preInit({ themes }) {
		themes.registerGroup('reply', {
			name: 'Reply Colour',
			description: 'Recolours the highlight on replies and mentions. Set your colour in the plugin settings (gear icon), then pick this.',
		})
		themes.registerTheme('reply', 'custom', {
			name: 'Reply Colour',
			description: 'Uses the colour from the plugin settings. Everything else stays stock Discord.',
			getColors: () => buildColors(current()),
		})
	},

	init({ jsonStorage }) {
		store = jsonStorage
	},

	SettingsComponent({ api }: { api: any }) {
		const R = api.unscoped.react
		const { React } = R
		const RN = R.ReactNative as any
		const h = React.createElement as any
		const { View, Text, Pressable, ScrollView, TextInput, Switch } = RN

		try {
			const dark = (RN.useColorScheme?.() ?? 'dark') !== 'light'
			const fg = dark ? '#e6e8ff' : '#1b1b1f'
			const sub = dark ? '#a9adc9' : '#5b5d6b'
			const card = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'

			const [, bump] = React.useState(0)
			React.useEffect(() => {
				const unsub = store && (store as any).subscribe ? (store as any).subscribe(() => bump((n: number) => n + 1)) : undefined
				return () => unsub?.()
			}, [])

			const s = current()
			const [draft, setDraft] = React.useState(s.color)
			const set = (v: Partial<Settings>) => {
				;(store as any)?.set?.(v)
			}

			const hex = normalizeHex(s.color) ?? DEFAULTS.color
			const st = STRENGTHS[s.strength] ?? STRENGTHS.medium
			const valid = normalizeHex(draft) !== null

			const title = (t: string) =>
				h(Text, { style: { color: sub, fontSize: 13, fontWeight: '700', marginTop: 20, marginBottom: 8, textTransform: 'uppercase' } }, t)

			const preview = h(
				View,
				{ style: { borderRadius: 12, backgroundColor: '#2b2d31', paddingVertical: 8 } },
				h(
					View,
					{ style: { flexDirection: 'row', backgroundColor: hex + st.def, paddingVertical: 10, paddingRight: 12 } },
					h(View, { style: { width: 4, backgroundColor: s.bar ? hex : '#decca4', marginRight: 12 } }),
					h(
						View,
						{ style: { flex: 1 } },
						h(Text, { style: { color: '#dbdee1', fontWeight: '600' } }, 'Someone replied to you'),
						h(Text, { style: { color: '#b5bac1', marginTop: 2 } }, 'This is how a reply or mention will look.'),
					),
				),
			)

			const swatch = (c: string) =>
				h(Pressable, {
					key: c,
					onPress: () => {
						setDraft(c)
						set({ color: c })
					},
					style: {
						width: 40,
						height: 40,
						borderRadius: 20,
						margin: 5,
						backgroundColor: c,
						borderWidth: hex === c ? 3 : 1,
						borderColor: hex === c ? '#ffffff' : '#555a63',
					},
				})

			const strengthRow = (k: keyof typeof STRENGTHS) =>
				h(
					Pressable,
					{
						key: k,
						onPress: () => set({ strength: k }),
						style: { flexDirection: 'row', alignItems: 'center', padding: 14, borderTopWidth: k === 'subtle' ? 0 : 1, borderTopColor: 'rgba(128,128,128,0.2)' },
					},
					h(
						View,
						{ style: { flex: 1 } },
						h(Text, { style: { color: fg, fontSize: 16 } }, STRENGTHS[k].label),
						h(Text, { style: { color: sub, fontSize: 13, marginTop: 2 } }, STRENGTHS[k].hint),
					),
					h(Text, { style: { color: '#9b8cff', fontSize: 20 } }, s.strength === k ? '✓' : ''),
				)

			return h(
				ScrollView,
				{ style: { flex: 1 }, contentContainerStyle: { padding: 16, paddingBottom: 48 } },

				preview,

				title('Colour'),
				h(View, { style: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', backgroundColor: card, borderRadius: 12, padding: 8 } }, SWATCHES.map(swatch)),

				title('Custom colour (hex)'),
				h(TextInput, {
					value: draft,
					placeholder: '#ff6fb5',
					placeholderTextColor: sub,
					maxLength: 7,
					autoCapitalize: 'none',
					autoCorrect: false,
					onChangeText: (v: string) => {
						setDraft(v)
						const n = normalizeHex(v)
						if (n) set({ color: n })
					},
					style: { color: fg, backgroundColor: card, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
				}),
				valid ? null : h(Text, { style: { color: '#f23f43', marginTop: 6 } }, 'Use a hex colour like #ff6fb5'),

				title('Strength'),
				h(View, { style: { backgroundColor: card, borderRadius: 12, overflow: 'hidden' } }, (Object.keys(STRENGTHS) as (keyof typeof STRENGTHS)[]).map(strengthRow)),

				title('Side bar'),
				h(
					View,
					{ style: { flexDirection: 'row', alignItems: 'center', backgroundColor: card, borderRadius: 12, padding: 14 } },
					h(
						View,
						{ style: { flex: 1, paddingRight: 12 } },
						h(Text, { style: { color: fg, fontSize: 16 } }, 'Also recolour the side bar'),
						h(Text, { style: { color: sub, fontSize: 13, marginTop: 2 } }, 'Experimental. Might also change other warning colours.'),
					),
					h(Switch, { value: s.bar, onValueChange: (v: boolean) => set({ bar: v }) }),
				),

				title('Apply'),
				h(
					View,
					{ style: { backgroundColor: card, borderRadius: 12, padding: 14 } },
					h(
						Text,
						{ style: { color: fg, fontSize: 14, lineHeight: 20 } },
						'Changes are saved automatically. To apply them, open Valenced Settings → Themes → Color themes and pick "Reply Colour". If it is already selected, pick another colour theme first, then this one again.',
					),
				),
			)
		} catch (e) {
			return h(
				ScrollView,
				{ contentContainerStyle: { padding: 16 } },
				h(Text, { style: { color: '#f23f43', fontSize: 16, fontWeight: '700' } }, 'Reply Colour settings failed to load'),
				h(Text, { selectable: true, style: { color: '#e6e8ff', marginTop: 8 } }, String((e as any)?.stack ?? e)),
			)
		}
	},
})
