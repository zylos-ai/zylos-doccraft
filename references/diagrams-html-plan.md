# html-plan Diagram Guide

Use Doccraft's diagram-only adapter for diagrams that a reader must study. Its syntax and lint rules come from the pinned html-plan source, but its CSS and browser runtime are Doccraft-owned and limited to diagram containers. It does not load review comments, response controls, a table of contents, local storage, or page-wide styles. Keep the diagram source in the HTML so later edits change readable text rather than generated SVG paths.

## Choose the block by question

| Reader question | Block | Required content |
|---|---|---|
| What parts exist and how does data or control move? | `doc-flow` | Named nodes, an explicit grid, directed edges, and short edge labels |
| Who talks to whom, and in what order? | `doc-seq` | Actors in first-use order, success messages, and the matching reject/error reply |
| Which states exist, and what moves between them? | `doc-machine` | Initial state, reachable final/stop states, and failure/cancellation transitions |

Use cards, a table, or `.phases` for a short list that has no important relationships. Do not use a diagram as decoration.

## Chinese authoring rules

- Write reader-facing node labels, edge labels, messages, state descriptions, captions, and legends in Chinese when the document is Chinese.
- Keep machine identifiers ASCII and short (`draft`, `checking`, `done`); put Chinese text after `#` or `:` so the parser remains stable.
- Keep one idea per label. Move detail into nearby prose instead of shrinking the diagram text.
- Use the CJK-aware runtime font stack. Do not convert Chinese text to paths or images.
- Keep `lang="zh-CN"` on a Chinese page and include `<meta name="viewport" content="width=device-width, initial-scale=1">`.

## Architecture and data flow

```html
<doc-flow caption="订单先校验，再写入账本；失败不会进入队列。">
  <script type="text/plain">
api = 接单接口
check = 规则校验 [amber]
db = 订单账本 [db]
queue = 履约队列 [green]
| api | check |
| queue | db |
api -> check : 提交
check -> db : 通过
db -> queue : 入队
check --> api : 拒绝原因
  </script>
</doc-flow>
```

Keep the grid explicit when labels or arrows could collide. Use at most 12 nodes and two or three columns.

## Sequence

```html
<doc-seq caption="校验失败会直接返回，不会调用履约服务。">
  <script type="text/plain">
用户 -> 接单接口 : 提交订单
接单接口 -> 规则服务 : 校验订单
规则服务 --> 接单接口 : 校验通过
接单接口 -> 履约服务 : 创建任务
履约服务 --> 接单接口 : 创建成功
接单接口 --> 用户 : 返回订单号
规则服务 -x-> 接单接口 : 校验失败
接单接口 --> 用户 : 返回拒绝原因
  </script>
</doc-seq>
```

The runtime places a wide sequence inside `.fig-frame`, whose horizontal overflow is local to the figure. Never add a fixed page width, a wide body, or CSS that turns figure overflow into page overflow.

## State and lifecycle

```html
<doc-machine name="order" caption="失败和取消都是可观察的终止状态。">
  <script type="text/plain">
machine order initial draft
state draft # 草稿等待提交。
state checking # 系统正在校验。
state accepted final # 订单已受理。
state rejected final # 订单被拒绝。
state cancelled final # 用户已取消。
| draft | checking | accepted |
| cancelled | rejected | . |
draft -submit-> checking : 提交
checking -ok-> accepted : 通过
checking -fail-> rejected : 拒绝
draft -cancel-> cancelled : 取消
  </script>
</doc-machine>
```

Every state must be reachable from the initial state. Every dead end must be `final`. Show the reject, failure, cancellation, or stop path that matches the success path.

## Pack and verify

While authoring, link the local diagram-only adapter:

```html
<link rel="stylesheet" href="../../runtime/diagrams.css">
<script src="../../runtime/diagrams.js" defer></script>
```

Then package the page:

```bash
node <doccraft-dir>/scripts/pack-diagrams.mjs page.html
```

The wrapper rejects missing diagrams, empty or malformed diagram blocks, and remote dependencies, including protocol-relative URLs. It uses the pinned upstream parser/linter, then replaces the upstream page runtime with the scoped adapter in the packed file. Deliver the packed file, then inspect it directly in desktop/mobile and light/dark modes. The page must have no horizontal overflow; a complex sequence may scroll only inside its figure. Use `examples/diagrams/wide-sequence-stress.html` only as a mobile overflow test, not as the warning-free reference example.
