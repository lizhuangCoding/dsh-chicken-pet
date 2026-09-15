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
import { createElement as h, useEffect, useState } from 'react';
/**
 * Settings namespace this card edits.
 *
 * Spelled here rather than imported from the host half: a client package must
 * not depend on a host package. The page pairs the two by this name alone.
 */
export const SETTINGS_NAMESPACE = 'chicken-pet';
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
export function ChickenPetCard(props) {
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
export function installCard(ctx, scope) {
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
    if (slots === undefined)
        return;
    // `key` is the namespace the host serves; the page dispatches on it.
    ctx.effect(() => slots.register({ name: 'settings.plugin.item', key: SETTINGS_NAMESPACE, inject: () => face }, ChickenPetCard));
}
