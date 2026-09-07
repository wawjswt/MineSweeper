/* 游戏 Tab 协调器(扫雷 / 数独 / 连连看)
 *
 * 背景:三款游戏同页共用一个顶部 Tab 栏。Tab 高亮与各游戏面板(壳)的显隐
 * 必须由唯一权威统一管理,否则新增游戏时各脚本各自维护会导致状态冲突。
 *
 * 职责:
 *  1. 为页面上所有 [data-game] 的 .game-tab 绑定点击;
 *  2. 切换时:更新全部 Tab 高亮 + 切换对应 .*-shell 的 hidden;
 *  3. 通过 register(game, { onActivate, onDeactivate }) 让各游戏脚本注册
 *     生命周期回调(如"切走自动暂停、切回恢复"),本文件不感知游戏内部;
 *  4. 支持 #sweep / #sudoku / #lianliankan 锚点直达(默认 sweep)。
 *
 * 加载顺序:位于 bundle.js(扫雷)之后、sudoku-game.js / lianliankan-game.js
 * 之前。协调器不触碰 bundle.js 的全局词法(无顶层声明外泄)。
 */
(function () {
  "use strict";

  /* 各游戏壳的 id。键即 Tab data-game 值。 */
  var SHELL_BY_GAME = {
    sweep: "sweepShell",
    sudoku: "sudokuShell",
    lianliankan: "lianliankanShell",
  };

  var handlers = {}; // game -> { onActivate, onDeactivate }
  var currentGame = "sweep";
  var initialized = false;

  function forEachTab(fn) {
    var tabs = document.querySelectorAll(".game-tab");
    for (var i = 0; i < tabs.length; i++) fn(tabs[i]);
  }

  function setTabState(tab, active) {
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  }

  function setShellVisible(game, visible) {
    var id = SHELL_BY_GAME[game];
    if (!id) return;
    var el = document.getElementById(id);
    if (el) el.hidden = !visible;
  }

  function activate(gameName, opts) {
    opts = opts || {};
    if (!Object.prototype.hasOwnProperty.call(SHELL_BY_GAME, gameName)) return;
    if (gameName === currentGame) {
      // 幂等:已是目标游戏时仅确保 UI 状态正确(如 hash 直达重复触发)
      syncUi();
      return;
    }

    var previous = currentGame;
    var prevHandler = handlers[previous];
    var nextHandler = handlers[gameName];

    if (prevHandler && prevHandler.onDeactivate) {
      try {
        prevHandler.onDeactivate();
      } catch (err) {
        if (typeof console !== "undefined") console.error("[game-tabs] onDeactivate error:", err);
      }
    }

    currentGame = gameName;
    syncUi();

    if (nextHandler && nextHandler.onActivate) {
      try {
        nextHandler.onActivate();
      } catch (err) {
        if (typeof console !== "undefined") console.error("[game-tabs] onActivate error:", err);
      }
    }

    if (opts.onChanged) opts.onChanged(previous, gameName);
  }

  /* 让当前激活状态与 DOM 同步(Tab 高亮 + 壳显隐) */
  function syncUi() {
    forEachTab(function (tab) {
      var game = tab.getAttribute("data-game");
      setTabState(tab, game === currentGame);
    });
    var keys = Object.keys(SHELL_BY_GAME);
    for (var i = 0; i < keys.length; i++) {
      setShellVisible(keys[i], keys[i] === currentGame);
    }
  }

  function register(gameName, handler) {
    handlers[gameName] = handler;
  }

  function getCurrent() {
    return currentGame;
  }

  /* 锚点直达:URL 末尾 #sudoku / #lianliankan / #sweep */
  function resolveInitialGame() {
    var hash = "";
    try {
      hash = window.location.hash || "";
    } catch (err) {
      hash = "";
    }
    if (hash.indexOf("lianliankan") !== -1) return "lianliankan";
    if (hash.indexOf("sudoku") !== -1) return "sudoku";
    if (hash.indexOf("sweep") !== -1) return "sweep";
    return "sweep"; // 默认与改造前一致:打开即扫雷
  }

  function init() {
    if (initialized) return;
    initialized = true;

    forEachTab(function (tab) {
      tab.addEventListener("click", function () {
        activate(tab.getAttribute("data-game"));
      });
    });

    // 首屏渲染(所有脚本已注册完毕再激活,保证 onActivate 能被调用)
    currentGame = "sweep";
    syncUi();
    var initial = resolveInitialGame();
    if (initial !== "sweep") {
      activate(initial);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* 暴露最小 API;协调器自身不向页面添加多余全局名 */
  if (typeof window !== "undefined") {
    window.__GAME_TABS__ = {
      activate: activate,
      register: register,
      getCurrent: getCurrent,
    };
  }
})();
