window.__ModuleLoader__.load({
  id: "dsh-chicken-pet",
  factory: (require) => {
    var module = { exports: {} };
    var __modules = {
"./client/index.js": (__require, exports) => {
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
const { ChickenBrain } = __require("./client/brain.js");
const { CELL, COLS, rowIndex, ROWS } = __require("./client/sheet.js");
/** Stable Cordis plugin name. */
const name = 'chicken-pet';
/** The pet needs no Cordis service; it reacts to agent events when they arrive. */
const inject = [];
/**
 * Defaults used when no host half supplies settings.
 *
 * These are plain values rather than a schema: the host validates user config
 * with schemastery, and this half only needs a fallback for a host-less mount.
 * Keeping the validator on the host is also what keeps `schemastery` out of the
 * browser bundle, which the shell cannot resolve.
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
function apply(ctx, config) {
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

Object.assign(exports, { name, inject, defaultConfig, apply });

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
