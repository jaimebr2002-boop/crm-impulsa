import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          // Verde lima real de Impulsa Studio (#AAFF00), tal cual definido
          // en impulsa_master_clipboard.html y usado en sus gráficos de marca.
          DEFAULT: "#AAFF00",
          // Variante oscura accesible: texto/iconos sobre superficies
          // claras, y estado hover de los botones.
          dark: "#5C8A00",
          // Texto sobre relleno brand (contraste alto, blanco puro deslumbra sobre el verde).
          ink: "#0A1400",
          light: "rgb(var(--brand-light) / <alpha-value>)",
        },
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        mute: "rgb(var(--mute) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        ink2: "rgb(var(--ink-2) / <alpha-value>)",
        ink3: "rgb(var(--ink-3) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        // Un único tono (con una variación sutil para dar algo de
        // profundidad) — el sistema real de Impulsa Studio usa el verde
        // lima como color sólido, no un degradado de dos tonos.
        "brand-gradient": "linear-gradient(135deg, #AAFF00, #93E000)",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)",
        glass: "0 1px 1px 0 rgb(0 0 0 / 0.03), 0 8px 24px -8px rgb(0 0 0 / 0.12)",
        "glass-dark": "0 1px 1px 0 rgb(0 0 0 / 0.2), 0 12px 32px -8px rgb(0 0 0 / 0.55)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};

export default config;
