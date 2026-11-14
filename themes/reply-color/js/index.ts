/// <reference types="@valenced/themes-api" />

import type { ThemeColors } from '@valenced/themes-api/types'

const COLORS: [id: string, name: string, hex: string | null][] = [
	['stock', 'Stock yellow (default)', '#f8a300'],
	['red', 'Red', '#f23f43'],
	['orange', 'Orange', '#ff7a2f'],
	['yellow', 'Yellow', '#ffd23f'],
	['lime', 'Lime', '#9ccc3c'],
	['green', 'Green', '#23a559'],
	['teal', 'Teal', '#1abc9c'],
	['cyan', 'Cyan', '#17c3e6'],
	['sky', 'Sky blue', '#3ba0ff'],
	['blue', 'Blue', '#4f6bff'],
	['blurple', 'Blurple', '#5865f2'],
	['purple', 'Purple', '#9b59ff'],
	['magenta', 'Magenta', '#d63bd6'],
	['pink', 'Pink', '#ff6fb5'],
	['hotpink', 'Hot pink', '#ff2d8a'],
	['white', 'White', '#ffffff'],
	['gray', 'Gray', '#97979f'],
	['none', 'No highlight', null],
]

const BASES = ['dark', 'darker', 'light', 'midnight'] as const

const build = (hex: string | null, withBar: boolean): ThemeColors => {
	const semantic: NonNullable<ThemeColors['semantic']> = {}
	for (const base of BASES) {
		const isLight = base === 'light'
		const tint = (alpha: string) => (hex ? hex + alpha : '#00000000')
		const colors: Record<string, string> = {
			MESSAGE_MENTIONED_BACKGROUND_DEFAULT: tint('1a'),
			MESSAGE_MENTIONED_BACKGROUND_HOVER: tint(isLight ? '29' : '0f'),
		}
		if (withBar && hex) {
			colors.STATUS_WARNING = hex
			colors.BORDER_FEEDBACK_WARNING = hex
		}
		semantic[base] = colors
	}
	return { semantic }
}

export default plugin({
	preInit({ themes }) {
		themes.registerGroup('reply', {
			name: 'Reply highlight',
			description: 'Recolour the highlight on replies and mentions. Nothing else changes.',
		})
		themes.registerGroup('reply-bar', {
			name: 'Reply highlight + side bar (experimental)',
			description: 'Also tries to recolour the thin bar. May affect other warning colours.',
		})

		for (const [id, name, hex] of COLORS) {
			themes.registerTheme('reply', id, {
				name,
				description: hex ? `Replies and mentions highlighted ${name.toLowerCase()}` : 'Removes the highlight',
				getColors: () => build(hex, false),
			})
			if (hex && id !== 'stock') {
				themes.registerTheme('reply-bar', id, {
					name,
					description: `Highlight and side bar in ${name.toLowerCase()}`,
					getColors: () => build(hex, true),
				})
			}
		}
	},
})
