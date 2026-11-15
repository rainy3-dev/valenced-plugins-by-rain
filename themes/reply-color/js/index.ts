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
		const { React } = api.unscoped.react
		const RN = api.unscoped.react.ReactNative
		const D = api.unscoped.discord.design.Design as any
		const h = React.createElement as any
		const { View, Text, Pressable } = RN as any

		const saved = (api.jsonStorage.use() ?? DEFAULTS) as Settings
		const s: Settings = { ...DEFAULTS, ...saved }
		const [draft, setDraft] = React.useState(s.color)
		const set = (v: Partial<Settings>) => api.jsonStorage.set(v as any)

		const hex = normalizeHex(s.color) ?? DEFAULTS.color
		const st = STRENGTHS[s.strength] ?? STRENGTHS.medium

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
					h(Text, { style: { color: '#dbdee1', fontWeight: '600' } }, 'Someone  replied to you'),
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

		return h(
			D.Stack,
			{ spacing: 16, style: { padding: 16 } },

			preview,

			h(
				D.TableRowGroup,
				{ title: 'Colour' },
				h(View, { style: { flexDirection: 'row', flexWrap: 'wrap', padding: 8, justifyContent: 'center' } }, SWATCHES.map(swatch)),
			),

			h(D.TextInput, {
				label: 'Custom colour (hex)',
				placeholder: '#ff6fb5',
				value: draft,
				maxLength: 7,
				onChange: (v: string) => {
					setDraft(v)
					const n = normalizeHex(v)
					if (n) set({ color: n })
				},
				errorMessage: normalizeHex(draft) ? undefined : 'Use a hex colour like #ff6fb5',
			}),

			h(
				D.TableRowGroup,
				{ title: 'Strength' },
				(Object.keys(STRENGTHS) as (keyof typeof STRENGTHS)[]).map((k) =>
					h(D.TableRow, {
						key: k,
						label: STRENGTHS[k].label,
						subLabel: STRENGTHS[k].hint,
						trailing: s.strength === k ? h(Text, { style: { color: '#9b8cff', fontSize: 18 } }, '✓') : undefined,
						onPress: () => set({ strength: k }),
					}),
				),
			),

			h(
				D.TableRowGroup,
				{ title: 'Side bar' },
				h(D.TableSwitchRow, {
					label: 'Also recolour the side bar',
					subLabel: 'Experimental. Might also change other warning colours.',
					value: s.bar,
					onValueChange: (v: boolean) => set({ bar: v }),
				}),
			),

			h(
				D.TableRowGroup,
				{ title: 'Apply' },
				h(D.TableRow, {
					label: 'After changing anything here',
					subLabel:
						'Open Valenced Settings → Themes → Color themes and pick "Reply Colour". If it is already selected, pick another colour theme and then this one again.',
					subLabelLineClamp: 6,
				}),
			),
		)
	},
})
