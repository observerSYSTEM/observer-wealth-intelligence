import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#101820",
        moss: "#3D5A40",
        copper: "#B76E35",
        mist: "#E8EEF2"
      }
    }
  },
  plugins: []
};

export default config;
