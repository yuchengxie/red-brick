window.onload = function() {
  //公共变量
  var blocks_;
  var block_;
  var search_block_;
  var tee_address = "";
  var currentFrame =
    this.localStorage.getItem("currentFrame") || "frame_account";
  // var currentFrame =
  //   this.localStorage.getItem("currentFrame");

  $(".page").removeClass("active");
  console.log("currentframe:", currentFrame);
  $("#" + currentFrame).addClass("active");

  //init
  $("iframe").height($(document).height());
  $(window).resize(function() {
    $("iframe").height($(document).height());
  });

  //注册单页切换事件
  $("#nav_block").click(tab);
  $("#nav_account").click(tab);
  $("#nav_utxo").click(tab);
  $("#nav_test").click(tab);
  function tab(e) {
    var id = e.currentTarget.id.split("_")[1];
    $(".page").removeClass("active");
    $("#frame_" + id).addClass("active");
    localStorage.setItem("currentPage", "#frame_" + id);
    store("frame_" + id);
  }

  $("#input_search").css("color", "#f60");
  $("#input_search").css("font-size", "0.95rem");

  LRS._sendAsyn({ command: "tee_base_pubAddr" });
  //getInfo
  let btn_getInfo = getElement("frame_test", "btn_getInfo");
  btn_getInfo.onclick = function() {
    if (tee_address) {
      var params = "addr=" + tee_address;
      LRS._sendAsyn({ command: "tee_base_getInfo", msg: params });
    } else {
      alert("未查询到tee地址");
    }
  };

  var getInfo = function(addr) {
    if (addr) {
      //地址校验todo
      var params = "addr=" + addr;
      LRS._sendAsyn({ command: "tee_base_getInfo", msg: params });
    } else {
      alert("地址不合法");
    }
  };

  LRS._on("pubAddr-asyn-reply", function(event, retMsg) {
    console.log("pubAddr-asyn-reply:", retMsg);
    tee_address = retMsg.data;
    if (tee_address) {
      getInfo(tee_address);
    }
  });

  LRS._on("info-asyn-reply", function(event, retMsg) {
    var payload = is_checksum(retMsg.data.body);
    if (payload) {
      var info = FtAccState.fromStream(payload);

      console.log("info-asyn-reply:", info.V);
      //todo render account.html
      renderAccount(info.V);
    } else {
      console.log("bad checksum");
    }
  });

  var renderAccount = function(data) {
    getElement("frame_account", "account").innerHTML = data.account.toString(
      "latin1"
    );
    getElement("frame_account", "link_no").innerHTML = data.link_no;
    getElement("frame_account", "search").innerHTML = data.search;
    getElement("frame_account", "timestamp").innerHTML = timestampToDate(
      data.timestamp
    );
    //动态UI
    var found = data.found.V;
    var divContent = getElement("frame_account", "content");
    for (var i = 0; i < found.length; i++) {
      var f = found[i];
      //divRow
      var divRow = document.createElement("div");
      divRow.classList.add("row");

      //编号
      var divNo = document.createElement("div");
      divNo.classList.add("col-md-2");
      // divNo.style.overflow="hidden";
      divNo.innerHTML = i + 1;
      divRow.appendChild(divNo);
      //高度
      var divHeight = document.createElement("div");
      divHeight.classList.add("col-md-2");
      var spanHeight = document.createElement("span");
      spanHeight.classList.add("addr");
      spanHeight.innerHTML = f.height;
      spanHeight.onclick = function() {
        searchBlockByHeight(this.innerHTML);
      };
      divHeight.appendChild(spanHeight);
      divRow.appendChild(divHeight);
      //uock
      var divUock = document.createElement("div");
      divUock.classList.add("col-md");
      var spanUock = document.createElement("span");
      spanUock.classList.add("addr");
      spanUock.innerHTML = bufToHexStr(f.uock.reverse());
      spanUock.onclick = function() {
        //todo
        searchUTXOSByUock(this.innerHTML);
      };
      divUock.appendChild(spanUock);
      divRow.appendChild(divUock);
      //金额-数量
      var divValue = document.createElement("div");
      divValue.classList.add("col-md");
      divValue.innerHTML = f.value / 100000000 + " NBC";
      divRow.appendChild(divValue);

      divContent.appendChild(divRow);
    }
  };

  //获取blocks数据
  var getDefaultBlocks = function() {
    var h = [];
    for (var i = 1; i < 10; i++) {
      h.push(-i);
    }
    // var h = [-1, -2, -3, -4, -5];
    var height = "";
    for (var i = 0; i < h.length; i++) {
      height += "&hi=" + h[i];
    }
    var hash = "";
    for (let i = 0; i < 32; i++) {
      hash += "00";
    }
    hash = "&hash=" + hash;
    var params = hash + height;
    LRS._sendAsyn({ command: "tee_base_getBlocks", msg: params });
  };

  LRS._on("blocks-asyn-reply", (ev, retMsg) => {
    var payload = is_checksum(retMsg.data.body);
    if (payload) {
      var blocks = FtReplyHeaders.fromStream(payload);
      console.log("blocks-asyn-reply:", blocks.V);
      //异步获取到数据后，前端渲染
      blocks_ = blocks.V;
      window.blocks_ = blocks_;
      renderBlocks(blocks_);
    } else {
      console.log("bad checksum");
    }
  });

  var renderBlocks = function(data) {
    var heights = data.heights.V;
    var headers = data.headers.V;
    var content = getElement("frame_block", "content");

    for (var i = 0; i < heights.length; i++) {
      var divP = document.createElement("div");
      divP.classList.add("row");
      //1.序号
      var divNo = document.createElement("div");
      divNo.classList.add("col-md-2");
      divNo.innerHTML = i + 1;
      divP.appendChild(divNo);
      //2.高度
      var divHeight = document.createElement("div");
      divHeight.classList.add("col-md-2");
      var divHeightspan = document.createElement("span");
      divHeightspan.classList.add("divHeightspan");
      divHeightspan.innerHTML = heights[i].V;
      divHeightspan.classList.add("blockheight");
      //2.1动态添加id和点击事件
      divHeightspan.setAttribute("id", "height" + divHeightspan.innerHTML);
      // divHeightspan.onclick = clickHeightForBlock;
      divHeightspan.onclick = function() {
        if (!this.innerHTML) return;
        searchBlockByHeight(this.innerHTML);
      };
      divHeight.appendChild(divHeightspan);
      divP.appendChild(divHeight);
      //3.时间
      var divTime = document.createElement("div");
      divTime.classList.add("col-md-4");
      divTime.innerHTML = timestampToDate(headers[i].V.timestamp);
      divP.appendChild(divTime);
      //4.交易
      var divTxns = document.createElement("div");
      divTxns.classList.add("col-md-2");
      divTxns.innerHTML = headers[i].V.txn_count;
      divP.appendChild(divTxns);
      //5.随机值
      var divRandom = document.createElement("div");
      divRandom.classList.add("col-md-2");
      divRandom.innerHTML = headers[i].V.nonce;
      divP.appendChild(divRandom);

      content.appendChild(divP);
    }
  };

  getDefaultBlocks();

  //btn_search
  btn_search.onclick = function() {
    var height_search = $("#input_search").val();
    if (!/^\d+$/.test(height_search)) return;
    searchBlockByHeight(height_search);
  };

  var searchBlockByHash = function(hash) {
    var params = "&hash=" + hash;
    LRS._sendAsyn({ command: "tee_base_getBlock", msg: params });
  };

  var searchBlockByHeight = function(height) {
    var params = "&hi=" + height;
    LRS._sendAsyn({ command: "tee_base_getBlock", msg: params });
  };

  LRS._on("block-asyn-reply", (ev, retMsg) => {
    var payload = is_checksum(retMsg.data.body);
    if (payload) {
      var block = FtReplyHeaders.fromStream(payload);
      console.log("block-asyn-reply:", block.V);
      //异步获取到数据后，前端渲染
      search_block_ = block.V;
      // console.log("search_block_:", search_block_);
      // var search_height = search_block_.heights.V[0].V;
      $(".page").removeClass("active");
      $("#frame_blockdetail").addClass("active");
      //测试临时用
      // store("frame_blockdetail");
      renderBlockdetail(search_block_);
    } else {
      console.log("bad checksum");
    }
  });

  function renderBlockdetail(block) {
    var height = block.heights[0];
    var txck = block.txcks[0];
    var header = block.headers[0];
    var txn_count = header.txn_count;

    if (!header) return;
    getElement("frame_blockdetail", "hi").innerHTML = height;
    getElement("frame_blockdetail", "txcks").innerHTML = bufToHexStr(txck);
    getElement("frame_blockdetail", "version").innerHTML = header.version;
    getElement("frame_blockdetail", "link_no").innerHTML = header.link_no;
    var prev_block = getElement("frame_blockdetail", "prev_block");
    prev_block.innerHTML = bufToHexStr(header.prev_block);
    prev_block.onclick = function() {
      searchBlockByHash(this.innerHTML);
    };
    getElement("frame_blockdetail", "prev_block").innerHTML = bufToHexStr(
      header.prev_block
    );
    getElement("frame_blockdetail", "merkle_root").innerHTML = bufToHexStr(
      header.merkle_root
    );
    getElement("frame_blockdetail", "timestamp").innerHTML = timestampToDate(
      header.timestamp
    );
    getElement("frame_blockdetail", "bits").innerHTML = header.bits;
    getElement("frame_blockdetail", "txn_count").innerHTML = header.txn_count;
    getElement("frame_blockdetail", "nonce").innerHTML = header.nonce;
    getElement("frame_blockdetail", "miner").innerHTML = bufToHexStr(
      header.miner
    );
    getElement("frame_blockdetail", "sig_tee").innerHTML = bufToHexStr(
      header.sig_tee
    );
    //txns
    //1.get all uock
    var UInt32_a = txck.readUInt32LE(0);
    var UInt32_b = txck.readUInt32LE(4);

    var blockId = (UInt32_b << 12) | (UInt32_a >>> 20);
    outIndex = 0; //固定
    // // txnIndex = 0, 1, 2 ...
    // txnIndex = 0; //0,1,2 分别对应交易的数量
    var uocks = [];
    for (var i = 0; i < txn_count; i++) {
      txnIndex = i;
      lo4 = outIndex + (txnIndex << 20);
      hi4 = blockId << 8;
      buflo4 = Buffer.alloc(4);
      buflo4.writeUInt32LE(lo4);
      bufhi4 = Buffer.alloc(4);
      bufhi4.writeUInt32LE(hi4);

      buf = Buffer.concat([buflo4, bufhi4]);
      var s1 = bufToHexStr(buf.reverse());
      uocks.push(s1);
    }
    console.log("uocks:", uocks);
    //根据计算出来的uock，查询数据
    searchBlockUTXOByUock(uocks[0]);
  }

  //getUtxo-测试
  var btn_getUtxo = getElement("frame_test", "btn_getUtxo");
  btn_getUtxo.disabled = true;
  btn_getUtxo.onclick = function() {
    if (tee_address) {
      var addr = "&addr=" + tee_address;
      var num = "&num=5";
      var params = addr + num;
      LRS._sendAsyn({ command: "tee_base_getUtxo", msg: params });
    }
  };

  // var getUtxoByAddr = function() {
  //   if (tee_address) {
  //     var addr = "&addr=" + tee_address;
  //     var num = "&num=5";
  //     var params = addr + num;
  //     LRS._sendAsyn({ command: "tee_base_getUtxo", msg: params });
  //   }
  // };

  var searchBlockUTXOByUock = function(uock) {
    var params = "&uock=" + uock;
    LRS._sendAsyn({ command: "tee_base_getBlockUtxo", msg: params });
  };

  LRS._on("blockutxo-asyn-reply", (ev, retMsg) => {
    var uock = retMsg.uock.split("=")[1];
    // console.log("pass uock:", uock);
    var payload = is_checksum(retMsg.data.body);
    if (payload) {
      var utxo = FtUtxoState.fromStream(payload);
      window.utxo = utxo;
      console.log("blockutxo-asyn-reply:", utxo.V);
      // console.log("search_uock_:", search_uock_);
      // var search_height = search_block_.heights.V[0].V;
      // $(".page").removeClass("active");
      // $("#frame_utxo").addClass("active");
      //测试临时用
      // store("frame_blockdetail");
      // var txnContent = getElement("frame_utxo", "txnContent");
      renderUtxo(utxo.V.txns.V, uock, "frame_blockdetail", "txnContent");
      // renderBlockdetail(search_block_);
    } else {
      console.log("bad checksum");
    }
  });

  var searchUTXOSByUock = function(uock) {
    var params = "&uock=" + uock;
    LRS._sendAsyn({ command: "tee_base_getUtxo", msg: params });
  };
  LRS._on("utxo-asyn-reply", (ev, retMsg) => {
    var uock = retMsg.uock.split("=")[1];
    console.log("pass uock:", uock);
    var payload = is_checksum(retMsg.data.body);
    if (payload) {
      var utxo = FtUtxoState.fromStream(payload);
      window.utxo = utxo;
      console.log("utxo-asyn-reply:", utxo.V);
      // console.log("search_uock_:", search_uock_);
      // var search_height = search_block_.heights.V[0].V;
      $(".page").removeClass("active");
      $("#frame_utxo").addClass("active");
      //测试临时用
      // store("frame_blockdetail");
      // var txnContent = getElement("frame_utxo", "txnContent");
      renderUtxo(utxo.V.txns.V, uock, "frame_utxo", "txnContent");
      // renderBlockdetail(search_block_);
    } else {
      console.log("bad checksum");
    }
  });

  // back
  var img_back_utxo = getElement("frame_utxo", "img_back");
  img_back_utxo.onclick = function() {
    var currentFrame = localStorage.getItem("currentFrame");
    var frameName = currentFrame.split("_")[1];
    $("#nav_" + frameName).trigger("click");
  };

  var renderUtxo = function(txns, uock, frname, elename) {
    if (!txns || !txns.constructor == Array) return;
    // var txnContent = getElement("frame_utxo", "txnContent");
    var txnContent = getElement(frname, elename);
    txnContent.innerHTML = ""; //清空子元素
    var parent = document.createElement("div");
    parent.classList.add("row", "mt-3", "b");
    //uock
    var uock = divColmd("uock:" + uock);
    parent.appendChild(uock);
    parent.appendChild(w100());
    for (var i = 0; i < txns.length; i++) {
      var txn = txns[i];
      var txn_in = txn.tx_in;
      //input
      for (var j = 0; j < txn_in.length; j++) {
        var _in = txn_in[j].V;
        parent.appendChild(divColmd("输入 " + (j + 1)));
        parent.appendChild(w100());
        parent.appendChild(divColmd2("index:" + _in.prev_output.V.index));
        parent.appendChild(
          divColmd("prevhash:" + bufToHexStr(_in.prev_output.V.hash))
        );
        parent.appendChild(w100());
      }
      //output
      var txn_out = txn.tx_out;
      for (var k = 0; k < txn_out.length; k++) {
        var _out = txn_out[k].V;
        parent.appendChild(divColmd("输出 " + (k + 1)));
        parent.appendChild(w100());
        parent.appendChild(divColmd2("value:" + _out.value / 100000000));
        var _pk_script = _process(bufToHexStr(_out.pk_script));
        parent.appendChild(
          divColmd("pk_script:" + _pk_script)
        );
        parent.appendChild(w100());
      }
    }
    txnContent.appendChild(parent);
    // var txnContent = getElement("frame_utxo", "txnContent");
    // var parent = document.createElement("div");
    // parent.classList.add("row", "mt-3", "b");
    //uock
    // var uock = divColmd("uock:12000abc123123");
    // parent.appendChild(uock);
    // parent.appendChild(w100());
    // console.log("txn.tx_in:", txn.tx_in);
    // //input
    // console.log("in:", txn.tx_in);
    // for (var i = 0; i < txn.tx_in.length; i++) {
    //   var _in = txn.in[i];
    //   parent.appendChild(divColmd("输入 " + (i + 1)));
    //   parent.appendChild(w100());
    //   parent.appendChild(divColmd2("index:" + _in.index));
    //   parent.appendChild(divColmd("prevhash:" + _in.prevhash));
    //   parent.appendChild(w100());
    // }
    // //output
    // console.log("out:", txn.out);
    // for (var i = 0; i < txn.out.length; i++) {
    //   var _out = txn.out[i];
    //   parent.appendChild(divColmd("输出 " + (i + 1)));
    //   parent.appendChild(w100());
    //   parent.appendChild(divColmd2("value:" + _out.value));
    //   parent.appendChild(divColmd("script:" + _out.script));
    //   parent.appendChild(w100());
    // }

    // txnContent.appendChild(parent);
  };

  var w100 = function() {
    var w100 = document.createElement("div");
    w100.classList.add("w-100");
    return w100;
  };

  var divColmd = function(v) {
    var divcolmd = document.createElement("div");
    divcolmd.classList.add("col-md");
    divcolmd.style.wordBreak = "break-all";
    divcolmd.innerHTML = v;
    return divcolmd;
  };
  var divColmd2 = function(v) {
    var divcolmd = document.createElement("div");
    divcolmd.classList.add("col-md-3", "a");
    divcolmd.innerHTML = v;
    divcolmd.style.wordBreak = "break-all";
    return divcolmd;
  };

  // back
  var img_back_blockdetail = getElement("frame_blockdetail", "img_back");
  img_back_blockdetail.onclick = function() {
    var currentFrame = localStorage.getItem("currentFrame");
    var frameName = currentFrame.split("_")[1];
    $("#nav_" + frameName).trigger("click");
  };

  function store(currentFrame) {
    localStorage.setItem("currentFrame", currentFrame);
  }

  //测试-删除
  // $("#nav_account").trigger("click");
  // searchBlockByHeight(46106);
};

function getElement(frameId, eleId) {
  return document
    .getElementById(frameId)
    .contentWindow.document.getElementById(eleId);
}

function getBlockIndex(_blocks, height) {
  if (!_blocks || !height) return -1;
  for (var i = 0; i < _blocks.heights.V.length; i++) {
    var v = _blocks.heights.V[i].V;
    if (height == v) {
      return i;
    }
  }
  return -1;
}

function bufToHexStr(buf) {
  var s = "";
  for (var i = 0; i < buf.length; i++) {
    var s1 = buf[i];
    var s2 = buf[i].toString(16);
    if (s2.length == 1) {
      s2 = "0" + s2;
    }
    s += s2;
  }
  return s;
}

function timestampToDate(timestamp) {
  var d = new Date(timestamp * 1000);
  var year = d.getFullYear();
  var month = d.getMonth() + 1;
  var date = d.getDate();
  var hour = d.getHours() < 10 ? "0" + d.getHours() : d.getHours();
  var minute = d.getMinutes() < 10 ? "0" + d.getMinutes() : d.getMinutes();
  var second = d.getSeconds() < 10 ? "0" + d.getSeconds() : d.getSeconds();

  return (
    year + "-" + month + "-" + date + " " + hour + ":" + minute + ":" + second
  );
}
