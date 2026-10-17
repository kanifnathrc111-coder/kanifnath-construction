/** Tailwind config - Kanifnath Construction ERP
 *  Colours are CSS-variable driven (see src/input.css) so light/dark theme
 *  is a single class on <html> with no per-element dark: variants. */
const v = (n) => `rgb(var(--${n}) / <alpha-value>)`;
module.exports = {
  content: ["./*.html", "./js/**/*.js"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#850D0D", hover: "#A01212", dark: "#5E0909", soft: v("brand-soft") },
        canvas: v("canvas"), surface: v("surface"), ink: v("ink"),
        muted: v("muted"), line: v("line"), subtle: v("subtle"),
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgb(15 23 42 / .04), 0 1px 3px rgb(15 23 42 / .06)",
        lift: "0 8px 24px -6px rgb(15 23 42 / .14)",
      },
      keyframes: {
        "fade-up": { from: { opacity: 0, transform: "translateY(8px)" }, to: { opacity: 1, transform: "none" } },
        "fade-in": { from: { opacity: 0 }, to: { opacity: 1 } },
        "scale-in": { from: { opacity: 0, transform: "scale(.96)" }, to: { opacity: 1, transform: "none" } },
        "toast-in": { from: { opacity: 0, transform: "translateY(10px)" }, to: { opacity: 1, transform: "none" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        grow: { from: { transform: "scaleY(0)" }, to: { transform: "scaleY(1)" } },
        growx: { from: { transform: "scaleX(0)" }, to: { transform: "scaleX(1)" } },
      },
      animation: {
        "fade-up": "fade-up .3s ease-out both",
        "fade-in": "fade-in .2s ease-out both",
        "scale-in": "scale-in .2s ease-out both",
        "toast-in": "toast-in .25s ease-out both",
        grow: "grow .5s cubic-bezier(.2,.8,.2,1) both",
        growx: "growx .6s cubic-bezier(.2,.8,.2,1) both",
      },
    },
  },
  plugins: [],
};
