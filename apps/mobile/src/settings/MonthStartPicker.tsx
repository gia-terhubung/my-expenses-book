import { DayGrid } from "@/components/DayGrid";

/** 1-28: the day of the month a pay period (Home and Stats "month") starts on. */
export function MonthStartPicker({ value, onChange }: { value: number; onChange: (d: number) => void }) {
  return <DayGrid value={value} onChange={onChange} />;
}
