"use client";

import React from "react";

interface SelectionBoxProps {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function SelectionBox({ x, y, width, height }: SelectionBoxProps) {
  return (
    <div
      className="selection-box"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: `${height}px`,
      }}
    />
  );
}
