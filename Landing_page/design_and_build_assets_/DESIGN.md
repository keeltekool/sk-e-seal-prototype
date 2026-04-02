# Design System Specification

## 1. Overview & Creative North Star: The Technical Editorial
This design system is built upon the "Technical Editorial" North Star. It bridges the gap between high-security digital infrastructure and a premium, accessible information experience. Unlike standard corporate layouts that rely on heavy borders and loud colors, this system uses **intentional asymmetry**, **tonal layering**, and **expansive white space** to command authority. 

The aesthetic is characterized by a "Swiss-inspired" precision: high-contrast headings, a strictly disciplined color palette, and a "No-Line" philosophy that prioritizes background shifts over structural borders. It feels engineered yet breathable—much like the security protocols it represents.

## 2. Colors
The palette is rooted in a high-visibility primary orange, supported by a sophisticated hierarchy of neutrals that define the spatial experience.

### Brand Core
- **Primary (`#b32000` / `#f12f00`):** Used for critical brand moments, active states, and high-impact CTAs.
- **Secondary (`#5f5e5d`):** Reserved for supporting information and secondary actions.
- **Surface (`#fbf9f7`):** The default canvas color, providing a warmer, more premium feel than pure white.

### The "No-Line" Rule
Traditional 1px borders are strictly prohibited for sectioning. Structural boundaries must be defined solely through background color shifts:
*   **Surface Hierarchy:** Use `surface_container_lowest` (#ffffff) for card elements to make them pop against a `surface_container_low` (#f6f3f1) or `surface` (#fbf9f7) background.
*   **Tonal Transitions:** Transition from a `surface` section to a `secondary_container` (#e4e2e0) section to denote a change in content context without visual clutter.

### Signature Textures
- **The "Glass & Gradient" Rule:** For floating UI elements or high-level overlays, utilize semi-transparent surface colors with a `backdrop-blur`.
- **Primary Gradients:** Main CTAs or Hero backgrounds should use a subtle linear gradient from `primary` (#b32000) to `primary_container` (#e02b00) to provide depth and "visual soul."

## 3. Typography
The system utilizes a dual-font strategy: **Space Grotesk** for technical authority and **Inter** for legible utility.

- **Display & Headlines (Space Grotesk):** High-character, geometric, and authoritative.
    - *Display-LG (3.5rem):* Reserved for hero headlines.
    - *Headline-MD (1.75rem):* Used for primary section titles.
- **Titles & Body (Inter):** Neutral, highly readable, and professional.
    - *Body-LG (1rem):* Standard reading text. Line-height should be generous (1.6) to maintain the editorial feel.
    - *Label-MD (0.75rem):* Used for small captions, metadata, and micro-copy.

**Editorial Hierarchy:** Always pair a bold, all-caps `label-md` in `primary` color above a `headline-lg` to create a sophisticated, curated content structure.

## 4. Elevation & Depth
Depth is achieved through **Tonal Layering** rather than drop shadows.

- **The Layering Principle:** Treat the UI as stacked sheets of fine paper. 
    - *Layer 1:* `surface` (Base)
    - *Layer 2:* `surface_container_low` (Sectioning)
    - *Layer 3:* `surface_container_lowest` (Interactive Cards/Components)
- **Ambient Shadows:** Only use shadows for "floating" elements (e.g., tooltips or mobile menus). Shadows must be extra-diffused: `blur: 24px`, `opacity: 6%`, using a tint of `on_surface` (#1b1c1b).
- **The Ghost Border:** If a boundary is required for accessibility, use `outline_variant` at 15% opacity. Never use high-contrast solid lines.

## 5. Components

### Service Cards
- **Style:** No borders. Background: `surface_container_lowest` (#ffffff).
- **Corner Radius:** `xl` (0.75rem).
- **Interaction:** On hover, shift background to `surface_container_high` and apply a subtle `primary` accent to the icon or arrow.
- **Spacing:** `8` (2rem) internal padding.

### Buttons
- **Primary:** `primary` background, `on_primary` text. `full` roundedness. 
- **Secondary:** `surface_container_highest` background. No border.
- **Tertiary:** Text-only with a `primary` color and a subtle bottom-weighted underline (2px) using `primary_fixed_dim`.

### Input Fields
- **Surface:** `surface_container_low`. 
- **Border:** Use the "Ghost Border" (10% opacity `outline`).
- **State:** On focus, the border transitions to `primary` with a 2px width.

### Data Visualization (The Baltic Map)
- **Aesthetic:** Minimalist outline using `outline_variant`. 
- **Callouts:** Connected via thin, precise lines in `primary`. Use `display-sm` for the large numerical data points.

## 6. Do's and Don'ts

### Do
- Use **Asymmetric Spacing** (e.g., a larger top margin than bottom margin) to create a dynamic, editorial rhythm.
- Use **Primary Orange** sparingly for "pinks" and "accents"—let the white space do the heavy lifting.
- Ensure all icons are monoline and use the `secondary` color token.

### Don't
- **Don't use 1px solid black or grey borders.** It breaks the "Technical Editorial" flow.
- **Don't use standard drop shadows.** They feel "out-of-the-box" and cheapen the premium identity.
- **Don't crowd the content.** If a section feels full, increase the spacing to the next tier in the scale (e.g., from `16` to `24`).