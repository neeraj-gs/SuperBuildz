/** Written by Super Builds for the chosen typography. Fonts load at build time through next/font. */
import { Inter, JetBrains_Mono } from 'next/font/google';

const interFont = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });
const jetbrains_monoFont = JetBrains_Mono({ subsets: ['latin'], display: 'swap', variable: '--font-jetbrains_mono' });

export const fontVariables = [interFont.variable, jetbrains_monoFont.variable].join(' ');
export const fontFamilies = {
  display: `var(--font-inter), ui-sans-serif, system-ui, sans-serif`,
  body: `var(--font-inter), ui-sans-serif, system-ui, sans-serif`,
  mono: `var(--font-jetbrains_mono), ui-monospace, SFMono-Regular, monospace`,
};
