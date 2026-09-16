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
import { ChickenBrain, } from './brain.js';
import { CELL, COLS, rowIndex, ROWS } from './sheet.js';
import { STYLES } from './config.js';
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
export function mountPet(ctx, service, config) {
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
