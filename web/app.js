(function (factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.LearningStats = api;
    document.addEventListener("DOMContentLoaded", function () {
      boot(api);
    });
  }
  if (typeof module !== "undefined" && module.exports && typeof require !== "undefined" && require.main === module) {
    selfCheck(api);
  }
})(function () {
  var NODES = [
    { id: "day1", label: "第 1 天", from: 1, to: 1 },
    { id: "day2", label: "第 2–3 天", from: 2, to: 3 },
    { id: "day7", label: "第 7 天", from: 7, to: 7 },
    { id: "day14", label: "第 14–16 天", from: 14, to: 16 }
  ];

  var DATASETS = [
    { file: "data.json", fallback: "真实记录" },
    { file: "example.json", fallback: "示例数据" },
    { file: "empty.json", fallback: "空白档案" }
  ];

  function parseISODate(iso) {
    var parts = String(iso).split("-");
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function formatISO(date) {
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return date.getFullYear() + "-" + month + "-" + day;
  }

  function formatChinese(iso) {
    if (!iso) return "未记录";
    var parts = iso.split("-");
    return Number(parts[0]) + "年" + Number(parts[1]) + "月" + Number(parts[2]) + "日";
  }

  function addDays(iso, days) {
    var date = parseISODate(iso);
    date.setDate(date.getDate() + days);
    return formatISO(date);
  }

  function dayNumber(learnedOn, todayISO) {
    var ms = parseISODate(todayISO) - parseISODate(learnedOn);
    return Math.round(ms / 86400000) + 1;
  }

  function startOfToday() {
    var now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function viewISO(data) {
    if (data && data.meta && data.meta.asOf) return data.meta.asOf;
    return formatISO(startOfToday());
  }

  function accentLabel(accent) {
    if (accent === "british") return "英音";
    if (accent === "american") return "美音";
    return "未记录";
  }

  function statusLabel(status) {
    if (status === "passed") return "过关";
    if (status === "needs_review") return "仍需回扣";
    return "未记录（先按仍需回扣）";
  }

  function schedule(item, todayISO) {
    var learned = item.learnedOn;
    if (!learned) {
      return {
        nodeLabel: "未记录",
        nextOn: null,
        nextLabel: "未记录",
        due: false,
        overdue: false,
        waiting: false,
        statusLabel: statusLabel(item.status),
        dayNum: null
      };
    }

    var dayNum = dayNumber(learned, todayISO);
    var passed = item.status === "passed";
    var label = statusLabel(item.status);
    if (passed) {
      return {
        nodeLabel: "已过关",
        nextOn: null,
        nextLabel: "不用再排",
        due: false,
        overdue: false,
        waiting: false,
        statusLabel: label,
        dayNum: dayNum
      };
    }

    if (item.nextReviewOn) {
      var explicitDue = todayISO >= item.nextReviewOn;
      var explicitNode = NODES.filter(function (node) {
        return dayNum >= node.from && dayNum <= node.to;
      })[0];
      return {
        nodeLabel: explicitNode ? explicitNode.label : (dayNum > 16 ? "第 14–16 天之后" : "按档案里的下次复习日期"),
        nextOn: item.nextReviewOn,
        nextLabel: formatChinese(item.nextReviewOn),
        due: explicitDue,
        overdue: explicitDue && dayNum > 16,
        waiting: !explicitDue,
        statusLabel: label,
        dayNum: dayNum
      };
    }

    var active = NODES.filter(function (node) {
      return dayNum >= node.from && dayNum <= node.to;
    })[0];
    if (active) {
      var start = addDays(learned, active.from - 1);
      var end = addDays(learned, active.to - 1);
      var range = active.from === active.to ? formatChinese(start) : formatChinese(start) + "至" + formatChinese(end);
      return {
        nodeLabel: active.label,
        nextOn: start,
        nextLabel: range + "（今天在这个窗口里）",
        due: true,
        overdue: false,
        waiting: false,
        statusLabel: label,
        dayNum: dayNum
      };
    }

    var upcoming = NODES.filter(function (node) {
      return dayNum < node.from;
    })[0];
    if (upcoming) {
      var nextOn = addDays(learned, upcoming.from - 1);
      return {
        nodeLabel: upcoming.label,
        nextOn: nextOn,
        nextLabel: formatChinese(nextOn),
        due: false,
        overdue: false,
        waiting: true,
        statusLabel: label,
        dayNum: dayNum
      };
    }

    var last = NODES[NODES.length - 1];
    var lastStart = addDays(learned, last.from - 1);
    var lastEnd = addDays(learned, last.to - 1);
    return {
      nodeLabel: last.label,
      nextOn: lastStart,
      nextLabel: formatChinese(lastStart) + "至" + formatChinese(lastEnd) + "（窗口已过）",
      due: true,
      overdue: true,
      waiting: false,
      statusLabel: label,
      dayNum: dayNum
    };
  }

  function formatMinutes(minutes) {
    if (minutes == null || minutes === "") return "未记录";
    var value = Number(minutes);
    if (!isFinite(value)) return "未记录";
    var hours = Math.floor(value / 60);
    var rest = value % 60;
    if (hours && rest) return hours + " 小时 " + rest + " 分钟";
    if (hours) return hours + " 小时";
    return rest + " 分钟";
  }

  function sumMinutes(sessions) {
    return sessions.reduce(function (total, session) {
      if (session.durationMinutes == null || session.durationMinutes === "") return total;
      return total + Number(session.durationMinutes);
    }, 0);
  }

  function missingDurations(sessions) {
    return sessions.filter(function (session) {
      return session.durationMinutes == null || session.durationMinutes === "";
    }).length;
  }

  function weekStart(iso) {
    var date = parseISODate(iso);
    var day = date.getDay();
    var diff = day === 0 ? 6 : day - 1;
    date.setDate(date.getDate() - diff);
    return formatISO(date);
  }

  function groupSessions(sessions, keyFn) {
    var groups = {};
    var order = [];
    sessions.forEach(function (session) {
      if (!session.date) return;
      var key = keyFn(session.date);
      if (!groups[key]) {
        groups[key] = [];
        order.push(key);
      }
      groups[key].push(session);
    });
    order.sort(function (a, b) {
      return a < b ? 1 : -1;
    });
    return order.map(function (key) {
      return { key: key, sessions: groups[key] };
    });
  }

  function monthKey(iso) {
    return iso.slice(0, 7);
  }

  function inRange(iso, todayISO, range) {
    if (!iso) return false;
    if (range === "7") return iso >= addDays(todayISO, -6) && iso <= todayISO;
    if (range === "30") return iso >= addDays(todayISO, -29) && iso <= todayISO;
    return true;
  }

  function itemAccent(item, learner) {
    return item.accent || (learner && learner.accent) || null;
  }

  return {
    NODES: NODES,
    DATASETS: DATASETS,
    parseISODate: parseISODate,
    formatISO: formatISO,
    formatChinese: formatChinese,
    addDays: addDays,
    dayNumber: dayNumber,
    viewISO: viewISO,
    accentLabel: accentLabel,
    schedule: schedule,
    formatMinutes: formatMinutes,
    sumMinutes: sumMinutes,
    missingDurations: missingDurations,
    weekStart: weekStart,
    groupSessions: groupSessions,
    monthKey: monthKey,
    inRange: inRange,
    itemAccent: itemAccent
  };
});

function selfCheck(api) {
  function assert(cond, message) {
    if (!cond) throw new Error(message);
  }

  assert(api.dayNumber("2026-11-07", "2026-11-22") === 16, "Nov 7 is day 16 on Nov 22");
  assert(api.dayNumber("2026-11-08", "2026-11-22") === 15, "Nov 8 is day 15 on Nov 22");
  assert(api.dayNumber("2026-11-22", "2026-11-22") === 1, "same day is day 1");

  var due = api.schedule({ learnedOn: "2026-11-07", status: null }, "2026-11-22");
  assert(due.nodeLabel === "第 14–16 天" && due.due && !due.overdue, "day 16 is inside the last window");

  var day7 = api.schedule({ learnedOn: "2026-11-16", status: "needs_review" }, "2026-11-22");
  assert(day7.nodeLabel === "第 7 天" && day7.due, "day 7 window");

  var waiting = api.schedule({ learnedOn: "2026-11-18", status: "needs_review" }, "2026-11-22");
  assert(waiting.waiting && waiting.nextOn === "2026-11-24" && waiting.nodeLabel === "第 7 天", "day 5 waits for day 7");

  var overdue = api.schedule({ learnedOn: "2026-10-20", status: "needs_review" }, "2026-11-22");
  assert(overdue.overdue && overdue.due, "past day 16 is overdue");

  var passed = api.schedule({ learnedOn: "2026-11-01", status: "passed" }, "2026-11-22");
  assert(!passed.due && passed.nodeLabel === "已过关", "passed items are not due");

  assert(api.formatMinutes(null) === "未记录", "missing duration");
  assert(api.formatMinutes(90) === "1 小时 30 分钟", "hour formatting");
  assert(api.sumMinutes([{ durationMinutes: 10 }, { durationMinutes: null }, { durationMinutes: 5 }]) === 15, "sum skips null");
  assert(api.weekStart("2026-11-08") === "2026-11-02", "Sunday belongs to the Monday week");
  assert(api.weekStart("2026-11-07") === "2026-11-02", "Saturday week start");
  assert(api.accentLabel("british") === "英音" && api.accentLabel(null) === "未记录", "accent labels");

  var fs = require("fs");
  var path = require("path");
  ["data.json", "example.json", "empty.json"].forEach(function (name) {
    var data = JSON.parse(fs.readFileSync(path.join(__dirname, name), "utf8"));
    assert(data.schemaVersion === 1, name + " schema");
    assert(Array.isArray(data.items) && Array.isArray(data.sessions), name + " arrays");
  });
  var recorded = JSON.parse(fs.readFileSync(path.join(__dirname, "data.json"), "utf8"));
  assert(recorded.meta.dataset === "recorded", "real dataset label");
  assert(recorded.items.length === 7 && recorded.sessions.length === 2, "real counts");
  assert(recorded.sessions.every(function (session) { return session.durationMinutes === null; }), "real durations stay empty");
  assert(recorded.items.every(function (item) { return item.ipa === null && item.status === null; }), "real ipa and status stay empty");
  assert(recorded.items.every(function (item) {
    var review = api.schedule(item, "2026-11-22");
    return review.due && review.nodeLabel === "第 14–16 天";
  }), "real items are in the last window on Nov 22");

  var example = JSON.parse(fs.readFileSync(path.join(__dirname, "example.json"), "utf8"));
  assert(example.meta.dataset === "example" && example.meta.asOf === "2026-11-22", "example is labeled");
  assert(api.sumMinutes(example.sessions) === 171, "example minutes");
  var exampleDue = example.items.filter(function (item) {
    return api.schedule(item, example.meta.asOf).due;
  });
  assert(exampleDue.length === 5, "example due count");
  var empty = JSON.parse(fs.readFileSync(path.join(__dirname, "empty.json"), "utf8"));
  assert(empty.items.length === 0 && empty.sessions.length === 0, "empty archive");
  console.log("self-check ok");
}

function boot(api) {
  var state = {
    file: "data.json",
    data: null,
    range: "all",
    month: "all",
    topic: "all"
  };
  var app = document.getElementById("app");
  var notice = document.getElementById("dataset-notice");
  var switcher = document.getElementById("dataset-switch");

  function el(tag, attrs) {
    var node = document.createElement(tag);
    var children = Array.prototype.slice.call(arguments, 2);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var value = attrs[key];
        if (key === "class") node.className = value;
        else if (key.slice(0, 2) === "on" && typeof value === "function") node.addEventListener(key.slice(2), value);
        else if (value != null && value !== false) node.setAttribute(key, value);
      });
    }
    children.forEach(function (child) {
      if (child == null || child === false) return;
      node.append(child.nodeType ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  function renderSwitcher() {
    switcher.innerHTML = "";
    api.DATASETS.forEach(function (dataset) {
      var selected = dataset.file === state.file;
      switcher.append(el("button", {
        type: "button",
        role: "radio",
        "aria-checked": selected ? "true" : "false",
        onclick: function () {
          state.file = dataset.file;
          state.range = "all";
          state.month = "all";
          state.topic = "all";
          load();
        }
      }, dataset.fallback));
    });
  }

  function renderNotice(data, todayISO) {
    notice.innerHTML = "";
    var meta = data.meta || {};
    if (meta.dataset === "example") {
      notice.append(el("strong", null, "示例数据，不是真实练习。"));
      notice.append(" ");
    }
    if (meta.description) notice.append(meta.description);
    notice.append(el("span", null, " 复习节点按" + (meta.asOf ? "档案里的 asOf " + api.formatChinese(meta.asOf) : "打开页面的今天 " + api.formatChinese(todayISO)) + " 计算。"));
  }

  function render(data) {
    var todayISO = api.viewISO(data);
    var items = data.items || [];
    var sessions = data.sessions || [];
    var learner = data.learner || {};
    renderNotice(data, todayISO);
    app.innerHTML = "";

    var scheduled = items.map(function (item) {
      return { item: item, review: api.schedule(item, todayISO) };
    });
    var dueCount = scheduled.filter(function (row) { return row.review.due; }).length;
    var recordedMinutes = api.sumMinutes(sessions);
    var missing = api.missingDurations(sessions);
    var timeValue = sessions.length === 0 ? "—" : (missing === sessions.length ? "未记录" : api.formatMinutes(recordedMinutes));
    var timeLabel = "累计学时";
    if (missing && missing === sessions.length) timeLabel = "累计学时（时长都没写）";
    else if (missing) timeLabel = "已记录学时（另有 " + missing + " 次没写时长）";

    app.append(el("ul", { class: "summary" },
      el("li", null, el("span", { class: "num" }, String(items.length)), el("span", { class: "label" }, "词汇和表达")),
      el("li", null, el("span", { class: "num" }, String(dueCount)), el("span", { class: "label" }, "到期待复习")),
      el("li", null, el("span", { class: "num" }, timeValue), el("span", { class: "label" }, timeLabel))
    ));

    app.append(renderVocabulary(items, learner, todayISO));
    app.append(renderCurve(scheduled));
    app.append(renderTime(sessions, learner));
  }

  function renderVocabulary(items, learner, todayISO) {
    var topics = unique(items.map(function (item) { return item.topic; }).filter(Boolean));
    var months = unique(items.map(function (item) { return item.learnedOn ? api.monthKey(item.learnedOn) : null; }).filter(Boolean)).sort().reverse();
    var filtered = items.filter(function (item) {
      if (state.topic !== "all" && item.topic !== state.topic) return false;
      if (state.month !== "all" && (!item.learnedOn || api.monthKey(item.learnedOn) !== state.month)) return false;
      if (state.range !== "all" && !api.inRange(item.learnedOn, todayISO, state.range)) return false;
      return true;
    }).slice().sort(function (a, b) {
      return (b.learnedOn || "") < (a.learnedOn || "") ? -1 : 1;
    });

    var section = el("section", { id: "vocabulary" },
      el("div", { class: "section-head" },
        el("h2", null, "最新学到的词汇和表达"),
        el("span", { class: "section-index" }, "01")
      ),
      el("p", { class: "section-note" }, "按首次学会的日期从新到旧。筛选只作用在这一节。音标用档案里记下的口音；没写就显示未记录。")
    );

    var filters = el("div", { class: "filters" });
    filters.append(selectField("时间", "range", [
      ["all", "全部时间"],
      ["7", "最近 7 天"],
      ["30", "最近 30 天"]
    ], state.range));
    filters.append(selectField("月份", "month", [["all", "全部月份"]].concat(months.map(function (month) {
      var parts = month.split("-");
      return [month, Number(parts[0]) + "年" + Number(parts[1]) + "月"];
    })), state.month));
    filters.append(selectField("主题", "topic", [["all", "全部主题"]].concat(topics.map(function (topic) {
      return [topic, topic];
    })), state.topic));
    section.append(filters);

    if (!items.length) {
      section.append(el("p", { class: "empty" }, "还没有词汇。课后把新词写入 data.json 的 items。"));
      return section;
    }
    if (!filtered.length) {
      section.append(el("p", { class: "empty" }, "这个筛选条件下没有条目。"));
      return section;
    }

    var list = el("ul", { class: "list" });
    filtered.forEach(function (item) {
      var accent = api.itemAccent(item, learner);
      list.append(el("li", { class: "card" },
        el("div", { class: "card-top" },
          el("h3", { class: "english" }, item.english || "（未写英文）"),
          el("span", { class: "date" }, api.formatChinese(item.learnedOn))
        ),
        el("p", { class: "ipa" }, item.ipa ? item.ipa : "音标未记录"),
        el("p", { class: "meaning" }, item.meaningZh || "中文未记录"),
        el("p", { class: "meta-line" }, [item.topic || "主题未记录", item.situation || "情境未记录", "口音" + api.accentLabel(accent)].join(" · ")),
        item.example ? el("p", { class: "item-note" }, "例句：" + item.example) : null,
        item.notes ? el("p", { class: "item-note" }, item.notes) : null
      ));
    });
    section.append(list);
    return section;
  }

  function selectField(label, key, options, current) {
    var select = el("select", {
      id: "filter-" + key,
      onchange: function (event) {
        state[key] = event.target.value;
        render(state.data);
      }
    });
    options.forEach(function (option) {
      var node = el("option", { value: option[0] }, option[1]);
      if (option[0] === current) node.selected = true;
      select.append(node);
    });
    return el("label", null, label, select);
  }

  function renderCurve(scheduled) {
    var section = el("section", { id: "curve" },
      el("div", { class: "section-head" },
        el("h2", null, "遗忘曲线"),
        el("span", { class: "section-index" }, "02")
      ),
      el("p", { class: "section-note" }, "间隔从首次学会那天算起：第 1 天、第 2–3 天、第 7 天、第 14–16 天。到期的排在前面。过关指能主动、较准确地用出；报告没写的，先按仍需回扣，不标成过关。")
    );
    if (!scheduled.length) {
      section.append(el("p", { class: "empty" }, "还没有需要复习的条目。"));
      return section;
    }

    var due = scheduled.filter(function (row) { return row.review.due; });
    var later = scheduled.filter(function (row) { return !row.review.due; });
    due.sort(compareReview);
    later.sort(compareReview);
    section.append(el("h3", { class: "group-label" }, "到期 · " + due.length + " 条"));
    section.append(due.length ? reviewList(due) : el("p", { class: "empty" }, "今天没有到期的条目。"));
    section.append(el("h3", { class: "group-label" }, "未到期 · " + later.length + " 条"));
    section.append(later.length ? reviewList(later) : el("p", { class: "empty" }, "没有未到期的条目。"));
    return section;
  }

  function compareReview(a, b) {
    if (a.review.overdue !== b.review.overdue) return a.review.overdue ? -1 : 1;
    var left = a.review.nextOn || "9999-99-99";
    var right = b.review.nextOn || "9999-99-99";
    if (left !== right) return left < right ? -1 : 1;
    return (a.item.english || "").localeCompare(b.item.english || "");
  }

  function reviewList(rows) {
    var list = el("ul", { class: "list" });
    rows.forEach(function (row) {
      var review = row.review;
      var badgeClass = review.due ? "badge due" : (row.item.status === "passed" ? "badge ok" : "badge wait");
      var badgeText = review.overdue ? "已过窗口" : (review.due ? "到期" : (row.item.status === "passed" ? "过关" : "未到"));
      var cardClass = review.due ? "card due" : (row.item.status === "passed" ? "card passed" : "card");
      list.append(el("li", { class: cardClass },
        el("div", { class: "card-top" },
          el("h3", { class: "english" }, el("span", { class: badgeClass }, badgeText), row.item.english || "（未写英文）"),
          el("span", { class: "date" }, api.formatChinese(row.item.learnedOn))
        ),
        el("p", { class: "meta-line" }, "复习节点：" + (review.waiting ? review.nodeLabel + "（未到）" : review.nodeLabel)),
        el("p", { class: "meta-line" }, "下次复习：" + review.nextLabel),
        el("p", { class: "meta-line" }, "状态：" + review.statusLabel)
      ));
    });
    return list;
  }

  function renderTime(sessions, learner) {
    var section = el("section", { id: "time" },
      el("div", { class: "section-head" },
        el("h2", null, "学时"),
        el("span", { class: "section-index" }, "03")
      ),
      el("p", { class: "section-note" }, "每次练习的日期、时长、主题和情境。累计、按日、按周只加总写了时长的课。一周从周一开始。")
    );
    if (!sessions.length) {
      section.append(el("p", { class: "empty" }, "还没有练习记录。课后把一节课写入 data.json 的 sessions。"));
      return section;
    }

    var recorded = api.sumMinutes(sessions);
    var missing = api.missingDurations(sessions);
    var totalText = missing === sessions.length
      ? "累计学时未记录。共 " + sessions.length + " 次练习，报告里都没有写时长。"
      : "累计 " + api.formatMinutes(recorded) + (missing ? "。另有 " + missing + " 次没有写时长，没有算进去。" : "。");
    section.append(el("p", { class: "section-note" }, totalText));

    var ordered = sessions.slice().sort(function (a, b) {
      return (b.date || "") < (a.date || "") ? -1 : 1;
    });
    section.append(el("h3", { class: "group-label" }, "每次练习"));
    var list = el("ul", { class: "list" });
    ordered.forEach(function (session) {
      var accent = session.accent || learner.accent || null;
      var card = el("li", { class: "card" },
        el("div", { class: "card-top" },
          el("h3", { class: "english" }, api.formatChinese(session.date)),
          el("span", { class: "date" }, api.formatMinutes(session.durationMinutes))
        ),
        el("p", { class: "meta-line" }, [session.topic || "主题未记录", session.situation || "情境未记录", "口音" + api.accentLabel(accent)].join(" · "))
      );
      if (session.summary) card.append(el("p", { class: "session-note" }, session.summary));
      if (session.corrections && session.corrections.length) {
        var ul = el("ul", { class: "corrections" });
        session.corrections.forEach(function (line) { ul.append(el("li", null, line)); });
        card.append(ul);
      }
      if (session.nextSuggestion) card.append(el("p", { class: "item-note" }, "下次：" + session.nextSuggestion));
      list.append(card);
    });
    section.append(list);

    section.append(renderTotals("按日", api.groupSessions(sessions, function (date) { return date; }), function (key) {
      return api.formatChinese(key);
    }));
    section.append(renderTotals("按周", api.groupSessions(sessions, api.weekStart), function (key) {
      return api.formatChinese(key) + "至" + api.formatChinese(api.addDays(key, 6));
    }));
    return section;
  }

  function renderTotals(title, groups, labelFn) {
    var block = el("div", { class: "stats-block" }, el("h3", null, title));
    var table = el("table", null,
      el("thead", null, el("tr", null,
        el("th", null, title === "按周" ? "一周（周一至周日）" : "日期"),
        el("th", { class: "num" }, "次数"),
        el("th", { class: "num" }, "时长")
      ))
    );
    var body = el("tbody");
    groups.forEach(function (group) {
      var known = api.sumMinutes(group.sessions);
      var missing = api.missingDurations(group.sessions);
      var duration = missing === group.sessions.length ? "未记录" : api.formatMinutes(known) + (missing ? "（另有未记录）" : "");
      body.append(el("tr", null,
        el("td", null, labelFn(group.key)),
        el("td", { class: "num" }, String(group.sessions.length)),
        el("td", { class: "num" }, duration)
      ));
    });
    table.append(body);
    block.append(table);
    return block;
  }

  function unique(values) {
    var seen = {};
    var result = [];
    values.forEach(function (value) {
      if (seen[value]) return;
      seen[value] = true;
      result.push(value);
    });
    return result;
  }

  function showLoadError(error) {
    app.innerHTML = "";
    notice.textContent = "";
    var box = el("div", { class: "empty" },
      el("p", null, "没有读到 " + state.file + "。用本地服务器打开这个目录后再刷新。在 web 目录里运行：python3 -m http.server"),
      el("p", { class: "file-pick" }, "也可以直接选一个 JSON 文件：")
    );
    var input = el("input", { type: "file", accept: "application/json,.json" });
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          state.data = JSON.parse(String(reader.result));
          render(state.data);
        } catch (parseError) {
          notice.textContent = "这个文件不是有效的 JSON。";
        }
      };
      reader.readAsText(file);
    });
    box.append(input);
    box.append(el("p", { class: "item-note" }, String(error && error.message ? error.message : error)));
    app.append(box);
  }

  function load() {
    renderSwitcher();
    app.innerHTML = "";
    app.append(el("p", { class: "notice" }, "正在读取 " + state.file + " …"));
    fetch(state.file).then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    }).then(function (data) {
      state.data = data;
      render(data);
    }).catch(showLoadError);
  }

  var params = new URLSearchParams(window.location.search);
  var requested = params.get("data");
  if (requested && api.DATASETS.some(function (dataset) { return dataset.file === requested; })) {
    state.file = requested;
  }
  load();
}
