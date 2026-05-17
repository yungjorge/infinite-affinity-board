"use client";

import React, { useEffect, useRef } from "react";
import { NoteColor } from "@/lib/boardTypes";
import { NOTE_COLORS } from "@/lib/constants";

interface ColorPickerProps {
  selectedColor: NoteColor;
  onSelect: (color: NoteColor) => void;
  onClose: () => void;
}

const COLORS: NoteColor[] = [
  "yellow",
  "pink",
  "blue",
  "green",
  "orange",
  "purple",
  "white",
];

export function ColorPicker({ selectedColor, onSelect, onClose }: ColorPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    // Delay to prevent immediate close from the button click
    setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside, { passive: true });
      document.addEventListener("keydown", handleEscape);
    }, 0);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="color-picker" role="listbox" aria-label="Note color picker">
      {COLORS.map((color) => (
        <button
          key={color}
          className={`color-swatch ${color === selectedColor ? "active" : ""}`}
          style={{
            backgroundColor: NOTE_COLORS[color],
            borderColor:
              color === "white" ? "rgba(0,0,0,0.15)" : "transparent",
          }}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(color);
          }}
          aria-label={`${color} note color`}
          aria-selected={color === selectedColor}
          title={color.charAt(0).toUpperCase() + color.slice(1)}
          role="option"
        />
      ))}
    </div>
  );
}
