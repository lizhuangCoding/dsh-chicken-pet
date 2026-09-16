# 排查：设置页里看不到桌宠卡片

桌宠显示正常，但 **设置 → 插件配置** 里没有「🐔 小鸡桌宠」卡片。

## 卡片出现的条件

设置页的卡片列表是**两个集合的交集**：

```
卡片显示  =  Host 注册的命名空间  ∩  浏览器注册的卡片
```

两边都以 `chicken-pet` 为 key。**任何一边缺失，卡片就不出现，而且不会有任何报错。**

## 三步定位

### 第一步：Host 侧命名空间注册了吗？

在浏览器控制台执行（Ctrl/Cmd + Shift + I）：

```js
// dsh 的设置在 window.__DSH_BOOT__ 里有记录
JSON.stringify(window.__DSH_BOOT__, null, 2).includes('chicken-pet')
```

或者更直接：**看精灵图能不能下载**。

```
http://127.0.0.1:3080/chicken-pet/spritesheet.png
```

- **能看到一只鸡的图** → Host 半正常，命名空间已注册
- **404** → Host 半没加载，问题在服务端

### 第二步：浏览器侧卡片注册了吗？

控制台执行：

```js
// 列出所有已注册的插槽条目
Object.keys(window.__DSH_BOOT__?.entries ?? {}).filter(id => id.includes('chicken'))
```

- 出现 `dsh-chicken-pet` → 客户端包已加载
- 没有 → 客户端包没进启动图

### 第三步：看控制台报错

卡片注册失败会打印错误。搜索这些关键字：

```
client-modules
slots
plugin
```

## 常见原因

| 现象 | 原因 | 处理 |
|---|---|---|
| 精灵图 404 | Host 半没激活 | 重启 dsh；确认 bundle 栈里有 `dsh-chicken-pet` |
| 精灵图正常但无卡片 | 客户端包没加载 | 见下 |
| 两者都正常但无卡片 | 卡片注册时机太早 | 升级到 0.2.1+ |

### 客户端包没加载

检查 `~/.dsh/profiles/web/package.json`：

```json
{
  "dsh": {
    "client": { "platform": "web" }
  }
}
```

**不要**在里面写 `inject`——它声明的是「必须先加载的包」，写错会让整个浏览器半静默不加载。

## 反馈问题时请附上

1. `dsh --version` 的输出
2. `dsh --profile web --dump-config | grep -A3 chicken-pet`
3. 浏览器控制台的完整报错
4. 精灵图 URL 能否打开
