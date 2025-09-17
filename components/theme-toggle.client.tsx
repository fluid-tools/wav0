'use client';

import dynamic from 'next/dynamic';

const ThemeToggle = dynamic(
  () => import('./theme-toggle').then((mod) => ({ default: mod.ThemeToggle })),
  { ssr: false },
);

export default ThemeToggle;


