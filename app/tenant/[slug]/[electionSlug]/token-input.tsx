"use client";

import { useRef, useEffect, useState } from "react";

export function TokenInput({
  value,
  onChange,
  disabled,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const [boxes, setBoxes] = useState<string[]>(Array(8).fill(" "));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    setBoxes(normalized.padEnd(8, " ").split(""));
  }, [value]);

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  function handleInput(index: number, char: string) {
    const upper = char.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!upper) return;

    const newBoxes = [...boxes];
    newBoxes[index] = upper[0];
    setBoxes(newBoxes);

    const fullToken = newBoxes.join("").replace(/\s/g, "");
    onChange(fullToken);

    if (upper[0] && index < 7) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      const newBoxes = [...boxes];
      newBoxes[index] = " ";
      setBoxes(newBoxes);
      onChange(newBoxes.join("").trim());

      if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 7) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    const newBoxes = pasted.padEnd(8, " ").split("");
    setBoxes(newBoxes);
    onChange(pasted);

    const firstEmpty = newBoxes.findIndex((b) => b === " ");
    if (firstEmpty >= 0 && firstEmpty < 8) {
      inputRefs.current[firstEmpty]?.focus();
    } else {
      inputRefs.current[7]?.focus();
    }
  }

  return (
    <div className="flex justify-center gap-2">
      {boxes.map((char, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="text"
          maxLength={1}
          value={char === " " ? "" : char}
          onChange={(e) => handleInput(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          disabled={disabled}
          autoComplete="off"
          className="h-16 w-12 rounded-2xl border-2 border-border bg-background text-center font-mono text-2xl font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 sm:h-20 sm:w-16 sm:text-3xl"
        />
      ))}
    </div>
  );
}
