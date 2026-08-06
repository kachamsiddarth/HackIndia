"use client";

import React from "react";

export function ColorBlindnessSVGFilters(): React.ReactNode {
  return (
    <svg
      style={{
        position: "absolute",
        width: 0,
        height: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
      aria-hidden="true"
    >
      <defs>
        {/* Protanopia (Red-Blind / Red-Weak) Filter */}
        <filter id="protanopia-filter">
          <feColorMatrix
            type="matrix"
            values="0.56667 0.43333 0.00000 0 0
                    0.55833 0.44167 0.00000 0 0
                    0.00000 0.24167 0.75833 0 0
                    0.00000 0.00000 0.00000 1 0"
          />
        </filter>

        {/* Deuteranopia (Green-Blind / Green-Weak) Filter */}
        <filter id="deuteranopia-filter">
          <feColorMatrix
            type="matrix"
            values="0.62500 0.37500 0.00000 0 0
                    0.70000 0.30000 0.00000 0 0
                    0.00000 0.30000 0.70000 0 0
                    0.00000 0.00000 0.00000 1 0"
          />
        </filter>

        {/* Tritanopia (Blue-Blind / Blue-Weak) Filter */}
        <filter id="tritanopia-filter">
          <feColorMatrix
            type="matrix"
            values="0.95000 0.05000 0.00000 0 0
                    0.00000 0.43333 0.56667 0 0
                    0.00000 0.47500 0.52500 0 0
                    0.00000 0.00000 0.00000 1 0"
          />
        </filter>

        {/* Achromatopsia (Monochromacy / Complete Color Blindness) Filter */}
        <filter id="achromatopsia-filter">
          <feColorMatrix
            type="matrix"
            values="0.29900 0.58700 0.11400 0 0
                    0.29900 0.58700 0.11400 0 0
                    0.29900 0.58700 0.11400 0 0
                    0.00000 0.00000 0.00000 1 0"
          />
        </filter>
      </defs>
    </svg>
  );
}
