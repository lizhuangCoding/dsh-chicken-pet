/**
 * The browser half of the pet: a floating pixel chicken that reacts to the
 * agent and to the person using it.
 *
 * Presentation is plain DOM rather than a slot-registered React component, so
 * the pet mounts identically in any surface that loads the plugin and owns no
 * layout slot. The chicken lives in a fixed-position, pointer-transparent host
 * element; only the sprite itself accepts pointer events, so it never blocks
 * the chat behind it.
 *
 * The sprite is a CSS background positioned by row and column, which keeps the
 * animation loop to one style write per frame.
 */
import { ChickenBrain, } from './brain.js';
import { CELL, COLS, rowIndex, ROWS } from './sheet.js';
/** Stable Cordis plugin name. */
export const name = 'chicken-pet';
/** The pet needs no Cordis service; it reacts to agent events when they arrive. */
export const inject = [];
/**
 * Defaults used when no host half supplies settings.
 *
 * These are plain values rather than a schema: the host validates user config
 * with schemastery, and this half only needs a fallback for a host-less mount.
 * Keeping the validator on the host is also what keeps `schemastery` out of the
 * browser bundle, which the shell cannot resolve.
 * @returns a complete configuration with every field defaulted.
 */
export function defaultConfig() {
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
/**
 * Mount the pet.
 *
 * Settings come from the host half's service rather than this half's own
 * config: only the host row is composed from the profile patch, so a value
 * placed on that row reaches the browser through here. The local `Config`
 * remains as the fallback for a browser-half-only mount.
 * @param ctx - registrant context.
 * @param config - fallback configuration for a host-less mount.
 * @returns nothing.
 */
export function apply(ctx, config) {
    const service = ctx.get('chickenPetSheet');
    const sheet = service ?? {
        // Fallback keeps the pet usable when the host half is absent: the sheet is
        // served by the same origin at a stable path.
        url: '/chicken-pet/spritesheet.png',
        hash: 'dev',
        cols: COLS,
        cellWidth: CELL.w,
        cellHeight: CELL.h,
    };
    // Host-supplied values win; defaults cover a host-less mount.
    const settings = { ...defaultConfig(), ...config, ...service?.pets };
    if (!settings.enabled)
        return;
    if (typeof document === 'undefined')
        return;
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
    const scale = settings.size / sheet.cellWidth;
    const height = Math.round(sheet.cellHeight * scale);
    sprite.style.width = `${settings.size}px`;
    sprite.style.height = `${height}px`;
    sprite.style.backgroundImage = `url("${sheet.url}?v=${sheet.hash}")`;
    sprite.style.backgroundSize = `${settings.size * sheet.cols}px auto`;
    const cornerStyles = {
        'top-left': { left: `${settings.marginX}px`, top: `${settings.marginY}px` },
        'top-right': { right: `${settings.marginX}px`, top: `${settings.marginY}px` },
        'bottom-left': { left: `${settings.marginX}px`, bottom: `${settings.marginY}px` },
        'bottom-right': { right: `${settings.marginX}px`, bottom: `${settings.marginY}px` },
    };
    Object.assign(root.style, cornerStyles[settings.corner]);
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
}
