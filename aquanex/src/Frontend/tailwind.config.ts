import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";


export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        alert: {
          DEFAULT: "hsl(var(--alert))",
          foreground: "hsl(var(--alert-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        earth: {
          DEFAULT: "hsl(var(--earth))",
          foreground: "hsl(var(--earth-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      height: {
        "map-lg": "500px",
        "map-md": "400px",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        progressFlow: {
          "0%":   { width: "0%",  marginLeft: "0%" },
          "50%":  { width: "70%", marginLeft: "0%" },
          "100%": { width: "0%",  marginLeft: "100%" },
        },
        dropBounce: {
          "0%, 100%": { transform: "translateY(0)",    opacity: "0.5" },
          "50%":      { transform: "translateY(-8px)", opacity: "1" },
        },
        dropPulse: {
          "0%, 100%": { transform: "scaleY(1)",   opacity: "0.6" },
          "50%":      { transform: "scaleY(1.4)", opacity: "1" },
        },
        pipeFlow: {
          "0%":   { left: "-100%" },
          "100%": { left: "200%" },
        },
        ripple: {
          "0%":   { transform: "scale(0.5)", opacity: "1" },
          "100%": { transform: "scale(1.4)", opacity: "0" },
        },
        dotPulse: {
          "0%, 100%": { transform: "scale(0.8)", opacity: "0.4" },
          "50%":      { transform: "scale(1.2)", opacity: "1" },
        },
        btnShimmer: {
          "0%":   { backgroundPosition: "0% 50%" },
          "50%":  { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
        shimmer:          "shimmer 1.8s linear infinite",
        progressFlow:     "progressFlow 1.8s ease-in-out infinite",
        dropBounce:       "dropBounce 1.2s ease-in-out infinite",
        dropPulse:        "dropPulse 0.8s ease-in-out infinite",
        pipeFlow:         "pipeFlow 1.5s ease-in-out infinite",
        ripple:           "ripple 2s ease-out infinite",
        dotPulse:         "dotPulse 1.2s ease-in-out infinite",
        btnShimmer:       "btnShimmer 1.5s linear infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
