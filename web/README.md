# 学习记录

静态页面，用来看三样东西：最近学到的词汇和表达、遗忘曲线、学时。数据以本目录的 JSON 为准，课后报告写进同一份文件，页面和档案就不会各记各的。

默认打开 `data.json`。那是 2026-11-19 语音报告里能对上的事实（11月7日介绍新公寓，11月8日点咖啡）。报告没写的时长、口音、音标、是否过关都空着。`example.json` 是虚构示例，用来看填完整之后的页面。`empty.json` 是空白档案，给下一节课起头用。

## 打开

在这个目录启动一个本地服务器，再用浏览器打开：

```bash
cd web
python3 -m http.server
```

然后访问 `http://127.0.0.1:8000/`。页面顶上可以切换「真实记录 / 示例数据 / 空白档案」。也可以直接用 `?data=example.json` 或 `?data=empty.json`。

不要双击 `index.html`。那种打开方式读不到旁边的 JSON。如果已经这样打开了，页面上可以改选一个 JSON 文件。

## 课后怎么更新

只改 `data.json`。不要把 `example.json` 里的词或时长抄进去。

1. 每节课在 `sessions` 加一条：日期、时长（分钟）、主题、情境。报告里有的纠正和原句写进 `summary`、`corrections`。没写时长就用 `null`，不要估。
2. 新词、新短语在 `items` 加一条：英文、音标、简短中文、主题、情境、首次学会日期。音标跟当时的口音一致（英音 RP，美音 General American）。口音写在 `learner.accent`；某一条不同就在那条上写 `accent`。
3. 只有学习者能主动、较准确地用出，才把 `status` 写成 `"passed"`。听懂或跟读不算。报告没判断就留 `null`。还要复习写成 `"needs_review"`。
4. 复习日期不用手填。页面按下面的间隔，从 `learnedOn` 推算。教练若已指定下次日期，可以写 `nextReviewOn`（`YYYY-MM-DD`），页面就改用这一天。

真实记录不要写 `meta.asOf`。不写的话，复习节点按打开页面的当天计算。示例数据写了 `asOf`，是为了让示例不随日期漂移。

## 字段

```json
{
  "schemaVersion": 1,
  "meta": {
    "dataset": "recorded",
    "label": "真实记录",
    "source": "报告名称，没有就 null",
    "description": "这批数据是什么",
    "asOf": "可选。YYYY-MM-DD。写了就按这天算复习节点"
  },
  "learner": { "accent": "british 或 american 或 null" },
  "items": [
    {
      "id": "稳定的短 id",
      "english": "单词、短语或句子",
      "ipa": "与 accent 一致的音标，没记录就 null",
      "accent": "可选，覆盖 learner.accent",
      "meaningZh": "简短中文",
      "topic": "主题",
      "situation": "情境",
      "learnedOn": "YYYY-MM-DD",
      "status": "passed、needs_review 或 null",
      "nextReviewOn": "可选，YYYY-MM-DD",
      "example": "可选，一句能用的例句",
      "notes": "可选，报告里的说明"
    }
  ],
  "sessions": [
    {
      "id": "稳定的短 id",
      "date": "YYYY-MM-DD",
      "durationMinutes": "整数分钟，或 null",
      "topic": "主题",
      "situation": "情境",
      "accent": "british、american 或 null",
      "summary": "可选。这节练了什么、说得怎样",
      "corrections": ["可选。发音、语调、用词、语法"],
      "nextSuggestion": "可选。下一课建议"
    }
  ]
}
```

`dataset` 用 `recorded`、`example` 或 `empty`。示例会在页面上标成「不是真实练习」。

## 复习节点

从首次学会那天算起，当天是第 1 天：

| 节点 | 第几天 | 页面上怎么显示 |
| --- | --- | --- |
| 第 1 天 | 1 | 当天窗口，到期 |
| 第 2–3 天 | 2–3 | 窗口内，到期 |
| 第 7 天 | 7 | 当天，到期 |
| 两次之间 | 4–6，或 8–13 | 下一节点标成「未到」，不算到期 |
| 第 14–16 天 | 14–16 | 窗口内，到期 |
| 窗口已过 | 17 天及以后，且未过关 | 到期，并标明窗口已过 |

`status` 为 `passed` 的不再排期。

## GitHub Pages

合并后，在仓库 Settings → Pages 里选部署分支，目录选仓库根目录 `/ (root)`。站点路径后面加上 `/web/`。这个仓库若是私有的，Pages 只对有权限的人可见。不需要另开托管账号。
