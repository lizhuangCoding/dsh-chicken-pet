/**
 * Styles for the pet's settings card.
 *
 * These are the shipped card's own values, copied member for member, because a
 * card that approximates them reads as a different component beside its
 * neighbours: a few pixels of extra padding and a larger radius are enough to
 * break the row. The one addition is the grouping used by the pet's own panel;
 * everything else keeps the shipped geometry.
 *
 * The class prefix stays `cdpc-` rather than reusing the section's hashed CSS
 * Module names, which a package outside this repository cannot import.
 */
/** Stylesheet installed once per plugin activation. */
export const CARD_STYLES = `
.cdpc {
  list-style: none;
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: 16px;
  background: var(--dsw-alias-bg-layer-3);
  transition: border-color .16s, background .16s;
}
.cdpc:hover { border-color: var(--dsw-alias-label-dimmed); }
.cdpc[data-open='true'] {
  background: var(--dsw-alias-bg-layer-2);
  border-color: var(--dsw-alias-label-dimmed);
}
.cdpc-head {
  width: 100%;
  appearance: none;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 12px;
}
.cdpc-head:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: -2px;
}
.cdpc-headtext {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cdpc-name {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--dsw-alias-label-primary);
}
.cdpc-desc {
  font-size: 13px;
  line-height: 1.5;
  color: var(--dsw-alias-label-tertiary);
}
.cdpc-chevron {
  flex: none;
  color: var(--dsw-alias-label-tertiary);
  transition: transform .16s;
}
.cdpc[data-open='true'] .cdpc-chevron { transform: rotate(180deg); }
.cdpc-body {
  border-top: 0.5px solid var(--dsw-alias-border-l2);
  margin: 0 16px;
  padding-bottom: 8px;
}
.cdpc-group { padding: 12px 0; }
.cdpc-group + .cdpc-group { border-top: 0.5px solid var(--dsw-alias-border-l2); }
.cdpc-grouptitle {
  font-size: 12px;
  line-height: 1.5;
  color: var(--dsw-alias-label-tertiary);
  margin-bottom: 8px;
}
.cdpc-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 2px 16px;
  padding: 6px 0;
}
.cdpc-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--dsw-alias-label-primary);
}
.cdpc-hint {
  grid-column: 1;
  font-size: 12px;
  line-height: 1.5;
  color: var(--dsw-alias-label-tertiary);
}
.cdpc-control {
  grid-column: 2;
  grid-row: 1 / span 2;
  display: flex;
  align-items: center;
  gap: 10px;
}
.cdpc-number {
  width: 88px;
  padding: 4px 8px;
  font: inherit;
  font-size: 13px;
  line-height: 1.5;
  color: inherit;
  background: none;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
}
.cdpc-slider { display: flex; align-items: center; gap: 10px; }
.cdpc-slider input[type='range'] { width: 150px; accent-color: var(--dsw-alias-brand-primary); }
.cdpc-value {
  min-width: 32px;
  text-align: right;
  font-size: 13px;
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-tertiary);
}
.cdpc-corners { display: grid; grid-template-columns: repeat(2, 18px); gap: 3px; }
.cdpc-corner {
  width: 18px;
  height: 18px;
  padding: 0;
  cursor: pointer;
  border: 1px solid var(--dsw-alias-border-l4);
  border-radius: 4px;
  background-color: var(--dsw-alias-bg-layer-3);
  background-image: radial-gradient(circle at center, var(--dsw-alias-label-dimmed) 2px, transparent 2px);
}
.cdpc-corner:hover { border-color: var(--dsw-alias-label-dimmed); }
.cdpc-corner[data-active='true'] {
  background-color: var(--dsw-alias-brand-primary);
  border-color: var(--dsw-alias-brand-primary);
  background-image: radial-gradient(circle at center, #fff 2px, transparent 2px);
}
.cdpc-reset {
  appearance: none;
  border: 0;
  background: none;
  padding: 0;
  font: inherit;
  font-size: 12px;
  line-height: 1.5;
  cursor: pointer;
  color: var(--dsw-alias-label-tertiary);
  text-decoration: underline dotted;
}
.cdpc-reset:hover { color: var(--dsw-alias-label-primary); }
.cdpc-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 0 4px;
  border-top: 0.5px solid var(--dsw-alias-border-l2);
}
.cdpc-status {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--dsw-alias-label-tertiary);
}
.cdpc-error {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--dsw-alias-label-error);
}
.cdpc-pending {
  flex: none;
  font-size: 13px;
  line-height: 1.5;
  color: var(--dsw-alias-label-tertiary);
}
`;
