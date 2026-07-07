export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  getOptionLabel
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  getOptionLabel?: (option: T) => string;
}) {
  return <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value as T)}>{options.map((option) => <option key={option} value={option}>{getOptionLabel ? getOptionLabel(option) : option}</option>)}</select></label>;
}

export function TextField({ label, value, onChange, type = "text" }: { label: string; value: string | null; onChange: (value: string) => void; type?: string }) {
  return <label className="field"><span>{label}</span><input type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} /></label>;
}

export function TextareaField({ label, value, onChange }: { label: string; value: string | null; onChange: (value: string | null) => void }) {
  return <label className="field span-2"><span>{label}</span><textarea value={value ?? ""} onChange={(event) => onChange(event.target.value || null)} /></label>;
}
