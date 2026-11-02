module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
  	borderRadius: {
  		none: '0px',
  		sm: '0px',
  		DEFAULT: '0px',
  		md: '0px',
  		lg: '0px',
  		xl: '0px',
  		'2xl': '0px',
  		'3xl': '0px',
  		full: '0px'
  	},
  	extend: {
  		fontFamily: {
  			sans: [
  				'\"Manrope\"',
  				'\"Segoe UI\"',
  				'\"Helvetica Neue\"',
  				'Arial',
  				'sans-serif'
  			],
  			display: [
  				'\"Fraunces\"',
  				'\"Times New Roman\"',
  				'serif'
  			],
  			mono: [
  				'\"Space Mono\"',
  				'ui-monospace',
  				'SFMono-Regular',
  				'Menlo',
  				'Monaco',
  				'Consolas',
  				'\"Liberation Mono\"',
  				'\"Courier New\"',
  				'monospace'
  			]
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))',
  				text: 'var(--color-accent-text)',
  				soft: 'var(--color-accent-soft)',
  				line: 'var(--color-accent-line)',
  				hi: 'var(--color-accent-hi)'
  			},
  			// Design E tokens (src/index.css); each switches with the theme.
  			page: 'var(--color-page)',
  			rail: 'var(--color-rail)',
  			bar: 'var(--color-bar)',
  			panel: 'var(--color-panel)',
  			surface: 'var(--color-surface)',
  			raised: 'var(--color-raised)',
  			line: 'var(--color-line)',
  			strong: 'var(--color-strong)',
  			ink: 'var(--color-ink)',
  			head: 'var(--color-head)',
  			text2: 'var(--color-text2)',
  			faint: 'var(--color-faint)',
  			'on-accent': 'var(--color-on-accent)',
  			danger: {
  				DEFAULT: 'var(--color-danger)',
  				bg: 'var(--color-danger-bg)',
  				line: 'var(--color-danger-line)'
  			},
  			kind: {
  				skill: 'var(--color-kind-skill)',
  				special: 'var(--color-kind-special)',
  				spell: 'var(--color-kind-spell)'
  			},
  			good: {
  				DEFAULT: 'var(--color-good)',
  				bg: 'var(--color-good-bg)',
  				line: 'var(--color-good-line)'
  			},
  			scrim: 'var(--color-scrim)',
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
