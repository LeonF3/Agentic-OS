import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // SWOS serves local files through its own API route, not next/image
      "@next/next/no-img-element": "off",
    },
  },
  { ignores: [".next/**", "node_modules/**", ".swos-data/**"] },
];

export default config;
