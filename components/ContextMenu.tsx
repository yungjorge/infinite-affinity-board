"use client";

import React, { useEffect, useRef } from "react";

export interface ContextMenuItem {
  label: string;
  action: () => void;
  danger?: boolean;
  icon?: string;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const handleResize = () => onClose();

    // Delay to avoid instant close from the triggering event
    const t = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside, { passive: true });
      document.addEventListener("keydown", handleEscape);
      window.addEventListener("resize", handleResize);
    }, 0);

    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleResize);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  const adjustedX = Math.min(x, window.innerWidth - 180);
  const adjustedY = Math.min(y, window.innerHeight - items.length * 48 - 8);

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        position: "fixed",
        left: `${Math.max(4, adjustedX)}px`,
        top: `${Math.max(4, adjustedY)}px`,
        zIndex: 10000,
        minWidth: "160px",
        borderRadius: "10px",
        background: "var(--toolbar-bg)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid var(--toolbar-border)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
        padding: "4px",
        display: "flex",
        flexDirection: "column",
        gap: "2px",
      }}
      role="menu"
      aria-label="Context menu"
    >
      {items.map((item, i) => (
        <button
          key={i}
          className="context-menu-item"
          role="menuitem"
          onClick={(e) => {
            e.stopPropagation();
            item.action();
            onClose();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            width: "100%",
            minHeight: "44px",
            padding: "8px 12px",
            border: "none",
            background: "transparent",
            borderRadius: "7px",
            cursor: "pointer",
            color: item.danger ? "#ef4444" : "var(--toolbar-fg)",
            fontSize: "14px",
            fontFamily: "inherit",
            textAlign: "left",
            transition: "background 0.1s",
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.background = "var(--toolbar-hover)";
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.background = "transparent";
          }}
        >
          {item.icon && <span style={{ fontSize: "16px", width: "20px", textAlign: "center" }}>{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>
  );
}
