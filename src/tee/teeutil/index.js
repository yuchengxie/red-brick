const smartcard = require("smartcard");
const dns = require("dns");
const dgram = require("dgram");
const hexify = require("hexify");
const bitcoinjs = require("bitcoinjs-lib");
const utilkey = require("./utilkey");
const bh = require("./bufferhelp");
const message = require("./message");
const gFormat = require("./format");
const struct = require("./struct");
const CommandApdu = smartcard.CommandApdu;
const Devices = smartcard.Devices;
const Iso7816Application = smartcard.Iso7816Application;

var bindMsg = message.bindMsg;
var mine_hostname = "user1-node.nb-chain.net";
var mine_port = 30302;
var WEB_SERVER_ADDR = "http://user1-node.nb-chain.net";

const cmd = {
  selectapp: "00A404000ED196300077130010000000020101",
  pubAddr: "80220200020000",
  pubkey: "8022000000",
  pubkeyHash: "8022010000"
};

function PseudoWallet(pubKey, pubHash, pubAddr, vcn = 0) {
  this.pub_key = utilkey.compress_public_key(pubKey);
  this.pub_hash = pubHash;
  this.pub_addr = pubAddr;
  var b_pub_hash = bh.hexStrToBuffer(this.pub_hash);
  this._vcn = (b_pub_hash[30] << 8) + b_pub_hash[31];
  this.coin_type = 0x00; // fixed to '00'
  // this.pin_code = '000000';
  pseudoWallet = this;
}

function PoetClient(miners, link_no, coin, name = "") {
  this.POET_POOL_HEARTBEAT = 5 * 1000; // heartbeat every 5 seconds, can be 5 sec ~ 50 min (3000 sec)
  this.PEER_ADDR_ = []; // ('192.168.1.103',30303)
  this._active = false;
  this.miners = miners;
  this._name = name + ">";
  this._link_no = link_no;
  this._coin = coin;
  this._last_peer_addr = null;
  this._recv_buffer = "";
  this._last_rx_time = 0;
  this._last_pong_time = 0;
  this._reject_count = 0;
  this._last_taskid = 0;
  this._time_taskid = 0;
  this._compete_src = [];
  this.socket = dgram.createSocket("udp4");
  this.set_peer = set_peer;
}

//负责发送数据包
PoetClient.prototype._start = function() {
  this._active = true;
  _heartTimer = setInterval(() => {
    if (this._active) {
      try {
        this.heartbeat();
        // startMinerEvent.sender.send("replyStartMiner", "tee mining...");
      } catch (error) {
        console.log("heartbeat error:", error);
      }
    }
  }, this.POET_POOL_HEARTBEAT);
};

function set_peer(peer_addr) {
  var s = this.PEER_ADDR_;
  var ip = peer_addr[0],
    port = peer_addr[1];
  var _isIP = isIP(ip);
  if (_isIP) {
    //todo
    // this.PEER_ADDR_=[]
  } else {
    var ip = "";
    // dns.lookup(hostname, (err, ip_addr, family) => {
    //     if (err) { console.log('invalid hostname'); return; }
    //     console.log('ip_addr:', ip_addr);
    //     this.PEER_ADDR_ = [ip_addr, port];
    //     this._last_peer_addr = this.PEER_ADDR_;
    // })
  }
}

PoetClient.prototype.heartbeat = function() {
  if (this.PEER_ADDR_.length == 0) return;
  var now = timest();
  // console.log(">>> now:", now);
  // console.log(">>> this._time_taskid:", this._time_taskid);
  if (now - this._time_taskid > 1800) {
    this._last_taskid = 0;
  }
  if (this._reject_count > 120) {
    this._reject_count = 0;
    this._last_taskid = 0;
  }
  if (now - this._last_rx_time > 1800 && this._last_peer_addr) {
    try {
      var sock = dgram.createSocket("udp4");
      this.socket.close();
      this.socket = sock;
      this.set_peer(this._last_peer_addr);
    } catch (error) {
      console.log("renew socket err:", error);
    }
  }

  var compete_src = this._compete_src;
  if (compete_src.length == 6) {
    var miners = this.miners;
    var sn = compete_src[0],
      block_hash = compete_src[1],
      bits = compete_src[2],
      txn_num = compete_src[3],
      link_no = compete_src[4],
      hi = compete_src[5];
    var succ_miner = "",
      succ_sig = "";
    for (var i in miners) {
      miners[i]
        .check_elapsed(block_hash, bits, txn_num, now, "00", hi)
        .then(sig => {
          console.log(">>> sig:", sig);
          if (sig) {
            succ_miner = miners[i];
            succ_sig = sig;
          }
          if (succ_miner) {
            this._compete_src = [];
            var msg = new PoetResult(
              link_no,
              sn,
              succ_miner.pub_keyhash,
              bh.bufToStr(succ_sig)
            );
            var payload = dftPoetResult(msg);
            var command = "poetresult";
            var msg_buf = message.g_binary(payload, command);
            this.send_message(msg_buf, this.PEER_ADDR_);
            console.log(">>>>>>>>>>>> success mining <<<<<<<<<<<<<<");
            console.log(
              `${this._name} success mining: link=${link_no}, height=${hi}, sn=${sn}, miner=${succ_miner.pub_keyhash}'`
            );
            sleep(this.POET_POOL_HEARTBEAT);
          }
        });
    }
  }

  if (now >= this._last_rx_time + this.POET_POOL_HEARTBEAT / 1000) {
    var msg = new GetPoetTask(
      this._link_no,
      this._last_taskid,
      this._time_taskid
    );
    var buf = new Buffer(0);
    var _bindMsg = new bindMsg(gFormat.poettask);
    var b = _bindMsg.binary(msg, buf);
    var command = "poettask";
    var msg_buf = message.g_binary(b, command);
    this.send_message(msg_buf, this.PEER_ADDR_);
  }
};

PoetClient.prototype.send_message = function(msg, peer_addr) {
  var that = this;
  //msg->binary
  this.socket.send(
    msg,
    0,
    msg.length,
    this.PEER_ADDR_[1],
    this.PEER_ADDR_[0],
    function(err, bytes) {
      if (err) {
        console.log("send err");
      } else {
        console.log(
          ">>> send data:",
          bh.bufToStr(msg),
          bh.bufToStr(msg).length
        );
      }
    }
  );

  // console.log("this.socket:", this.socket);
  this.socket.on("message", function(msg, rinfo) {
    console.log(">>> res data", bh.bufToStr(msg), bh.bufToStr(msg).length);
    // that._recv_buffer = msg;
    // that._last_rx_time = timest();
    // that.command = message.getCommand(msg);
    // addr = rinfo;

    // if (that._recv_buffer) {
    //   var len = first_msg_len(that._recv_buffer);
    //   if (len && len <= that._recv_buffer.length) {
    //     var data = that._recv_buffer.slice(0);
    //     try {
    //       var payload = message.g_parse(data);
    //       that._recv_buffer = that._recv_buffer.slice(len);
    //       len = first_msg_len(that._recv_buffer);
    //       that._msg_ = payload;
    //       try {
    //         that.handle_message(payload, that);
    //       } catch (error) {
    //         // console.log('handle_message err');
    //       }
    //     } catch (error) {
    //       console.log("handle err:", error);
    //     }
    //   }
    // }
  });
};

PoetClient.prototype.handle_message = function(payload, that) {
  // var sCmd = message.getCommand(payload);
  var sCmd = that.command;
  console.log(">>> sCmd:", sCmd);
  if (sCmd == "poetinfo") {
    var _bindMsg = new bindMsg(gFormat.poetinfo);
    var msg = _bindMsg.parse(payload, 0)[1];
    // console.log('>>> sCmd:%s\n>>> msg:%o',sCmd,msg);

    // console.log('>>> sCmd:%s', sCmd);
    if (msg.curr_id > that._last_taskid) {
      // this._compete_src = ;
      that._compete_src = [
        msg.curr_id,
        msg.block_hash,
        msg.bits,
        msg.txn_num,
        msg.link_no,
        msg.height
      ];
      that._last_taskid = msg.curr_id;
      that._time_taskid = that._last_rx_time;
      that._reject_count = 0;
      console.log(
        ">>> (%s) receive a task: link=%d,height=%d,sn=%d",
        that._name,
        msg.link_no,
        msg.height,
        msg.curr_id
      );
    }
  } else if ((sCmd = "poetreject")) {
    //状态未更新ok
    var _bindMsg = new bindMsg(gFormat.poetreject);
    var msg = _bindMsg.parse(payload, 0)[1];
    if (msg.timestamp == that._time_taskid) {
      var b = bh.hexStrToBuffer(msg.reason);
      var reason = b.toString("latin1");
      // console.log('>>> sCmd:%s %s\n>>> msg:%o',sCmd,reason,msg);
      console.log(">>> sCmd:%s %s", sCmd, reason);
      //missed task old
      //invalid current task not exist
      if (reason == "missed" && that._last_taskid == msg.sequence) {
      } else {
        //invalid
        that._compete_src = [];
        that._reject_count += 1;
      }
    }
    that._last_pong_time = that._last_rx_time;
  } else if (sCmd == "pong") {
    console.log(">>> sCmd:%s\n>>> msg:%o", sCmd, msg);
    that._last_pong_time = that._last_rx_time;
  }
};

function GetPoetTask(link_no, curr_id, timestamp) {
  this.link_no = link_no;
  this.curr_id = curr_id;
  this.timestamp = timestamp;
}

function PoetResult(link_no, curr_id, miner, sig_tee) {
  this.link_no = link_no;
  this.curr_id = curr_id;
  this.miner = miner;
  this.sig_tee = sig_tee;
}

function isIP(ip) {
  var re = /^(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])$/;
  return re.test(ip);
}

function timest() {
  var tmp = Date.parse(new Date()).toString();
  tmp = tmp.substr(0, 10);
  return parseInt(tmp);
}

function first_msg_len(data) {
  if (data == undefined) return 0;
  if (data.length < 20) {
    // not enough to determine payload size yet
    return 0;
  }
  return data.length;
  //todo
  // return struct.unpack('<I', data.slic)[0] + 24
}

function dftPoetResult(msg) {
  var a = new Buffer(0);
  var b;

  for (var name in msg) {
    if (name === "link_no") {
      dftNumberI(msg["link_no"]); //4
    } else if (name === "curr_id") {
      dftNumberI(msg["curr_id"]); //4
    } else if (name === "miner") {
      dftBytes32(msg["miner"]);
    } else if (name === "sig_tee") {
      dftVarString(msg["sig_tee"]); //4
    }
  }

  function dftBytes32(hash) {
    // var b = toBuffer(hash);
    // var b=bh.hexStrToBuffer(hash);
    var b = new Buffer(hash, "hex");
    a = Buffer.concat([a, b]);
  }

  function dftNumberI(n) {
    b = new Buffer(4);
    //n转16进制buffer
    b.writeUInt32LE(n);
    a = Buffer.concat([a, b]);
  }

  function dftVarString(str) {
    var b = bh.hexStrToBuffer(str);
    var len = b.length;

    if (b.length < 0xfd) {
      dftNumber1(len); //1
      a = Buffer.concat([a, b]);
    }
  }

  function dftNumber1(n) {
    b = new Buffer(1);
    b.writeUInt8(n);
    a = Buffer.concat([a, b]);
  }

  return a;
}

/**
 * tee card
 */
const devices = new Devices();
var application;
var cardstate;
var pseudoWallet;

devices.on("device-activated", event => {
  const currentDevices = event.devices;
  let device = event.device;
  console.log(`Device '${device}' activated, devices: ${currentDevices}`);
  for (let prop in currentDevices) {
    console.log("Devices: " + currentDevices[prop]);
  }

  device.on("card-inserted", event => {
    cardstate = true;
    let card = event.card;
    console.log("card-inserted card:", card.atr);
    application = new Iso7816Application(card);

    console.log(`Card '${card.getAtr()}' inserted into '${event.device}'`);

    card.on("command-issued", event => {
      console.log(`Command '${event.command}' issued to '${event.card}' `);
    });

    card.on("response-received", event => {
      console.log(
        `Response '${event.response}' received from '${event.card}' in response to '${event.command}'`
      );
    });

    //test select app
    transmit(cmd.selectapp).then(res => {
      if (res.data == "9000") {
        // console.log("选择应用成功");
        getWallet();
      }
    });
  });

  device.on("card-removed", event => {
    cardstate = false;
    console.log(`Card removed from '${event.name}' `);
  });
});

devices.on("device-deactivated", event => {
  console.log(
    `Device '${event.device}' deactivated, devices: [${event.devices}]`
  );
});

function transmit(cmd) {
  if (!application) return;
  return application.issueCommand(str_commandApdu(cmd));
}

function getState() {
  return cardstate;
}

async function getWallet() {
  var pubkey = await getPubkey();
  var pubkeyHash = await getPubkeyHash();
  var pubAddr = await getPubAddr();
  pseudoWallet = new PseudoWallet(pubkey, pubkeyHash, pubAddr);
  console.log("getWallet() pseudoWallet:", pseudoWallet);
  return pseudoWallet;
}

function getPubkey() {
  return transmit(cmd.pubkey).then(r => {
    return r.data.slice(0, r.data.length - 4);
  });
}

function getPubkeyHash() {
  return transmit(cmd.pubkeyHash).then(r => {
    return r.data.slice(0, r.data.length - 4);
  });
}

function getPubAddr() {
  return transmit(cmd.pubAddr).then(r => {
    var pubAddr = r.data.slice(0, r.data.length - 4);
    pubAddr = hexStrToBuffer(pubAddr).toString("latin1");
    return pubAddr;
  });
}

function sign(pin_code, str) {
  if (!cardstate) return;
  console.log("str:", str);
  console.log("pin_code:", pin_code);
  var payload = hexStrToBuffer(str);
  console.log("payload:", payload);
  var p = bitcoinjs.crypto.sha256(payload);
  var pinLen = parseInt(pin_code.length / 2);
  var n1 = pinLen << 5;
  var s1 = n1.toString(16);
  if ((s1.length & 0x01) == 1) {
    s1 += "0" + s1;
  }
  var s2 = (pinLen + 32).toString(16);
  if ((s2.length & 0x01) == 0x01) {
    s2 += "0" + s2;
  }
  var sCmd = "802100" + s1 + s2 + pin_code + bufToStr(p);
  return transmit(sCmd);
}

function startMiner() {
  console.log("start miner...");
  dns.lookup(mine_hostname, (err, ip_addr, family) => {
    if (err) {
      console.log("invalid hostname");
      return;
    }
    console.log("dns ip_addr:", ip_addr);
    var tee = new TeeMiner(pseudoWallet.pub_hash);
    gPoetClient = new PoetClient([tee], 0, "", "clinet1");
    gPoetClient.PEER_ADDR_ = [ip_addr, mine_port];
    gPoetClient._last_peer_addr = gPoetClient.PEER_ADDR_;
    gPoetClient._start();
    gPoetClient.set_peer(gPoetClient.PEER_ADDR_);
  });
}

function str_commandApdu(s) {
  return new CommandApdu({ bytes: hexify.toByteArray(s) });
}

function bufToStr(buf) {
  var s = "";
  buf.forEach(ele => {
    var tmp = ele.toString(16);
    if (tmp.length === 1) {
      s += "0" + tmp;
    } else {
      s += tmp;
    }
  });
  return s;
}

function hexStrToBuffer(hex) {
  if (hex == "") return new Buffer("");
  if (hex.length % 2 != 0) {
    hex = "0" + hex;
  }
  var typedArray = new Uint8Array(
    hex.match(/[\da-f]{2}/gi).map(function(h) {
      return parseInt(h, 16);
    })
  );
  var buffer = typedArray.buffer;
  buffer = Buffer.from(buffer);
  return buffer;
}

function TeeMiner(pubHash) {
  this.SUCC_BLOCKS_MAX = 256;
  this.succ_blocks = [];
  this.pub_keyhash = pubHash;
}

TeeMiner.prototype.check_elapsed = function(
  block_hash,
  bits,
  txn_num,
  curr_tm = "",
  sig_flag = "00",
  hi = 0
) {
  if (!application) return;
  if (!curr_tm) curr_tm = timest();
  try {
    var sCmd = "8023" + sig_flag + "00";
    sCmd = bh.hexStrToBuffer(sCmd);
    var sBlockInfo = Buffer.concat([
      bh.hexStrToBuffer(block_hash),
      struct.pack("<II", [bits, txn_num])
    ]);
    var sData = Buffer.concat([
      struct.pack("<IB", [curr_tm, sBlockInfo.length]),
      sBlockInfo
    ]);
    sCmd = Buffer.concat([sCmd, struct.pack("<B", [sData.length]), sData]);
    sCmd = bh.bufToStr(sCmd);
    return transmit(sCmd).then(res => {
      if (res.data.length > 128) {
        this.succ_blocks.push([curr_tm, hi]);
        if (this.succ_blocks.length > this.SUCC_BLOCKS_MAX) {
          this.succ_blocks.splice(this.SUCC_BLOCKS_MAX, 1);
        }
        return Buffer.concat([
          bh.hexStrToBuffer(res.buffer),
          bh.hexStrToBuffer(sig_flag)
        ]);
      } else {
        // return bh.hexStrToBuffer('00');
        return "";
      }
    });
  } catch (err) {
    console.log(err);
  }
};

module.exports = {
  transmit: transmit,
  sign: sign,
  cmd: cmd,
  getState: getState,
  getWallet: getWallet,
  startMiner: startMiner,
  getPubAddr: getPubAddr
};

// getWallet();
// setTimeout(() => {
//   startMiner();
// }, 1000);
