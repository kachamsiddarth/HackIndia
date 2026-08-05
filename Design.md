# AccessDiff — Design System

> Visual identity, typography, color palette, components & interaction patterns

---

## 1. Design Philosophy

AccessDiff follows a design philosophy rooted in:

1. **Clarity over decoration.** Every visual element serves a purpose.
2. **Dark-first, not dark-only.** Dark theme is the default; high contrast mode is a first-class alternative.
3. **Density where it matters.** Developer tools need information density — but organized, not overwhelming.
4. **Motion with intent.** Animations guide attention, not distract. Every animation must have a reason.
5. **Accessible by example.** A platform about accessibility must itself be flawlessly accessible.

### Design Inspirations

| Product | What We Take |
|---|---|
| **GitHub** | File explorer, diff viewer, PR formatting |
| **Linear** | Clean navigation, information density, keyboard-first |
| **Vercel** | Dashboard layout, card design, dark theme execution |
| **Raycast** | Glassy surfaces, command palette feel, micro-interactions |

---

## 2. Color System

### 2.1 Core Palette

All colors are defined as CSS custom properties using HSL for easy theming.

```css
:root {
  /* ── Background Layers ── */
  --color-bg-base:        hsl(230, 21%, 6%);     /* #0d0e14 — Deepest background */
  --color-bg-surface:     hsl(230, 18%, 9%);     /* #131520 — Card/panel surface */
  --color-bg-elevated:    hsl(230, 16%, 12%);    /* #1a1c28 — Elevated surface (modal, dropdown) */
  --color-bg-hover:       hsl(230, 14%, 16%);    /* #242636 — Hover state */
  --color-bg-active:      hsl(230, 12%, 20%);    /* #2e3040 — Active/pressed state */

  /* ── Borders ── */
  --color-border-subtle:  hsl(230, 12%, 18%);    /* Subtle divider */
  --color-border-default: hsl(230, 10%, 24%);    /* Default border */
  --color-border-strong:  hsl(230, 8%, 32%);     /* Emphasized border */

  /* ── Text ── */
  --color-text-primary:   hsl(0, 0%, 95%);       /* #f2f2f2 — Primary text */
  --color-text-secondary: hsl(230, 8%, 62%);     /* #979aa6 — Secondary text */
  --color-text-tertiary:  hsl(230, 6%, 42%);     /* #65676e — Muted/disabled text */
  --color-text-inverse:   hsl(230, 21%, 6%);     /* Dark text on light backgrounds */

  /* ── Accent (Orange) ── */
  --color-accent:         hsl(24, 95%, 53%);     /* #f97316 — Primary accent */
  --color-accent-hover:   hsl(24, 95%, 60%);     /* Hover state */
  --color-accent-muted:   hsl(24, 40%, 18%);     /* Muted background for accent elements */
  --color-accent-text:    hsl(24, 95%, 70%);     /* Accent text on dark backgrounds */

  /* ── Semantic Colors ── */
  --color-success:        hsl(142, 71%, 45%);    /* #22c55e — Pass, verified, resolved */
  --color-success-muted:  hsl(142, 30%, 14%);
  --color-warning:        hsl(38, 92%, 50%);     /* #eab308 — Needs attention */
  --color-warning-muted:  hsl(38, 30%, 14%);
  --color-error:          hsl(0, 84%, 60%);      /* #ef4444 — Critical, failed */
  --color-error-muted:    hsl(0, 30%, 14%);
  --color-info:           hsl(217, 91%, 60%);    /* #3b82f6 — Informational */
  --color-info-muted:     hsl(217, 30%, 14%);

  /* ── Severity Colors ── */
  --color-severity-critical: var(--color-error);
  --color-severity-major:    hsl(15, 85%, 55%);
  --color-severity-minor:    var(--color-warning);
  --color-severity-advisory: var(--color-info);

  /* ── Glass Effect ── */
  --glass-bg:             hsla(230, 18%, 9%, 0.7);
  --glass-border:         hsla(230, 10%, 24%, 0.5);
  --glass-blur:           12px;
}
```

### 2.2 High Contrast Mode

```css
[data-theme="high-contrast"] {
  --color-bg-base:        hsl(0, 0%, 0%);
  --color-bg-surface:     hsl(0, 0%, 5%);
  --color-text-primary:   hsl(0, 0%, 100%);
  --color-text-secondary: hsl(0, 0%, 80%);
  --color-border-default: hsl(0, 0%, 40%);
  --color-accent:         hsl(24, 100%, 60%);
}
```

### 2.3 Color Contrast Requirements

All text must meet WCAG 2.2 AA contrast ratios:

| Element | Minimum Ratio |
|---|---|
| Normal text (< 18px) | 4.5:1 |
| Large text (≥ 18px or 14px bold) | 3:1 |
| UI components & graphics | 3:1 |
| Focus indicators | 3:1 against adjacent colors |

---

## 3. Typography

### 3.1 Font Stack

```css
:root {
  /* Display — App name, hero headings */
  --font-display:   'Talina', serif;

  /* Heading — Section headings, feature titles */
  --font-heading:   'Gunken', sans-serif;

  /* Body — All body text, UI elements */
  --font-body:      'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

  /* Code — Code blocks, diffs, file paths */
  --font-mono:      'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
}
```

### 3.2 Type Scale

```css
:root {
  --text-xs:    0.75rem;    /* 12px — Badges, labels */
  --text-sm:    0.875rem;   /* 14px — Secondary text, captions */
  --text-base:  1rem;       /* 16px — Body text */
  --text-lg:    1.125rem;   /* 18px — Emphasized body */
  --text-xl:    1.25rem;    /* 20px — Card titles */
  --text-2xl:   1.5rem;     /* 24px — Section headings */
  --text-3xl:   1.875rem;   /* 30px — Page headings */
  --text-4xl:   2.25rem;    /* 36px — Hero sub-heading */
  --text-5xl:   3rem;       /* 48px — Hero heading */
  --text-6xl:   3.75rem;    /* 60px — Landing page hero */

  --leading-tight:   1.25;
  --leading-normal:  1.5;
  --leading-relaxed: 1.75;

  --tracking-tight:  -0.025em;
  --tracking-normal: 0;
  --tracking-wide:   0.025em;
}
```

### 3.3 Font Loading Strategy

- **Plus Jakarta Sans**: Loaded from Google Fonts via `next/font/google` (subset: latin)
- **JetBrains Mono**: Loaded from Google Fonts via `next/font/google`
- **Talina, Gunken**: Self-hosted in `/public/fonts/` (loaded via `@font-face`)
- **Fallback strategy**: System fonts for body, serif for display

---

## 4. Spacing & Layout

### 4.1 Spacing Scale

```css
:root {
  --space-1:   0.25rem;   /* 4px */
  --space-2:   0.5rem;    /* 8px */
  --space-3:   0.75rem;   /* 12px */
  --space-4:   1rem;      /* 16px */
  --space-5:   1.25rem;   /* 20px */
  --space-6:   1.5rem;    /* 24px */
  --space-8:   2rem;      /* 32px */
  --space-10:  2.5rem;    /* 40px */
  --space-12:  3rem;      /* 48px */
  --space-16:  4rem;      /* 64px */
  --space-20:  5rem;      /* 80px */
  --space-24:  6rem;      /* 96px */
}
```

### 4.2 Layout Grid

```css
:root {
  --sidebar-width:       260px;
  --sidebar-collapsed:   64px;
  --header-height:       56px;
  --content-max-width:   1200px;
  --content-padding:     var(--space-6);
}
```

### 4.3 Border Radius

```css
:root {
  --radius-sm:   4px;
  --radius-md:   8px;
  --radius-lg:   12px;
  --radius-xl:   16px;
  --radius-2xl:  20px;
  --radius-full: 9999px;
}
```

---

## 5. Shadows & Elevation

```css
:root {
  --shadow-sm:   0 1px 2px hsla(0, 0%, 0%, 0.3);
  --shadow-md:   0 4px 6px hsla(0, 0%, 0%, 0.3),
                 0 1px 3px hsla(0, 0%, 0%, 0.2);
  --shadow-lg:   0 10px 15px hsla(0, 0%, 0%, 0.3),
                 0 4px 6px hsla(0, 0%, 0%, 0.2);
  --shadow-xl:   0 20px 25px hsla(0, 0%, 0%, 0.35),
                 0 10px 10px hsla(0, 0%, 0%, 0.2);
  --shadow-glow: 0 0 20px hsla(24, 95%, 53%, 0.15);
}
```

---

## 6. Component Specifications

### 6.1 Button

```
┌───────────────────────────────────────────────────────────────┐
│  Variant        Background            Text          Border   │
│  ─────────────  ────────────────────  ────────────  ──────── │
│  Primary        --color-accent        white         none     │
│  Secondary      --color-bg-elevated   --text-primary --border │
│  Ghost          transparent           --text-secondary none  │
│  Danger         --color-error         white         none     │
│  Success        --color-success       white         none     │
│                                                              │
│  Size           Padding               Font Size     Height   │
│  ─────────────  ────────────────────  ────────────  ──────── │
│  sm             4px 12px              --text-sm     32px     │
│  md             6px 16px              --text-base   40px     │
│  lg             8px 24px              --text-lg     48px     │
│                                                              │
│  States: hover (lighten 8%), active (darken 4%),             │
│          focus (2px accent outline, 2px offset),             │
│          disabled (opacity 0.5, cursor not-allowed)          │
└───────────────────────────────────────────────────────────────┘
```

### 6.2 Card

```
┌─────────────────────────────────────────────────────────┐
│  Background:    --color-bg-surface                      │
│  Border:        1px solid --color-border-subtle         │
│  Border Radius: --radius-lg                             │
│  Padding:       --space-5                               │
│  Shadow:        --shadow-sm                             │
│                                                         │
│  Hover:         border-color → --color-border-default   │
│                 shadow → --shadow-md                    │
│                 translate Y → -1px                      │
│                 transition: 200ms ease                  │
│                                                         │
│  Glass Variant:                                         │
│    Background:  --glass-bg                              │
│    Backdrop:    blur(--glass-blur)                      │
│    Border:      1px solid --glass-border                │
└─────────────────────────────────────────────────────────┘
```

### 6.3 Badge / Severity Indicator

```
Severity Badges:
  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ CRITICAL │  │  MAJOR   │  │  MINOR   │  │ ADVISORY │
  └──────────┘  └──────────┘  └──────────┘  └──────────┘
  bg: error-muted  warning-muted  warning-muted  info-muted
  text: error      severity-major  warning       info
  border-radius: --radius-full
  padding: 2px 10px
  font-size: --text-xs
  font-weight: 600
  text-transform: uppercase
  letter-spacing: 0.05em
```

### 6.4 Pipeline Stage Card

```
┌─────────────────────────────────────────────────────────┐
│  States:                                                │
│                                                         │
│  Pending:   border-left: 3px solid --color-text-tertiary│
│             opacity: 0.6                                │
│                                                         │
│  Active:    border-left: 3px solid --color-accent       │
│             background: --color-bg-elevated             │
│             Pulsing glow animation on left border       │
│                                                         │
│  Complete:  border-left: 3px solid --color-success      │
│                                                         │
│  Failed:    border-left: 3px solid --color-error        │
│                                                         │
│  Animation: expand/collapse 300ms ease-out              │
│             stage transition: slide-in-from-bottom      │
└─────────────────────────────────────────────────────────┘
```

### 6.5 Trust Score Indicator

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│     ╭──────────╮                                        │
│     │    88    │    Score: 88/100                       │
│     │  ████▓▓ │    Confidence: 92%                     │
│     ╰──────────╯    Status: ✅ Verified                 │
│                                                         │
│  Visual: Circular progress ring                         │
│  Color:  0-40 = error, 41-70 = warning, 71-100 = success│
│  Animation: count-up + ring fill (600ms ease-out)       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 6.6 Diff Viewer

```
┌─────────────────────────────────────────────────────────┐
│  Based on Monaco Editor diff view                       │
│                                                         │
│  Added lines:    bg: hsla(142, 71%, 45%, 0.1)          │
│                  gutter: --color-success                │
│                                                         │
│  Removed lines:  bg: hsla(0, 84%, 60%, 0.1)            │
│                  gutter: --color-error                  │
│                                                         │
│  Modified lines: bg: hsla(38, 92%, 50%, 0.08)          │
│                  gutter: --color-warning                │
│                                                         │
│  Line numbers:   --color-text-tertiary                  │
│  Font:           --font-mono, --text-sm                 │
│  Line height:    1.6                                    │
│                                                         │
│  Modes: Side-by-side | Inline                           │
└─────────────────────────────────────────────────────────┘
```

---

## 7. Animation System

### 7.1 Transition Tokens

```css
:root {
  --ease-default:   cubic-bezier(0.4, 0, 0.2, 1);
  --ease-in:        cubic-bezier(0.4, 0, 1, 1);
  --ease-out:       cubic-bezier(0, 0, 0.2, 1);
  --ease-spring:    cubic-bezier(0.34, 1.56, 0.64, 1);

  --duration-fast:    100ms;
  --duration-normal:  200ms;
  --duration-slow:    300ms;
  --duration-slower:  500ms;
}
```

### 7.2 Animation Library Usage

| Library | Usage |
|---|---|
| **CSS Transitions** | Hover states, focus rings, color changes |
| **CSS Keyframes** | Loading spinners, pulse effects, skeleton screens |
| **GSAP** | Page transitions, scroll-triggered animations, timeline charts |
| **Lenis** | Global smooth scrolling on landing page |
| **Rive** | Logo animation, pipeline progress illustration |

### 7.3 Micro-Interactions

| Interaction | Animation |
|---|---|
| Button hover | Scale 1.02, shadow increase (100ms) |
| Card hover | Translate Y -2px, shadow increase (200ms) |
| Pipeline stage activation | Left border glow pulse + expand (300ms) |
| Trust score load | Count-up number + ring fill (600ms) |
| Issue severity badge | Subtle scale-in on appear (200ms spring) |
| Toast notification | Slide in from right (300ms ease-out) |
| Modal open | Scale 0.95 → 1.0 + fade in (200ms) |
| Sidebar toggle | Width transition (300ms ease) |

### 7.4 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 8. Accessibility Requirements (Meta)

The AccessDiff platform itself must be fully accessible:

| Requirement | Implementation |
|---|---|
| Keyboard Navigation | All interactive elements reachable via Tab. Logical tab order. |
| Focus Indicators | Visible focus ring (2px accent, 2px offset) on all focusable elements. |
| Skip Navigation | Skip-to-main-content link at page top. |
| Screen Reader | All images have alt text. All icons have aria-labels. Dynamic content uses aria-live regions. |
| Heading Hierarchy | Single h1 per page. Logical heading nesting. |
| Form Labels | Every input has a visible associated label. |
| Color Independence | No information conveyed by color alone. Icons/text accompany color indicators. |
| Touch Targets | Minimum 44×44px touch targets on interactive elements. |
| Language | `lang="en"` on html element. Dynamic language switching for Sarvam AI responses. |
| Semantic HTML | Use `<nav>`, `<main>`, `<article>`, `<aside>`, `<header>`, `<footer>`. |
| Landmarks | All major page regions have ARIA landmarks. |

---

## 9. Responsive Breakpoints

```css
:root {
  --breakpoint-sm:   640px;
  --breakpoint-md:   768px;
  --breakpoint-lg:   1024px;
  --breakpoint-xl:   1280px;
  --breakpoint-2xl:  1536px;
}
```

| Breakpoint | Layout Change |
|---|---|
| < 768px | Sidebar collapses to bottom nav. Single column layout. |
| 768px–1024px | Sidebar collapses to icons. Content fills remaining space. |
| > 1024px | Full sidebar + content layout. |

---

## 10. Iconography

- **Primary**: Lucide React (consistent stroke-based icons)
- **Size scale**: 16px (inline), 20px (UI elements), 24px (navigation), 32px (feature cards)
- **Stroke width**: 1.5px (default), 2px (emphasis)
- **Color**: Inherit from text color

---

*Document Version: 1.0*
*Last Updated: 2026-08-04*
*Status: DRAFT — Awaiting Review*
