// tee_io.js

// var _base = function(ev, msg) {  // msg.command is 'tee_base_account' ...
// /* var data = msg.data ? msg.data : tee.cmd.selectapp;
//   transmit(data).then(
//     res => {
//       ret.data = res.data;
//       ev.sender.send("tee-asyn-reply", ret);
//     },
//     err => {
//       ret.error = err;
//       ev.sender.send("tee-asyn-reply", ret);
//     }
//   ); */
//   return undefined;
// };

// const tee_io_imp = require("./tee_io_imp");

var _base = function(ev, msg) {
  return undefined;
};

var _pay = function(ev, msg) {
  // msg.command is 'tee_pay_getpass' ...
  return undefined;
};

var _miner = function(ev, msg) {
  // msg.command is 'tee_miner_start' ...
  return undefined;
};

var _admin = function(ev, msg) {
  // msg.command is 'tee_admin_getpass' ...
  return undefined;
};

module.exports = {
  do_base: function(ev, msg) {
    return _base(ev, msg);
  },

  do_pay: function(ev, msg) {
    return _pay(ev, msg);
  },

  do_miner: function(ev, msg) {
    return _miner(ev, msg);
  },

  do_admin: function(ev, msg) {
    return _admin(ev, msg);
  },
  
  setup: function(callbacks) {
    _base = callbacks[0];
    _pay = callbacks[1];
  }
  // setup: function(callbacks) {
  //   _base = callbacks[0];
  //   _pay = callbacks[1];
  //   // _miner = callbacks[2];
  //   // _admin = callbacks[3];
  // }
};
