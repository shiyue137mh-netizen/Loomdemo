# Loom Studio Architecture

> *A workshop for prompt looms.*

**Status**: Draft v0.2 — discussion document, not implementation spec.
**Audience**: Loom 引擎维护者、Studio 设计者、未来的 Extension 作者、独立前端作者。
**Companion documents**: `loom-whitepaper.md`, `loom-scope.md`, `loom-architecture-answers.md`（ADR-001）。

---

## 0. Intent

本文档回答一个问题：**如果 Loom 引擎是织机，那么"用织机做事的工坊"长什么样？**

Loom Studio 是一个**本地优先、平台化的 LLM 工作台**。它面向当前 SillyTavern 用户群体——本地部署、重度自定义、生态驱动——但它不试图做"更好的 SillyTavern"，而是做**让"更好的 SillyTavern"成为众多可能形态之一**的那个底座。

Studio 不是一个 App。Studio 是一个 **Node.js 应用 + 一组协议**，它的官方 Web UI 只是这个协议的第一个客户端。Studio 与 Loom 引擎的气质一脉相承：**克制、显式、不替用户决定**。

### 三个核心承诺（hero）

1. **Extension 前后端分离 / Protocol-Shaped, Not Application-Shaped**  
   一个 Extension 的"服务端能力"与"客户端 UI"是两个独立的可分发部分，通过协议而不是组件库连接。后端大佬只发后端、前端大佬只发 UI、二者能被任意组合。Server Part 不知道自己在为哪个 UI 服务。

2. **Transport API 是平台对外的真正契约**  
   官方 Web UI 没有任何走后门的能力。第三方客户端、独立角色卡前端、CLI、bot 通过 Transport 看到的世界与官方客户端完全相同。

3. **一切已注册之物皆可发现**  
   Extension 注册到 Kernel 的所有东西（document types、passes、commands、rpc、events、schemas）在运行时可枚举。生态作者写的不只是代码，还是**自描述**的代码。

### Studio 不做的事（先于做的事说）

- Studio 不内置任何 LLM provider
- Studio 不内置 chat / message / character / worldbook 概念（哪怕 99% 用户都需要——这些由概念栈 Extension 提供，例如 `loom-studio-st`）
- Studio 不提供云端同步、用户系统、多租户、SaaS 形态
- Studio 不维护中央插件市场
- Studio 不做插件自动更新
- Studio 不做内置全文搜索、向量检索
- Studio 不假设"官方 Web UI"必然存在
- Studio 不抹平 LLM provider 差异（"AI Gateway"是 Extension 的事）
- Studio 不替 Extension 决定 UI 形态、UI 框架、UI 挂载方式

这些"不做"不是延后清单，而是**架构承诺**。它们越多，平台属性越强。

---

## 1. Tenets

Studio 有三条不可动摇的信条，与 Loom 引擎的 *The Engine Does Less* 形成两层一致的克制风格：

### Tenet I — The Kernel Does Less

Studio 的 Kernel 只承担六件事（见 §6）。任何"看起来很有用、但有任何一个 Extension 能做"的功能都不进 Kernel。每多一个 Kernel 内置功能，平台属性就削弱一分。

### Tenet II — Transport API is the Contract

Studio 对外的真正契约是 Transport API，**不是**官方 Web UI、**不是**官方 SDK、**不是**任何具体客户端实现。

- 官方 Web UI 没有任何走后门的能力
- 第三方客户端通过 Transport 看到的世界与官方客户端完全相同
- "Studio 是平台"这句话的工程含义就是这一条

如同 Loom 引擎不假设"有一个 App 在使用它"，Studio Kernel 不假设"有一个官方 UI 在使用它"。两层克制相互独立、相互见证。

### Tenet III — Everything Registered is Discoverable

Extension 注册到 Kernel 的一切都必须**运行时可枚举、可自描述**：

- Document Types 必须附带 schema
- RPC 必须有签名（参数 / 返回 / 流式特征）
- Events 必须声明命名空间与 payload 形状
- Passes 必须暴露 `provides` / `requires` 契约
- Commands 必须可被命令面板列出

Kernel 暴露统一的 `system.introspect` RPC（见 §6.6）。任何客户端、任何 Extension、任何调试器都能拿到平台的完整能力图。

这条信条解决三类开发者的同一个痛点："我看不见别人提供了什么"——

- Server Part 作者：知道别的 Extension 暴露了哪些 RPC 可调
- Client Part 作者：知道宿主里装了哪些 Extension、它们的 schema 长什么样
- 独立前端作者：通过纯协议 introspect 后端能力，不读源码

平台是否真的"对所有人友好"，最便宜的检验就是这条。

---

## 2. Vocabulary

| 词 | 定义 |
|---|---|
| **Loom Engine** | 提示词组装引擎，发布为 npm 包（`@loom/core` 等），与 Studio 解耦 |
| **Loom Studio** | 平台/工作台，独立 Node.js 应用，本文档主体对象 |
| **Kernel** | Studio 内部最小运行时，由六个服务构成 |
| **Workspace** | 一个 Studio 进程对应的资料目录，含全部内容库与已装 Extension |
| **Document** | Workspace 内的最小数据单元，typed JSON，由 Kernel 统一管理 |
| **Document Store** | Kernel 的存储服务，默认后端 SQLite，可换 |
| **Scratch Space** | 每个 Extension 一个独立目录，用于其私有持久化数据（向量索引、缓存等） |
| **Transport API** | Studio 对外的协议层，所有客户端通过它访问 Studio |
| **Extension** | 用户/开发者安装的扩展物。可包含 Server Part、Client Part 之一或两者 |
| **Server Part** | Extension 的服务端部分，运行在 Kernel 内 |
| **Client Part** | Extension 的客户端部分，运行在 UI 宿主内；Kernel 不感知其形态 |
| **Official Web UI** | 官方维护的"玩 + 开发一体"客户端，享受与第三方客户端完全相同的接口 |
| **Dock** | 官方 Web UI 提供的、可独立 npm 引入的 Extension 默认挂载位组件。是生态级 convention，非平台级 contract |
| **Card Script** | 角色卡自带的前端脚本，以 sandboxed iframe 加载（架构第一版只承认这一种形态，详见 §8） |

---

## 3. Repository Boundary

Studio 与 Loom 引擎是两个独立的物理仓库与发布物。

```
loom-engine/                            ← 当前 monorepo
  packages/core                         ← @loom/core，npm
  packages/stdlib                       ← @loom/stdlib，npm
  packages/devtool
  packages/st-compat-lib (optional)     ← 纯逻辑库，不依赖 Studio

loom-studio/                            ← 独立仓库
  apps/                                 ← Studio 主程序
  packages/plugin-sdk                   ← Extension 作者用的 SDK，依赖 @loom/core
  packages/dock                         ← 可选 npm 包，给独立前端引入
  plugins/official-*                    ← 官方 Extension，包括官方 Web UI
```

**两条铁律**：

1. `loom-engine` 仓库永远不出现 Studio 的概念。Studio 引用 `@loom/core`，反向不存在。
2. Studio 的 Plugin SDK 是 Studio 生态的产物，不是 Loom 引擎的一部分。`@loom/core` 永远只承诺"提示词组装"。

这条边界让 Loom 引擎能服务 Studio 之外的世界（别人用 `@loom/core` 写 CLI、服务端管线、其他应用），同时 Studio 也可以在不修改引擎的前提下野蛮生长。

### Engine ABI Lifecycle

- Extension manifest 同时声明 `engines.loom` 与 `engines.studio`
- Studio 启动时校验两者
- `@loom/core` 大版本变更 → Studio 大版本变更 → 所有 Extension 至少要刷 manifest 的 `engines` 字段
- Studio 团队内部先验证新 Core 无回归后，才在某个 Studio 大版本里 bump `@loom/core` 依赖

---

## 4. The Four Layers

```
┌─────────────────────────────────────────────────┐
│  L4  Surface Layer                              │
│  Transport 客户端、官方 Web UI、独立前端、CLI…    │
├─────────────────────────────────────────────────┤
│  L3  Domain Layer                               │
│  以 Extension 形式存在的领域模型；Kernel 不认识它们│
├─────────────────────────────────────────────────┤
│  L2  Kernel Layer                               │
│  Document Store · Plugin Host · Event Bus ·     │
│  Capability Broker · Loom Runner · Transport    │
├─────────────────────────────────────────────────┤
│  L1  Engine Layer                               │
│  Fragment · Pass · Pipeline · Resolve           │
│  来自 npm: @loom/core                            │
└─────────────────────────────────────────────────┘
```

**单向依赖规则**：

- 上层可以引用下层；下层永不知道上层
- L3 / L4 只能通过 L2 暴露的接口访问 L1，**禁止跨层直接 import `@loom/core`**

为什么禁止跨层直连？因为 Kernel 必须是 trace、capability、调度的**唯一入口**。任何 Extension 偷偷起一个 Pipeline，DevTools 就丢失上下文，平台属性瞬间崩塌。

---

## 5. Data Layer

数据层拆成多个独立关注，混在一起讨论会乱。

### 5.1 Storage Semantics

Kernel 只承认一种数据单元：**Document**。

```ts
type DocId = `${string}:${string}`        // e.g. "official.chat.session:01HXYZ..."

interface Document<T = unknown> {
  id: DocId
  type: string                            // 字符串命名空间，Kernel 不认识其含义
  version: number                         // 单调递增，写入时做乐观并发
  data: T                                 // 任意 JSON，Kernel 不校验
  meta: {
    createdAt: string
    updatedAt: string
    pluginId: string                      // 注册此 type 的 Extension
    tags?: string[]
  }
}
```

Kernel 提供的 API 极少：

```
get(id)
put(doc)
patch(id, jsonPatch, expectedVersion)
list(type, query?)
subscribe(type | id, listener)
```

**没有关系、没有外键、没有事务、没有跨 type 查询。** 需要这些的领域 Extension 自己往 `data` 里塞 ID、自己在应用层维护一致性。这是 ECS 哲学在数据层的复刻，与 Loom 引擎"平铺优于嵌套"一脉相承。

**Document Type Schema** 由注册它的 Extension 通过 Plugin SDK 声明（JSON Schema 或类似），Kernel 持有 schema 仅用于 introspection（Tenet III），**不用它做校验**。校验是 Extension 自己的事。

### 5.2 Persistence Backend

把"语义"和"用什么存"解耦：

```ts
interface DocumentBackend {
  read(id): Promise<Document | null>
  write(doc): Promise<void>
  list(type, query): AsyncIterable<Document>
  watch(filter): AsyncIterable<DocumentEvent>
}
```

**默认实现：单文件 SQLite + WAL 模式**（`better-sqlite3` 同步 API + 二进制预编译）。

为什么 SQLite 而不是"一堆 JSON 文件"：

- **原子性**：单文件 + WAL，事务原子性是数据库给的，不用我们手写 fsync+rename 的舞蹈
- **查询能力**：`list(type, query?)` 在文件夹方案下要么自己实现索引、要么每次 scan，SQLite 一个 `WHERE type=? ORDER BY ...` 解决
- **变更订阅**：SQLite 的 update hook 比 fs.watch 跨平台稳定
- **可移植**：一个 `workspace.db` 文件就是用户的完整数据，备份/迁移就是 cp 一个文件
- **生态**：Node 平台第一档稳定

**SQLite 是默认后端而非唯一后端**。`DocumentBackend` 是一个接口，未来可以接 CRDT（多人协作）、网络数据库（NAS 共享）、其他方案。Kernel 只承诺"语义不变"。

### 5.3 Projection Pattern

派生视图（如"按 sessionId 分组的 message 列表"、"按 tag 索引的卡库"）**完全是 Extension 自己的事**，但要在架构里给它留位置：

- 一个 Server Part 可以在内存里维护派生视图
- 视图通过订阅 Document 事件保持同步
- 视图永不写回 Kernel
- 不同 Extension 可以维护**冲突的视图**（这是 feature）

Plugin SDK 提供 `defineProjection()` 帮助函数，但 Kernel 对它一无所知。

### 5.4 Extension Scratch Space

不是所有 Extension 数据都适合塞进 Document Store。例如：

- 向量库的 ANN 索引（需要 mmap、二进制、特殊 IO 模式）
- LLM provider 的请求缓存（半结构化、TTL 驱动）
- 重型 Extension 自己的 SQLite / lmdb / 二进制文件

这些**不该污染 Document Store**——它们语义不是 user-facing 的 typed JSON。强塞会污染 introspection、污染备份导出、性能也差。

每个 Extension 在 workspace 内拥有一个独立目录：

```
<workspace>/extensions/<extension-id>/
```

约定：

- Extension 默认拥有此目录的 `fs:rw:own` capability，**无需用户额外审批**
- Extension 完全自主决定目录内的格式（sqlite/lmdb/jsonl/二进制）
- 跨 Extension 访问需更高 capability（`fs:rw:other:<id>`），需用户显式授权
- **此目录在 workspace 备份时一起被打包**——Kernel 唯一的承诺
- Extension 卸载时此目录由用户决定保留或删除

Document Store 与 Scratch Space 共同覆盖 Extension 95% 的存储需求：普通 Extension（记忆条目这种）用 Document Store；重型 Extension（向量库、知识图）用 Scratch Space。

### 5.5 Minimal Provision

启动一个空的 Studio，看到的世界是：

- 一个空 workspace（仅有 `workspace.db` 与基础结构）
- Document Store 6 个 API
- 一条 Transport 通道
- `system.introspect` 返回一张接近空的能力图
- 一句"安装 Extension 开始使用"

**没有** chat 概念、message 概念、character 概念、任何内置 UI、任何内置 LLM provider。这是平台正确的初始状态。

### 5.6 Self-Hosting

Kernel 自身需要存的东西（trace、audit log、settings、capability 审批记录）**也走 Document Store**，使用 Kernel 命名空间下的 Document type：

- `system.trace`
- `system.audit`
- `system.setting`
- `system.capability-grant`

这样 Kernel 内部状态与 Extension 外部状态用**同一种存储原语**——DevTools 能用同一种方式 introspect 两者，备份机制天然覆盖两者。**Kernel 自己也是 Document Store 的用户，跟 Extension 平起平坐。**

这是一种自指的优雅，也呼应了 Tenet III：连 Kernel 自己注册的东西也是可发现的。

### 5.7 Workspace Layout

```
my-workspace/
  loom-studio.json              ← workspace 元信息（版本、激活的 Extensions、settings）
  loom-studio.lock              ← Extension 版本与 capability 授权的锁
  workspace.db                  ← Document Store 默认 SQLite 后端
  workspace.db-wal              ← SQLite WAL 文件
  plugins/                      ← 本 workspace 安装的 Extension 源
    com.author.memory@1.4.2/
      manifest.json
      server/
      client/
  extensions/                   ← Extension Scratch Space
    com.author.memory/
      vectors.sqlite
      cache/
    official.tokenizer/
      tiktoken-cache/
  .loom/
    cache/                      ← Kernel 派生数据，可删
    token                       ← Transport 鉴权 token
```

**关键性质**：workspace 是**可压缩、可拷贝、可 git** 的。备份 = 打包整个文件夹。分享一组"卡 + 世界书 + 预设" = 分享一个 zip 或一个 git repo。这是本地部署社区最在意的属性，必须从架构层保证。

> 注：`workspace.db` 是二进制，git 友好度差。爱手动管文件 / 想 git 历史可读的用户可换成未来提供的 `FsBackend`（每 doc 一 JSON 文件）。Kernel 通过接口承诺两种后端语义等价。

### 5.8 Workspace 与 Process 的关系

**一个 Studio 进程对应一个 workspace**。要管多个 workspace 就开多个进程，每个进程绑不同端口。

但是——**一个 workspace 装用户的全部内容库**。几百上千张角色卡、所有世界书、所有会话都在同一个 workspace 内。切换角色 = 在同一个进程里切一个 active document，**不重启任何东西**。

游戏引擎/IDE 模型（一项目一进程）不能直接照搬到 LLM 应用，因为 LLM 应用的"资产"是轻、量大、关系弱的；用户期望"打开一次工具，里面是我所有的卡"。

---

## 6. Kernel Services

Kernel = 6 个服务的总和。每个服务都遵循 *The Kernel Does Less*。

### 6.1 Document Store

见 §5。Kernel 只懂 Document，不懂 chat / message / character。默认 SQLite 后端，接口可换。Kernel 自身的 trace / audit / settings 也走它（Self-Hosting，§5.6）。

### 6.2 Plugin Host

负责 Extension 的发现、加载、激活、回收。

- **加载源**：本地路径 / git url / npm 包；第一阶段先支持本地路径
- **manifest**：JSON，声明 id / version / engines / capabilities / contributes / activationEvents
- **激活模型**：懒加载，按 activationEvent 触发（"打开了某 type 的 doc"、"用户运行了某 command"、"启动时"）
- **隔离边界**：Server Part 默认 inproc；少数 Extension 可声明 `isolation: "worker"`（详见 §7）

### 6.3 Event Bus

类型化、命名空间化的 pub/sub：

- 通道命名约定：`<pluginId>.<domain>.<verb>`，例如 `official.chat.message.appended`
- 同步发射 + 异步订阅（不让一个慢订阅者阻塞发射方）
- 所有事件通道在 Tenet III 下可被 introspect
- Kernel 自身也用它：文档变更、Extension 激活、Loom trace 都走这条总线

### 6.4 Capability Broker

每个 Extension 在 manifest 里声明它要什么能力：

```
docs:rw:chat.*
net:fetch:openai.com
loom:run
fs:rw:own                ← Scratch Space 默认能力
fs:rw:other:<id>         ← 跨 Extension 访问
```

Broker 在加载时让用户审批（或读 trust policy），运行时拦截每次跨 capability 的调用。**Loom 引擎本身就是一种 capability**（`loom:run`）。

没有 Capability Broker，"Studio 是平台"是一句空话。

### 6.5 Loom Runner

把 `@loom/core` 包成一个受控入口：

- Server Part 不直接 import `@loom/core`，而是 `kernel.loom.run(passes, fragments, options)`
- Runner 自动注入 trace 收集、错误边界、超时、tokenizer（来自 tokenizer Extension）
- Runner 把 trace 落到 Document Store 里成 `system.trace` 类型的文档，DevTools 通过订阅这个 type 看回放

这一步让"引擎严谨"与"Studio 灵活"得以共存——引擎那边一个字不改，Studio 这边把它装进自己的世界观。

### 6.6 Transport

**唯一一条**对外通道，本地 WebSocket（或 Unix domain socket）。

- 协议：JSON-RPC 2.0 + 一种自定义的 stream message
- 暴露的 namespace：
  - `docs.*` —— Document Store CRUD
  - `events.*` —— 订阅与发射
  - `commands.*` —— 命令运行
  - `loom.*` —— 引擎入口
  - `extensions.*` —— Extension 注册的 RPC（命名空间由各 Extension 自己决定）
  - `system.*` —— Kernel 元能力，含 `system.introspect`（Tenet III）
- 鉴权：默认 workspace-scoped token，写在 `.loom/token`，客户端连接时必须携带
- **不暴露**：`plugins.load` 这类管理操作（要做也走另一个 admin socket，需要更高 capability）

#### `system.introspect`

返回平台运行时的完整能力图：

```jsonc
{
  "studio":     { "version": "0.2.0" },
  "loom":       { "version": "0.1.0" },
  "extensions": [
    {
      "id": "com.author.memory",
      "version": "1.4.2",
      "documentTypes": [
        { "type": "memory.entry", "schema": { /* JSON Schema */ } }
      ],
      "rpc": [
        { "name": "memory.search", "params": {...}, "returns": {...}, "stream": false }
      ],
      "events": [
        { "name": "memory.indexed", "payload": {...} }
      ],
      "passes":   [ { "name": "MemoryRecallPass", "provides": [...], "requires": [...] } ],
      "commands": [ { "name": "memory.rebuild-index", "title": "重建记忆索引" } ]
    }
  ]
}
```

Transport 是 Tenet II 与 Tenet III 的物理体现。

---

## 7. Extension Model

Extension 是 Studio 的扩展一等公民。它有两个独立的可分发部分：**Server Part** 与 **Client Part**。两者**通过协议而不是组件库连接**，可独立分发，任一可缺席。

### 7.1 Repository Layout

约定一个 Extension 仓库长这样：

```
com.author.memory/
├── manifest.json                  ← 同时声明 server / client 两 part（任一可省略）
├── README.md
├── server/                        ← Server Part 源（任一可省略）
│   ├── index.js                   ← manifest.server.entry 指向此
│   ├── recall-pass.js
│   └── ...向量库、算法...
└── client/                        ← Client Part 源（任一可省略）
    ├── dist/                      ← manifest.client.bundle 指向此
    ├── views/
    └── ...React / Vue / 原生 ...
```

**第一版只支持单 Extension 仓库**（一个 git url / npm 包 = 一个 Extension）。monorepo 作者自己把子目录作为分发单位（git subtree、submodule、npm 单包）。

### 7.2 Manifest

```jsonc
{
  "id": "com.author.memory",
  "version": "1.4.2",
  "engines": {
    "loom": "^0.1.0",
    "studio": "^0.1.0"
  },

  // —— Extension 间依赖（决定 Extension 的加载顺序与可满足性） ——
  "dependencies":     { "official.tokenizer": "^1.0.0" },
  "peerDependencies": { "official.character": "^1.0.0" },
  "conflicts":        { "thirdparty.alt-memory": "*" },

  // —— Pass 间依赖（决定 Pipeline 内 Pass 的相对位置；Loom Engine 由 ADR-001 约束 —— Studio 在送入引擎前完成扁平化）——
  "provides": ["loom.pass.memory-recall"],
  "requires": ["loom.pass.history-window"],

  "server": {
    "entry": "./server/index.js",
    "isolation": "inproc",                    // "inproc" | "worker"
    "isolationHints": {
      "cpuBound": true,
      "respawnOnCrash": true,
      "memoryLimitMb": 512
    },
    "capabilities": {
      "requires": ["docs:rw:memory.*", "loom:run", "fs:rw:own"],
      "optional": ["net:fetch:gist.github.com"]
    },
    "contributes": {
      "documentTypes": ["memory.entry"],
      "passes":        ["MemoryRecallPass"],
      "rpc":           ["memory.search", "memory.embed", "memory.upsert"],
      "events":        ["memory.indexed", "memory.recalled"]
    }
  },

  "client": {
    "bundle": "./client/dist/",               // 由宿主自行决定如何使用
    "consumes": {
      "rpc":    ["memory.search", "memory.upsert"],
      "events": ["memory.indexed"]
    }
  },

  "activation": {
    "events": ["onDocument:memory.*", "onCommand:memory.*"]
  }
}
```

### 7.3 Server Part

运行在 Kernel 内，负责 Extension 的"能力"。它是协议提供者：

- 注册 Document Type 与 schema
- 注册 Pass，进入 Loom Pipeline
- 注册 RPC，向所有合法 Studio 客户端开放
- 注册 Event channels

**关键性质**：Server Part **不知道**自己在为哪个 UI 服务。它对自己的能力消费者一视同仁——官方 Web UI、独立前端、其他 Extension 的 Client Part 都通过同一组 RPC 调用它。这就是"protocol-shaped, not application-shaped"。

#### 隔离模型

Server Part 默认运行在主线程（inproc）。Extension 可在 manifest 里声明 `isolation: "worker"`，进入独立 `worker_threads`。

|  | inproc | worker |
|---|---|---|
| 序列化开销 | 无 | structured clone 每次跨边界 |
| 故障隔离 | 一坏全坏 | 强 |
| 共享状态 | 自然 | 难（SharedArrayBuffer 或 message） |
| CPU 抢占 | 卡 UI | 真并行 |
| 同步 API | 可用 | 不可能 |
| 启动 | 即时 | 几十~上百毫秒 |
| 调试 | 简单 | 复杂 |

**指导**：

- 大部分 Extension 是 inproc。Provider（IO 异步即可）、纯函数 Pass、领域 schema 注册器、ST 兼容层都属此类。
- worker 模式留给：tokenizer、本地嵌入、向量检索、规则引擎、不信任来源的 Extension。
- LLM 应用整体偏轻量异步，**不要**默认推 worker。worker 是少数派 opt-in。

**Plugin SDK 在两种模式下 API 完全相同**——Extension 作者不写两套代码，区别只在 Kernel 启动它时把它装进哪个执行容器。

#### 数据形态约束

跨边界数据（包括 inproc 的事件总线在内）收敛成"可结构克隆的 plain object"。Document 已经是 JSON-able，Fragment 也是。这一约束反过来强化 Loom 引擎"Fragment 是数据不是行为"的纪律。

### 7.4 Client Part

**Studio Kernel 不感知 Client Part 的形态**。manifest 里 `client.bundle` 只是一个静态资源指针，Kernel 把这个指针通过 Transport 暴露给宿主，宿主自己决定怎么用。

不同宿主可以用不同方式：

- 官方 Web UI：通过 Dock convention（§7.5）默认挂载
- 独立角色卡前端 page：直接 `import` 进自己的工程，按自己设计语言渲染；或选择性引入 Dock 组件以瞬间获得"用户已装的所有 Extension UI"
- CLI 客户端：忽略 Client Part 不挂载即可
- 桌面套壳客户端：用 webview 加载

**Studio 不定义 Client Part 的 API 形状、不定义挂载方式、不规定 UI 框架**。这是 Tenet II（Transport API is the Contract）的延伸——UI 不在契约里，所以 UI 不被约束。

这也带来一个直接好处：**纯后端 Extension 与纯前端 Extension 都被允许**。

| Extension 类型 | server | client | 例子 |
|---|---|---|---|
| 纯能力 | ✓ | — | tokenizer、provider、向量算法、ST 兼容层 |
| 纯 UI | — | ✓ | 主题包、新视图（用现有 RPC 组合） |
| 双形态 | ✓ | ✓ | 记忆、文生图、世界书管理器 |

后端大佬只发后端，前端大佬只发前端，组合由用户在 workspace 里完成。

### 7.5 Default Presentation: Dock Convention

> **重要**：Dock 是**生态级 convention**，不是平台级 contract。Kernel 与 Transport 完全不知道 Dock 存在。

官方 Web UI 提供一个 **Dock** 组件作为 Extension Client Part 的默认呈现位（隐喻借自 macOS Dock，是"应用启动器"而非"功能栏"）：

- Extension 默认呈现为 Dock 上的一个图标 / 槽位
- 点开 = 展开它的 Client Part（一个面板、一个抽屉、一个浮窗，由 Extension 自己决定）
- Extension 作者**不被强迫用 Dock**——他可以在 Client Part 里做悬浮窗、做全屏接管、做侧边抽屉，Dock 只是"如果你不知道挂哪，挂这里"

**Dock 作为独立 npm 包**（`@loom-studio/dock`），独立前端作者可选择性引入：

```jsx
// 作者写的西幻 page
<MyFantasyUI>
  <SoulBookView />              {/* 他自己的全部门面 */}
  <LoomDock position="bottom"/> {/* 装了的所有 Extension UI 都在这里 */}
</MyFantasyUI>
```

——他什么都不写，就拿到了用户已装的所有 Extension UI。这是 Extension 前后端分离这件事最具体的兑现：**最低成本路径**（用 Dock 就有）和**最高自由度路径**（完全替换 / 重写 Extension UI 成"灵魂之书"）两端齐备，中间不强行拉一条。

Client Part 具体的挂载协议（postMessage 形态、生命周期事件、视觉约定）属于 Dock 与官方 Web UI 内部的实现细节，**不是平台架构层的承诺**，留待 Web UI 文档单独规范。

### 7.6 Plugin Resolver

加载流程：

```
扫 plugins/ → 解析 manifests
  → SAT 求解（dependencies / conflicts / engines / version 兼容）
  → 失败：列出最小冲突集，报给用户（人类可读：
     "memory 想要 tokenizer^2，但 chat 锁定 tokenizer^1，
      请考虑升级 chat 到 1.5.0"）
  → 成功：拓扑排序 → 按序激活
  → 激活时跑 capability 授权（首次询问用户；之后读锁文件）
```

第一版 SAT 可以是朴素实现，但 `PluginResolver.resolve(manifests, lockfile?) → Plan | Conflict[]` 接口从一开始稳定。

### 7.7 Lockfile

```jsonc
// loom-studio.lock
{
  "version": 1,
  "plugins": {
    "official.chat": {
      "version": "1.2.3",
      "source": "git+https://github.com/foo/loom-studio-st#v1.2.3",
      "integrity": "sha256-...",
      "capabilities": ["docs:rw:chat.*", "loom:run"],
      "approvedAt": "2026-04-27T10:00:00Z"
    }
  }
}
```

锁文件做四件事：

1. 复现性（同一 workspace 在另一台机上启动行为一致）
2. capability 审批的持久化（不每次启动都问）
3. 拓扑解的缓存（启动快）
4. 来源溯源（防止"同名异物"替换攻击）

**锁文件进 git。** 这对本地部署社区分享 workspace 是关键。

### 7.8 Installation

第一版安装链路：**URL + 声明依赖**。

```
loom-studio install https://github.com/foo/loom-studio-st
loom-studio install npm:loom-extension-memory
loom-studio install file:./my-local-extension
```

或在官方 Web UI 里粘贴 URL → 点"安装"。

#### 内部流程

1. fetch / clone / npm install 到 `plugins/<id>@<version>/`
2. 解析 manifest，读取 `dependencies` / `peerDependencies` / `engines`
3. 跑可满足性求解——若有未装依赖，**显示**"将一并安装：A、B、C"，用户确认后递归装
4. 解析 capability 请求，**显示**"此 Extension 申请：访问网络（openai.com）、读写记忆文档"，用户确认
5. 写进 `loom-studio.lock`（含 source、integrity、approvedAt）
6. 下次启动激活

#### 关键设计决策

- **没有中央仓库**——URL 就是地址，git/npm/local 三种 scheme 即可。这与 Deno 依赖模型一致，与本地部署气质一致。
- **没有自动升级**——`loom-studio update <id>` 显式触发。本地部署人群最讨厌自动更新破坏配置。
- **lockfile 进 git**——一个 workspace 的可复现性靠它。
- **依赖冲突报告人类可读**——这件事容易被低估，但 npm 早期"resolution failed"那种报错是真劝退人。

---

## 8. Card Script (deferred)

角色卡自带的前端脚本（如"xxx 的日记本前端"）是与 Extension **截然不同**的扩展物：

- 生命周期 = 所属 Document 的生命周期，不是进程生命周期
- 跟着角色卡的 zip / json 一起走，不进 `plugins/`、不进锁文件
- 信任模型 = 匿名作者，必须强沙箱
- **架构第一版只承认前端形态**，以 sandboxed iframe 在客户端 Web UI 内加载，通过 postMessage 拿到一个受限的 Studio API
- **Card Script 完全不进 Studio 后端进程**——它只是 Web UI 里的浏览器内沙箱代码。要调后端能力（LLM、记忆、文生图）通过受限 Studio API 走 Transport

第一版**不承认** Card Script 的后端形态——它的安全模型显著更难，且 Extension 已经覆盖了"我想给 LLM 流程加 hook"的需求。

> Studio 处理两类截然不同的扩展物：**用户安装的全局工具（Extension）**与**内容自带的脚本（Card Script）**。前者要稳，后者要安全。Studio 的扩展系统不试图用同一个机制覆盖这两件事。

详细规范留待后续文档。

---

## 9. Extensibility Rings

Studio 同时服务多种深度差异巨大的玩家。三圈结构是这一承诺的具体形态。

```
        ┌─────────────────────────────────────────┐
        │  外圈：Transport API                     │  ← 任何语言、任何客户端
        │  ┌───────────────────────────────────┐  │
        │  │  中圈：Plugin SDK                  │  │  ← TS Extension 作者
        │  │  ┌─────────────────────────────┐  │  │
        │  │  │  内圈：Shell Toolkit + Dock  │  │  │  ← Client Part 视图作者
        │  │  │  （官方 Web UI 的 UI 原语）   │  │  │
        │  │  └─────────────────────────────┘  │  │
        │  └───────────────────────────────────┘  │
        └─────────────────────────────────────────┘
```

| 玩家类型 | 用什么圈 | 投入 |
|---|---|---|
| 用户 | 装别人的 Extension | 零 |
| 改皮玩家 | 内圈 Toolkit + 一个 Client-only Extension | 几小时 |
| 平台扩展者 | 中圈 SDK | 一个周末到一周 |
| 独立前端作者 | 外圈协议（可选 import Dock） | 一个项目 |
| Kernel 黑客 | 直接 fork Studio | 长期投入 |

### 内圈：Shell Toolkit + Dock

- 一组官方提供的 UI 原语：消息气泡、流式文本、命令面板、设置面板、文档列表
- 加上 Dock 组件（§7.5）
- 给"我只想给默认 UI 加一个按钮"的玩家用
- 不强制使用，但用了就能融入官方 UI
- **它本身只是官方 Web UI 的一部分**，不是 Studio 平台的一部分；同时也作为独立 npm 包发布，让独立前端作者也能用

### 中圈：Plugin SDK

- TypeScript 包（`@loom-studio/plugin-sdk`），含 manifest 类型、Document 类型、capability helpers、`defineProjection`、`defineCommand`、`defineRpc`、`defineEvent` 等便利函数
- 给"我想加新文档类型 / 新 Pass / 新命令 / 新 RPC"的玩家用
- 可完全不写 UI（headless Extension），也可只写 UI（视图 Extension）

### 外圈：Transport API

- 纯协议（JSON-RPC over WS + stream message），有版本号、有 schema
- 任何语言、任何运行时都能写一个客户端
- Vim 插件、iOS 原生 App、Discord bot、OBS overlay 都是这一层的客户端
- **官方 Web UI 也是这一层的一个客户端**，无任何特殊待遇
- `system.introspect` 让外圈客户端不必读源码就能发现后端能力（Tenet III）

> Tenet II 的工程意义在这里得到具体形态：Studio 把"客户端"和"Extension"当作平等公民，区别只在物理位置——Extension 在进程内，客户端在进程外。两者通过同一组接口看到同一个 Kernel。

---

## 10. The Seven Boundary Decisions

正式立项需明确站位的七件事。

| # | 决定 | 站位 |
|---|---|---|
| 1 | **进程模型** | Server Part 默认 inproc；worker 是少数 opt-in（manifest 显式声明）。Plugin SDK 在两种模式下 API 一致。Card Script 走 Web UI 内 sandboxed iframe，与 Extension 隔离机制不共用 |
| 2 | **打包形态** | Studio 是 Node.js 应用，第一阶段以源码 + `npm run` 启动；内置官方 Web UI；headless 模式（仅 Kernel + Transport，不挂 UI）恒在；desktop bundle / embedded 模式列入 v1 路线图 |
| 3 | **Workspace** | 单进程单 workspace；一个 workspace 装用户全部内容库（几百上千张卡），切换角色 = 切 active document，不重启进程；workspace 文件夹可压缩、可拷贝、可 git |
| 4 | **信任** | Extension 用 manifest + capability + 锁文件管理；锁文件入 git；Card Script 用 sandbox + 加载时权限请求；无签名、无中心仓库、无自动更新 |
| 5 | **引擎绑定** | manifest 同时声明 `engines.loom` 与 `engines.studio`；Studio 团队先内部验证 Core 再 bump |
| 6 | **Extension 形态** | Server Part 与 Client Part 独立分发，通过 Transport API 连接；Studio Kernel 不感知 Client Part 形态；任一 Part 可缺席；Dock 是 Web UI 端的 convention，不是平台 contract |
| 7 | **安装链路** | URL + 三种 scheme（git / npm / local）+ 锁文件 + 显式 capability 确认；无中央仓库、无自动更新；第一版只支持单 Extension 仓库 |

---

## 11. Non-Goals

平台架构最有用的部分是它列出的"不做"。这些条目越多，平台属性越强。

- **不发布 official chat / character / worldbook schemas**——这些由概念栈 Extension 提供（如 `loom-studio-st`），不是平台层的事
- 不内置任何 LLM provider
- 不抹平 LLM provider 差异（无 AI Gateway）
- 不内置全文搜索、向量检索、嵌入算法
- 不假设官方 Web UI 必然存在
- 不替 Extension 决定 UI 形态、UI 框架、UI 挂载方式（Dock 是 convention，可被忽略可被替换）
- 不做云端同步、用户系统、多租户、SaaS
- 不做中央插件市场
- 不做插件签名 / 中央信任根
- 不做插件自动更新
- 不做内置 MCP 客户端（MCP 是 Extension 的事，作为外部协议适配器，不进入内部通信）
- 不做内置 HTTP 路由 / 鉴权策略
- 不做跨 workspace 的数据流通（多 workspace 通过开多进程实现）
- 不做插件级别的"读写另一个插件的 doc"——一切跨 Extension 通信走 RPC / Event

### 关于"概念栈"的软约定（非承诺）

Studio 不定义业务概念，但**鼓励**概念栈 Extension（如 `loom-studio-st`、未来可能的 `loom-studio-chat`）将自己的事件命名空间与 Document schema 公开发布，供其他 Extension 适配。生态会自然形成"事实标准"——这与 Linux 社区对窗口管理协议形成 EWMH 的方式一致：内核不管，社区形成共识。

---

## 12. Open Questions

明确标记尚未拍板的事项，避免未来贡献者把"未定"误读为"已定"。

1. **Workspace 多端共享**：多设备同步是 Extension 的事，还是 Document Backend 的事？倾向后者，但接口长什么样未定。
2. **Card Script Backend 形态**：第一版只承认 frontend Card Script。是否在某个版本承认 backend Card Script（用 `node:vm` / `isolated-vm`），以及它的安全模型，留待 §8 详细文档。
3. **Plugin Resolver 的语义版本策略**：semver 严格匹配？还是允许 caret/tilde？倾向严格 semver + caret 默认，但 conflicts 字段的语义（"任何版本互斥"还是"特定 range 互斥"）需细化。
4. **Loom Trace 的存储压力**：trace 落 `system.trace` 文档是否会撑爆 SQLite？需要 retention policy，但策略由 Kernel 提供还是 DevTools Extension 提供未定。
5. **`isolation: "worker"` 的实现时机**：第一版只实现 inproc，manifest 字段保留并校验。具体在哪个 Studio 版本兑现 worker 实现未定。
6. **Plugin SDK 的发布节奏**：是与 Studio 同版本，还是独立版本号？倾向同版本以避免版本矩阵爆炸。
7. **官方 Web UI 与 Plugin SDK 的边界**：Shell Toolkit + Dock（内圈）的代码物理上属于官方 Web UI 还是独立包？倾向独立 npm 包，让第三方客户端也能用。
8. **Dock 与 Client Part 的具体挂载协议**：Client Part 与 Dock 之间通过什么协议交流（postMessage 形态、生命周期事件、视觉融合约定）？这是 Web UI 端的实现细节，留待单独的 Web UI 文档规范。
9. **`system.introspect` 的粒度与权限**：是否所有客户端都能看到完整能力图，还是按 capability 过滤？信任 token 是否分级？
10. **Extension Scratch Space 的配额**：是否需要 per-extension 磁盘配额？目前倾向不做（信任本地用户），但需求需观察。
11. **`engines.loom` 跨大版本时 Extension 的迁移路径**：Studio 是否提供 codemod / 兼容垫片？还是要求 Extension 作者自行升级？

---

## Appendix A — Vocabulary Cross-Reference

与 Loom 引擎文档的术语对应：

| Studio | Loom Engine |
|---|---|
| Document | （无对应；引擎不感知 Document） |
| Server Part 注册的 Pass | `Pass` |
| Loom Runner 调用 | `Pipeline.run` |
| Loom Trace | `Pass` 执行的 IR snapshot 序列 |
| Transport `loom.*` namespace | 包装后的 `@loom/core` 入口 |

与 SillyTavern 现状的术语对应（仅参考，非承诺）：

| Studio | SillyTavern |
|---|---|
| Workspace | 用户的整个 ST 数据目录 |
| Document (`character.card` type，由 `loom-studio-st` 注册) | 角色卡 |
| Document (`worldbook.entry` type，由 `loom-studio-st` 注册) | 世界书条目 |
| Extension (Server + Client) | 全局扩展 |
| Card Script | 角色绑定 JS 脚本 |
| 官方 Web UI | ST 的 web 界面 |
| Dock | （无对应；ST 没有此抽象） |

---

## Appendix B — Document History

| Version | Date | Notes |
|---|---|---|
| Draft v0.1 | 2026-04-28 | 首版讨论稿。基于 Loom 白皮书 + ADR-001 + 与维护者的架构讨论。 |
| Draft v0.2 | 2026-04-28 | 加入 Tenet III（Everything Registered is Discoverable）；§5 数据层定为 SQLite 默认后端，新增 Scratch Space 与 Self-Hosting 节；§6.6 Transport 加 `system.introspect`；§7 Extension Model 加 Repository Layout、Dock Convention、Installation 章节；§10 站位扩展为 7 项；§11 Non-Goals 强化"不发布 chat/character/worldbook 官方 schema"等承诺；§12 Open Questions 移除已定项、新增 Dock 挂载协议等。 |
