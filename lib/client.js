window.__ModuleLoader__.load({
  id: "dsh-chicken-pet",
  factory: (require) => {
    var module = { exports: {} };
    var __modules = {
"./client/index.js": (__require, exports) => {
/**
 * The browser half of the pet.
 *
 * Two contributions live here. The pet itself is a fixed overlay that mounts as
 * soon as the plugin loads. The settings card registers into the Web settings
 * page under the namespace the host half serves, so users change the pet's
 * behaviour from the interface rather than by editing YAML.
 *
 * Both are optional at runtime: a deployment without the settings services
 * still gets the pet, and a browser half mounted without the host half falls
 * back to its own defaults.
 */
const { defaultConfig } = __require("./client/config.js");
const { installCard, SETTINGS_NAMESPACE } = __require("./client/card.js");
const { mountPet } = __require("./client/pet.js");
/** Stable Cordis plugin name. */
const name = 'chicken-pet';
/**
 * Services this half needs before it activates.
 *
 * Deliberately empty. Cordis gates activation on every declared name: a row
 * whose service never appears stays `pending` forever, and the boot audit then
 * reports an entry that did not activate, which fails Web startup. The pet
 * needs no service to draw, so it declares none and reaches for the optional
 * ones at runtime instead.
 *
 * `{ optional: [...] }` is NOT how to express this. Cordis reads `inject` as a
 * map of service name to intercept config, so that object asks for a service
 * literally named `optional` and the plugin waits forever.
 */
const inject = [];

// Exported for the package's own tests: rendering the card in isolation is the
// only way to catch a props-contract drift without a browser.
const __re_0 = __require("./client/card.js"); const { ChickenPetCard } = __re_0;
/**
 * Mount the pet and register its settings card.
 * @param ctx - registrant context.
 * @param config - fallback configuration for a host-less mount.
 * @returns nothing.
 */
function apply(ctx, config) {
    // The sheet URL and the saved settings both arrive from the browser side's own
    // view of the host. This half runs in the page, so `ctx.get` cannot reach a
    // service the host process provides; the service name is kept only as the
    // same-process fallback a test harness mounts.
    const service = ctx.get('chickenPetSheet');
    const pet = mountPet(ctx, service, { ...defaultConfig(), ...config });
    ctx.inject(['settingsScope'], (ready) => {
        const scope = ready?.settingsScope;
        // A missing binding is not an error worth throwing over: the pet still
        // draws, and throwing here would take down the whole plugin.
        if (scope === undefined) {
            console.warn('[chicken-pet] settingsScope is unavailable; the settings card is skipped');
            return;
        }
        const bound = scope.bind({ namespace: SETTINGS_NAMESPACE });
        // Saved settings reach the pet through the same scope the card writes, so a
        // change applies live. Reading the host half's own service would deliver
        // nothing: that service lives in the other process.
        const applySaved = () => {
            const snapshot = bound.getSnapshot();
            if (snapshot.status !== 'ready' || snapshot.value === undefined)
                return;
            pet?.update({ ...defaultConfig(), ...config, ...snapshot.value });
        };
        applySaved();
        ready.effect(() => bound.subscribe(applySaved));
        installCard(ready, bound);
    });
}

Object.assign(exports, { name, inject, apply, defaultConfig, ChickenPetCard });

},
"./client/config.js": (__require, exports) => {
/**
 * The pet's configuration type, defaults, and shared stylesheet.
 *
 * Settings are owned by the host half and reach this side over its service.
 * This module only carries the type, the fallback defaults for a host-less
 * mount, and the styles the pet and its settings card share.
 *
 * `@deepseek-ai/schemastery` must NOT be imported here. The shell resolves only
 * its platform modules, so a value import of anything else throws while the
 * bundle loads — and because DSH serves a batch of plugins as one response,
 * that failure unregisters every plugin in the batch.
 */
/**
 * Defaults used when no host half supplies settings.
 *
 * These are plain values rather than a schema: the host validates user config
 * with schemastery, and this half only needs a fallback for a host-less mount.
 * @returns a complete configuration with every field defaulted.
 */
function defaultConfig() {
    return {
        enabled: true,
        corner: 'bottom-right',
        marginX: 24,
        marginY: 24,
        size: 128,
        sound: true,
        volume: 0.85,
        idleMinSec: 4,
        idleMaxSec: 12,
        liveliness: 0.75,
    };
}
/** Stylesheet installed once per plugin activation. */
const STYLES = `
.cdp-root {
  position: fixed;
  z-index: 40;
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}
.cdp-sprite {
  position: relative;
  pointer-events: auto;
  cursor: grab;
  background-repeat: no-repeat;
  image-rendering: pixelated;
  filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.18));
  transition: transform 120ms ease-out;
}
.cdp-sprite:active { cursor: grabbing; }
.cdp-root[data-dragging='true'] .cdp-sprite { transform: scale(1.04); }
.cdp-bubble {
  position: absolute;
  left: 50%;
  bottom: 100%;
  transform: translateX(-50%);
  margin-bottom: 6px;
  padding: 5px 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.97);
  color: #2b2520;
  border: 1px solid rgba(74, 58, 46, 0.14);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.13);
  font: 500 12px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 160ms ease-out;
}
.cdp-bubble[data-visible='true'] { opacity: 1; }
.cdp-bubble::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: rgba(255, 255, 255, 0.97);
}
@media (prefers-color-scheme: dark) {
  .cdp-bubble {
    background: rgba(38, 34, 30, 0.97);
    color: #f4efe6;
    border-color: rgba(255, 255, 255, 0.12);
  }
  .cdp-bubble::after { border-top-color: rgba(38, 34, 30, 0.97); }
}
@media (prefers-reduced-motion: reduce) {
  .cdp-sprite { transition: none; }
}
`;

Object.assign(exports, { defaultConfig, STYLES });

},
"./client/card.js": (__require, exports) => {
/**
 * The pet's card on the Web settings page.
 *
 * The page dispatches one card per settings namespace the host serves, keyed by
 * that namespace, so registering here is what puts the pet's options in the
 * interface instead of leaving users to edit `cordis.patch.yml` by hand.
 *
 * The card follows the same shape as the ones DSH ships: a header that names
 * the plugin and discloses its controls in place, a chevron that turns over
 * when open, a pending marker that survives collapsing, and a footer with
 * discard and save. Edits are staged locally and written on save rather than
 * committed on every keystroke, so a slider drag is one write instead of fifty.
 *
 * Two constraints come from the browser shell rather than from taste:
 *
 * - Only its platform modules resolve, so this card may require `react` and
 *   `@deepseek-ai/dsh-client-ui-primitives` and nothing else. `clsx` is not on
 *   that list; class names are composed with plain string joins.
 * - The inject face is spread onto props, not nested under `inject`. The face's
 *   `hooks` compartment becomes `use<Name>` and every other member lands at the
 *   top level, which is why a shipped card writes `props.save`.
 */
const { createElement: h, useEffect, useRef, useState } = __require("react");
const { Button, IconChevronDownOutline14, Switch } = __require("@deepseek-ai/dsh-client-ui-primitives");
const { CARD_STYLES } = __require("./client/card-styles.js");
/**
 * Settings namespace this card edits.
 *
 * Spelled here rather than imported from the host half: a client package must
 * not depend on a host package. The page pairs the two by this name alone.
 */
const SETTINGS_NAMESPACE = 'chicken-pet';
/** The card's controls, grouped so the panel reads as sections, not a list. */
const GROUPS = [
    {
        title: '显示',
        fields: [
            { field: 'enabled', label: '显示桌宠', hint: '关掉后小鸡从界面消失，设置保留。', kind: 'toggle' },
            { field: 'corner', label: '停靠角落', hint: '拖走之后以拖动的位置为准。', kind: 'corner' },
            { field: 'size', label: '大小', hint: '渲染宽度，高度按 192:208 自动计算。', kind: 'number' },
        ],
    },
    {
        title: '活跃度',
        fields: [
            {
                field: 'liveliness',
                label: '活跃度',
                hint: '平时它自己找事做。0 = 几乎不动，1 = 一刻不停。',
                kind: 'slider',
                min: 0,
                max: 1,
                step: 0.05,
                format: v => v.toFixed(2),
            },
            { field: 'idleMinSec', label: '最短间隔', hint: '两次自主行为之间至少隔几秒。', kind: 'number' },
            { field: 'idleMaxSec', label: '最长间隔', hint: '最长间隔，必须不小于最短间隔。', kind: 'number' },
        ],
    },
    {
        title: '声音',
        fields: [
            { field: 'sound', label: '叫声', hint: 'AI 每答完一段时叫一声。', kind: 'toggle' },
            {
                field: 'volume',
                label: '音量',
                hint: '0 到 1。',
                kind: 'slider',
                min: 0,
                max: 1,
                step: 0.05,
                format: v => v.toFixed(2),
            },
        ],
    },
];
/**
 * Render the disclosure chevron.
 *
 * The shell's own icon rather than a drawn one: it carries explicit width and
 * height attributes, so it cannot stretch to fill the header the way an
 * attribute-less inline SVG does.
 * @param props - the icon's class name.
 * @returns the chevron icon element.
 */
function Chevron(props) {
    return h(IconChevronDownOutline14, { className: props.className });
}
/**
 * Read the working value of every field.
 *
 * A staged edit wins over the stored one, so the form shows what the user is
 * about to save rather than what is currently saved.
 * @param snapshot - the live scope snapshot.
 * @param staged - fields the user has edited but not saved.
 * @returns the effective value of each field.
 */
function effectiveValues(snapshot, staged) {
    return { ...(snapshot.value ?? {}), ...staged };
}
/**
 * Render one field's control.
 * @param spec - the field's description.
 * @param value - the effective value.
 * @param disabled - whether writing is refused.
 * @param commit - apply a staged edit.
 * @returns the row element.
 */
function renderField(spec, value, disabled, commit) {
    let control;
    switch (spec.kind) {
        case 'toggle':
            control = h(Switch, {
                checked: value === true,
                disabled,
                label: spec.label,
                onChange: (next) => commit(spec.field, next),
            });
            break;
        case 'slider': {
            const numeric = typeof value === 'number' ? value : 0;
            control = h('div', { className: 'cdpc-slider' }, h('input', {
                type: 'range',
                min: spec.min,
                max: spec.max,
                step: spec.step,
                value: numeric,
                disabled,
                'aria-label': spec.label,
                onChange: (e) => commit(spec.field, Number(e.target.value)),
            }), h('span', { className: 'cdpc-value' }, (spec.format ?? String)(numeric)));
            break;
        }
        case 'number': {
            const numeric = typeof value === 'number' ? value : 0;
            control = h('input', {
                type: 'number',
                className: 'cdpc-number',
                value: numeric,
                disabled,
                'aria-label': spec.label,
                onChange: (e) => {
                    const next = Number(e.target.value);
                    if (Number.isFinite(next))
                        commit(spec.field, next);
                },
            });
            break;
        }
        case 'corner': {
            const corners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
            const labels = {
                'top-left': '左上', 'top-right': '右上', 'bottom-left': '左下', 'bottom-right': '右下',
            };
            control = h('div', { className: 'cdpc-corners' }, corners.map(corner => h('button', {
                key: corner,
                type: 'button',
                title: labels[corner],
                'aria-label': labels[corner],
                'aria-pressed': value === corner,
                className: 'cdpc-corner',
                'data-active': String(value === corner),
                disabled,
                onClick: () => commit(spec.field, corner),
            })));
            break;
        }
        default:
            control = null;
    }
    return h('div', { className: 'cdpc-row', key: spec.field }, h('div', { className: 'cdpc-label' }, h('span', null, spec.label)), h('div', { className: 'cdpc-hint' }, spec.hint), h('div', { className: 'cdpc-control' }, control));
}
/**
 * Render the pet's settings card.
 * @param props - the injected face, spread onto props by the renderer.
 * @returns the card element.
 */
function ChickenPetCard(props) {
    const face = props;
    const [snapshot, setSnapshot] = useState(() => face.getSnapshot());
    const [staged, setStaged] = useState({});
    const [saving, setSaving] = useState(false);
    const [failed, setFailed] = useState(false);
    // `__open` lets the package's own tests render the disclosed state without a
    // browser; the page never passes it.
    const [open, setOpen] = useState(props.__open === true);
    const saveStarted = useRef(false);
    useEffect(() => {
        setSnapshot(face.getSnapshot());
        return face.subscribe(() => setSnapshot(face.getSnapshot()));
    }, [face]);
    const values = effectiveValues(snapshot, staged);
    const user = (snapshot.user ?? {});
    const dirty = Object.keys(staged).length > 0;
    // Whether any field still differs from the composition layer: the reset button
    // has nothing to do once every override is gone.
    const anyOverridden = Object.keys(user).length > 0;
    // Collapse once the write settles cleanly. A rejected write keeps its drafts
    // and diagnostics on screen so the user can correct them.
    useEffect(() => {
        if (saving) {
            saveStarted.current = true;
            return;
        }
        if (!saveStarted.current)
            return;
        saveStarted.current = false;
        if (!dirty && !failed)
            setOpen(false);
    }, [dirty, failed, saving]);
    const commit = (field, value) => {
        setStaged(current => ({ ...current, [field]: value }));
        setFailed(false);
    };
    /**
     * Clear every field the user has overridden, returning the card to the
     * composition defaults.
     *
     * Staged edits need no wire call — dropping them restores the stored value —
     * so only fields already saved are unset on the host.
     * @returns fulfillment after every host write settles.
     */
    const restoreDefaults = async () => {
        const saved = Object.keys(user).filter(field => !(field in staged));
        setStaged({});
        setFailed(false);
        if (saved.length === 0)
            return;
        setSaving(true);
        try {
            for (const field of saved)
                await face.reset(field);
        }
        catch {
            setFailed(true);
        }
        finally {
            setSaving(false);
        }
    };
    const save = async () => {
        setSaving(true);
        setFailed(false);
        try {
            for (const [field, value] of Object.entries(staged))
                await face.set(field, value);
            setStaged({});
        }
        catch {
            setFailed(true);
        }
        finally {
            setSaving(false);
        }
    };
    const discard = () => {
        setStaged({});
        setFailed(false);
    };
    if (snapshot.status === 'loading') {
        return h('li', { className: 'cdpc' }, h('div', { className: 'cdpc-head' }, h('span', { className: 'cdpc-desc' }, '读取设置中…')));
    }
    if (snapshot.status === 'unavailable')
        return null;
    const disabled = !snapshot.writable;
    return h('li', { className: 'cdpc', 'data-open': String(open) }, h('button', {
        type: 'button',
        className: 'cdpc-head',
        'aria-expanded': open,
        'aria-label': `${open ? '收起' : '展开'}: 🐔 小鸡桌宠`,
        onClick: () => setOpen(!open),
    }, h('span', { className: 'cdpc-headtext' }, h('span', { className: 'cdpc-name' }, '🐔 小鸡桌宠'), h('span', { className: 'cdpc-desc' }, '一只会自己找事做的像素鸡，跟着 Agent 的工作状态活动。')), dirty ? h('span', { className: 'cdpc-pending' }, '未保存') : null, h(Chevron, { className: 'cdpc-chevron' })), open
        ? h('div', { className: 'cdpc-body' }, ...GROUPS.map(group => h('div', { className: 'cdpc-group', key: group.title }, h('div', { className: 'cdpc-grouptitle' }, group.title), ...group.fields.map(spec => renderField(spec, values[spec.field], disabled, commit)))), h('div', { className: 'cdpc-footer' }, failed
            ? h('span', { className: 'cdpc-error', role: 'status' }, '保存失败，请重试。')
            : h('span', { className: 'cdpc-status' }, disabled ? '当前部署只读。' : dirty ? `有 ${Object.keys(staged).length} 项未保存` : '改动会保存到你的配置。'), 
        // One reset for the whole card rather than one per field: a row of
        // identical "reset" links competes with the labels for attention, and
        // restoring defaults is a whole-panel action anyway.
        h(Button, {
            size: 'sm',
            disabled: saving || disabled || (!dirty && !anyOverridden),
            onClick: () => { void restoreDefaults(); },
        }, '恢复默认'), h(Button, {
            size: 'sm',
            disabled: !dirty || saving,
            onClick: discard,
        }, '放弃'), h(Button, {
            variant: 'primary',
            size: 'sm',
            disabled: !dirty || saving || disabled,
            onClick: () => { void save(); },
        }, saving ? '保存中…' : '保存')))
        : null);
}
/**
 * Register the card with the settings page.
 *
 * @param ctx - client registrant context.
 * @param scope - the bound scope for this plugin's settings namespace.
 * @returns nothing.
 */
function installCard(ctx, scope) {
    const styleId = 'chicken-pet-card-styles';
    if (typeof document !== 'undefined' && document.getElementById(styleId) === null) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = CARD_STYLES;
        document.head.appendChild(style);
    }
    const face = {
        getSnapshot: () => scope.getSnapshot(),
        subscribe: listener => scope.subscribe(listener),
        set: (field, value) => scope.set(field, value),
        reset: field => scope.unset(field),
    };
    const slots = ctx.get('slots');
    if (slots === undefined || typeof slots.inject !== 'function') {
        console.warn('[chicken-pet] the slot registry is unavailable; the settings card is skipped');
        return;
    }
    ctx.effect(() => slots.inject('settings.plugin.item', () => slots.register({ name: 'settings.plugin.item', key: SETTINGS_NAMESPACE, inject: () => face }, ChickenPetCard)));
}

Object.assign(exports, { SETTINGS_NAMESPACE, ChickenPetCard, installCard });

},
"./client/card-styles.js": (__require, exports) => {
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
const CARD_STYLES = `
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

Object.assign(exports, { CARD_STYLES });

},
"./client/pet.js": (__require, exports) => {
/**
 * The floating pet: a pixel chicken that reacts to the agent and to the person
 * using it.
 *
 * Presentation is plain DOM rather than a React component. The pet is a fixed
 * overlay that owns no layout slot, so keeping it outside React means it mounts
 * in any surface that loads the plugin and never re-renders with the chat. Only
 * the sprite itself accepts pointer events, so it does not block the interface
 * behind it.
 *
 * The sprite is a CSS background positioned by row and column, which keeps the
 * animation loop to one style write per frame.
 */
const { ChickenBrain } = __require("./client/brain.js");
const { CELL, COLS, rowIndex, ROWS } = __require("./client/sheet.js");
const { STYLES } = __require("./client/config.js");
/**
 * Mount the pet.
 *
 * Settings come from the host half's service rather than this half's own
 * config: only the host row is composed from the profile patch, so a value
 * placed on that row reaches the browser through here. A host-less mount uses
 * the supplied fallback.
 * @param ctx - registrant context.
 * @param service - the host half's sheet and settings service, when present.
 * @param config - fallback configuration for a host-less mount.
 * @returns a handle for applying later settings changes, or undefined when no DOM is available.
 */
function mountPet(ctx, service, config) {
    const sheet = service ?? {
        // Fallback keeps the pet usable when the host half is absent: the sheet is
        // served by the same origin at a stable path.
        url: '/chicken-pet/spritesheet.png',
        hash: 'dev',
        cols: COLS,
        cellWidth: CELL.w,
        cellHeight: CELL.h,
        voice: '/chicken-pet/voice.mp3',
        stateUrl: '/chicken-pet/state.json',
    };
    let settings = { ...config, ...service?.pets };
    if (typeof document === 'undefined')
        return undefined;
    if (!settings.enabled)
        return undefined;
    const style = document.createElement('style');
    style.textContent = STYLES;
    document.head.appendChild(style);
    const root = document.createElement('div');
    root.className = 'cdp-root';
    root.setAttribute('data-dragging', 'false');
    const sprite = document.createElement('div');
    sprite.className = 'cdp-sprite';
    const bubble = document.createElement('div');
    bubble.className = 'cdp-bubble';
    sprite.appendChild(bubble);
    root.appendChild(sprite);
    document.body.appendChild(root);
    let scale = settings.size / sheet.cellWidth;
    let height = Math.round(sheet.cellHeight * scale);
    sprite.style.backgroundImage = `url("${sheet.url}?v=${sheet.hash}")`;
    /**
     * Apply the current size, position, and sheet scaling to the element.
     * @returns nothing.
     */
    const applyGeometry = () => {
        scale = settings.size / sheet.cellWidth;
        height = Math.round(sheet.cellHeight * scale);
        sprite.style.width = `${settings.size}px`;
        sprite.style.height = `${height}px`;
        sprite.style.backgroundSize = `${settings.size * sheet.cols}px auto`;
        // A dragged pet keeps its explicit coordinates; only a corner-anchored one
        // follows the configured corner and margins.
        if (!dragged) {
            root.style.left = '';
            root.style.top = '';
            root.style.right = '';
            root.style.bottom = '';
            const cornerStyles = {
                'top-left': { left: `${settings.marginX}px`, top: `${settings.marginY}px` },
                'top-right': { right: `${settings.marginX}px`, top: `${settings.marginY}px` },
                'bottom-left': { left: `${settings.marginX}px`, bottom: `${settings.marginY}px` },
                'bottom-right': { right: `${settings.marginX}px`, bottom: `${settings.marginY}px` },
            };
            Object.assign(root.style, cornerStyles[settings.corner]);
        }
    };
    const autonomy = {
        idleMinMs: settings.idleMinSec * 1000,
        idleMaxMs: Math.max(settings.idleMinSec, settings.idleMaxSec) * 1000,
        liveliness: settings.liveliness,
        celebrateMs: 2600,
        reactMs: 1400,
    };
    const brain = new ChickenBrain(autonomy, {
        setTimeout: (fn, ms) => {
            const id = window.setTimeout(fn, ms);
            return () => window.clearTimeout(id);
        },
        now: () => Date.now(),
    });
    // Autonomy tuning lives on the brain, so a settings change mutates it rather
    // than rebuilding the pet and losing its current animation.
    const brainConfig = brain;
    let dragged = false;
    applyGeometry();
    // ---- frame playback -----------------------------------------------------
    let frameTimer;
    let currentRow = -1;
    let currentFrame = 0;
    /**
     * Advance the sprite to one cell of the sheet.
     * @param row - row index in the sheet.
     * @param frame - column index within the row.
     * @returns nothing.
     */
    const paint = (row, frame) => {
        const x = -frame * settings.size;
        const y = -row * height;
        sprite.style.backgroundPosition = `${x}px ${y}px`;
    };
    /**
     * Start looping an animation row from its first frame.
     * @param animation - the animation to play.
     * @returns nothing.
     */
    const play = (animation) => {
        stopFrames();
        currentRow = rowIndex(animation);
        currentFrame = 0;
        startFrames();
    };
    /** Stop the frame loop; safe to call when none is running. */
    const stopFrames = () => {
        if (frameTimer !== undefined)
            window.clearTimeout(frameTimer);
        frameTimer = undefined;
    };
    /** Begin looping the current row from its current frame. */
    const startFrames = () => {
        const row = ROWS[currentRow];
        if (row === undefined)
            return;
        paint(currentRow, currentFrame);
        const step = () => {
            const r = ROWS[currentRow];
            if (r === undefined)
                return;
            currentFrame = (currentFrame + 1) % r.count;
            paint(currentRow, currentFrame);
            frameTimer = window.setTimeout(step, r.frames[currentFrame] ?? 140);
        };
        frameTimer = window.setTimeout(step, row.frames[currentFrame] ?? 140);
    };
    // ---- bubble -------------------------------------------------------------
    let bubbleTimer;
    /**
     * Show or hide the speech bubble.
     * @param text - text to show; empty hides it.
     * @returns nothing.
     */
    const say = (text) => {
        if (bubbleTimer !== undefined)
            window.clearTimeout(bubbleTimer);
        bubbleTimer = undefined;
        if (text.length === 0) {
            bubble.removeAttribute('data-visible');
            return;
        }
        bubble.textContent = text;
        bubble.setAttribute('data-visible', 'true');
        bubbleTimer = window.setTimeout(() => {
            bubble.removeAttribute('data-visible');
        }, 3200);
    };
    // ---- sound --------------------------------------------------------------
    let audio;
    /** Reused playback element; a fresh one per call would leak under a burst. */
    let voiceEl;
    /**
     * Play the completion voice through the browser.
     *
     * The clip is optional: a package without one falls back to the synthesised
     * chirp so the pet still answers audibly. Playback is best-effort — browsers
     * refuse audio before the first user gesture, and that refusal must not break
     * the pet or surface as an error.
     * @returns nothing.
     */
    const speak = () => {
        if (!settings.sound) {
            trace('叫声已关闭（设置里 sound = false）');
            return;
        }
        const voice = sheet.voice;
        if (voice === undefined) {
            trace('没有音频文件，回落到合成音');
            chirp();
            return;
        }
        try {
            voiceEl ??= new Audio(voice);
            voiceEl.volume = Math.max(0, Math.min(1, settings.volume));
            voiceEl.currentTime = 0;
            const started = voiceEl.play();
            trace(`播放音频（音量 ${voiceEl.volume.toFixed(2)}）`);
            if (started !== undefined) {
                void started.catch((error) => {
                    // Autoplay policy: the clip plays from the next user gesture onward.
                    const name = error instanceof Error ? error.name : String(error);
                    trace(`音频被拦下（${name}）—— 点一下页面任意位置再试`);
                });
            }
        }
        catch (error) {
            trace(`音频播放失败：${error instanceof Error ? error.message : String(error)}`);
        }
    };
    /**
     * Play a short two-note chirp.
     *
     * The fallback used when the package ships no voice clip. A synthesised tone
     * needs no asset and no route, so it works in any checkout.
     * @returns nothing.
     */
    const chirp = () => {
        try {
            const Ctor = window.AudioContext
                ?? window.webkitAudioContext;
            if (Ctor === undefined)
                return;
            audio ??= new Ctor();
            if (audio.state === 'suspended')
                void audio.resume();
            const start = audio.currentTime;
            const osc = audio.createOscillator();
            const gain = audio.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(880, start);
            osc.frequency.exponentialRampToValueAtTime(1480, start + 0.07);
            osc.frequency.exponentialRampToValueAtTime(1040, start + 0.16);
            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, settings.volume * 0.22), start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
            osc.connect(gain);
            gain.connect(audio.destination);
            osc.start(start);
            osc.stop(start + 0.24);
        }
        catch {
            // Audio is a nicety: a blocked or unavailable context must not break the pet.
        }
    };
    // ---- state --------------------------------------------------------------
    // ---- state --------------------------------------------------------------
    const unsubscribe = brain.subscribe((snapshot) => {
        play(snapshot.animation);
        say(snapshot.text);
    });
    const initial = brain.snapshot();
    play(initial.animation);
    say(initial.text);
    /**
     * Forward one agent observation to the brain.
     * @param trigger - the trigger to apply.
     * @returns nothing.
     */
    const push = (trigger) => {
        // The brain reports whether this trigger decided to bark. Reading its mode
        // afterwards was unreliable: the 250ms sampler can move the pet out of the
        // reaction pose before that read, and the sound was skipped.
        if (brain.dispatch(trigger) === 'bark')
            speak();
    };
    // ---- diagnostics --------------------------------------------------------
    /**
     * Whether the pet logs what it observes.
     *
     * Enabled by `localStorage.setItem('chicken-pet:debug', '1')` and a reload.
     * A user reporting "the pet did not react" otherwise has nothing to look at:
     * the interesting events are silent by design, and the browser console shows
     * nothing about what arrived or what it drove.
     */
    const debug = () => {
        try {
            return window.localStorage?.getItem('chicken-pet:debug') === '1';
        }
        catch {
            // A sandboxed frame can deny storage access; diagnostics are optional.
            return false;
        }
    };
    /**
     * Log one observation when tracing is on.
     * @param message - what happened.
     * @returns nothing.
     */
    const trace = (message) => {
        if (debug())
            console.info(`[chicken-pet] ${message}`);
    };
    // ---- agent observation --------------------------------------------------
    /**
     * Tools executing right now, and whether one ran recently.
     *
     * These refine the pose WITHIN a running turn; they never decide whether the
     * turn is running. That distinction is what the previous revision got wrong:
     * it treated a tool event as proof the agent was working, so the long stretch
     * where the model is thinking produced no state at all and the pet appeared
     * frozen while an answer was being written.
     */
    let toolsInFlight = 0;
    let recentTool = false;
    let recentToolTimer;
    ctx.effect(() => ctx.on('tools/execute', (_exec, next) => {
        toolsInFlight++;
        recentTool = true;
        if (recentToolTimer !== undefined)
            window.clearTimeout(recentToolTimer);
        recentToolTimer = undefined;
        trace(`tools/execute → 工具开始 (同时 ${toolsInFlight} 个)`);
        sample();
        let result;
        try {
            result = next();
        }
        catch (error) {
            toolsInFlight = Math.max(0, toolsInFlight - 1);
            throw error;
        }
        const settle = (ok) => {
            toolsInFlight = Math.max(0, toolsInFlight - 1);
            trace(`tools/execute → 工具${ok ? '成功' : '失败'}结束 (还剩 ${toolsInFlight} 个)`);
            // Hold the working pose briefly between calls so a burst of quick tools
            // does not flicker back to the thinking pose on every boundary.
            if (toolsInFlight === 0) {
                recentToolTimer = window.setTimeout(() => {
                    recentToolTimer = undefined;
                    recentTool = false;
                    sample();
                }, 1200);
            }
            sample();
        };
        void Promise.resolve(result).then(() => settle(true), () => settle(false));
        return result;
    }));
    ctx.effect(() => ctx.on('agent/assistant-stream', ({ frame }) => {
        // A committed end frame is exactly "the model finished one answer", which is
        // finer-grained than a whole turn and is what drives the chirp.
        if (frame.type === 'end' && frame.outcome.kind === 'committed') {
            trace('agent/assistant-stream → AI 答完一段');
            push({ kind: 'answer-finished' });
        }
    }));
    ctx.effect(() => ctx.on('agent/request-error', (_payload, next) => {
        trace('agent/request-error → 请求出错');
        push({ kind: 'turn-failed' });
        // Delegate: this listener observes the failure and must not own recovery.
        return next();
    }));
    // ---- the sampler --------------------------------------------------------
    /**
     * Read the live agent picture and hand it to the brain.
     *
     * This runs on a short interval rather than being driven by events alone. The
     * interesting window is the model thinking, which emits nothing: a tool event
     * marks its start and end but the seconds between them are silent, and an
     * event-driven pet therefore sits in whatever pose the last event left it in
     * for the whole time an answer is being produced.
     *
     * Sampling is authoritative about `running`, and the tool counters refine it.
     * No event is required for the pet to be correct, so a deployment that does
     * not forward agent events still tracks the turn.
     */
    /**
     * The last picture the host reported.
     *
     * This half cannot read `ctx.agents`: that service lives in the host process,
     * so a lookup here returns undefined and the pet would track nothing. The host
     * samples the registry and serves it over the same origin, which is the one
     * channel the two halves share.
     */
    let hostRunning = false;
    /** Fetch the host's live agent picture. */
    const refreshAgentState = async () => {
        const url = sheet.stateUrl;
        if (url === undefined)
            return;
        try {
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok)
                return;
            const body = await response.json();
            const running = body.running === true;
            if (running !== hostRunning) {
                hostRunning = running;
                trace(`主机采样 → agent ${running ? '运行中' : '已停止'}`);
            }
        }
        catch {
            // A failed poll keeps the last picture; the next tick retries.
        }
    };
    /**
     * Read the picture the sampler has.
     * @returns what the pet needs to choose a pose.
     */
    const sampleAgentState = () => ({ running: hostRunning, toolsInFlight, recentTool, waiting });
    /** Whether the agent is blocked on the human, tracked from the approval seam. */
    let waiting = false;
    ctx.effect(() => ctx.on('approval/request', (_request, next) => {
        waiting = true;
        trace('approval/request → 等待用户审批');
        sample();
        let result;
        try {
            result = next();
        }
        catch (error) {
            waiting = false;
            throw error;
        }
        const settle = () => { waiting = false; sample(); };
        void Promise.resolve(result).then(settle, settle);
        return result;
    }));
    /** Hand the current picture to the brain. */
    function sample() {
        const state = sampleAgentState();
        brain.dispatch({ kind: 'agent-state', ...state });
        if (debug() && state.running !== lastLoggedRunning) {
            lastLoggedRunning = state.running;
            trace(`采样 → agent ${state.running ? '运行中' : '已停止'}`
                + `（工具 ${state.toolsInFlight}，等待 ${state.waiting ? '是' : '否'}）`);
        }
    }
    let lastLoggedRunning;
    if (sheet.stateUrl === undefined) {
        trace('主机未提供状态路由，桌宠无法同步 agent 状态');
    }
    else {
        trace(`状态同步已启用：每 250ms 拉取 ${sheet.stateUrl}`);
        void refreshAgentState();
        const poller = window.setInterval(() => { void refreshAgentState(); }, 250);
        ctx.effect(() => () => window.clearInterval(poller));
    }
    // 250ms: fast enough that a thinking turn reads as live rather than as a
    // freeze, and cheap enough to hold one boolean for every open session.
    const sampler = window.setInterval(sample, 250);
    ctx.effect(() => () => window.clearInterval(sampler));
    ctx.effect(() => () => {
        if (recentToolTimer !== undefined)
            window.clearTimeout(recentToolTimer);
    });
    sample();
    // ---- interaction --------------------------------------------------------
    let dragState;
    /**
     * Read the pet's current position as explicit pixel offsets.
     * @returns the left and top offsets.
     */
    const currentPosition = () => {
        const rect = root.getBoundingClientRect();
        return { left: rect.left, top: rect.top };
    };
    const onPointerDown = (event) => {
        if (event.button !== 0)
            return;
        dragged = true;
        const pos = currentPosition();
        // Switch from corner anchoring to explicit coordinates so the pet stays
        // where the pointer left it.
        root.style.left = `${pos.left}px`;
        root.style.top = `${pos.top}px`;
        root.style.right = '';
        root.style.bottom = '';
        dragState = { x: event.clientX, y: event.clientY, left: pos.left, top: pos.top, moved: false };
        root.setAttribute('data-dragging', 'true');
        sprite.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event) => {
        if (dragState === undefined)
            return;
        const dx = event.clientX - dragState.x;
        const dy = event.clientY - dragState.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3)
            dragState.moved = true;
        const maxLeft = window.innerWidth - settings.size;
        const maxTop = window.innerHeight - height;
        const left = Math.min(Math.max(dragState.left + dx, -settings.size * 0.3), maxLeft);
        const top = Math.min(Math.max(dragState.top + dy, 0), maxTop);
        root.style.left = `${left}px`;
        root.style.top = `${top}px`;
    };
    const onPointerUp = (event) => {
        if (dragState === undefined)
            return;
        const moved = dragState.moved;
        dragState = undefined;
        root.setAttribute('data-dragging', 'false');
        try {
            sprite.releasePointerCapture(event.pointerId);
        }
        catch {
            // The pointer may already be released; nothing to undo.
        }
        if (!moved) {
            push({ kind: 'poked' });
            chirp();
        }
    };
    sprite.addEventListener('pointerdown', onPointerDown);
    sprite.addEventListener('pointermove', onPointerMove);
    sprite.addEventListener('pointerup', onPointerUp);
    sprite.addEventListener('pointercancel', onPointerUp);
    // ---- teardown -----------------------------------------------------------
    ctx.effect(() => () => {
        unsubscribe();
        if (frameTimer !== undefined)
            window.clearTimeout(frameTimer);
        if (bubbleTimer !== undefined)
            window.clearTimeout(bubbleTimer);
        brain.dispose();
        sprite.removeEventListener('pointerdown', onPointerDown);
        sprite.removeEventListener('pointermove', onPointerMove);
        sprite.removeEventListener('pointerup', onPointerUp);
        sprite.removeEventListener('pointercancel', onPointerUp);
        root.remove();
        style.remove();
        void audio?.close();
        audio = undefined;
    });
    // ---- applying settings --------------------------------------------------
    /** Whether the pet is currently on screen. */
    let visible = true;
    /**
     * Show or hide the pet.
     *
     * Hiding stops the frame loop and the behaviour timer, so a hidden pet costs
     * nothing; showing starts them again against the same element. The element
     * itself is kept rather than removed, so toggling back does not rebuild the
     * overlay or lose its dragged position.
     * @param next - whether the pet should be on screen.
     * @returns nothing.
     */
    const setVisible = (next) => {
        if (next === visible)
            return;
        visible = next;
        root.style.display = next ? '' : 'none';
        if (next) {
            startFrames();
            brain.resume();
        }
        else {
            stopFrames();
            brain.pause();
            say('');
        }
    };
    /**
     * Apply a complete settings value to the live pet.
     * @param next - the settings to apply.
     * @returns nothing.
     */
    const applySettings = (next) => {
        settings = next;
        brainConfig.config = {
            ...brainConfig.config,
            idleMinMs: next.idleMinSec * 1000,
            idleMaxMs: Math.max(next.idleMinSec, next.idleMaxSec) * 1000,
            liveliness: next.liveliness,
        };
        applyGeometry();
        setVisible(next.enabled);
    };
    // The host half's own service carries settings when both halves share a
    // process (a test harness). In the page the browser half subscribes to the
    // settings scope instead, and calls `update` through this handle.
    const offSettings = service?.onSettings?.((next) => {
        applySettings({ ...settings, ...next });
    });
    if (offSettings !== undefined)
        ctx.effect(() => offSettings);
    return { update: applySettings };
}

Object.assign(exports, { mountPet });

},
"./client/brain.js": (__require, exports) => {
/**
 * The autonomy engine: what the chicken does when nobody is asking it to do
 * anything.
 *
 * A desktop pet that only loops one idle animation reads as a screensaver. This
 * module instead runs a weighted dice roll on a timer and plays whatever it
 * picks, so the chicken naps, paces, pecks, ruffles, and spins its ball in an
 * order that never repeats exactly. Agent activity interrupts the roll and
 * takes priority; when the work finishes the chicken returns to being idle and
 * the dice start again.
 *
 * Everything here is pure state and scheduling. It never touches the DOM, so
 * the same engine can be exercised in a test with a fake clock.
 */
/**
 * The idle pool. Weights encode character: the chicken mostly stands, looks
 * around, and pecks, and only occasionally does something athletic. Keeping
 * the flashy behaviours rare is what makes them read as surprises.
 */
const IDLE_POOL = [
    { animation: 'idle', weight: 26, loops: 1 },
    { animation: 'look', weight: 16, loops: 1, say: '？' },
    { animation: 'peck', weight: 14, loops: 1, say: '咕咕…' },
    { animation: 'ruffle', weight: 11, loops: 1, say: '抖抖毛~' },
    { animation: 'pace', weight: 10, loops: 2, say: '溜达溜达' },
    { animation: 'flap', weight: 8, loops: 1, say: '扑棱扑棱' },
    { animation: 'sleep', weight: 7, loops: 2, say: 'Zzz…' },
    { animation: 'spin-ball', weight: 5, loops: 2, say: '看我转球！' },
    { animation: 'dribble', weight: 4, loops: 2, say: '运球中…' },
    { animation: 'wave', weight: 3, loops: 1, say: '嘿~' },
];
/** Animation shown for each ongoing mode. */
const MODE_ANIMATION = {
    celebrating: 'celebrate',
    reacting: 'wave',
    working: 'work',
    thinking: 'think',
    waiting: 'wait',
    failed: 'sad',
    idle: 'idle',
};
/** Bubble text for each ongoing mode. */
const MODE_TEXT = {
    celebrating: '好球！',
    reacting: '诶嘿~',
    working: '搬砖中…',
    thinking: '想想…',
    waiting: '等你哦~',
    failed: '呜…出错了',
    idle: '休息中~',
};
/**
 * Pick one entry from a weighted pool.
 * @param pool - behaviours to choose from.
 * @param roll - a value in `[0, 1)`, supplied by the caller so the choice is deterministic in tests.
 * @returns the chosen behaviour, or `undefined` for an empty pool.
 */
function pickWeighted(pool, roll) {
    const total = pool.reduce((sum, b) => sum + b.weight, 0);
    if (total <= 0)
        return undefined;
    let target = roll * total;
    for (const behaviour of pool) {
        target -= behaviour.weight;
        if (target < 0)
            return behaviour;
    }
    return pool[pool.length - 1];
}
/**
 * The autonomy engine.
 *
 * Callers push agent-derived triggers in and read a snapshot out; the engine
 * owns all timing. It holds at most one pending timer, so disposing the plugin
 * cannot leak a callback.
 */
class ChickenBrain {
    config;
    clock;
    random;
    listeners = new Set();
    mode = 'idle';
    animation = 'idle';
    text = MODE_TEXT.idle;
    revision = 0;
    facingLeft = false;
    /** Pending one-shot release timer, if a celebration or reaction is running. */
    releaseTimer;
    /** Pending idle roll timer. */
    rollTimer;
    /** True while a work-related mode is driving the pet. */
    busy = false;
    /** Wall-clock time of the last answer bark, for debouncing. */
    lastAnswerAt = 0;
    /** Minimum gap between answer barks. */
    answerDebounceMs;
    /** True while scheduling is suspended by {@link pause}. */
    paused = false;
    /** Whether the agent was running at the previous sample. */
    wasRunning = false;
    /**
     * @param config - autonomy tuning from the plugin config.
     * @param clock - timer source.
     * @param random - uniform `[0, 1)` source; injectable for tests.
     * @param answerDebounceMs - minimum gap between answer reactions.
     */
    constructor(config, clock, random = Math.random, answerDebounceMs = 6000) {
        this.config = config;
        this.clock = clock;
        this.random = random;
        this.answerDebounceMs = answerDebounceMs;
        this.scheduleRoll();
    }
    /**
     * Subscribe to state changes.
     * @param listener - called on every change.
     * @returns an unsubscribe function.
     */
    subscribe(listener) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
    /**
     * Read the current state.
     * @returns the current snapshot.
     */
    snapshot() {
        return {
            mode: this.mode,
            animation: this.animation,
            text: this.text,
            revision: this.revision,
            facingLeft: this.facingLeft,
        };
    }
    /**
     * Apply one trigger from the agent or the user.
     * @param trigger - what happened.
     * @returns nothing.
     */
    dispatch(trigger) {
        switch (trigger.kind) {
            case 'agent-state':
                this.applyAgentState(trigger);
                return undefined;
            case 'answer-finished': {
                // The agent answered a step. Bark only when the chicken is otherwise
                // idle-adjacent, and never twice in quick succession: a multi-step turn
                // would otherwise chirp on every step.
                const now = this.clock.now();
                if (now - this.lastAnswerAt < this.answerDebounceMs)
                    return undefined;
                this.lastAnswerAt = now;
                if (this.mode === 'celebrating' || this.mode === 'failed')
                    return undefined;
                this.react('咕咕！', 'wave', this.config.reactMs);
                return 'bark';
            }
            case 'turn-failed':
                this.busy = false;
                this.setMode('failed');
                this.scheduleRelease(this.config.celebrateMs);
                return undefined;
            case 'poked':
                this.react('干嘛~', 'startle', this.config.reactMs);
                return undefined;
            case 'celebration-over':
                this.busy = false;
                this.setMode('idle');
                this.scheduleRoll();
                return undefined;
            case 'idle-roll':
                this.roll();
                return undefined;
            default: {
                // A merge-extensible union: an unknown trigger is ignored rather than
                // crashing the pet, but the exhaustiveness of the known cases is still
                // enforced by the compiler above.
                const _exhaustive = trigger;
                void _exhaustive;
            }
        }
    }
    /**
     * Suspend scheduling without discarding state.
     *
     * Used while the pet is hidden: the timers would otherwise keep firing
     * against an element nobody can see.
     * @returns nothing.
     */
    pause() {
        this.releaseTimer?.();
        this.rollTimer?.();
        this.releaseTimer = undefined;
        this.rollTimer = undefined;
        this.paused = true;
    }
    /**
     * Resume scheduling after {@link pause}.
     * @returns nothing.
     */
    resume() {
        if (!this.paused)
            return;
        this.paused = false;
        if (this.mode === 'idle')
            this.scheduleRoll();
    }
    /**
     * Move the pet to the pose that matches the live agent picture.
     *
     * The agent is `running` from the moment a message is sent until its turn
     * closes, so this is what makes the pet react to thinking as well as to tool
     * execution. Tool counts only pick the pose within that window.
     *
     * A turn that ends between two samples is celebrated: the pet sees the agent
     * stop without having been told it finished, and staying idle there would
     * silently drop the completion the user is watching for.
     * @param state - the sampled agent picture.
     * @returns nothing.
     */
    applyAgentState(state) {
        // A one-shot celebration owns the pet until it releases itself.
        if (this.mode === 'celebrating')
            return;
        if (state.waiting) {
            this.busy = true;
            this.setMode('waiting');
            return;
        }
        if (state.running) {
            this.busy = true;
            this.wasRunning = true;
            this.setMode(state.toolsInFlight > 0 || state.recentTool ? 'working' : 'thinking');
            return;
        }
        // The agent is not running. A turn that was running at the last sample has
        // just closed, so this is the completion moment.
        if (this.wasRunning) {
            this.wasRunning = false;
            this.busy = false;
            this.celebrate('好球！', this.config.celebrateMs);
            return;
        }
        if (this.busy) {
            this.busy = false;
            this.setMode('idle');
            this.scheduleRoll();
        }
    }
    /** Stop every timer. */
    dispose() {
        this.releaseTimer?.();
        this.rollTimer?.();
        this.releaseTimer = undefined;
        this.rollTimer = undefined;
        this.listeners.clear();
    }
    /**
     * Roll the idle dice and start the chosen behaviour.
     *
     * `liveliness` is applied as a filter over the pool's weights rather than as
     * a separate coin flip. A coin flip would make a high liveliness still land
     * on "stand still" often, and would make the gap between rolls depend on
     * which branch was taken, so the observed activity stopped tracking the
     * setting. Weighting instead keeps the pace fixed and scales how much of it
     * is spent doing something visible.
     * @returns nothing.
     */
    roll() {
        this.rollTimer = undefined;
        if (this.mode === 'celebrating' || this.mode === 'reacting' || this.mode === 'failed')
            return;
        // Scale every behaviour's weight by liveliness; the still entry keeps its
        // full weight, so the pool shifts toward motion as liveliness rises and
        // collapses to pure standing when it is zero.
        const scaled = IDLE_POOL.map(behaviour => ({
            ...behaviour,
            weight: behaviour.animation === 'idle'
                ? behaviour.weight + (1 - this.config.liveliness) * 200
                : behaviour.weight * (0.15 + this.config.liveliness * 1.85),
        }));
        const choice = pickWeighted(scaled, this.random());
        if (choice === undefined) {
            this.scheduleRoll();
            return;
        }
        this.applyIdle(choice.animation, choice.say ?? '');
        const loops = Math.max(1, choice.loops);
        this.scheduleRoll(this.estimateIdleMs(choice.animation) * loops);
    }
    /**
     * Apply an idle behaviour, unless agent work took over in the meantime.
     * @param animation - animation to play.
     * @param text - bubble text, or empty.
     * @returns nothing.
     */
    applyIdle(animation, text) {
        if (this.busy)
            return;
        this.mode = 'idle';
        this.commit(animation, text);
    }
    /**
     * Enter a sustained mode driven by agent state.
     * @param mode - the mode to enter.
     * @returns nothing.
     */
    setMode(mode) {
        this.releaseTimer?.();
        this.releaseTimer = undefined;
        this.rollTimer?.();
        this.rollTimer = undefined;
        this.mode = mode;
        this.commit(MODE_ANIMATION[mode], MODE_TEXT[mode]);
    }
    /**
     * Play a one-shot celebration.
     * @param text - bubble text.
     * @param ms - how long to hold before returning to idle.
     * @returns nothing.
     */
    celebrate(text, ms) {
        this.releaseTimer?.();
        this.rollTimer?.();
        this.rollTimer = undefined;
        this.mode = 'celebrating';
        this.commit('celebrate', text);
        this.scheduleRelease(ms);
    }
    /**
     * Play a one-shot reaction that does not clear the busy flag.
     * @param text - bubble text.
     * @param animation - animation to play.
     * @param ms - how long to hold.
     * @returns nothing.
     */
    react(text, animation, ms) {
        this.releaseTimer?.();
        this.rollTimer?.();
        this.rollTimer = undefined;
        this.mode = 'reacting';
        this.commit(animation, text);
        this.scheduleRelease(ms);
    }
    /**
     * Schedule the return to idle after a one-shot.
     * @param ms - delay in milliseconds.
     * @returns nothing.
     */
    scheduleRelease(ms) {
        this.releaseTimer = this.clock.setTimeout(() => {
            this.releaseTimer = undefined;
            this.dispatch({ kind: 'celebration-over' });
        }, ms);
    }
    /**
     * Schedule the next idle roll.
     * @param extraMs - additional delay beyond the configured gap.
     * @returns nothing.
     */
    scheduleRoll(extraMs = 0) {
        if (this.paused)
            return;
        this.rollTimer?.();
        const span = Math.max(0, this.config.idleMaxMs - this.config.idleMinMs);
        const gap = this.config.idleMinMs + this.random() * span + extraMs;
        this.rollTimer = this.clock.setTimeout(() => {
            this.rollTimer = undefined;
            this.roll();
        }, gap);
    }
    /**
     * Publish a new animation and text.
     * @param animation - animation to play.
     * @param text - bubble text, or empty to hide it.
     * @returns nothing.
     */
    commit(animation, text) {
        this.facingLeft = animation === 'walk-left';
        this.animation = animation;
        this.text = text;
        this.revision++;
        const snapshot = this.snapshot();
        for (const listener of this.listeners)
            listener(snapshot);
    }
    /**
     * Approximate how long one loop of an animation takes, for idle pacing.
     *
     * The authoritative durations live in the spritesheet metadata, which this
     * module deliberately does not import so the engine stays testable without
     * the assets. The values here are close enough to schedule the next roll;
     * being slightly off only shifts when the chicken changes its mind.
     * @param animation - animation being played.
     * @returns estimated duration in milliseconds.
     */
    estimateIdleMs(animation) {
        const heavy = animation === 'sleep' || animation === 'spin-ball' || animation === 'dribble';
        return heavy ? 1800 : 1000;
    }
}

Object.assign(exports, { IDLE_POOL, MODE_ANIMATION, MODE_TEXT, pickWeighted, ChickenBrain });

},
"./client/sheet.js": (__require, exports) => {
/**
 * Spritesheet geometry and frame timing.
 *
 * The sheet is addressed entirely by index: row order is contractual, so rows
 * are appended, never reordered. Timing is baked here rather than read from the
 * JSON at runtime because the browser bundle cannot fetch a file from the
 * package directory without a host route; the JSON stays as the authoring
 * source of truth and this table is checked against it by the build.
 */
/** One cell's pixel size in the spritesheet. */
const CELL = { w: 192, h: 208 };
/** Columns in the spritesheet. */
const COLS = 8;
/**
 * Per-row frame count and durations, indexed by row.
 *
 * Row order matches `scripts/animations.mjs`; `scripts/build-plugin.mjs`
 * regenerates this table from the sprite build so the two cannot drift.
 */
const ROWS = [
    { name: 'idle', count: 6, frames: [280, 110, 110, 140, 140, 320] },
    { name: 'walk-right', count: 8, frames: [110, 110, 110, 110, 110, 110, 110, 200] },
    { name: 'walk-left', count: 8, frames: [110, 110, 110, 110, 110, 110, 110, 200] },
    { name: 'wave', count: 6, frames: [140, 140, 140, 140, 140, 260] },
    { name: 'jump', count: 8, frames: [110, 110, 130, 150, 150, 130, 110, 200] },
    { name: 'dribble', count: 6, frames: [110, 110, 110, 110, 110, 200] },
    { name: 'spin-ball', count: 6, frames: [140, 140, 140, 140, 140, 240] },
    { name: 'shoot', count: 8, frames: [130, 130, 130, 130, 150, 150, 170, 240] },
    { name: 'sleep', count: 6, frames: [420, 320, 320, 420, 320, 420] },
    { name: 'startle', count: 6, frames: [90, 90, 90, 90, 110, 200] },
    { name: 'sad', count: 6, frames: [200, 200, 200, 200, 200, 320] },
    { name: 'wait', count: 6, frames: [200, 180, 180, 180, 180, 300] },
    { name: 'flap', count: 6, frames: [120, 120, 120, 120, 120, 200] },
    { name: 'pace', count: 8, frames: [140, 140, 140, 140, 140, 140, 140, 200] },
    { name: 'ruffle', count: 6, frames: [90, 90, 90, 90, 90, 180] },
    { name: 'look', count: 6, frames: [260, 200, 200, 200, 200, 300] },
    { name: 'peck', count: 6, frames: [150, 120, 180, 150, 120, 220] },
    { name: 'think', count: 6, frames: [240, 200, 200, 200, 200, 320] },
    { name: 'work', count: 6, frames: [110, 110, 110, 110, 110, 200] },
    { name: 'celebrate', count: 8, frames: [110, 110, 110, 110, 110, 110, 140, 220] },
];
/**
 * Look up a row index by animation name.
 * @param name - animation row name.
 * @returns the row index, or 0 when the name is unknown.
 */
function rowIndex(name) {
    const index = ROWS.findIndex(row => row.name === name);
    return index < 0 ? 0 : index;
}

Object.assign(exports, { CELL, COLS, ROWS, rowIndex });

}
    };
    var __cache = {};
    function __require(id) {
      if (__cache[id] !== undefined) return __cache[id].exports;
      var factory = __modules[id];
      if (factory === undefined) return require(id);
      var mod = { exports: {} };
      __cache[id] = mod;
      factory(__require, mod.exports);
      return mod.exports;
    }
    var __entry = __require("./client/index.js");
    Object.assign(module.exports, __entry);
    return module.exports;
  },
});
