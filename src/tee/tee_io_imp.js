import TeeIO from "./tee_io";
import tee from "./teeutil/index";
import server from "./webserver/server";

var WEB_SERVER_ADDR = "http://user1-node.nb-chain.net";
// var WEB_SERVER_ADDR = "http://raw0.nb-chain.net";

var _base = function(ev, msg) {
  if (!tee.getState()) return;
  var subcmd = msg.command.split("_")[2];
  console.log("subcmd:", subcmd);
  var ret = { command: msg.command, data: "", error: "" };

  if (subcmd == "selectApp") {
    tee.transmit(tee.cmd.selectapp).then(
      res => {
        ret.data = res.data;
        console.log("selectApp ret:", ret);
        ev.sender.send("selectapp-asyn-reply", ret);
      },
      err => {
        ret.error = err;
        ev.sender.send("selectapp-asyn-reply", ret);
      }
    );
  } else if (subcmd == "pubAddr") {
    tee.getPubAddr().then(
      res => {
        ret.data = res;
        console.log("pubAddr ret:", ret);
        ev.sender.send("pubAddr-asyn-reply", ret);
      },
      err => {
        ret.error = err;
        ev.sender.send("pubAddr-asyn-reply", ret);
      }
    );
  } else if (subcmd == "getInfo") {
    console.log("getInfo msg:", msg);
    var pubAddr = msg.msg;
    //http网络请求
    var url = WEB_SERVER_ADDR + "/txn/state/account?" + msg.msg;
    
    server.getInfo(ev, msg, url);
  } else if (subcmd == "getBlocks") {
    var url = WEB_SERVER_ADDR + "/txn/state/block?" + msg.msg;
    console.log("blocks url:", url);
    server.getBlocks(ev, msg, url);
  } else if (subcmd == "getBlock") {
    var url = WEB_SERVER_ADDR + "/txn/state/block?" + msg.msg;
    console.log("block url:", url);
    server.getBlock(ev, msg, url);
  } else if (subcmd == "getUtxo") {
    var url = WEB_SERVER_ADDR + "/txn/state/uock?" + msg.msg;
    server.getUtxo(ev, msg, url);
  }
};

var _pay = function(ev, msg) {
  //todo
  console.log("_pay");
};

TeeIO.setup([_base, _pay]);

// var _base = function(ev, msg) {
// msg.command is 'tee_base_account' ...
/* var data = msg.data ? msg.data : tee.cmd.selectapp;
  transmit(data).then(
    res => {
      ret.data = res.data;
      ev.sender.send("tee-asyn-reply", ret);
    },
    err => {
      ret.error = err;
      ev.sender.send("tee-asyn-reply", ret);
    }
  ); */
//   return undefined;
// };
