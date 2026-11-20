# 互动展示 v3 核验报告

## 概要

用户重点是可视化互动，而不是静态四组结果图。前两次实现偏重结果图，互动仍是旧两条回放。本版把四组同步推进放到正文第一主体，并增加真实候选块的三阶段检查器。原网站、v1、v2 不变。

## 实际交互

1. 四组固定同时可见，播放/暂停/复位，共用时间轴。
2. 可选 18 个语言/文字条件 × 3 并发设置。
3. 点击每条完成时间，或快捷按钮跳到某系统完成时刻。
4. 实际块级交互：Draft、Rescore、Verify，可播放或单步，点击 token 位置查看候选变化。
5. 默认真实 prefix 7：接受草稿 token 由 1 个变为 3 个；其他 7 个前缀也可检查，包含收益为零情况。
6. 原两条完整 trace 和静态表格保留为补充，不占主要互动位置。

## 文件与计算

- index.html:36-62：四组互动 UI。
- index.html:64-86：真实 block 检查器。
- assets/interactive.js:24-97：同步进度、构建四组、播放和快捷定位。
- assets/interactive.js:100-153：八组真实候选的三阶段检查、点击位置和播放。
- assets/metrics.js:74-83：由汇总 throughput 得到归一化等工作量进度。
- assets/metrics.js:85-94：基于实际 accepted_* 计数生成接受/拒绝/丢弃状态。

```js
const finish = 100 / arm.ratio;
const progress = Math.min(1, time / finish);
```

这不是请求耗时公式，而是恒定吞吐率下等工作量示意。时间无秒单位，UI 明示不是 recorded token timing 或 request latency。

## 数据边界

seqs.json 仅有 base/lex 两条完整记录，trace_te.json 有 8 个相同 prefix 下 plain/lex 候选对比；没有四模型对应的完整实测时间轨迹。四组主展示因此仅为汇总吞吐驱动的等工作量示意。未用伪造文本或接受事件拼出四组真实推理。小格是抽象工作份额，不是 token。

真实 block 使用原有 plain_pick / lex_pick / accepted_plain / accepted_lex。导出缺少准确 checkpoint 元数据，不冒称其属于特定 public 或多语 checkpoint。未接受的后缀标 discarded，不标为逐位置全错；统计不包括 correction/bonus token。

## 最终验证

verification/unit.log：25 tests / 25 pass / 0 fail。
verification/browser.log：26 组验收，关键项目：
- 第 4 行：播放控件在四条 lane 前，time=100 刻度实际位于 100/110。
- 第 5 行：同步播放、暂停、复位及完成节点。
- 第 6 行：54 个设置、216 个 progress/finish 值；English 不强制 LexDraft 获胜。
- 第 7 行：8 组真实 prefix 和三个阶段、点击候选位置。
- 第 8 行：减少动态效果不自动播放。
- 第 15-19 行：五种宽度无页面水平溢出。
- 第 20 行：手机实际指针/键盘操作新互动区。
- 第 25 行：控制台/网络/HTTP 错误为零。
- 第 26 行：file:// 离线打开通过。

HTML 与外部 CSS 全部通过 checker；人工回读桌面主互动、真实 block、手机主互动与 block 截图。所有源 JSON 哈希不变。

## 本轮错误及修复

1. assets/interactive.js:109 首次语法检查出现 `SyntaxError: missing ) after argument list`。选择器末尾误写 ]，修正为 )。最终 node --check 与浏览器加载通过。
2. 一次多余 edit_file 调用返回 `No changes: old_string and new_string are identical.`。该调用没有改动文件，之前有效改动已成功；后续完整验收通过。
3. 初稿时间轴用 space-between 排 0/50/100/110，刻度位置错误。回读截图发现后，改用 0%、45.4545%、90.9091%、100% 定位；新增浏览器断言验证。
4. 初稿手机播放按钮在四条 lane 后，互动入口太远。移到 lane 之前，浏览器断言验证位置；未通过隐藏其他系统来缩短页面。

## 置信度与风险

- 实现、数据口径和当前导出内容一致性：98%。
- 已测 Chromium 交互及布局：95%，未覆盖 Safari/Firefox/真实手机硬件。
- 原论文实验真实性不属于本次验证范围。
- 四组真实逐 token 录像仍缺数据，本版明确使用可核验的示意代替，不能把示意当新实验。
- 未部署或改原站，所有交付在会话 artifact，应保存 ZIP。
