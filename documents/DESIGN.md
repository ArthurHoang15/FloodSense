# Design System Specification

## 1. Creative North Star: "The Luminous Sentinel"
This design system is built to transcend the "utility dashboard" aesthetic. Our North Star is **The Luminous Sentinel**—a visual language that combines the cold, clinical precision of meteorological instrumentation with the high-contrast urgency of emergency response.

We reject "standard" UI. There are no generic boxes here. Instead, we use intentional asymmetry, expansive negative space, and a sophisticated layering of dark surfaces to create an atmosphere of calm authority. This system doesn't just show data; it commands attention through editorial-grade typography and atmospheric depth, ensuring critical information remains legible in the most punishing environmental conditions (rain, glare, or night).

---

## 2. Color & Atmospheric Depth
Our palette is rooted in the abyss of high-altitude weather patterns. We use deep, monochromatic foundations to allow our "Electric Blue" tech accents and critical warning colors to pierce through the interface.

### The Palette
- **Foundational Backgrounds:** `background (#0f131d)` and `surface_dim (#0f131d)`.
- **Primary Tech (Electric Blue):** `primary (#c3f5ff)` and `primary_container (#00e5ff)`.
- **Warning Tiers:** 
  - *Light:* `secondary_container (#feb300)` (Yellow-Gold)
  - *Moderate:* `on_secondary_container (#6a4800)` (Deep Orange/Amber)
  - *Heavy:* `tertiary_container (#ffc2ba)` (High-vis Red/Coral)

### The "No-Line" Rule
Standard 1px borders are strictly prohibited for defining layout sections. We define boundaries through **Background Shifts** only.
- A section sitting on the `surface` should be defined by a `surface_container_low` background. 
- Content nested inside that section uses `surface_container`. 
- This creates a soft, architectural depth that feels like an integrated machine rather than a collection of pasted boxes.

### Signature Textures
Main CTAs and critical data hero-states should utilize subtle gradients. Transition from `primary` to `primary_container` with a 15-degree angle to provide a "glow" that flat colors lack. For overlays, utilize **Backdrop Blur (12px-20px)** with `surface_container_highest` at 60% opacity to maintain a glassmorphism feel that ensures no overlapping clutter.

---

## 3. Typography: Technical Editorial
We pair the utilitarian `Inter` with the futuristic, high-precision `Space Grotesk`. This creates a hierarchy that feels both human and highly technical.

- **Display & Headlines (`Space Grotesk`):** Used for large data points and urgent alerts. The wide apertures of Space Grotesk feel technical and advanced.
  - `display-lg`: 3.5rem (Critical Flood Metrics)
  - `headline-md`: 1.75rem (Regional Alerts)
- **Body & Labels (`Inter`):** Used for functional reading. Inter provides maximum legibility during high-stress monitoring.
  - `body-md`: 0.875rem (The workhorse for telemetry data)
  - `label-sm`: 0.6875rem (Timestamping and micro-metadata)

---

## 4. Elevation & Tonal Layering
We do not use structural lines. We use **Physicality**.

### The Layering Principle
Depth is achieved by "stacking" the surface tiers provided in our scale. 
- **Base Level:** `surface` (#0f131d)
- **Sectioning:** `surface_container_low` (#171b26)
- **Interactive Cards:** `surface_container_highest` (#313540)

### Ambient Shadows
If an element must "float" (e.g., a critical alert modal), use an **Ambient Shadow**. The shadow color must be a 10% opacity version of the `primary` blue or `error` red (depending on status), with a blur of `spacing.8` (1.75rem). This mimics the way light scatters in heavy fog or rain.

### The Ghost Border Fallback
If accessibility requires a border, use the `outline_variant` token at **15% opacity**. A solid, 100% opaque border is a failure of the design system's elegance.

---

## 5. Primitive Components

### Buttons & Interaction
- **Primary:** Gradient fill (`primary` to `primary_container`) with `on_primary` text. Corners: `rounded-md` (0.75rem). 
- **Secondary:** `surface_container_highest` background with a `Ghost Border`.
- **Tertiary:** Text-only using `primary_fixed_dim`.

### Cards & Lists
**Forbid the use of divider lines.** 
To separate list items, use a background shift between `surface_container_low` and `surface_container_lowest`, or use `spacing.4` (0.9rem) of vertical white space to let the typography breathe. 

### Input Fields
Inputs must feel like integrated parts of the dashboard, not "boxes" to fill. Use `surface_container_low` with a subtle `outline_variant` (20% opacity). On focus, the border transitions to a 100% opaque `primary` (Electric Blue) glow.

### Specialized Components: The Alert Banner
For flood warnings, use the full width of the container with a backdrop blur. 
- **Heavy Flood:** Background `error_container` with a 40% blur. Text is `on_error_container`.
- **Iconography:** Use 24px Line/Outline icons. Use a 2px stroke weight to ensure visibility against the dark, textured backgrounds.

---

## 6. Do’s and Don’ts

### Do
- **Embrace Asymmetry:** Place critical metrics off-center to create a sense of movement and "active" monitoring.
- **Use the Grid:** All padding and margins must strictly follow the 8px-based spacing scale (e.g., use `spacing.5` (1.1rem) for card gutters).
- **Prioritize Contrast:** Ensure all `on_surface` text meets a 7:1 contrast ratio against `surface_dim` for night-time legibility.

### Don't
- **Never use 100% Black:** Pure black (#000000) is dead. Use `surface_container_lowest` (#0a0e18) for the deepest depths.
- **No Sharp Corners:** Every interactive element must use at least `rounded-sm` (0.25rem), with a preference for `rounded-md` (0.75rem) to maintain a modern, approachable tech feel.
- **Avoid Clutter:** If the screen feels full, increase the spacing to the next tier in the scale (e.g., move from `spacing.8` to `spacing.10`).