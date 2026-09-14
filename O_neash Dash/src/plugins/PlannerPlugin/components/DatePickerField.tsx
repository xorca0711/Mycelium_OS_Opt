import React, { useState } from 'react';
import { AlarmClock } from 'pixelarticons/react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { usePersonalSettingsStore } from '../../../store/usePersonalSettingsStore';

interface DatePickerFieldProps {
  value: Date | null;
  onChange: (d: Date | null) => void;
  placeholder?: string;
  triggerClassName?: string;
  triggerStyle?: React.CSSProperties;
  hideIcon?: boolean;
  toDate?: Date;
}

// Cast shadcn components that lack proper generic types due to untyped forwardRef
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TypedPopoverContent = PopoverContent as React.FC<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TypedCalendar = Calendar as React.FC<any>;

export default function DatePickerField({ value, onChange, placeholder, triggerClassName, triggerStyle, hideIcon, toDate }: DatePickerFieldProps) {
  const locale = usePersonalSettingsStore(s => s.settings.locale);
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={triggerClassName ?? "w-full justify-start font-mono text-sm rounded-none h-9 bg-transparent border-[rgba(255,255,255,0.09)] text-[rgba(255,255,255,0.62)] hover:text-white hover:border-[rgba(255,255,255,0.22)] gap-2"}
          style={triggerStyle}
        >
          {!hideIcon && <AlarmClock width={13} height={13} />}
          {value ? value.toLocaleDateString(locale === 'system' ? undefined : locale, { month: 'short', day: 'numeric', year: 'numeric' }) : (placeholder ?? 'pick a date')}
        </Button>
      </PopoverTrigger>
      <TypedPopoverContent className="w-auto p-0 bg-black border-[rgba(255,255,255,0.09)] rounded-none">
        <TypedCalendar
          mode="single"
          selected={value ?? undefined}
          onSelect={(d: Date | undefined) => {
            onChange(d ?? null);
            setOpen(false);
          }}
          disabled={toDate ? { after: toDate } : undefined}
          className="rounded-none"
        />
      </TypedPopoverContent>
    </Popover>
  );
}
