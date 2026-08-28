/**
 * DateField — a styled native `type="date"` input used by the task dialogs
 * (R8.3) to capture a Task's due date.
 *
 * The prototype used a plain `<input type="date">`; here it is wrapped so the
 * dialogs get a single, consistently styled control. Styling is inherited from
 * the shadcn `Input` (themed exclusively through OKLCH variables, Requirements
 * 14.3/14.7) with small adjustments so the native date picker indicator adopts
 * the foreground color and the control fills its container.
 *
 * The `type` is fixed to `"date"`; all other native input props (`value`,
 * `onChange`, `min`, `max`, `id`, `name`, `disabled`, ...) pass straight
 * through. The value round-trips as an ISO `YYYY-MM-DD` string, matching the
 * `Task.due` representation in `logic.ts`.
 */

import * as React from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type DateFieldProps = Omit<React.ComponentProps<'input'>, 'type'>;

function DateField({ className, ...props }: DateFieldProps) {
  return (
    <Input
      type="date"
      data-slot="date-field"
      className={cn(
        // Tint the native calendar indicator with the current text color so it
        // matches the themed foreground rather than the browser default.
        '[&::-webkit-calendar-picker-indicator]:cursor-pointer',
        '[&::-webkit-calendar-picker-indicator]:opacity-60',
        'hover:[&::-webkit-calendar-picker-indicator]:opacity-100',
        className,
      )}
      {...props}
    />
  );
}

export { DateField };
