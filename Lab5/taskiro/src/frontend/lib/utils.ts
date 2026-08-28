import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge conditional class names and resolve Tailwind conflicts.
 * Used by every shadcn/ui component to compose `className` props.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Re-export the canonical avatar-initials helper from the pure logic module
 * (R3.6). `logic.ts` owns the implementation; `utils.ts` re-exports it so
 * existing `import { initials } from "./utils"` call sites keep working.
 */
export { initials } from './logic';
