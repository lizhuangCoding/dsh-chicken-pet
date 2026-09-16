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
export const IDLE_POOL = [
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
export const MODE_ANIMATION = {
    celebrating: 'celebrate',
    reacting: 'wave',
    working: 'work',
    thinking: 'think',
    waiting: 'wait',
    failed: 'sad',
    idle: 'idle',
};
/** Bubble text for each ongoing mode. */
export const MODE_TEXT = {
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
export function pickWeighted(pool, roll) {
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
export class ChickenBrain {
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
