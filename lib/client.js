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
const __re_0 = __require("./client/config.js");
/**
 * Mount the pet and register its settings card.
 * @param ctx - registrant context.
 * @param config - fallback configuration for a host-less mount.
 * @returns nothing.
 */
function apply(ctx, config) {
    const service = ctx.get('chickenPetSheet');
    mountPet(ctx, service, { ...defaultConfig(), ...config });
    // The card needs the slot registry and the settings scope together. Asking
    // for both through `ctx.inject` waits until they exist without holding up the
    // pet itself, which is why these dependencies are declared here rather than on
    // the plugin.
    // Mirrors the shape a shipped settings card uses: wait on the settings scope
    // alone, then read the slot registry from the injected context inside the
    // callback. Asking for `slots` in this dependency list as well would gate the
    // callback on a second service for no benefit, and a callback that never runs
    // reports nothing.
    ctx.inject(['settingsScope'], (ready) => {
        const scope = ready?.settingsScope;
        // A missing binding is not an error worth throwing over: the pet still
        // draws, and throwing here would take down the whole plugin.
        if (scope === undefined) {
            console.warn('[chicken-pet] settingsScope is unavailable; the settings card is skipped');
            return;
        }
        console.info('[chicken-pet] registering the settings card');
        installCard(ready, scope.bind({ namespace: SETTINGS_NAMESPACE }));
    });
}

Object.assign(exports, { name, inject, apply, defaultConfig });

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
 * The card renders with `React.createElement` rather than JSX so the build
 * needs no JSX transform: this package is built by its own scripts, and adding
 * a compiler for one component would be more machinery than the component is
 * worth. The element tree is identical either way.
 *
 * A card must ship its own chrome, staging, and revision fencing; the settings
 * section deliberately exposes no shared field components to outside packages.
 */
const { createElement: h, useEffect, useState } = __require("react");
/**
 * Settings namespace this card edits.
 *
 * Spelled here rather than imported from the host half: a client package must
 * not depend on a host package. The page pairs the two by this name alone.
 */
const SETTINGS_NAMESPACE = 'chicken-pet';
/** The card's controls, in display order. */
const FIELDS = [
    {
        field: 'enabled',
        label: '显示桌宠',
        hint: '关掉后小鸡会从界面上消失，设置保留。',
        kind: 'toggle',
    },
    {
        field: 'liveliness',
        label: '活跃度',
        hint: '0 = 几乎不动，1 = 一刻不停。多数时候它自己找事做。',
        kind: 'slider',
        min: 0,
        max: 1,
        step: 0.05,
        format: v => v.toFixed(2),
    },
    {
        field: 'idleMinSec',
        label: '最短间隔（秒）',
        hint: '两次自主行为之间至少间隔多久。',
        kind: 'number',
    },
    {
        field: 'idleMaxSec',
        label: '最长间隔（秒）',
        hint: '最长间隔，必须不小于最短间隔。',
        kind: 'number',
    },
    {
        field: 'size',
        label: '大小（像素）',
        hint: '渲染宽度，高度按比例自动计算。',
        kind: 'number',
    },
    {
        field: 'corner',
        label: '停靠角落',
        hint: '拖走之后以拖动的位置为准。',
        kind: 'corner',
    },
    {
        field: 'sound',
        label: '叫声',
        hint: 'AI 每答完一段时叫一声。',
        kind: 'toggle',
    },
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
];
/** Styles for the card, scoped by a prefix so nothing leaks into the page. */
const CARD_STYLES = `
.cdpc {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 18px;
  border: 1px solid var(--dsh-border, rgba(127, 127, 127, 0.22));
  border-radius: 10px;
  background: var(--dsh-surface, transparent);
  font: 13px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
}
.cdpc-head { display: flex; align-items: baseline; gap: 8px; }
.cdpc-title { font-size: 14px; font-weight: 600; }
.cdpc-sub { opacity: 0.6; font-size: 12px; }
.cdpc-row { display: flex; flex-direction: column; gap: 4px; }
.cdpc-label { font-weight: 500; display: flex; justify-content: space-between; gap: 12px; }
.cdpc-value { opacity: 0.65; font-variant-numeric: tabular-nums; }
.cdpc-hint { opacity: 0.55; font-size: 12px; }
.cdpc-controls { display: flex; align-items: center; gap: 10px; }
.cdpc input[type='range'] { flex: 1; min-width: 120px; }
.cdpc input[type='number'] {
  width: 90px; padding: 3px 6px; font: inherit;
  border: 1px solid var(--dsh-border, rgba(127, 127, 127, 0.3));
  border-radius: 6px; background: transparent; color: inherit;
}
.cdpc-corners { display: grid; grid-template-columns: repeat(2, 22px); gap: 4px; }
.cdpc-corner {
  width: 22px; height: 22px; padding: 0; cursor: pointer;
  border: 1px solid var(--dsh-border, rgba(127, 127, 127, 0.3));
  border-radius: 5px; background: transparent;
}
.cdpc-corner[data-active='true'] { background: currentColor; }
.cdpc-actions { display: flex; align-items: center; gap: 10px; padding-top: 2px; }
.cdpc button.cdpc-btn {
  padding: 5px 14px; font: inherit; cursor: pointer; border-radius: 7px;
  border: 1px solid var(--dsh-border, rgba(127, 127, 127, 0.3));
  background: transparent; color: inherit;
}
.cdpc button.cdpc-btn[data-primary='true'] { background: currentColor; }
.cdpc button.cdpc-btn[data-primary='true'] span { color: var(--dsh-surface, #fff); mix-blend-mode: difference; }
.cdpc button.cdpc-btn:disabled { opacity: 0.45; cursor: default; }
.cdpc-status { opacity: 0.6; font-size: 12px; }
.cdpc-error { color: #d9534f; font-size: 12px; }
`;
/**
 * Render one labelled control.
 * @param spec - the control's description.
 * @param value - current effective value.
 * @param overridden - whether the user layer sets this field.
 * @param face - the card's actions.
 * @returns the control's element.
 */
function renderField(spec, value, overridden, face) {
    const dirty = overridden;
    const commit = (next) => { void face.set(spec.field, next); };
    let control;
    switch (spec.kind) {
        case 'toggle':
            control = h('input', {
                type: 'checkbox',
                checked: value === true,
                onChange: (e) => commit(e.target.checked),
            });
            break;
        case 'slider': {
            const numeric = typeof value === 'number' ? value : 0;
            control = h('div', { className: 'cdpc-controls' }, h('input', {
                type: 'range',
                min: spec.min,
                max: spec.max,
                step: spec.step,
                value: numeric,
                onChange: (e) => commit(Number(e.target.value)),
            }), h('span', { className: 'cdpc-value' }, (spec.format ?? String)(numeric)));
            break;
        }
        case 'number': {
            const numeric = typeof value === 'number' ? value : 0;
            control = h('div', { className: 'cdpc-controls' }, h('input', {
                type: 'number',
                value: numeric,
                onChange: (e) => {
                    const next = Number(e.target.value);
                    if (Number.isFinite(next))
                        commit(next);
                },
            }));
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
                className: 'cdpc-corner',
                'data-active': String(value === corner),
                onClick: () => commit(corner),
            })));
            break;
        }
        default:
            control = null;
    }
    return h('div', { className: 'cdpc-row', key: spec.field }, h('div', { className: 'cdpc-label' }, h('span', null, spec.label), dirty ? h('button', {
        type: 'button',
        className: 'cdpc-corner',
        title: '恢复默认',
        onClick: () => { void face.reset(spec.field); },
        style: { width: 'auto', padding: '0 6px', fontSize: '11px' },
    }, '重置') : null), control, h('div', { className: 'cdpc-hint' }, spec.hint));
}
/**
 * Render the pet's settings card.
 * @param props - the injected face.
 * @returns the card's element tree.
 */
function ChickenPetCard(props) {
    const face = props.inject;
    const [snapshot, setSnapshot] = useState(() => face.getSnapshot());
    useEffect(() => {
        // The renderer owns hook binding; subscribing here keeps the card current
        // without the card needing to know how the scope is transported.
        setSnapshot(face.getSnapshot());
        return face.subscribe(() => setSnapshot(face.getSnapshot()));
    }, [face]);
    const user = (snapshot.user ?? {});
    const value = { ...(snapshot.value ?? {}) };
    if (snapshot.status === 'loading') {
        return h('div', { className: 'cdpc' }, h('div', { className: 'cdpc-status' }, '读取设置中…'));
    }
    if (snapshot.status === 'unavailable') {
        return h('div', { className: 'cdpc' }, h('div', { className: 'cdpc-title' }, '🐔 小鸡桌宠'), h('div', { className: 'cdpc-hint' }, '当前部署不提供可写的设置存储，请在 cordis.patch.yml 中配置。'));
    }
    return h('div', { className: 'cdpc' }, h('div', { className: 'cdpc-head' }, h('span', { className: 'cdpc-title' }, '🐔 小鸡桌宠'), h('span', { className: 'cdpc-sub' }, '保存后立即生效')), ...FIELDS.map(spec => renderField(spec, value[spec.field], spec.field in user, face)), h('div', { className: 'cdpc-status' }, snapshot.writable ? '改动会保存到你的配置。' : '只读。'));
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
    if (slots === undefined) {
        console.warn('[chicken-pet] slot registry is absent; no settings card');
        return;
    }
    if (typeof slots.inject !== 'function') {
        console.warn('[chicken-pet] slot registry has no inject(); the card cannot wait for the settings page');
        return;
    }
    // `key` is the namespace the host serves; the page dispatches on it.
    //
    // Registration goes through `slots.inject` rather than calling `register`
    // directly. `inject` runs the callback for each lifetime of the slot's
    // DECLARING owner, so the card is registered once that owner — the settings
    // page's plugin section — is actually mounted. Registering eagerly loses the
    // race whenever this plugin activates first, and a slot that does not exist
    // yet has nowhere to put the card.
    ctx.effect(() => slots.inject('settings.plugin.item', () => slots.register({ name: 'settings.plugin.item', key: SETTINGS_NAMESPACE, inject: () => face }, ChickenPetCard)));
}

Object.assign(exports, { SETTINGS_NAMESPACE, ChickenPetCard, installCard });

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
        if (frameTimer !== undefined)
            window.clearTimeout(frameTimer);
        frameTimer = undefined;
        currentRow = rowIndex(animation);
        currentFrame = 0;
        const row = ROWS[currentRow];
        if (row === undefined)
            return;
        paint(currentRow, 0);
        const step = () => {
            const r = ROWS[currentRow];
            if (r === undefined)
                return;
            currentFrame = (currentFrame + 1) % r.count;
            paint(currentRow, currentFrame);
            frameTimer = window.setTimeout(step, r.frames[currentFrame] ?? 140);
        };
        frameTimer = window.setTimeout(step, row.frames[0] ?? 140);
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
    /**
     * Play a short two-note chirp.
     *
     * A synthesised chirp avoids shipping an audio file, keeps the plugin free of
     * third-party voice samples, and needs no asset route. The context is created
     * lazily because browsers refuse to start audio before a user gesture.
     * @returns nothing.
     */
    const chirp = () => {
        if (!settings.sound)
            return;
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
        brain.dispatch(trigger);
        if (trigger.kind === 'answer-finished' && brain.snapshot().mode === 'reacting')
            chirp();
    };
    // ---- agent observation --------------------------------------------------
    // Events are the accurate source. `tools/execute` brackets real work, so it
    // distinguishes "the model is thinking" from "something is actually running".
    let toolsInFlight = 0;
    ctx.effect(() => ctx.on('tools/execute', (_exec, next) => {
        toolsInFlight++;
        push({ kind: 'agent-working' });
        let result;
        try {
            result = next();
        }
        catch (error) {
            toolsInFlight = Math.max(0, toolsInFlight - 1);
            throw error;
        }
        void Promise.resolve(result).then(() => {
            toolsInFlight = Math.max(0, toolsInFlight - 1);
            if (toolsInFlight === 0)
                push({ kind: 'agent-thinking' });
        }, () => {
            toolsInFlight = Math.max(0, toolsInFlight - 1);
            if (toolsInFlight === 0)
                push({ kind: 'agent-thinking' });
        });
        return result;
    }));
    ctx.effect(() => ctx.on('agent/assistant-stream', ({ frame }) => {
        // A committed end frame is exactly "the model finished one answer", which
        // is finer-grained than a whole turn and is what drives the chirp.
        if (frame.type === 'end' && frame.outcome.kind === 'committed') {
            push({ kind: 'answer-finished' });
        }
    }));
    ctx.effect(() => ctx.on('agent/request-error', (_payload, next) => {
        push({ kind: 'turn-failed' });
        // Delegate: this listener observes the failure and must not own recovery.
        return next();
    }));
    // Polling is the fallback: an event dispatched on a bus this deployment does
    // not forward would otherwise leave the pet stuck in a working pose forever.
    const agents = ctx.get('agents');
    let sawEvent = false;
    const offEventSeen = brain.subscribe(() => { sawEvent = true; });
    if (agents !== undefined) {
        let previousRunning = false;
        const poll = window.setInterval(() => {
            let running = false;
            try {
                for (const agent of agents.list()) {
                    if (agent?.status === 'running') {
                        running = true;
                        break;
                    }
                }
            }
            catch {
                return;
            }
            if (running === previousRunning)
                return;
            previousRunning = running;
            // Only drive from polling while events have never arrived; once the event
            // path proves live it stays authoritative and polling just tracks state.
            if (!sawEvent)
                push({ kind: running ? 'agent-working' : 'turn-finished' });
            else if (!running)
                push({ kind: 'turn-finished' });
        }, 700);
        ctx.effect(() => () => window.clearInterval(poll));
    }
    ctx.effect(() => offEventSeen);
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
    // A settings save reaches the pet here, so the card updates the pet live
    // instead of asking the user to restart.
    const offSettings = service?.onSettings?.((next) => {
        const merged = { ...settings, ...next };
        // `enabled` is deliberately not honoured after mount: hiding and showing
        // the pet is the plugin's own lifecycle, and toggling it mid-session would
        // leave the brain's timers running against a removed element.
        settings = merged;
        brainConfig.config = {
            ...brainConfig.config,
            idleMinMs: merged.idleMinSec * 1000,
            idleMaxMs: Math.max(merged.idleMinSec, merged.idleMaxSec) * 1000,
            liveliness: merged.liveliness,
        };
        applyGeometry();
    });
    if (offSettings !== undefined)
        ctx.effect(() => offSettings);
    return {
        update(next) {
            settings = { ...settings, ...next };
            brainConfig.config = {
                ...brainConfig.config,
                idleMinMs: settings.idleMinSec * 1000,
                idleMaxMs: Math.max(settings.idleMinSec, settings.idleMaxSec) * 1000,
                liveliness: settings.liveliness,
            };
            applyGeometry();
        },
    };
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
            case 'agent-working':
                this.busy = true;
                this.setMode('working');
                return;
            case 'agent-thinking':
                this.busy = true;
                this.setMode('thinking');
                return;
            case 'agent-waiting':
                this.busy = true;
                this.setMode('waiting');
                return;
            case 'turn-finished':
                this.busy = false;
                this.celebrate('好球！', this.config.celebrateMs);
                return;
            case 'answer-finished': {
                // The agent answered a step. Bark only when the chicken is otherwise
                // idle-adjacent, and never twice in quick succession: a multi-step turn
                // would otherwise chirp on every step.
                const now = this.clock.now();
                if (now - this.lastAnswerAt < this.answerDebounceMs)
                    return;
                this.lastAnswerAt = now;
                if (this.mode === 'celebrating' || this.mode === 'failed')
                    return;
                this.react('咕咕！', 'wave', this.config.reactMs);
                return;
            }
            case 'turn-failed':
                this.busy = false;
                this.setMode('failed');
                this.scheduleRelease(this.config.celebrateMs);
                return;
            case 'poked':
                this.react('干嘛~', 'startle', this.config.reactMs);
                return;
            case 'celebration-over':
                this.busy = false;
                this.setMode('idle');
                this.scheduleRoll();
                return;
            case 'idle-roll':
                this.roll();
                return;
            default: {
                // A merge-extensible union: an unknown trigger is ignored rather than
                // crashing the pet, but the exhaustiveness of the known cases is still
                // enforced by the compiler above.
                const _exhaustive = trigger;
                void _exhaustive;
            }
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
