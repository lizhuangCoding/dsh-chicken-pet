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
/** Every animation row the spritesheet provides, by name. */
export type AnimationName = 'idle' | 'walk-right' | 'walk-left' | 'wave' | 'jump' | 'dribble' | 'spin-ball' | 'shoot' | 'sleep' | 'startle' | 'sad' | 'wait' | 'flap' | 'pace' | 'ruffle' | 'look' | 'peck' | 'think' | 'work' | 'celebrate';
/**
 * What the chicken is currently doing, in priority order.
 *
 * `celebrating` and `reacting` are one-shot: they hold for a fixed duration and
 * then release control. `working`, `thinking`, `waiting`, and `idle` are
 * ongoing modes that persist until the agent state changes.
 */
export type PetMode = 'celebrating' | 'reacting' | 'working' | 'thinking' | 'waiting' | 'failed' | 'idle';
/** Why the chicken is doing something; drives which animation is chosen. */
export type PetTrigger = {
    readonly kind: 'idle-roll';
} | {
    readonly kind: 'agent-working';
} | {
    readonly kind: 'agent-thinking';
} | {
    readonly kind: 'agent-waiting';
} | {
    readonly kind: 'answer-finished';
} | {
    readonly kind: 'turn-finished';
} | {
    readonly kind: 'turn-failed';
} | {
    readonly kind: 'poked';
} | {
    readonly kind: 'celebration-over';
};
/** Tuning that the plugin config supplies. */
export interface AutonomyConfig {
    /** Shortest gap between idle dice rolls, in milliseconds. */
    idleMinMs: number;
    /** Longest gap between idle dice rolls, in milliseconds. */
    idleMaxMs: number;
    /** Probability of picking an active behaviour over simply standing still. */
    liveliness: number;
    /** How long a celebration holds before handing control back. */
    celebrateMs: number;
    /** How long a poke reaction holds. */
    reactMs: number;
}
/**
 * One entry in the idle behaviour pool.
 *
 * `weight` is relative, not a probability: the engine normalises across the
 * whole pool, so adding a behaviour never requires rebalancing the others.
 */
export interface IdleBehaviour {
    /** Animation to play. */
    readonly animation: AnimationName;
    /** Relative likelihood of being chosen. */
    readonly weight: number;
    /** How many animation loops to play before rolling again. */
    readonly loops: number;
    /** Line shown in the pet's speech bubble, if any. */
    readonly say?: string;
}
/**
 * The idle pool. Weights encode character: the chicken mostly stands, looks
 * around, and pecks, and only occasionally does something athletic. Keeping
 * the flashy behaviours rare is what makes them read as surprises.
 */
export declare const IDLE_POOL: readonly IdleBehaviour[];
/** Animation shown for each ongoing mode. */
export declare const MODE_ANIMATION: Record<PetMode, AnimationName>;
/** Bubble text for each ongoing mode. */
export declare const MODE_TEXT: Record<PetMode, string>;
/** The complete observable state a renderer needs for one frame. */
export interface PetSnapshot {
    /** Current high-level mode. */
    readonly mode: PetMode;
    /** Animation row to play. */
    readonly animation: AnimationName;
    /** Bubble text, or an empty string to hide the bubble. */
    readonly text: string;
    /** Monotonic counter bumped whenever the animation changes. */
    readonly revision: number;
    /** Whether the chicken is facing left (used to un-mirror walk rows). */
    readonly facingLeft: boolean;
}
/** A clock the engine uses, so tests can drive time by hand. */
export interface Clock {
    /**
     * Schedule a callback.
     * @param fn - callback to run.
     * @param ms - delay in milliseconds.
     * @returns a handle that cancels the pending callback.
     */
    setTimeout(fn: () => void, ms: number): () => void;
    /** Current wall-clock time in milliseconds. */
    now(): number;
}
/**
 * Pick one entry from a weighted pool.
 * @param pool - behaviours to choose from.
 * @param roll - a value in `[0, 1)`, supplied by the caller so the choice is deterministic in tests.
 * @returns the chosen behaviour, or `undefined` for an empty pool.
 */
export declare function pickWeighted(pool: readonly IdleBehaviour[], roll: number): IdleBehaviour | undefined;
/**
 * The autonomy engine.
 *
 * Callers push agent-derived triggers in and read a snapshot out; the engine
 * owns all timing. It holds at most one pending timer, so disposing the plugin
 * cannot leak a callback.
 */
export declare class ChickenBrain {
    private readonly config;
    private readonly clock;
    private readonly random;
    private readonly listeners;
    private mode;
    private animation;
    private text;
    private revision;
    private facingLeft;
    /** Pending one-shot release timer, if a celebration or reaction is running. */
    private releaseTimer;
    /** Pending idle roll timer. */
    private rollTimer;
    /** True while a work-related mode is driving the pet. */
    private busy;
    /** Wall-clock time of the last answer bark, for debouncing. */
    private lastAnswerAt;
    /** Minimum gap between answer barks. */
    private readonly answerDebounceMs;
    /** True while scheduling is suspended by {@link pause}. */
    private paused;
    /**
     * @param config - autonomy tuning from the plugin config.
     * @param clock - timer source.
     * @param random - uniform `[0, 1)` source; injectable for tests.
     * @param answerDebounceMs - minimum gap between answer reactions.
     */
    constructor(config: AutonomyConfig, clock: Clock, random?: () => number, answerDebounceMs?: number);
    /**
     * Subscribe to state changes.
     * @param listener - called on every change.
     * @returns an unsubscribe function.
     */
    subscribe(listener: (snapshot: PetSnapshot) => void): () => void;
    /**
     * Read the current state.
     * @returns the current snapshot.
     */
    snapshot(): PetSnapshot;
    /**
     * Apply one trigger from the agent or the user.
     * @param trigger - what happened.
     * @returns nothing.
     */
    dispatch(trigger: PetTrigger): void;
    /**
     * Suspend scheduling without discarding state.
     *
     * Used while the pet is hidden: the timers would otherwise keep firing
     * against an element nobody can see.
     * @returns nothing.
     */
    pause(): void;
    /**
     * Resume scheduling after {@link pause}.
     * @returns nothing.
     */
    resume(): void;
    /** Stop every timer. */
    dispose(): void;
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
    private roll;
    /**
     * Apply an idle behaviour, unless agent work took over in the meantime.
     * @param animation - animation to play.
     * @param text - bubble text, or empty.
     * @returns nothing.
     */
    private applyIdle;
    /**
     * Enter a sustained mode driven by agent state.
     * @param mode - the mode to enter.
     * @returns nothing.
     */
    private setMode;
    /**
     * Play a one-shot celebration.
     * @param text - bubble text.
     * @param ms - how long to hold before returning to idle.
     * @returns nothing.
     */
    private celebrate;
    /**
     * Play a one-shot reaction that does not clear the busy flag.
     * @param text - bubble text.
     * @param animation - animation to play.
     * @param ms - how long to hold.
     * @returns nothing.
     */
    private react;
    /**
     * Schedule the return to idle after a one-shot.
     * @param ms - delay in milliseconds.
     * @returns nothing.
     */
    private scheduleRelease;
    /**
     * Schedule the next idle roll.
     * @param extraMs - additional delay beyond the configured gap.
     * @returns nothing.
     */
    private scheduleRoll;
    /**
     * Publish a new animation and text.
     * @param animation - animation to play.
     * @param text - bubble text, or empty to hide it.
     * @returns nothing.
     */
    private commit;
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
    private estimateIdleMs;
}
