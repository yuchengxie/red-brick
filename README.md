## 几个术语

RED-BRICK（注：这是暂定名）是一种超级 APP，所谓超级是指它是一种 APP 的超集，可
以理解为 RED-BRICK 可以容纳众多小程序，所容纳的小程序我们称为 Smart Applet，
简称为 SApp。注：微信将小程序翻译为 Mini Program。

RED-BRICK 在底部提供一个名为 Local Resource Service 的服务层，简称 LRS，
这层服务包括：本地文件读写、本地目录管理、通知管理、TEE 加密服务等。LRS 对上层
提供的服务由预定义的权限规则 cfg.policy 保障安全。


## 两个扩展 protocol

RED-BRICK 扩展了两个 URL 的 protocol，其一是 "nbc:"，其二是 "file:" 这两者
的含义为 “在 RED-BRICK 中可运行的小程序”，只有在 RED-BRICK 程序中使用这两个
protocol 的 URL 才能被正常打开对应网页。

比如：将 NBC 官方网页定义成一个名为 nbc-site 的 SApp，如下定义表明
www.nb-chain.net 全网站都纳入该 SApp 管理。

``` js
"nbc-site": {
  "homepage": "https://www.nb-chain.net",
  "policy": {
    "file_read": true,
    "file_write": true,
    "tee_signature": true
  }
}
```

该网址下 `/index.html` 页面，可描述成如下格式：

```js
nbc://nbc-site/index.html
```

RED-BRICK 将这个 URL 自动解析为 `https://www.nb-chain.net/index.html`

只有以 "nbc:" 或 "file:" 为前缀的网页，在 RED-BRICK 中打开，才具备访问底层
LRS 服务的能力。


## SApp 类型

RED-BRICK 支持 3 类预定义 SApp，一类是 normal，一类是 dialog，还有一类是 hidden，
这三类由项目配置 cfg.app_type 指示，如果 cfg.app_type 未指定，缺省取 normal 值。

normal 对应于常规网页主页，以 cfg.homepage 指示 "http:" 或 "https:" 开头的
网址，cfg.homepage 定义根址，在根址之下众多子路径的网页都自动归属于这个 SApp。

dialog 是单页程序，由 cfg.homepage 指定其固定页的 URL。它表达模态窗口，由某个 SApp
弹出到顶部窗口显示，该 SApp 的其它页而在这个 dialog 关闭前将不可操作。dialog 设计
用于组织 LRS 接口供调用，比如，把 LRS 的 TEE 签名操作封装到 dialog 中，凡需调用
签名服务，都只能弹出这种窗口显式提醒用户。这是一种安全性设计，就像在网页中打开一个本
地文件，只能由浏览器管控的鼠标或键盘事件去触发，用户不能随意通过调用 API 来触发。
dialog 窗口展示的固定网页，只支持 "file://" 协议，即，只支持随 RED-BRICK 已安装
到本地的预设页面。

hidden 也是单页程序，由 cfg.homepage 指定其固定页的 URL。它表示隐式服务，由于我们
的生态不开放基于 Node 进程的定制，只开放基于网页的定制。实现特定的远程调用，不必用网页
展示，我们不能让第 3 方机构开发 Node 程序，只能以网页方式供其定制，hidden 页为此目的
而设计。打开 hidden 页（见 “测试2” 样例）后，并不展示新建页面，但对应 SApp 正常启
动了，其界面是自动隐藏的，该隐藏页中实现的功能只能以 IPC 调用方式，提供给其它 SApp。

## 通道服务

RED-BRICK 的桌面端 APP 用 Electron 开发，每个 Electron 程序都包含一个 Render 网
页进程与一个 Node 背景进程，两个进程之间用 IPC（Inter-Process Communication）通道
机制实现通信。

RED-BRICK 将通道服务再作封装，以实现针对在 dialog 与 hidden 页中封装的服务的直接调用，
这种调用称为 Inter-SApp Service Call，简称 ISSC。

提供 ISSC 服务的 SApp 在网页启动后，要注册 `income-query` 的回调处理，比方如下
代码（参见 my-test3/index.html）:

```js
LRS._on('income-query', function(event, msg, servName, msgIdx, webId) {
  console.log('income-query',msg,servName,msgIdx,webId);
  
  var retMsg = {error:'', desc:'OK'};  // do some caculation
  LRS._sendAsyn(retMsg,servName,msgIdx,webId); // reply caculate result
});
```

将计算结果返回给发起调用的 SApp 时，用 `LRS._sendAsyn(retMsg,servName,msgIdx,webId)` 即
返回服务结果 `retMsg`。

而某个 SApp 想发起 ISSC 调用，只需调用 `LRS.query()` 函数，可参考 `my-test1/index.html`
给出的例子。如下：

```js
LRS.query('test3', {command:'echo'}, function(retMsg) {
  console.log('replied:',retMsg);  // retMsg=null means failed
}, 5000);  // within 5 seconds
```
