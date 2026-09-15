/**
 * dsh-chicken-pet — a pixel chicken desktop pet for DeepSeek Harness.
 *
 * The package's substance is `cordis.patch.yml`, which inserts the browser
 * plugin row; this module exists because a bundle package must expose a
 * resolvable entry point. It carries no runtime behaviour of its own: every
 * effect lives in the client half (`./client`), which is the only face that
 * can draw and speak.
 *
 * @module dsh-chicken-pet
 */

export {}
