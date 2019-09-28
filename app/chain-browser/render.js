window.onload = function() {
  //公共变量
  var blocks_;
  var block_;
  var search_block_;
  var tee_address = "";
  var currentFrame =
    this.localStorage.getItem("currentFrame") || "frame_account";

  $(".page").removeClass("active");
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

  // $("#nav_block").trigger("click");

  $("#input_search").css("color", "#f60");
  $("#input_search").css("font-size", "0.95rem");

  LRS._sendAsyn({ command: "tee_base_pubAddr" });
  //getInfo
  let btn_getInfo = getElement("frame_test", "btn_getInfo");
  btn_getInfo.onclick = function() {
    if (tee_address) {
      LRS._sendAsyn({ command: "tee_base_getInfo", msg: tee_address });
    } else {
      alert("未查询到tee地址");
    }
  };

  LRS._on("pubAddr-asyn-reply", function(event, retMsg) {
    console.log("pubAddr-asyn-reply:", retMsg);
    tee_address = retMsg.data;
    if (tee_address) {
      $("#input_search").val(tee_address);
    }
  });

  LRS._on("info-asyn-reply", function(event, retMsg) {
    var payload = is_checksum(retMsg.data.body);
    if (payload) {
      var info = FtAccState.fromStream(payload);
      console.log("info-asyn-reply:", info.V);
    } else {
      console.log("bad checksum");
    }
  });

  //获取blocks数据
  var getDefaultBlocks = function() {
    var h = [-1, -2, -3, -4, -5];
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
      // window.blocks_ = blocks_;
      renderBlocks(blocks_);
    } else {
      console.log("bad checksum");
    }
  });

  var renderBlocks = function(data) {
    console.log("ready render");
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
      divHeightspan.onclick = clickHeightForBlock;
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
    console.log("content:", content);
  };

  var clickHeightForBlock = function(e) {
    $(".page").removeClass("active");
    $("#frame_blockdetail").addClass("active");
    renderBlockdetailDefault(e.target.innerHTML);
    //测试使用，正式环境，删除
    // store("frame_blockdetail");
  };

  getDefaultBlocks();

  //btn_search
  btn_search.onclick = function() {
    var height_search = $("#input_search").val();
    if (!/^\d+$/.test(height_search)) return;
    console.log("height_search:", height_search);
    // renderBlockdetail(height_search);
    searchBlockByHeight(height_search);
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
      var search_height = search_block_.heights.V[0].V;
      // window.block_ = block_;
      console.log("block-asyn-reply height", search_block_.heights.V[0].V);
      console.log("block-asyn-reply header", search_block_.headers.V[0].V);
      $(".page").removeClass("active");
      $("#frame_blockdetail").addClass("active");
      renderBlockdetailDefault(search_height);
      // fillValue(block_);
      // renderBlocks(blocks_);
      // renderBlockdetail();
    } else {
      console.log("bad checksum");
    }
    //数据获取

    // renderBlockdetail(height_search);
    // $(".page").removeClass("active");
    // $("#frame_blockdetail").addClass("active");
    // // // //测试使用，正式环境，删除
    // store("frame_blockdetail");
  });

  //frame_blockdetail
  function renderBlockdetailDefault(height) {
    var hi = getElement("frame_blockdetail", "hi");
    hi.innerHTML = "#" + height;
    var index = getBlockIndex(blocks_, height);
    if (index > -1) {
      console.log("index:", index);
      block_ = blocks_.headers.V[index].V;
    } else {
      block_ = search_block_.headers.V[0].V;
    }
    fillValue(block_);
  }

  var fillValue = function(header) {
    if (!header) return;
    getElement("frame_blockdetail", "version").innerHTML = header.version;
    getElement("frame_blockdetail", "link_no").innerHTML = header.link_no;
    console.log(
      "header.prev_block.toString():",
      bufToHexStr(header.prev_block)
    );
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
  };

  //getUtxo
  var btn_getUtxo = getElement("frame_test", "btn_getUtxo");
  btn_getUtxo.onclick = function() {
    if (tee_address) {
      var addr = "&addr=" + tee_address;
      var num = "&num=5";
      var params = addr + num;
      LRS._sendAsyn({ command: "tee_base_getUtxo", msg: params });
    }
  };
  LRS._on("utxo-asyn-reply", (ev, retMsg) => {
    var payload = is_checksum(retMsg.data.body);
    if (payload) {
      var utxo = FtUtxoState.fromStream(payload);
      window.utxo = utxo;
      console.log("info-asyn-reply:", utxo.V);
    } else {
      console.log("bad checksum");
    }
  });

  /**
   * block
   */
  //动态UI

  // var heightEle = getElement("frame_block", "height1");
  // heightEle.onclick = function(e) {
  //   console.log(e.target.innerHTML);
  //   var hi = e.target.innerHTML;
  //   $(".page").removeClass("active");
  //   $("#frame_blockdetail").addClass("active");
  //   renderBlockdetail(hi);
  //   // $("#input_search").val(parmsHeight);
  //   // top.document.getElementById("input_search").innerHTML="11";
  //   //todo 动态渲染blockdetai页面
  //   // var doc=$("#frame_blockdetail").contentWindow.document;
  //   // $(doc).append('<div class="append">通过append方法添加的元素</div>');
  // };

  // back
  var img_back = getElement("frame_blockdetail", "img_back");
  img_back.onclick = function() {
    $(".page").removeClass("active");
    $("#frame_block").addClass("active");
  };

  function store(currentFrame) {
    localStorage.setItem("currentFrame", currentFrame);
  }
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
  var d = new Date(timestamp);
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
