import tailwindcssAnimate from 'tailwindcss-animate'
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-fraunces)', 'Georgia', 'serif'],
        mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'monospace'],
        // UI del CRM (rediseño). Dentro de `.crm-theme`, --font-inter apunta a
        // Hanken, así que `font-sans` ya rinde Hanken; `font-hanken` es explícito.
        hanken: ['var(--font-crm)', 'system-ui', 'sans-serif'],
      },
      colors: {
        /* CN design system palette — matches docs/design-claude/styles.css */
        cn: {
          /* Paleta CN driven por CSS vars (definidas en :root = web pública,
             y sobreescritas en `.crm-theme` = backoffice con la identidad nueva).
             Así las utilidades cn-* se rebrandean solo dentro del CRM. */
          teal: {
            900: 'var(--cn-teal-900)',
            700: 'var(--cn-teal-700)',
            500: 'var(--cn-teal-500)',
            300: 'var(--cn-teal-300)',
          },
          cream: {
            50: 'var(--cn-cream-50)',
            100: 'var(--cn-cream-100)',
            200: 'var(--cn-cream-200)',
          },
          sand: {
            300: 'var(--cn-sand-300)',
            500: 'var(--cn-sand-500)',
          },
          terra: {
            500: 'var(--cn-terra-500)',
            600: 'var(--cn-terra-600)',
          },
          ink: {
            900: 'var(--cn-ink-900)',
            700: 'var(--cn-ink-700)',
            500: 'var(--cn-ink-500)',
            300: 'var(--cn-ink-300)',
          },
          line: 'var(--cn-line)',
        },
        sand: 'hsl(var(--sand))',
        forest: 'hsl(var(--forest))',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
        /* ── Tokens EXACTOS del mockup (rediseño CRM). Solo resuelven dentro
           de `.crm-theme`, donde están definidos (globals.css). Nombres planos
           1:1 con las CSS vars: bg-canvas, text-ink2, border-line, bg-brand,
           hover:bg-brand2, bg-panel2, text-panel-ink, text-good, bg-bad-tint… */
        canvas: 'var(--bg)',
        line: 'var(--line)',
        line2: 'var(--line2)',
        track: 'var(--track)',
        ink: 'var(--ink)',
        ink2: 'var(--ink2)',
        ink3: 'var(--ink3)',
        brand: 'var(--brand)',
        brand2: 'var(--brand2)',
        'brand-tint': 'var(--brand-tint)',
        panel: 'var(--panel)',
        panel2: 'var(--panel2)',
        'panel-line': 'var(--panel-line)',
        'panel-ink': 'var(--panel-ink)',
        'panel-ink2': 'var(--panel-ink2)',
        good: 'var(--green)',
        'good-tint': 'var(--green-t)',
        warn: 'var(--amber)',
        'warn-tint': 'var(--amber-t)',
        bad: 'var(--red)',
        'bad-tint': 'var(--red-t)',
        info: 'var(--blue)',
        'info-tint': 'var(--blue-t)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        'cn-sm': '8px',
        'cn-md': '14px',
        'cn-lg': '20px',
        'cn-xl': '28px',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}

export default config
