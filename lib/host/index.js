/**
 * The host half of the pet: serving the sprite asset and watching agent state.
 *
 * A browser plugin cannot read files from a package directory, so the sprite
 * sheet needs an HTTP route. This half owns that route and nothing else — all
 * drawing and interaction live in the client half.
 *
 * Agent activity is observed two ways on purpose. Events are the accurate
 * source and arrive immediately; polling is the fallback, because an event can
 * be dispatched on a bus a given deployment does not forward to plugin
 * listeners. Either source can drive the pet; neither is trusted alone.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import z from '@deepseek-ai/schemastery';
/** Stable Cordis plugin name. */
export const name = 'chicken-pet-host';
/** Services this half needs before it can serve the sheet. */
export const inject = ['webServer'];
export const Config = z.object({
    serveAssets: z.boolean().default(true),
    pollMs: z.number().step(1).min(200).max(10000).default(700),
});
/**
 * Read the packaged spritesheet and its content hash.
 *
 * The sheet is located from this module's own URL, which is the only anchor
 * that survives being installed under a different package manager layout. The
 * path depends on where the compiled file sits, and the package exposes the
 * host half at both `lib/host/index.js` (source emit) and `lib/index.js` (the
 * published re-export), so the search walks upward instead of assuming a depth.
 *
 * The hash is returned to the client so a reload after a plugin upgrade cannot
 * serve a stale cached sheet.
 * @returns the PNG bytes, the hash, and the pixel dimensions.
 * @throws when the sheet is missing from the installed package.
 */
function loadSheet() {
    const candidates = [
        new URL('../../assets/spritesheet.png', import.meta.url),
        new URL('../assets/spritesheet.png', import.meta.url),
    ];
    for (const url of candidates) {
        if (!existsSync(fileURLToPath(url)))
            continue;
        const bytes = readFileSync(fileURLToPath(url));
        const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
        // PNG IHDR: width and height are big-endian uint32 at byte offsets 16 and 20.
        const width = bytes.readUInt32BE(16);
        const height = bytes.readUInt32BE(20);
        return { bytes, hash, width, height };
    }
    throw new Error('chicken-pet: assets/spritesheet.png is missing from the installed package; '
        + 'reinstall the plugin or run `npm run build`.');
}
/**
 * Register the spritesheet route and expose sheet metadata as a service.
 *
 * @param ctx - registrant context carrying the web server and agent registry.
 * @param config - host-half configuration.
 * @returns nothing.
 */
export function apply(ctx, config) {
    const sheet = loadSheet();
    const routePath = '/chicken-pet/spritesheet.png';
    if (config.serveAssets) {
        ctx.effect(() => ctx.webServer.register({
            kind: 'exact',
            path: routePath,
            handler: (req, res) => {
                if (req.method !== 'GET' && req.method !== 'HEAD') {
                    res.writeHead(405, { Allow: 'GET, HEAD' });
                    res.end();
                    return;
                }
                res.writeHead(200, {
                    'Content-Type': 'image/png',
                    'Content-Length': String(sheet.bytes.length),
                    // The URL carries the content hash, so the sheet is immutable.
                    'Cache-Control': 'public, max-age=31536000, immutable',
                });
                if (req.method === 'HEAD')
                    res.end();
                else
                    res.end(sheet.bytes);
            },
        }));
    }
    ctx.provide('chickenPetSheet', {
        /** URL the browser loads the sheet from. */
        url: routePath,
        /** Content hash used as a cache key. */
        hash: sheet.hash,
        /** Sheet width in pixels. */
        width: sheet.width,
        /** Sheet height in pixels. */
        height: sheet.height,
        /** Columns in the sheet. */
        cols: 8,
        /** Rows in the sheet. */
        rows: sheet.height / 208,
        /** Pixel width of one cell. */
        cellWidth: 192,
        /** Pixel height of one cell. */
        cellHeight: 208,
    });
}
