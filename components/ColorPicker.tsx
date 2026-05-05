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
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to prevent immediate close from the button click
    setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div ref={ref} className="color-picker">
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
          title={color.charAt(0).toUpperCase() + color.slice(1)}
        />
      ))}
    </div>
  );
}
