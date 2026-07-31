"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

type PasswordInputProps = {
  id: string;
  name: string;
  label: string;
  value: string;
  autoComplete: string;
  required?: boolean;
  onChange: (value: string) => void;
};

export function PasswordInput({
  id,
  name,
  label,
  value,
  autoComplete,
  required = true,
  onChange
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="mt-2 flex overflow-hidden rounded-md border border-black/15 bg-white focus-within:ring-2 focus-within:ring-moss dark:border-white/15 dark:bg-white/10">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
        />
        <button
          type="button"
          aria-label={visible ? "Hide password" : "Show password"}
          title={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((current) => !current)}
          className="grid w-11 place-items-center text-black/60 hover:bg-black/5 dark:text-white/65 dark:hover:bg-white/10"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
