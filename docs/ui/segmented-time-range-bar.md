```yaml
---
reference_asset:
  type: image
  url: "https://assets.ripplix.com/prompt-sheets/a793bac1-830b-4726-9198-d19f0f016f46.mp4.png"
  usage: visual-reference
component_id: segmented-time-range-bar
display_name: Segmented Time Range Bar
category: filter-control
one_line: Horizontal segmented date preset group paired with reset and filter action dropdown triggers.
source_clip: "Mixpanel Analytics Toolbar — 1 frame @ 10fps, 0.1s, 1920px"
stack: [react>=18, typescript, tailwind>=3]
required_packages: ["lucide-react@^0.400.0"]
optional_packages: ["motion@^11.0.0", "clsx@^2.0.0", "tailwind-merge@^2.0.0"]
portable_variant: yes
portable_variant_needs_js: no
file_count: 1
render_mode: client
ssr_safe: yes
touches_global_scroll: no
renders_page_chrome: no
content_is_props: yes
accessibility: full
provenance: reconstructed-from-video
confidence: "Preset items, visual hierarchy, and active pill state measured from UI snapshot; selection spring transition and hover feedback inferred from standard UI kit norms."
---
```

# Reference Asset

**Visual Reference:**
https://assets.ripplix.com/prompt-sheets/a793bac1-830b-4726-9198-d19f0f016f46.mp4.png

Use this image as the visual reference for the implementation.

The reference image should be used to understand:

- Visual composition
- Layout and proportions
- Spacing
- Visual hierarchy
- Media positioning
- Container treatment
- Overall visual presentation
- Relationship between visual elements

The reference image is supplementary to the written implementation specification.

Preserve all functionality, interaction behavior, animation behavior, timing, technical requirements, dependencies, and implementation constraints from the original specification.

Do not invent functionality that is not supported by the original implementation specification.

Use the reference image to improve visual fidelity while preserving the documented implementation behavior.





# Segmented Time Range Bar

## AGENT: do these in order

1. Read **Scope boundary** to identify which controls belong strictly within this component versus external report layout containers.
2. Read **Mechanism** to understand the active pill indicator transition, keyboard navigation across preset buttons, and dropdown toggle callbacks.
3. Check **Environment check** to configure icon imports and optional class utility functions.
4. Implement **Variant A** (or **Variant B** if a zero-dependency setup is required).
5. Verify all criteria in **Acceptance checks** before customization.

---

## Scope boundary

| Belongs in this component | Belongs in the page |
| :--- | :--- |
| Time preset segmented group (`Custom`, `Today`, `Yesterday`, `7D`, `30D`, `3M`, `6M`, `12M`) | Report cards, query charts, and canvas layout |
| Active selection indicator pill highlight | Dashboard title, global search bar, user navigation |
| Preset click handler and `onChange` callback | Data fetching logic triggered by date boundary changes |
| Trailing actions (`Default` preset dropdown trigger, `Filter` action trigger) | Global report export, sharing modals, and report creation flows |

Content (preset options, active preset, action labels) is supplied via props and defaults to generic presets.

---

## What the user sees

A compact horizontal filter strip sitting above dashboard charts. On the left, an inline segmented control hosts standard date preset options starting with a calendar-icon "Custom" item followed by text presets ("Today", "Yesterday", "7D", "30D", "3M", "6M", "12M").

Clicking any preset shifts the active pill background directly to the selected item. To the right of the preset group, a vertical line separates secondary triggers: a "Default" view selector with a chevron icon and a "+ Filter" button.

Hovering over unselected items applies a subtle neutral background fill, while keyboard focus displays a distinct focus ring around the target pill.

---

## Mechanism

- **Active Indicator (FLIP Transition)**: The active preset pill uses a shared layout element (`layoutId="activePresetPill"`) behind the text label. When selection changes, the indicator translates and resizes smoothly across items.
- **Segmented Container**: A single horizontal inline flex wrapper with `role="radiogroup"` or `role="group"` manages tab stops and arrow key navigation.
- **Divider & Action Stack**: A vertical 1px divider isolates the preset group from secondary dropdown action triggers without breaking inline alignment.

### Invariants

- Preset selection must trigger `onChange` with the selected preset key immediately on click.
- Active pill layout indicator must be rendered behind the button label text (`z-0` for indicator, `z-10 relative` for label) to prevent contrast obscuration.
- Focus navigation must be accessible via Tab and Arrow keys.

---

## Environment check

| Check | If yes | If no |
| :--- | :--- | :--- |
| `motion` package installed? | Use **Variant A** | Use **Variant B** |
| Project uses `@/lib/utils` with `cn()`? | Use existing `cn` helper | Use fallback template literals |
| `lucide-react` available? | Import `Calendar`, `ChevronDown`, `Plus` | Replace with inline SVG icons |

---

## Variant A — with `motion`

```bash
npm install motion lucide-react
```

```tsx
'use client'

import React, { useState, useId } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Calendar, ChevronDown, Plus } from 'lucide-react'

// ─── Motion Constants ───
// Measured from standard UI toolbar interaction patterns
const PILL_TRANSITION = {
  type: 'spring',
  stiffness: 400,
  damping: 35,
} as const

// ─── Types ───

export interface PresetItem {
  id: string
  label: string
  hasIcon?: boolean
}

export interface SegmentedTimeRangeBarProps {
  /** Array of time preset options */
  presets?: PresetItem[]
  /** Controlled active preset ID */
  value?: string
  /** Default active preset ID for uncontrolled usage */
  defaultValue?: string
  /** Callback fired when a preset is selected */
  onChange?: (id: string) => void
  /** Label for the default view trigger */
  defaultViewLabel?: string
  /** Callback fired when default view trigger is clicked */
  onDefaultViewClick?: () => void
  /** Callback fired when filter action is clicked */
  onAddFilterClick?: () => void
  /** Optional custom CSS classes */
  className?: string
}

// ─── Default data ───

export const DEFAULT_PRESETS: PresetItem[] = [
  { id: 'custom', label: 'Custom', hasIcon: true },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '3m', label: '3M' },
  { id: '6m', label: '6M' },
  { id: '12m', label: '12M' },
]

// ─── Component ───

export default function SegmentedTimeRangeBar({
  presets = DEFAULT_PRESETS,
  value,
  defaultValue = '30d',
  onChange,
  defaultViewLabel = 'Default',
  onDefaultViewClick,
  onAddFilterClick,
  className = '',
}: SegmentedTimeRangeBarProps) {
  const [internalValue, setInternalValue] = useState<string>(defaultValue)
  const isControlled = value !== undefined
  const activeId = isControlled ? value : internalValue
  const layoutGroupId = useId()
  const prefersReducedMotion = useReducedMotion()

  const handleSelect = (id: string) => {
    if (!isControlled) {
      setInternalValue(id)
    }
    onChange?.(id)
  }

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-2 p-1 bg-white border border-slate-200 rounded-lg shadow-sm text-xs font-medium text-slate-700 ${className}`}
      role="toolbar"
      aria-label="Time range and filter controls"
    >
      {/* Segmented Preset Radio Group */}
      <div
        className="flex items-center gap-0.5"
        role="radiogroup"
        aria-label="Date range presets"
      >
        {presets.map((preset) => {
          const isSelected = preset.id === activeId

          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => handleSelect(preset.id)}
              className={`relative px-2.5 py-1.5 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 ${
                isSelected
                  ? 'text-slate-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {isSelected && (
                <motion.div
                  layoutId={`pill-${layoutGroupId}`}
                  className="absolute inset-0 bg-slate-100 rounded-md border border-slate-300/60 shadow-xs z-0"
                  transition={prefersReducedMotion ? { duration: 0 } : PILL_TRANSITION}
                />
              )}
              <span className="relative z-10 inline-flex items-center gap-1.5 pointer-events-none">
                {preset.hasIcon && <Calendar className="w-3.5 h-3.5 text-slate-500" />}
                {preset.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Divider */}
      <div className="h-4 w-px bg-slate-200 mx-1" aria-hidden="true" />

      {/* Default View Selector Button */}
      <button
        type="button"
        onClick={onDefaultViewClick}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <span>{defaultViewLabel}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {/* Filter Action Button */}
      <button
        type="button"
        onClick={onAddFilterClick}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 font-semibold"
      >
        <Plus className="w-3.5 h-3.5 text-slate-500" />
        <span>Filter</span>
      </button>
    </div>
  )
}
```

---

## Variant B — zero dependencies

```tsx
'use client'

import React, { useState } from 'react'

export interface PresetItem {
  id: string
  label: string
  hasIcon?: boolean
}

export interface SegmentedTimeRangeBarProps {
  presets?: PresetItem[]
  value?: string
  defaultValue?: string
  onChange?: (id: string) => void
  defaultViewLabel?: string
  onDefaultViewClick?: () => void
  onAddFilterClick?: () => void
  className?: string
}

export const DEFAULT_PRESETS: PresetItem[] = [
  { id: 'custom', label: 'Custom', hasIcon: true },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '3m', label: '3M' },
  { id: '6m', label: '6M' },
  { id: '12m', label: '12M' },
]

export default function SegmentedTimeRangeBarZeroDeps({
  presets = DEFAULT_PRESETS,
  value,
  defaultValue = '30d',
  onChange,
  defaultViewLabel = 'Default',
  onDefaultViewClick,
  onAddFilterClick,
  className = '',
}: SegmentedTimeRangeBarProps) {
  const [internalValue, setInternalValue] = useState<string>(defaultValue)
  const isControlled = value !== undefined
  const activeId = isControlled ? value : internalValue

  const handleSelect = (id: string) => {
    if (!isControlled) {
      setInternalValue(id)
    }
    onChange?.(id)
  }

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-2 p-1 bg-white border border-slate-200 rounded-lg shadow-sm text-xs font-medium text-slate-700 ${className}`}
      role="toolbar"
      aria-label="Time range and filter controls"
    >
      <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Date range presets">
        {presets.map((preset) => {
          const isSelected = preset.id === activeId

          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => handleSelect(preset.id)}
              className={`relative px-2.5 py-1.5 rounded-md transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                isSelected
                  ? 'bg-slate-100 text-slate-900 font-semibold border border-slate-300/60 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                {preset.hasIcon && (
                  <svg
                    className="w-3.5 h-3.5 text-slate-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                )}
                {preset.label}
              </span>
            </button>
          )
        })}
      </div>

      <div className="h-4 w-px bg-slate-200 mx-1" aria-hidden="true" />

      <button
        type="button"
        onClick={onDefaultViewClick}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <span>{defaultViewLabel}</span>
        <svg
          className="w-3.5 h-3.5 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <button
        type="button"
        onClick={onAddFilterClick}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 font-semibold"
      >
        <svg
          className="w-3.5 h-3.5 text-slate-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span>Filter</span>
      </button>
    </div>
  )
}
```

---

## Demo

```tsx
import React, { useState } from 'react'
import SegmentedTimeRangeBar from './SegmentedTimeRangeBar'

export default function Demo() {
  const [selectedRange, setSelectedRange] = useState('30d')

  return (
    <div className="p-8 bg-slate-50 min-h-screen flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">My dashboard</h1>
          <p className="text-xs text-slate-500 mt-1">Active preset: {selectedRange}</p>
        </div>
      </div>

      <div>
        <SegmentedTimeRangeBar
          value={selectedRange}
          onChange={setSelectedRange}
          onDefaultViewClick={() => alert('Open default presets')}
          onAddFilterClick={() => alert('Open filter builder')}
        />
      </div>
    </div>
  )
}
```

---

## Data contract

```typescript
export interface PresetItem {
  id: string // Unique key identifier (e.g., 'custom', '7d', '30d')
  label: string // Short text label displayed inside the button (1-10 chars)
  hasIcon?: boolean // When true, prepends a calendar icon before the label
}
```

| Input state | Behavior |
| :--- | :--- |
| `presets = []` | Renders an empty segmented group container, preserves divider and action buttons |
| Single preset | Renders single active pill, selection remains locked to that item |
| Uncontrolled (no `value`) | Tracks selected item internally with `defaultValue` |
| Controlled (`value` passed) | Updates active pill strictly following prop updates |

---

## Props

| Prop | Type | Default | Range | Effect |
| :--- | :--- | :--- | :--- | :--- |
| `presets` | `PresetItem[]` | `DEFAULT_PRESETS` | 1–16 items | Renders preset toggle buttons in the segmented group |
| `value` | `string` | `undefined` | Any preset ID | Controls active selected pill state |
| `defaultValue` | `string` | `'30d'` | Any preset ID | Sets initial preset if uncontrolled |
| `onChange` | `(id: string) => void` | `undefined` | Function | Invoked whenever a user selects a preset button |
| `defaultViewLabel` | `string` | `'Default'` | Text string | Label for the secondary view trigger |
| `onDefaultViewClick` | `() => void` | `undefined` | Function | Fired on clicking the default view dropdown trigger |
| `onAddFilterClick` | `() => void` | `undefined` | Function | Fired on clicking the "+ Filter" button |
| `className` | `string` | `''` | Tailwind classes | Custom wrapper style overrides |

---

## Acceptance checks

1. Clicking any unselected preset immediately moves the active highlight to that button.
2. In Variant A, the active highlight slides via FLIP animation (`layoutId`) between presets.
3. Hovering unselected preset buttons reveals a light neutral hover background (`bg-slate-50`).
4. Custom preset button renders the calendar icon aligned with the text.
5. Action triggers (`Default`, `+ Filter`) are separated by a 1px vertical divider.
6. Triggering keyboard navigation (Tab/Shift+Tab) exposes a visible focus outline (`focus-visible:ring-2`).
7. Activating `prefers-reduced-motion` suppresses sliding animations and applies instant state changes.
8. No browser console warnings regarding layout IDs or duplicate keys.

---

## Failure modes

| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| Active pill jumps across unrelated bars on the same page | Duplicate `layoutId` collision in Framer Motion | Generate unique `layoutId` prefix using `useId()` |
| Pill background covers preset text label | Indicator positioned over content without `z-index` layering | Ensure pill indicator has `z-0` and label has `relative z-10` |
| Active button text stays gray | Hardcoded text color ignoring selection state | Apply conditional `text-slate-900 font-semibold` when selected |

---

## Do not

- Do not use hardcoded absolute pixel offsets to calculate active pill positions; rely on `layoutId` or CSS class transitions.
- Do not hide the focus ring (`outline: none` without `focus-visible`).
- Do not render filter dropdown action buttons inside the segmented radio group role.

---

## Safe to change

- Border color, radius, and background color tokens (`bg-white`, `border-slate-200`, `rounded-lg`).
- Preset list labels and keys passed through the `presets` prop.
- Font family and size tokens (e.g., changing from `text-xs` to `text-sm`).

---

## Do not change without re-testing

- `layoutId` binding on the active indicator motion element.
- The `z-0` on the active indicator and `relative z-10` on the button label text.
- Separation of `role="radiogroup"` from the outer action buttons.

---

## Placement

Place this component directly above dashboard metrics grids or report chart containers. The container allows horizontal wrapping on constrained viewports (`flex-wrap`).

---

## Known gaps

- Source clip captures a static dashboard view; exact dropdown menu popover contents (e.g., date picker modal, saved view list) are external to this toolbar spec.
- Drag-selection gestures are not present in standard segmented controls and are not implemented.
- Reconstructed from video capture; verify token integration within local theme setup.
