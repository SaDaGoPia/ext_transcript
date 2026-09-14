---
name: Tab Transcript
description: A quiet, local-first popup for recording and transcribing lecture audio.
colors:
  ink: "#1c1d1f"
  paper: "#f6f7f8"
  cloud: "#ffffff"
  fog: "#565b63"
  hairline: "rgba(20, 22, 25, 0.12)"
  ink-dark: "#edeef0"
  void: "#17181a"
  charcoal: "#202226"
  ash: "#a9afb6"
  hairline-dark: "rgba(255, 255, 255, 0.12)"
  ember: "#d97706"
  ember-hover: "#e2891c"
  amber-glow: "#e08a1e"
  amber-glow-hover: "#ee9a2e"
  signal: "#dc2626"
  signal-deep: "#b91c1c"
  signal-bright: "#ef4444"
  signal-light: "#f87171"
typography:
  heading:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  action:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
  meta:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  control: "10px"
  dot: "50%"
spacing:
  xs: "6px"
  sm: "9px"
  md: "12px"
  lg: "14px"
  xl: "18px"
components:
  button-primary:
    backgroundColor: "{colors.ember}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  button-primary-hover:
    backgroundColor: "{colors.ember-hover}"
  button-primary-recording:
    backgroundColor: "rgba(220, 38, 38, 0.09)"
    textColor: "{colors.signal-deep}"
    rounded: "{rounded.control}"
  button-secondary:
    backgroundColor: "{colors.cloud}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
---

# Design System: Tab Transcript

## Overview

**Creative North Star: "The Quiet Study Tool"**

Tab Transcript is a personal utility, not a product with an audience to persuade — it exists to disappear into a lecture, do one honest job (record, transcribe, hand back a file), and get out of the way. The whole system is built around a single restrained accent (a warm amber, "ember") plus one universal borrowed convention: red means recording, always, with no exceptions and no competing use of that hue. Nothing implies a cloud, an account, or a service running somewhere else — the surface is flat, local, and small on purpose, sized to a ~340px browser popup rather than a page.

Confirmed visual rejections: no cream/parchment neutrals (a deliberately avoided AI-interface default), no gradients or glass, no glyph/emoji icons standing in for the drawn mark, no invented affordances where a universal one already exists (recording is red because recording is always red).

**Key Characteristics:**
- One accent (ember/amber), used only for the primary action and the icon mark — never decoration.
- Recording state borrows the universal red-dot convention outright; it is not a brand color.
- Flat throughout — no bevels, no faux depth, one real elevation shadow on the primary button only.
- Theme follows the browser's own light/dark setting; light and dark are two complete, independently-tuned palettes, not one palette with an opacity trick.

## Colors

A restrained, two-color-family system: warm neutrals for structure, one warm accent for action, one borrowed red for a single specific state.

### Primary
- **Ember** (`#d97706`): the one accent. Used only on the primary "Start Recording" button and the toolbar icon's mark — nowhere else. Light-theme value; the dark-theme surface uses **Amber Glow** (`#e08a1e`) instead, tuned lighter so it still reads correctly against a near-black ground.

### Neutral
- **Ink** (`#1c1d1f`): primary text and the accent-contrast color sitting on top of Ember. Light theme.
- **Paper** (`#f6f7f8`): light-theme background. Deliberately a cool near-white, not a warm cream — the calibration this system explicitly avoids.
- **Cloud** (`#ffffff`): light-theme surface color for the transcript panel and the secondary button.
- **Fog** (`#565b63`): light-theme secondary/meta text.
- **Void** (`#17181a`): dark-theme background.
- **Charcoal** (`#202226`): dark-theme surface color (transcript panel, secondary button).
- **Ink Dark** (`#edeef0`): dark-theme primary text.
- **Ash** (`#a9afb6`): dark-theme secondary/meta text.

### Named Rules
**The One Ember Rule.** The accent hue appears in exactly two places: the primary button's idle state and the toolbar mark. It is never used for links, borders, or decoration elsewhere in the interface.

**The Borrowed Red Rule.** Red is never chosen for brand reasons — it exists solely because "recording" and "error" already mean red to every user. `Signal` (`#dc2626` light / `#ef4444` dark) covers status text at that role; `Signal Deep` (`#b91c1c` light) / `Signal Light` (`#f87171` dark) cover text and borders that sit on top of the tinted red field, where the plain `Signal` value doesn't clear contrast. Never introduce a second red, and never use `Signal` for anything that isn't recording or error.

## Typography

**Body Font:** System sans stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`) — no display font anywhere. This is an Operate-mode utility; a workhorse system sans carries every role.

**Character:** Plain and legible at every tier — the interface should read as a tool, not make a typographic statement.

### Hierarchy
- **Heading** (700, 17px, 1.2): the "Tab Transcript" wordmark only. The one place bold, larger type appears.
- **Action** (600, 15px, 1.2): the primary and secondary button labels.
- **Body** (400, 14px, 1.55): the transcript preview text — the one place users read continuous prose, sized for comfortable reading in a narrow panel.
- **Meta** (400, 12px, 1.45): the idle/status line. Promoted to Action-tier weight and size, in Signal Deep/Light, specifically while recording — proof the tool is alive outranks the meta tier's usual quietness.

### Named Rules
**The Four-Tier Rule.** Heading (17/700) → Action (15/600) → Body (14/400, or 600 for the secondary button) → Meta (12/400) are the only four type combinations in the system. A fifth size is a sign the hierarchy needs to be re-derived, not extended.

## Layout

A single fixed-width column, 340px, padding 18px (`spacing.xl`) on all sides, with a consistent 14px (`spacing.lg`) gap between stacked elements. There is no responsive behavior — a Chrome extension popup has exactly one viewport. Density stays low: one primary action, one status line, one content panel, one secondary action, in that fixed vertical order, top to bottom.

## Elevation & Depth

Flat by default, with exactly one elevated element: the primary button, which is the one thing on the surface the user's eye should land on first. Everything else — the transcript panel, the secondary button — sits flush with the background, differentiated by a hairline border and a background-color step, never a shadow.

### Shadow Vocabulary
- **Button Lift** (light: `0 1px 2px rgba(20,22,25,.16), 0 4px 10px rgba(20,22,25,.08)`; dark: `0 2px 4px rgba(0,0,0,.5), 0 8px 18px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.1)`): the primary button only, in its idle and transcribing states. The dark-theme version adds a 1px top inset highlight because a plain dark shadow disappears against a near-black background — the highlight, not extra shadow darkness, is what restores the edge.

### Named Rules
**The One Shadow Rule.** Exactly one element carries elevation. If a second element seems to need a shadow, the layout has too much competing weight, not too little depth.

## Shapes

One radius for every control — 10px (`rounded.control`) — applied identically to the primary button, the secondary button, and the transcript panel, so nothing in the interface reads as a different "kind" of control. The record indicator is the one fully circular element (`rounded.dot`, 9px diameter), reserved for that single purpose.

## Components

### Buttons
- **Shape:** 10px radius (`rounded.control`), shared with every other control.
- **Primary — idle:** Ember background (Amber Glow in dark theme), Ink text, Button Lift shadow. This is the only solid-fill, elevated element on the surface.
- **Primary — recording:** background flips to a 9-14% Signal tint (never a solid fill — the tint is what keeps the red state legible without turning the whole button into an alarm), Signal Deep/Light text and border, a pulsing 9px red dot at 1.6s ease-in-out. No shadow — the border carries definition instead.
- **Primary — transcribing:** stays in the Ember/Amber Glow family (this is still "working," not idle and not an error) but the *background* breathes between Ember and Ember Hover on a 1.8s cycle — never the button's opacity, which would dim the label during the one state most likely to last minutes.
- **Hover / Focus:** idle hover lightens toward Ember Hover / Amber Glow Hover (lighter, not darker — the label text is dark, so hover must move away from it). Focus-visible is a 2px solid outline in the text color, 2px offset, on every interactive element.
- **Secondary:** Cloud/Charcoal background, 1px hairline border, no shadow, Action-tier weight (600) at Body-tier size (14px) — deliberately shares the body text's size so it doesn't compete with the primary button, distinguished only by weight and button chrome.

### Inputs / Fields
- **Style:** the transcript preview is a `readonly` textarea styled as a panel — Cloud/Charcoal background, 1px hairline border, 10px radius, Body-tier type. `resize: none` — a drag handle on a read-only field is a stray default, not a real affordance.
- **Focus:** same 2px solid outline as buttons, 1px offset.
- **Placeholder:** Fog/Ash (the secondary text color) — never a lighter, lower-contrast gray reserved just for placeholders.

## Do's and Don'ts

### Do:
- **Do** keep red exclusive to the recording and error states — no other element may use `Signal`, `Signal Deep`, `Signal Bright`, or `Signal Light`.
- **Do** derive every hover/active/disabled state from the existing four-color-role system (Ink/Paper/Ember/Signal, per theme) rather than introducing a fifth hue.
- **Do** keep the type system to its four tiers (Heading/Action/Body/Meta); a new size means the hierarchy wasn't thought through, not that one more size was needed.
- **Do** use the tinted-background pattern (a translucent role color over the surface, with a `-Deep`/`-Light` variant for any text/border sitting on it) whenever a future state needs a colored field — it's what makes the recording state legible without becoming a solid alarm block.

### Don't:
- **Don't** add a second accent color. Ember is the only "brand" color this system has; a second one dilutes the One Ember Rule.
- **Don't** animate `opacity` on any element that contains readable text for a state lasting more than a second or two — animate `background-color` (or a layered pseudo-element) instead, so the text never dips below contrast.
- **Don't** give any control a different corner radius than 10px, or the record dot a different shape than a circle.
- **Don't** reach for a warm cream/parchment background if this system ever grows a second surface — the cool `Paper`/`Void` neutrals are a deliberate rejection of that default, not an oversight to "warm up" later.
