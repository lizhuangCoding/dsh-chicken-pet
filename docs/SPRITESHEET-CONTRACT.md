# 精灵图契约

本项目的素材是**程序化生成的原创像素画**，不是任何现有形象的二创。这份文档说明图集规格，方便替换素材或做二次创作。

## 图集规格

| 项 | 值 |
|---|---|
| 文件 | `assets/spritesheet.png` |
| 格式 | PNG，RGBA8（带 alpha） |
| 尺寸 | `1536 × 4160` px |
| 网格 | **8 列 × 20 行** |
| 单格 | `192 × 208` px |
| 背景 | 全透明 |
| 未用格 | 必须全透明（本图集每行都填满） |

> 网格与单格尺寸**沿用 Codex 桌宠契约**（8 列、192×208 单格），所以为那套规格做的素材可以直接换进本项目，反之亦然。行数从 9 扩到 20 是本项目的扩展，不影响兼容性：渲染端按行索引取图，多余的行只是多了可选动作。

## 行顺序（契约）

**行顺序是契约的一部分**：浏览器按行索引寻址，所以只允许**在末尾追加**，不能重排或删除。

| 行 | 名称 | 帧数 | 用途 |
|---:|---|---:|---|
| 0 | `idle` | 6 | 呼吸 + 眨眼待机 |
| 1 | `walk-right` | 8 | 向右走 |
| 2 | `walk-left` | 8 | 向左走 |
| 3 | `wave` | 6 | 挥手打招呼 |
| 4 | `jump` | 8 | 跳跃 |
| 5 | `dribble` | 6 | 原地运球 |
| 6 | `spin-ball` | 6 | 指尖转球 |
| 7 | `shoot` | 8 | 投篮 |
| 8 | `sleep` | 6 | 打盹 |
| 9 | `startle` | 6 | 受惊弹起 |
| 10 | `sad` | 6 | 低落 |
| 11 | `wait` | 6 | 期待等待 |
| 12 | `flap` | 6 | 扑棱翅膀 |
| 13 | `pace` | 8 | 来回踱步 |
| 14 | `ruffle` | 6 | 抖羽毛 |
| 15 | `look` | 6 | 左右张望 |
| 16 | `peck` | 6 | 啄米 |
| 17 | `think` | 6 | 思考 |
| 18 | `work` | 6 | 专注干活 |
| 19 | `celebrate` | 8 | 庆祝 |

每帧的停留时长（毫秒）定义在 `src/client/sheet.ts`，与生成器 `scripts/animations.mjs` 保持同步——`scripts/build-sprites.mjs` 的输出会校验两者一致。

## 状态 → 动画映射

宿主状态机（`src/client/brain.ts`）产出 `mode`，客户端映射到动画行：

| mode | 动画行 | 气泡文案 |
|---|---|---|
| `idle` | 由行为调度器决定（见下） | 随行为变化 |
| `working` | 18 `work` | 搬砖中… |
| `thinking` | 17 `think` | 想想… |
| `waiting` | 11 `wait` | 等你哦~ |
| `failed` | 10 `sad` | 呜…出错了 |
| `celebrating` | 19 `celebrate` | 好球！ |
| `reacting` | 9 `startle` | 干嘛~ |

**`idle` 不是一个固定动画。** 待机时行为调度器每 4–12 秒掷一次加权骰子，从 10 种行为里抽一个（`IDLE_POOL`），所以鸡会自己打盹、踱步、啄米、转球。这是本项目区别于普通桌宠的核心。

## 重新生成素材

```sh
npm run sprites     # 重新生成 assets/spritesheet.png 与 spritesheet.json
npm run preview     # 渲染预览图到 docs/
```

## 换成你自己的形象

改 `scripts/chicken.mjs`：

- **配色**：`PALETTE` 对象
- **体型比例**：`BODY_RX` / `BODY_RY` / `HEAD_R` 等几何常量
- **姿态参数**：`drawChicken(pose)` 接受 `bob`（上下）、`lean`（左右）、`headTilt`（转头）、`wingL/wingR`（翅膀角度）、`legLift`（抬腿）、`squash/stretch`（挤压拉伸）、`eye`（0 睁 / 1 闭）、`mouth`（张嘴）、`ball*`（篮球）等

然后在 `scripts/animations.mjs` 里用这些参数写姿势函数即可。所有动作都是参数化绘制，不需要手绘每一帧。
