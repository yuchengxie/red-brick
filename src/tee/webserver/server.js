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
  ret = { command: msg.command, data: "", error: "" };
  // url='http://raw0.nb-chain.net/txn/state/uock?addr=11144Q9KHcPvhTNNA8SncVJSXCXmN3DeqqEPeppAR2kKxjDHdmGHhX&num=0&uock=00e9660000100001';
  // url='http://raw0.nb-chain.net/txn/state/uock?addr=13U4DyvTXgFy9TfcS3RaRt9cecKd1WAXk6BPnHC6akU8y7YWafgdVPR&num=0&uock=01001000007db400';
  // url='http://raw0.nb-chain.net/txn/state/uock?addr=13U4DyvTXgFy9TfcS3RaRt9cecKd1WAXk6BPnHC6akU8y7YWafgdVPR&num=0&uock=00b47d0000100001';
  // 0013e3b000000000
  // url='http://raw0.nb-chain.net/txn/state/uock\?uock\=00b47d0000000000';
  //source: 01001000007db400
  // 00b47d0000100001
  // url='http://raw0.nb-chain.net/txn/state/uock?uock=013e3b0000000000'
  // url='http://raw0.nb-chain.net/txn/state/uock?addr=13U4DyvTXgFy9TfcS3RaRt9cecKd1WAXk6BPnHC6akU8y7YWafgdVPR&num=5'
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
      console.log('utxo res:',res);
      ev.sender.send("utxo-asyn-reply", ret);
    }
  );
}

module.exports = {
  getInfo: getInfo,
  getBlocks: getBlocks,
  getBlock: getBlock,
  getUtxo: getUtxo
};
