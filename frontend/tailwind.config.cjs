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
  			mordheim: [
  				'\"Mordheim\"',
  				'\"Fraunces\"',
  				'\"Times New Roman\"',
  				'serif'
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
  				foreground: 'hsl(var(--accent-foreground))'
  			},
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
