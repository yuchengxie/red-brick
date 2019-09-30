// var txck = Buffer.from([0, 0, 0, 224, 19, 0, 0, 0]);
// var txck = Buffer.from([1, 0, 16, 0, 0, 125, 180]);
var txck = Buffer.from([0, 0, 176, 227, 19, 0, 0, 0]);
console.log(txck);

var UInt32_a = txck.readUInt32LE(0);
console.log("UInt32_a:", UInt32_a.toString(16));
var UInt32_b = txck.readUInt32LE(4);
console.log('UInt32_b:',UInt32_b.toString(16));

var blockId = (UInt32_b << 12) | (UInt32_a >>> 20);
console.log('blockId:',blockId);
outIndex = 0;//固定
// // txnIndex = 0, 1, 2 ...
txnIndex = 0;//0,1,2 分别对应交易的数量

lo4 = outIndex + (txnIndex << 20);
// hi4 = blockId << 4;
hi4 = blockId << 8;
console.log("lo4:", lo4);
console.log("hi4:", hi4);
buflo4 = Buffer.alloc(4);
buflo4.writeUInt32LE(lo4);
console.log('buflo4:',buflo4);
bufhi4 = Buffer.alloc(4);
bufhi4.writeUInt32LE(hi4);
console.log('bufhi4:',bufhi4);

buf = Buffer.concat([buflo4, bufhi4]);
console.log("buf:", buf);
var s1=bufToHexStr(buf.reverse());
console.log("s1:", s1);

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

// http://raw0.nb-chain.net/txn/state/uock?uock=013e3b0000000000
// http://raw0.nb-chain.net/txn/state/uock?addr=13U4DyvTXgFy9TfcS3RaRt9cecKd1WAXk6BPnHC6akU8y7YWafgdVPR
