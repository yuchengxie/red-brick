// preload.js

var _ipc = require("electron").ipcRenderer;

window.LRS = {  // define _send/_on for Local Resource Service
  _msgBuff: [],
  _msgIndex: 0,
  
  _on: function() {        // LRS._on(msg_id,callback)
    return _ipc.on.apply(_ipc,arguments);
  },
  
  _sendSync: function() {  // LRS._sendSync(msg)
    var args = ['sys-sync-query'];
    Array.prototype.push.apply(args,arguments);
    return _ipc.sendSync.apply(_ipc,args);
  },
  
  _sendAsyn: function() {  // LRS._sendAsyn(msg)
    var args = ['sys-asyn-query'];
    Array.prototype.push.apply(args,arguments);
    return _ipc.send.apply(_ipc,args);
  },
};

window.addEventListener('load', function(ev) {
  // step 1: prepare app
  LRS._on('reply-query', function(event, retMsg, servName, msgIdx) {
    LRS._msgBuff.push([servName,msgIdx,(new Date()).valueOf(),retMsg]);
  });
  LRS._sendSync({command:'prepareApp'});  // prepareApp should be first LRS request
  
/* LRS._on('income-query', function(event, msg, servName, msgIdx, webId) {
    var retMsg = {error:'', desc:'OK'};   // do some caculation
    LRS._sendAsyn(retMsg,servName,msgIdx,webId);
  });
  
  LRS._on('sys-asyn-reply', function(event, retMsg) {
    console.log(retMsg);
  });  */
  
  // step 2: regist query() and findReply()
  LRS.query = function(servName, msg, callback, timeout) {
    var msgIdx = LRS._msgIndex + 1;
    LRS._msgIndex = msgIdx;
    LRS._sendAsyn(msg,servName,msgIdx,0,true); // isQuery = true
    
    if (typeof(callback) != 'function')
      return msgIdx;
    
    var till = (new Date()).valueOf() + (timeout || 5000); // default within 5 seconds
    var taskId = setInterval( function() {
      var now = (new Date()).valueOf();
      if (now > till) {
        clearInterval(taskId);
        return callback(null);
      }
      
      var i = LRS._msgBuff.length-1;
      while (i >= 0) {
        var item = LRS._msgBuff[i];
        if (item) {  // item is [servName,msgIdx,replyTime,replyBody]
          if (item[1] === msgIdx) {
            LRS._msgBuff.splice(i,1);
            clearInterval(taskId);
            return callback(item[3]);           // success return
          }
          if ((now - (item[2] || 0)) > 1800000) // if more than 30 minutes, remove item
            LRS._msgBuff.splice(i,1);
        }
        else LRS._msgBuff.splice(i,1);
        i -= 1;
      }
    }, 500);
  };
  
  LRS.findReply = function(msgIdx) {
    var i = LRS._msgBuff.length-1;
    while (i >= 0) {
      var item = LRS._msgBuff[i];
      if (item) {
        if (item[1] === msgIdx) {
          LRS._msgBuff.splice(i,1);
          return item[3];  // success
        }
        if ((now - (item[2] || 0)) > 1800000)
          LRS._msgBuff.splice(i,1);
      }
      else LRS._msgBuff.splice(i,1);
      i -= 1;
    }
    
    return null;  // nothing found
  };
  
  // step 3: setup toolbar
  if (LRS._noToolbar) return;
  
  var toolbar = document.createElement('DIV');
  toolbar.setAttribute('id','lrs-bar');
  toolbar.style =
  "display:block; position:absolute; z-index:16777215; left:0px; top:0px;width:100%; height:25px;background:#fff; font-size:14px;box-shadow:0px 1px 10px #888"; 
  document.body.appendChild(toolbar);

  this.document.body.style.marginTop='30px';
  
  var pNode = document.createElement('P');
  pNode.style = "margin:0px 8px;padding:0px;line-height:25px";
  pNode.innerHTML =
    '<a id="close-page" style="text-decoration:none;color:#444;font-size:14px;font-weight:200" href="javascript:void(0)"> <img src="../static/nav_back.png" style="height:13px;width:15px;margin-right:2px"/>返回  </a>';
  toolbar.appendChild(pNode);
  
  document.querySelector('#close-page').onclick = function(ev) {
    setTimeout( function() {
      window.close();
    },100);
  };
},false);
