const dhttp = require("dhttp");

function getInfo(ev, msg, url) {
  ret = { command: msg.command, data: "", error: "" };
  dhttp(
    {
      url: url,
      method: "GET"
    },
    function(err, res) {
      if (err) {
        ret.error = err;
        ev.sender.send("info-asyn-reply", ret);
        return;
      }
      ret.data = res;
      ev.sender.send("info-asyn-reply", ret);
    }
  );
}

function getBlock(ev, msg, url) {
  ret = { command: msg.command, data: "", error: "" };
  dhttp(
    {
      url: url,
      method: "GET"
    },
    function(err, res) {
      if (err) {
        ret.error = err;
        ev.sender.send("block-asyn-reply", ret);
        return;
      }
      ret.data = res;
      ev.sender.send("block-asyn-reply", ret);
    }
  );
}

function getBlocks(ev, msg, url) {
  ret = { command: msg.command, data: "", error: "" };
  dhttp(
    {
      url: url,
      method: "GET"
    },
    function(err, res) {
      if (err) {
        ret.error = err;
        ev.sender.send("blocks-asyn-reply", ret);
        return;
      }
      ret.data = res;
      ev.sender.send("blocks-asyn-reply", ret);
    }
  );
}

function getUtxo(ev, msg, url) {
  // console.log('msg:',msg.split('=')[1]);
  ret = { command: msg.command, uock: msg.msg, data: "", error: "" };
  console.log("utxo url:", url);
  dhttp(
    {
      url: url,
      method: "GET"
    },
    function(err, res) {
      if (err) {
        ret.error = err;
        ev.sender.send("utxo-asyn-reply", ret);
        return;
      }
      ret.data = res;
      console.log("utxo res:", res);
      ev.sender.send("utxo-asyn-reply", ret);
    }
  );
}
function getBlockUtxo(ev, msg, url) {
  // console.log('msg:',msg.split('=')[1]);
  ret = { command: msg.command, uock: msg.msg, data: "", error: "" };
  console.log("utxo url:", url);
  dhttp(
    {
      url: url,
      method: "GET"
    },
    function(err, res) {
      if (err) {
        ret.error = err;
        ev.sender.send("blockutxo-asyn-reply", ret);
        return;
      }
      ret.data = res;
      console.log("utxo res:", res);
      ev.sender.send("blockutxo-asyn-reply", ret);
    }
  );
}

module.exports = {
  getInfo: getInfo,
  getBlocks: getBlocks,
  getBlock: getBlock,
  getUtxo: getUtxo,
  getBlockUtxo:getBlockUtxo,
};
