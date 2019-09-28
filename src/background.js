// background.js

import path from "path";
import url from "url";
import fs from "fs";

import { app, BrowserWindow, webContents, Menu, ipcMain,screen } from "electron";
import { devMenuTemplate } from "./menu/dev_menu_template";
import { editMenuTemplate } from "./menu/edit_menu_template";
// var electron = require("electron");

// environment variables that declared in config/env_xxx.json
import env from "env";

import teeIO from "./tee/tee_io";
import teeIOApp from "./tee/tee_io_imp";
import server from './tee/webserver/server';

// if not 'production' env, change to dir such 'red-brick-app test'
let userDataPath = app.getPath("userData");
if (env.name !== "production") {
  // for mac, ~/Library/Application Support/red-brick-app
  userDataPath = `${userDataPath} (${env.name})`;
  app.setPath("userData", userDataPath);
}

const loadAppConfig_ = () => {
  let item,
    ret = fs.readFileSync(
      path.join(__dirname, "root-app", "app_config.json"),
      "utf-8"
    );
  ret = JSON.parse(ret);

  for (item in ret) {
    let cfg = ret[item];
    if ((cfg.homepage || "").indexOf("file://") == 0)
      cfg.root_dir = path.join(__dirname, item);
    else cfg.root_dir = path.join(userDataPath, "www", item); // nbc://xxx
    cfg.data_dir = path.join(userDataPath, "app", item);
  }

  return ret;
};

let mainWindow = null;
let activeWindows = [];

let nbc_apps = loadAppConfig_();
let nbc_url2app = { "file://root-app/app.html": nbc_apps["root-app"] }; // using when just loading

let nbc_id2app = {}; // { webId:cfg }, using when DOM loaded

const setApplicationMenu = () => {
  const menus = [editMenuTemplate];
  if (env.name !== "production") {
    menus.push(devMenuTemplate);
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate(menus));
};

const createMainWin = () => {
  mainWindow = new BrowserWindow({
    // width: 720, height: 480,
    // fullscreen: true,

    webPreferences: {
      defaultEncoding: "utf-8",
      preload: path.join(__dirname, "preload.js"),

      enableRemoteModule: false,
      contextIsolation: false, // to do: change to true
      nodeIntegration: false, // default is false
      webviewTag: false // default is false, not support <webview> tag
    }
  });

  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, "root-app", "app.html"),
      protocol: "file:",
      slashes: true
    })
  );

  mainWindow.maximize();

  if (env.name === "development") {
    mainWindow.openDevTools();
  }

  mainWindow.on("closed", () => {
    while (activeWindows.length) {
      // try close all other windows
      let oneWin = activeWindows.pop();
      if (oneWin && oneWin.destory) oneWin.destory(); // can fire 'closed', not fire 'close', 'unload', 'beforeunload'
    }
    mainWindow = null;
  });

  mainWindow.webContents.on("crashed", () => {
    mainWindow.reload(); // reload is better, whereas it seldom acting
  });
};

app.on("ready", () => {
  setApplicationMenu();
  createMainWin();
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", () => {
  if (mainWindow === null && activeWindows.length == 0) createMainWin();
});

//---------- system IPC service -----

const winByWebId = webId => {
  let i = activeWindows.length - 1; // try last one first
  while (i >= 0) {
    let item = activeWindows[i];
    i -= 1;

    let win = item[1];
    if ((win.webContents || {}).id === webId) return win;
  }
  return null;
};

const winInfosByName = servName => {
  let ret = [];
  let i = activeWindows.length - 1;
  while (i >= 0) {
    let item = activeWindows[i];
    i -= 1;
    if (item[3] === servName) ret.push(item);
  }

  return ret;
};

const winInfoById = winId => {
  let i = activeWindows.length - 1; // try last one first
  while (i >= 0) {
    let item = activeWindows[i];
    i -= 1;
    if (item[0] === winId) return item;
  }
  return null;
};

const addAppCfg_ = (u, cfg) => {
  // prepare {url:app} for preload.js
  const s = url.format({
    protocol: u.protocol,
    slashes: u.slashes,
    host: u.host,
    pathname: u.pathname
  }); // avoid using u.hash
  if (cfg.app_type == "hidden" || cfg.app_type == "dialog") {
    if (s !== cfg.homepage) return false;
  }

  nbc_url2app[s] = cfg;
  cfg.time = parseInt(new Date().valueOf() / 1000); // help for clean old items
  return true;
};

const getAppCfg_ = u => {
  const s = url.format({
    protocol: u.protocol,
    slashes: u.slashes,
    host: u.host,
    pathname: u.pathname
  }); // avoid using u.hash
  return nbc_url2app[s];
};

const adjustLocal_ = u => {
  if (!u.host && u.pathname.indexOf(__dirname) == 0) {
    let sLeft = u.pathname.slice(__dirname.length);
    if (sLeft.length && sLeft[0] == "/") {
      sLeft = sLeft.slice(1);

      let b = sLeft.split("/");
      if (b.length) {
        u.host = b[0];
        u.pathname = sLeft.slice(u.host.length);
        return true; // file:///.../root-app/index.html --> file://root-app/index.html
      }
    }
  }
  return false;
};

setInterval(() => {
  let item,
    cfg,
    now = parseInt(new Date().valueOf() / 1000);
  let b = [];
  for (item in nbc_url2app) {
    cfg = nbc_url2app[item];
    if (now - (cfg.time || 0) >= 600)
      // 10 minutes
      b.push(item);
  }

  b.forEach(item => {
    delete nbc_url2app[item]; // avoid nbc_url2app growing large
  });

  let newDict = {};
  b = BrowserWindow.getAllWindows();
  b.forEach(item => {
    if (item.webContents) {
      cfg = nbc_id2app[item.webContents.id];
      if (cfg) newDict[item] = cfg; // keep alive items and forget others
    }
  });
  nbc_id2app = newDict;
}, 600000); // every 10 minutes

const readjustLocal_ = (u, bRet) => {
 
  if (!u.host) {
    // file:///User/.../app-name/...
    if (!adjustLocal_(u)) return null;
  }
  
  // u is file://app-name/...
  const cfg = nbc_apps[u.host];
  if (cfg) {
    let u2 = url.parse(cfg.homepage);
    if (u2.protocol == "file:" && u.host == u2.host) {
      let cfg2 = { ...cfg };
      if (addAppCfg_(u, cfg2)) {
        // success add url to nbc_url2app[]
        if (bRet) bRet[0] = cfg2; // return back cfg value
        return (
          "file://" +
          path.join(__dirname, u.host, u.pathname) +
          (u.search || "") +
          (u.hash || "")
        ); // renew url
      }
    }
  }

  return null; // avoid none-authority file
};

const ipcNewWindow = (ev, msg, _parent) => {
  if (typeof msg != "object" || msg.url === undefined) return; // msg.url can be Url object
  mainWindow.height;
  let isHidden = false,
    isDialog = false,
    servName = "<unknown>";
  let forceFull = false,
    newParent = undefined;
  let winWd = 720,
    winHi = 480;

  let u = url.parse(msg.url);

  if (u.protocol == "nbc:") {
    // nbc://app-name
    const cfg = nbc_apps[u.host]; // url.host includes auth and hostname
    if (cfg) {
      if (msg.command && msg.isRootApp) {
        if (cfg.app_type === "dialog") {
          const sz = cfg.screen || [720, 480];
          winWd = sz[0];
          winHi = sz[1];
          newParent = _parent;
          if (cfg.serv_name) servName = cfg.serv_name;
          isDialog = true; // for nbc://app-name only enter from root-app can accepted as dialog page
        } else if (cfg.app_type === "hidden") {
          if (cfg.serv_name) servName = cfg.serv_name;
          isHidden = true; // for nbc://app-name only enter from root-app can accepted as hidden page
        }
      }

      let u2 = url.parse(cfg.homepage);
      u.protocol = u2.protocol;
      u.host = u2.host;
      // u.pathname not changed

      addAppCfg_(u, { ...cfg });
    }
  } else if (u.protocol == "file:") {
    let info = [null];
    u = readjustLocal_(u, info);
    let cfg = info[0];
    if (cfg) {
      // for file://app-name, only one page is suggested in hidden/dialog style, ignore msg.command and msg.isRootApp
      if (cfg.app_type === "dialog") {
        const sz = cfg.screen || [720, 480];
        if (!sz[0] || !sz[1]) forceFull = true;
        else {
          winWd = sz[0];
          winHi = sz[1];
        }
        newParent = _parent;
        if (cfg.serv_name) servName = cfg.serv_name;
        isDialog = true;
      } else if (cfg.app_type === "hidden") {
        if (cfg.serv_name) servName = cfg.serv_name;
        isHidden = true;
      }
    }
  }

  let win = new BrowserWindow({
    width: winWd,
    height: winHi,
    // fullscreen: forceFull || (!isHidden && !isDialog),
    modal: isDialog,
    show: false,

    resizable: isDialog,
    // minimizable: false, maximizable: false,

    parent: newParent || mainWindow,
    webContents: msg.webContents, // msg.webContents can be undefined

    webPreferences: {
      defaultEncoding: "utf-8",
      preload: path.join(__dirname, "preload.js"),

      enableRemoteModule: false,
      contextIsolation: false, // to do: change to true
      nodeIntegration: false, // default is false
      webviewTag: false // default is false, not support <webview> tag
    }
  });
  let winInfo = [win.id, win, isDialog ? 1 : isHidden ? 2 : 0, servName]; // normal:0, dialog:1, hidden:2
  activeWindows.push(winInfo);

  win.once("ready-to-show", () => {
    if (!isHidden && !isDialog) {
      var winW = screen.getPrimaryDisplay().workAreaSize.width;
      var winH = screen.getPrimaryDisplay().workAreaSize.height;
      win.setBounds({
        width:winW,
        height:winH,
        x:0,
        y:0
      },false);
      win.show();
    }else{
      win.show();
    }
  });

  win.on("closed", () => {
    // safe clean window object
    let i,
      item,
      tempThis = null;

    // step 1: try remove from activeWindows
    for (i = 0; i < activeWindows.length; i++) {
      let item = activeWindows[i];
      if (item && item === winInfo) {
        tempThis = item[1]; // temporary holding, avoid recycle right now
        activeWindows.splice(i, 1);
        break;
      }
    }

    // step 2: delay remove closing window
    setTimeout(() => {
      winInfo = null;
      tempThis = null;
    }, 2000);
  });

  // 'new-window' is occured when 'open in new tab/window' processing
  win.webContents.on(
    "new-window",
    (event, _url, frameName, disposition, options) => {
      if (disposition == "new-window" || disposition == "foreground-tab") {
        event.preventDefault();
        // ipcNewWindow(event,{url:_url,webContents:options.webContents},win); // msg.command is undefined
        console.log('_url:',_url);
        ipcNewWindow(
          event,
          { url: _url, webContents: options.webContents },
          mainWindow
        ); // msg.command is undefined
      }
    }
  );

  // 'will-navigate' is occured when window.location changing, but not window.location.hash changing
  win.webContents.on("will-navigate", (event, _url) => {
    let u = url.parse(_url);
    if (u.protocol == "nbc:") {
      let cfg = nbc_apps[u.host];
      if (cfg) {
        let u2 = url.parse(cfg.homepage);
        u.protocol = u2.protocol;
        u.host = u2.host;
        // u.pathname not changed

        event.preventDefault();
        if (addAppCfg_(u, { ...cfg }))
          setTimeout(() => win.webContents.loadURL(url.format(u)), 100);
      }
    } else if (u.protocol == "file:") {
      u = readjustLocal_(u);
      if (u) {
        if (u === _url) return;
        // continue open
        else {
          event.preventDefault();
          setTimeout(() => {
            win.webContents.loadURL(u);
          }, 100);
        }
      } else event.preventDefault(); // ignore open
    }
  });

  if (u) {
    if (!msg.command) {
      // if not msg.command, means called from on('new-window')
      if (!msg.webContents) win.loadURL(url.format(u)); // existing webContents will be navigated automatically
      ev.newGuest = win;
    } else {
      win.loadURL(url.format(u));
    }
  }
};

ipcMain.on("sys-sync-query", (ev, msg) => {
  try {
    ev.returnValue = processQuery(ev, msg) || "";
  } catch (e) {
    console.log("process sync-query failed:", e);
  }
});

ipcMain.on("sys-asyn-query", (ev, msg, servName, msgIndex, webId, isQuery) => {
  try {
    let ret = processQuery(ev, msg, servName, msgIndex, webId, isQuery);
    if (ret !== undefined)
      // if ret is undefined, means no need reply
      ev.sender.send("sys-asyn-reply", ret);
  } catch (e) {
    console.log(
      "process asyn-query (" + ((msg || {}).command || "unknown") + ") failed:",
      e
    );
  }
});

const processQuery = (ev, msg, servName, msgIndex, webId, isQuery) => {
  let ret = undefined,
    cfg = null;
  let isQueryWrap =
    typeof servName == "string" &&
    typeof msgIndex == "number" &&
    typeof webId == "number";

  if (isQueryWrap && !isQuery) {
    // is reply of query
    let ctx = webContents.fromId(webId);
    if (ctx) ctx.send("reply-query", msg, servName, msgIndex);
    return undefined; // avoid resend
  }

  let cmd = (msg || {}).command || "";
  if (cmd == "prepareApp") {
    let wid = ev.sender.id; // webContents.id
    const u = url.parse(ev.sender.getURL()); // for security: try find url, not by pass in
    if (u.protocol == "file:") {
      if (adjustLocal_(u)) {
        // file:///.../root-app/index.html --> file://root-app/index.html
        cfg = getAppCfg_(u);
        if (cfg) nbc_id2app[wid] = cfg;
      }
    } else {
      cfg = getAppCfg_(u);
      if (cfg) nbc_id2app[wid] = cfg;
    }
  } else if (cmd == "newWindow") {
    ipcNewWindow(ev, msg); // not need set ret
  } else if (cmd == "alignCenter") {
    let win = winByWebId(ev.sender.id);
    if (win && win.isMovable()) {
      win.center();

      /*    const dip = screen.getPrimaryDisplay();  // import {screen} from "electron"; 
      const sz = win.getSize();
      let x = parseInt(dip.size.width - sz.width) / 2);
      let y = parseInt(dip.size.height - sz.height) / 2);
      win.setPosition(x,y); */
    }
  } else {
    const u = url.parse(ev.sender.getURL());
    if (u.protocol == "file:") {
      if (adjustLocal_(u)) cfg = getAppCfg_(u);
    } else cfg = getAppCfg_(u);
    if (!cfg) return ret;

    let policy = cfg.policy || {};

    if (isQueryWrap) {
      let win = winByWebId(ev.sender.id);
      if (!win || !win.webContents) return undefined;

      // step 1: check policy
      if ((policy.access_list || []).indexOf(servName) < 0) return undefined; // ignore next step, no authority

      // step 2: find winInfo by servName, try direct children/parent first
      let winInfo = null,
        infos = winInfosByName(servName);
      if (infos.length == 0) return undefined; // no matched peer

      if (infos.length == 1)
        // get only one matched
        winInfo = infos[0];
      else {
        let i,
          tmp = win.getParentWindow();
        tmp = tmp ? tmp.id : 0xffffffff; // get owner id

        for (i = 0; i < infos.length; i++) {
          let item = infos[i],
            curr = item[1];
          if (curr.id === tmp) {
            // is direct parent
            winInfo = item;
            break;
          } else {
            curr = curr.getParentWindow();
            if (curr && curr.id === win.id) {
              // is direct child
              winInfo = item;
              break;
            }
          }
        }

        if (!winInfo) winInfo = infos[0]; // get any one
      }

      // step 3: send async query message
      let ctx = winInfo[1].webContents;
      if (ctx) {
        ctx.send("income-query", msg, servName, msgIndex, ev.sender.id);
        return undefined; // avoid resend
      }
    } else if (cmd == "fileRead") {
      ret = { error: "unknown", command: cmd, data: "" };
      if (msg.path && policy.file_read) {
        let sBase = cfg.data_dir + path.sep;
        let sTarg = path.join(sBase, msg.path);
        if (sTarg.length > sBase.length && sTarg.indexOf(sBase) == 0) {
          try {
            let st = fs.statSync(sTarg);
            if (st.isFile()) {
              ret.data = fs.readFileSync(sTarg, {
                encoding: msg.encoding || "utf-8"
              });
              ret.error = "";
            } else ret.error = "invalid format";
          } catch (e) {
            console.log("read failed:" + sTarg);
            ret.error = "IO error";
          }
        } else ret.error = "invalid path";
      } else ret.error = "no authorization";
    } else if (cmd == "loadAppCfg") {
      if (policy.root_config_read) {
        let data = fs.readFileSync(
          path.join(__dirname, "ui_config.json"),
          "utf-8"
        );
        ret = { error: "", command: cmd, data: JSON.parse(data) }; // maybe raise exception
      }
    } else if (cmd.slice(0, 4) == "tee_") {
      if (cmd.slice(4, 9) == "base_") {
        console.log('come do base');
        console.log('policy.tee_base:',policy.tee_base);
        // tee_base_account, tee_base_state ...
        if (policy.tee_base) return teeIO.do_base(ev, msg);
      } else if (cmd.slice(4, 8) == "pay_") {
        // tee_pay_getpass, tee_pay_sign ...
        if (policy.tee_pay) return teeIO.do_pay(ev, msg);
      } else if (cmd.slice(4, 10) == "miner_") {
        // tee_miner_start, tee_miner_stop ...
        if (policy.tee_miner) return teeIO.do_miner(ev, msg);
      } else if (cmd.slice(4, 10) == "admin_") {//service
        // tee_admin_getpass ...
        if (policy.tee_admin) return teeIO.do_admin(ev, msg);
      }
    }
  }

  return ret;
};
