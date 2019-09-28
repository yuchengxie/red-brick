var Buffer = require("safe-buffer").Buffer;
var createHash = require("create-hash");

function isArray(value) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.length === "number" &&
    typeof value.splice === "function" &&
    !value.propertyIsEnumerable("length")
  );
}

var _arraySlice = Array.prototype.slice;

var _FtTypes = {}; // { typeName:typeFunc }

function _getType(childType) {
  if (typeof childType == "function") return childType;
  else return _FtTypes[childType];
}

function NbcClass(name, statics, methods, registIt) {
  methods = methods || {}; // methods can be undefined

  var fn = function(value, stream) {
    this._value = value;
    this._stream = stream;
    this.init();
  };
  fn.name = name; // fn.name can be undefined
  fn.from = from_;
  for (var item in statics) {
    // statics must have { toBinary,fromStream }
    fn[item] = statics[item];
  }

  var methods2 = {
    toString: toString_,
    init: init_,
    typeOf: typeOf_,
    binary: binary_
  };
  for (var item in methods) {
    // copy every method
    methods2[item] = methods[item];
  }
  fn.prototype = methods2;

  if (registIt && name) _FtTypes[name] = fn;
  return fn;

  function from_(v) {
    var info = fn.toBinary(v);
    return new fn(info[1], info[0]);
  }

  function toString_() {
    var v = this._value;
    if (isArray(v)) return fn.name + "[" + v.length + "]";
    // fn.name maybe undefined
    else return v + "";
  }

  function init_() {
    Object.defineProperty(this, "V", {
      enumerable: false,
      configurable: true,
      get: function() {
        return this._value;
      } // no 'set'
    });
    Object.defineProperty(this, "S", {
      enumerable: false,
      configurable: true,
      get: function() {
        return this._stream;
      } // no 'set'
    });
  }

  function typeOf_() {
    return fn;
  }

  function binary_() {
    var info = fn.toBinary(this._value),
      stream = info[0];
    this._value = info[1]; // maybe changed
    this._stream = stream;
    return stream;
  }
}

//----- FtNum_xxx ---

function _makeNumCls(name) {
  var fmt,
    bigEndian = false;
  if (name == "FtNum_b") fmt = "b";
  else if (name == "FtNum_B") fmt = "B";
  else {
    fmt = name[name.length - 3];
    bigEndian = name.slice(name.length - 2) == "BE";
  }
  var aType = NbcClass(name, {}, {}, true);

  aType.toBinary = function(v) {
    var ret,
      n = parseInt(v || 0);
    if (fmt === "b") {
      ret = Buffer.allocUnsafe(1);
      ret.writeInt8(n, 0);
    } else if (fmt === "B") {
      ret = Buffer.allocUnsafe(1);
      ret.writeUInt8(n, 0);
    } else if (fmt === "h") {
      ret = Buffer.allocUnsafe(2);
      if (bigEndian) ret.writeInt16BE(n, 0);
      else ret.writeInt16LE(n, 0);
    } else if (fmt === "H") {
      ret = Buffer.allocUnsafe(2);
      if (bigEndian) ret.writeUInt16BE(n, 0);
      else ret.writeUInt16LE(n, 0);
    } else if (fmt === "i") {
      ret = Buffer.allocUnsafe(4);
      if (bigEndian) ret.writeInt32BE(n, 0);
      else ret.writeInt32LE(n, 0);
    } else if (fmt === "I") {
      ret = Buffer.allocUnsafe(4);
      if (bigEndian) ret.writeUInt32BE(n, 0);
      else ret.writeUInt32LE(n, 0);
    } else if (fmt === "q") {
      if (n < -0x1fffffffffffff || n > 0x1fffffffffffff)
        throw new RangeError('the number of "q" is out of bounds');

      ret = Buffer.allocUnsafe(8);
      if (n < 0) {
        // (0xffffffffffffffff - n + 1) == 0x001fffffffffffff + 0xffe0000000000000 - n + 1
        var k = 0x1fffffffffffff + n + 1; // k >= 0 && k <= 0x1fffffffffffff
        if (bigEndian) {
          ret.writeUInt32BE(Math.floor(k / 0x100000000), 0);
          ret.writeUInt32BE(k % 0x100000000, 4);
          ret[1] = (ret[1] + 0xe0) % 0x100;
          ret[0] = 0xff;
        } else {
          ret.writeUInt32LE(k % 0x100000000, 0);
          ret.writeUInt32LE(Math.floor(k / 0x100000000), 4);
          ret[6] = (ret[6] + 0xe0) % 0x100;
          ret[7] = 0xff;
        }
      } else {
        if (bigEndian) {
          ret.writeUInt32BE(Math.floor(n / 0x100000000), 0);
          ret.writeUInt32BE(n % 0x100000000, 4);
        } else {
          ret.writeUInt32LE(n % 0x100000000, 0);
          ret.writeUInt32LE(Math.floor(n / 0x100000000), 4);
        }
      }
    } else if (fmt === "Q") {
      if (n < 0 || n > 0x1fffffffffffff)
        throw new RangeError('the number of "Q" is out of bounds');

      ret = Buffer.allocUnsafe(8);
      if (bigEndian) {
        ret.writeUInt32BE(Math.floor(n / 0x100000000), 0);
        ret.writeUInt32BE(n % 0x100000000, 4);
      } else {
        ret.writeUInt32LE(n % 0x100000000, 0);
        ret.writeUInt32LE(Math.floor(n / 0x100000000), 4);
      }
    } else throw new TypeError("unknown format: " + fmt);

    return [ret, n];
  };

  aType.fromStream = function(stream, off) {
    // stream is FtNum_xxx.binary()
    var n = 0,
      size = 1;

    off = off || 0; // ensure it is number
    if (fmt === "b") n = stream.readInt8(off);
    else if (fmt === "B") n = stream.readUInt8(off);
    else if (fmt === "h") {
      n = bigEndian ? stream.readInt16BE(off) : stream.readInt16LE(off);
      size = 2;
    } else if (fmt === "H") {
      n = bigEndian ? stream.readUInt16BE(off) : stream.readUInt16LE(off);
      size = 2;
    } else if (fmt === "i") {
      n = bigEndian ? stream.readInt32BE(off) : stream.readInt32LE(off);
      size = 4;
    } else if (fmt === "I") {
      n = bigEndian ? stream.readUInt32BE(off) : stream.readUInt32LE(off);
      size = 4;
    } else if (fmt === "q") {
      var k1, k2, k3, k4;
      if (bigEndian) {
        k1 = stream.readUInt16BE(off);
        k2 = stream.readUInt16BE(off + 2);
        k3 = stream.readUInt32BE(off + 4);
      } else {
        k1 = stream.readUInt16LE(off + 6);
        k2 = stream.readUInt16LE(off + 4);
        k3 = stream.readUInt32LE(off);
      }

      // 0xffffffffffffffff - n + 1 == 0xffe0000000000000 + 0x001fffffffffffff - n + 1
      if (k1 >= 0xffe0 && (k2 > 0 || k3 >= 1)) {
        // stream < 0 && stream >= -0x1fffffffffffff
        k1 -= 0xffe0;
        k4 = (k1 << 48) + (k2 << 32) + k3;
        n = -(0x001fffffffffffff - k4 + 1);
      } else if (k1 <= 0x001f)
        // stream >= 0 && stream <= 0x1fffffffffffff
        n = (k1 << 48) + (k2 << 32) + k3;
      else throw new RangeError('the number of "q" is out of bounds');

      size = 8;
    } else if (fmt === "Q") {
      var k1, k2;
      if (bigEndian) {
        k1 = stream.readUInt32BE(off);
        k2 = stream.readUInt32BE(off + 4);
      } else {
        k1 = stream.readUInt32LE(off + 4);
        k2 = stream.readUInt32LE(off);
      }

      if (k1 <= 0x1fffff) n = (k1 << 32) + k2;
      else throw new RangeError('the number of "Q" is out of bounds');

      size = 8;
    } else throw new TypeError("unknown format: " + fmt);

    var stream2 = Buffer.allocUnsafe(size);
    stream.copy(stream2, 0, off, off + size);

    return new aType(n, stream2); // uses copied stream
  };

  return aType;
}

var FtNum_b = _makeNumCls("FtNum_b");
var FtNum_B = _makeNumCls("FtNum_B");

var FtNum_hBE = _makeNumCls("FtNum_hBE");
var FtNum_HBE = _makeNumCls("FtNum_HBE");
var FtNum_hLE = _makeNumCls("FtNum_hLE");
var FtNum_HLE = _makeNumCls("FtNum_HLE");

var FtNum_iBE = _makeNumCls("FtNum_iBE");
var FtNum_IBE = _makeNumCls("FtNum_IBE");
var FtNum_iLE = _makeNumCls("FtNum_iLE");
var FtNum_ILE = _makeNumCls("FtNum_ILE");

var FtNum_qBE = _makeNumCls("FtNum_qBE");
var FtNum_QBE = _makeNumCls("FtNum_QBE");
var FtNum_qLE = _makeNumCls("FtNum_qLE");
var FtNum_QLE = _makeNumCls("FtNum_QLE");

//----- FtVarInt ---

var FtVarInt = NbcClass(
  "FtVarInt",
  {
    toBinary: function(v) {
      var num = parseInt(v || 0);
      var stream = null;

      if (num >= 0) {
        if (num < 0xfd) stream = Buffer.from([num]);
        else if (num < 0xffff) {
          stream = Buffer.allocUnsafe(3);
          stream.writeUInt8(0xfd, 0);
          stream.writeUInt16LE(num, 1);
        } else if (num < 0xffffffff) {
          stream = Buffer.allocUnsafe(5);
          stream.writeUInt8(0xfe, 0);
          stream.writeUInt32LE(num, 1);
        } else if (num <= 0x1fffffffffffff) {
          stream = Buffer.allocUnsafe(9);
          stream.writeUInt8(0xff, 0);
          stream.writeUInt32LE(num % 0x100000000, 1);
          stream.writeUInt32LE(Math.floor(num / 0x100000000), 5);
        }
      }

      if (stream === null) throw new RangeError("VarInt out of range");

      return [stream, num];
    },

    fromStream: function(stream, off) {
      // stream is FtVarInt.binary()
      off = off || 0;
      var flag = stream[off];

      var n = 0,
        size = 1;
      if (flag < 0xfd) n = flag;
      // size = 1
      else if (flag == 0xfd) {
        n = stream.readUInt16LE(off + 1);
        size = 3;
      } else if (flag == 0xfe) {
        n = stream.readUInt32LE(off + 1);
        size = 5;
      } else {
        // flag == 0xff
        n = stream.readUInt32LE(off + 1) + (stream.readUInt32LE(off + 5) << 32);
        if (n > 0x1fffffffffffff) throw new RangeError("VarInt out of range");
        size = 9;
      }

      var stream2 = Buffer.allocUnsafe(size);
      stream.copy(stream2, 0, off, off + size);

      return new FtVarInt(n, stream2); // uses copied stream
    }
  },
  {},
  true
);

//----- FtIPAddr ---

var FtIPAddr = NbcClass(
  "FtIPAddr",
  {
    toBinary: function(v) {
      var sIP = v || "";

      var succ = true,
        groups = sIP.split(".");
      groups.forEach(function(item, idx) {
        var tmp = parseInt(item);
        if (!isNaN(tmp) && tmp >= 0 && tmp <= 255) groups[idx] = tmp;
        else succ = false;
      });

      if (succ) {
        if (groups.length == 4) {
          // is IP v4 format
          var stream = new Buffer.allocUnsafe(16); // default is fill 0
          stream[10] = 255;
          stream[11] = 255;
          stream[12] = groups[0];
          stream[13] = groups[1];
          stream[14] = groups[2];
          stream[15] = groups[3];

          return [stream, sIP];
        }
        // else, take as IP v6 format

        groups = sIP.split(":");
        if (groups.length < 2) succ = false;
        else {
          if (groups[0] == "" && groups[1] == "")
            // starts with '::'
            groups.splice(0, 1);
          else if (
            groups[groups.length - 1] == "" &&
            groups[groups.length - 2] == ""
          )
            // ends withs '::'
            groups.splice(groups.length - 1, 1);

          if (groups.length > 8) succ = false;
          else {
            var emptyNum = 0;
            for (var i = 0; i < groups.length; i++) {
              if (groups[i] == "") emptyNum += 1;
            }
            if (emptyNum > 1) succ = false;
          }
        }
      }

      if (succ) {
        var groups2 = [];
        for (var i = 0; i < groups.length; i++) {
          var group = groups[i];
          if (group == "") {
            var tmp = 9 - groups.length;
            while (tmp >= 1) {
              groups2.push(0);
              tmp -= 1;
            }
          } else {
            var tmp = parseInt(group, 16);
            if (tmp < 0 || tmp > 0xffff) {
              succ = false;
              break;
            } else groups2.push(tmp);
          }
        }

        if (succ) {
          var stream = Buffer.allocUnsafe(16);
          groups2.forEach(function(item, idx) {
            stream.writeUInt16BE(item, idx + idx);
          });
          return [stream, sIP];
        }
      }

      throw new TypeError("unknown IP address: " + sIP);
    },

    fromStream: function(stream, off) {
      // stream is FtIPAddr.binary()
      off = off || 0;

      var i,
        sIP = "",
        ip4 = true;
      for (i = 0; i < 10; i++) {
        if (stream[off + i] != 0) {
          ip4 = false;
          break;
        }
      }
      if (stream[off + 10] != 255 || stream[off + 11] != 255) ip4 = false;

      if (ip4)
        sIP =
          stream[off + 12] +
          "." +
          stream[off + 13] +
          "." +
          stream[off + 14] +
          "." +
          stream[off + 15];
      else {
        for (i = 0; i < 8; i++) {
          if (sIP) sIP += ":";
          sIP += stream.readUInt16BE(off + i + i).toString(16);
        }
      }

      var stream2 = Buffer.allocUnsafe(16);
      stream.copy(stream2, 0, off, off + 16);

      return new FtIPAddr(sIP, stream2); // uses copied stream
    }
  },
  {},
  true
);

//----- FtVarStr ---

var FtVarStr = NbcClass(
  "FtVarStr",
  {
    toBinary: function(v) {
      // v can be string, Buffer, compatible array
      // step 1: convert v to Buffer
      var value2,
        buf = v;
      if (typeof buf == "string") value2 = Buffer.from(buf);
      else {
        value2 = Buffer.allocUnsafe(buf.length);
        if (buf instanceof Buffer) buf.copy(value2, 0, 0, buf.length);
        // copy content
        else {
          // take as array
          for (var i = 0; i < buf.length; i++) {
            value2[i] = buf[i];
          }
        }
      }

      // step 2: prepare stream
      var size = value2.length;
      var head = new FtVarInt(size).binary();
      var off = head.length,
        size2 = off + size;
      var stream2 = Buffer.allocUnsafe(size2);
      head.copy(stream2, 0, 0, off);
      value2.copy(stream2, off, 0, size);

      // step 3: return
      return [stream2, value2];
    },

    fromStream: function(stream, off) {
      // stream is FtVarStr.binary()
      off = off || 0;

      var head = FtVarInt.fromStream(stream, off);
      var size0 = head._stream.length,
        size = head._value;
      var value2 = Buffer.allocUnsafe(size);
      stream.copy(value2, 0, off + size0, off + size0 + size);

      var stream2 = Buffer.allocUnsafe(size0 + size);
      head._stream.copy(stream2, 0, size0);
      value2.copy(stream2, size0, 0, size);

      return new FtVarStr(value2, stream2);
    }
  },
  {},
  true
);

//----- arrayOf ---

function _joinStream(b) {
  var i,
    item,
    total = 0;
  for (i = 0; (item = b[i]); i++) {
    total += item.length;
  }

  var ret = Buffer.allocUnsafe(total);
  var off = 0;
  for (i = 0; (item = b[i]); i++) {
    item.copy(ret, off, 0, item.length);
    off += item.length;
  }

  return ret;
}

function defineObjGet_(obj, attr) {
  Object.defineProperty(obj, attr, {
    enumerable: true,
    configurable: true,
    get: function() {
      var ret = this._value[attr]._value;
      if (typeof ret.typeOf == "function" && (ret.typeOf()._flag || 0) <= 1)
        return ret._value;
      // aType._flag is 0 or 1 means atom data type
      else return ret;
    } // no 'set'
  });
}

function arrayOf(childType, len, name) {
  // if (len == undefined) means using alterable length
  var childClass = _getType(childType);
  if (!childClass) throw new ReferenceError("invalid data type: " + childType);

  var isFixed = typeof len == "number";
  var typeName =
    name ||
    (isFixed ? childClass.name + "[" + len + "]" : childClass.name + "[]");
  var childIsUInt8 = childClass === FtNum_B;

  var retClass = NbcClass(
    typeName,
    {
      toBinary: function(buf) {
        // buf is array
        var len2,
          values = [],
          streams = [];

        if (isFixed) {
          if (buf.length < len) {
            if (childIsUInt8) {
              // if UInt8Array will auto append 0
              if (typeof buf == "string") buf = Buffer.from(buf);

              var tmp = [];
              for (var i = 0; i < len; i++) {
                tmp.push(i < buf.length ? buf[i] : 0);
              }
              buf = tmp;
            } else throw new RangeError("length of array mismatch");
          }
          len2 = len;
        } else {
          streams.push(FtVarInt.from(buf.length)._stream);
          len2 = buf.length;
        }

        if (childIsUInt8) {
          values = Buffer.from(buf);
          streams.push(values);
        } else {
          if (typeof buf == "string") buf = Buffer.from(buf);

          for (var i = 0; i < len2; i++) {
            var item = buf[i];
            if (item instanceof childClass) {
              values.push(item);
              streams.push(item._stream);
            } else {
              var info = childClass.toBinary(item);
              values.push(new childClass(info[1], info[0]));
              streams.push(info[0]);
            }
          }
        }

        return [_joinStream(streams), values];
      },

      fromStream: function(stream, off) {
        off = off || 0;

        var off2,
          value2 = [];
        if (isFixed) {
          if (childIsUInt8) {
            off2 = off + len;
            value2 = stream.slice(off, off2);
          } else {
            off2 = off;
            for (var i = 0; i < len; i++) {
              var item = childClass.fromStream(stream, off2);
              value2.push(item);
              off2 += item._stream.length;
            }
          }
        } else {
          var head = FtVarInt.fromStream(stream, off),
            size = head._value;
          off2 = off + head._stream.length;

          if (childIsUInt8) {
            value2 = stream.slice(off2, off2 + size);
            off2 += size;
          } else {
            for (var i = 0; i < size; i++) {
              var item = childClass.fromStream(stream, off2);
              value2.push(item);
              off2 += item._stream.length;
            }
          }
        }

        var stream2 = Buffer.allocUnsafe(off2 - off);
        stream.copy(stream2, 0, off, off2);

        return new retClass(value2, stream2);
      }
    },
    {
      init: function() {
        Object.defineProperty(this, "V", {
          enumerable: false,
          configurable: true,
          get: function() {
            return this._value;
          } // no 'set'
        });
        Object.defineProperty(this, "S", {
          enumerable: false,
          configurable: true,
          get: function() {
            return this._stream;
          } // no 'set'
        });

        if (this._stream !== undefined && !childIsUInt8) {
          // content is ready  // if childIsUInt8 maybe use huge storage
          var nn = this._value.length;
          for (var i = 0; i < nn; i++) {
            defineObjGet_(this, i); // define this[i] = values[i]._value
          }
        }
      },

      binary: function() {
        if (!this._stream)
          // can not direct call, call arrayType.from(...) first
          throw new ReferenceError("Array not assigned yet");
        return this._stream;
      },

      toString: function() {
        if (!this._value || isFixed) return "<" + typeName + ">";
        else if (childIsUInt8) return this._value.toString("hex");
        else return "<" + typeName + ":" + this._value.length + ">";
      }
    },
    !!name
  );

  retClass._flag = childIsUInt8 ? 1 : 2; // 1 means UInt8 array, 2 means other array
  return retClass;
}

/*
var n = FtNum_ILE.from(127);
var n = FtNum_qBE.from(-0x1fffffffffffff);
FtNum_qBE.fromStream(n._stream);

var n = FtVarInt.from(0xfc);
var n = FtIPAddr.from('192.168.1.1');
FtIPAddr.fromStream(n._stream);

var n = FtVarStr.from('abcdef');
var n = FtVarStr.from(Buffer.from('abcd'));

var n = arrayOf(FtNum_HLE).from([258,259,260]);
var n = arrayOf('FtNum_HLE').from([258,259,260]);
var n = arrayOf(FtVarStr).from(['abcd','example']);
var n = arrayOf('FtVarStr').from(['abcd','example']);
var n = arrayOf(FtVarStr,2).from(['abcd','example']);
var n = arrayOf(FtNum_B,20).from([1,2]);
var n = arrayOf(FtNum_B,32,'hash32').from([]);  // regist as 'hash32'
*/

//----- composeOf ---

function defineObjGet2_(obj, attr) {
  Object.defineProperty(obj, attr, {
    enumerable: true,
    configurable: true,
    get: function() {
      var ret = this._value[attr];
      if (typeof ret != "object" || ret._value === undefined) return ret;
      // direct save in {} when aType._flag <= 1
      else return ret._value;
    } // no 'set'
  });
}

function composeOf(types, name, methods) {
  // if (!name) means no need regist to global
  methods = methods || {};

  var methods2 = {
    init: function() {
      Object.defineProperty(this, "V", {
        enumerable: false,
        configurable: true,
        get: function() {
          return this._value;
        } // no 'set'
      });
      Object.defineProperty(this, "S", {
        enumerable: false,
        configurable: true,
        get: function() {
          return this._stream;
        } // no 'set'
      });

      if (this._stream !== undefined) {
        // content is ready
        var values = this._value;
        for (var item in values) {
          defineObjGet2_(this, item);
        }
      }
    },

    binary: function() {
      if (!this._stream)
        // can not direct call, call FtArray.from(...) first
        throw new ReferenceError("value not assigned yet");
      return this._stream;
    },

    toString: function() {
      return "<" + name + ">";
    }
  };
  for (var item in methods) {
    methods2[item] = methods[item];
  }

  var retClass = NbcClass(
    name,
    {
      toBinary: function(v) {
        var b = [],
          values = {};
        types.forEach(function(item) {
          var subName = item[0],
            subType = item[1],
            v2 = v[subName];
          if (v2 === undefined)
            throw new ReferenceError(
              "no attribute (" + subName + ") when call toBinary()"
            );

          if (v2 instanceof subType) {
            if ((subType._flag || 0) <= 1) values[subName] = v2._value;
            else values[subName] = v2;
            b.push(v2._stream);
          } else {
            var info2 = subType.toBinary(v2),
              stream2 = info2[0],
              value2 = info2[1];
            if ((subType._flag || 0) <= 1) values[subName] = value2;
            else values[subName] = new subType(value2, stream2);
            b.push(stream2);
          }
        });

        return [_joinStream(b), values];
      },

      fromStream: function(stream, off) {
        off = off || 0;
        var off2 = off,
          streams = [],
          values = {};
        types.forEach(function(item, idx) {
          var subName = item[0],
            subType = item[1];
          var value2 = subType.fromStream(stream, off2);

          var st = value2._stream;
          streams.push(st);
          if ((subType._flag || 0) <= 1) values[subName] = value2._value;
          else values[subName] = value2;
          off2 += st.length;
        });

        return new retClass(values, _joinStream(streams));
      }
    },
    methods2,
    !!name
  );

  retClass._flag = 3; // 3 means composed struct
  return retClass;
}

//----- others ---

var FtUockValue = composeOf(
  [
    ["uock", arrayOf(FtNum_B, 8)], // warning: use FtNum_B[8] since FtNum_qLE is out of range
    ["value", FtNum_qLE],
    ["height", FtNum_ILE],
    ["vcn", FtNum_HLE]
  ],
  "FtUockValue"
);

var FtNetworkAddr = composeOf(
  [
    ["timestamp", FtNum_ILE],
    ["services", FtNum_QLE],
    ["address", FtIPAddr],
    ["port", FtNum_HBE]
  ],
  "FtNetworkAddr"
);

var FtInventoryVector = composeOf(
  [["object_type", FtNum_ILE], ["hash", arrayOf(FtNum_B, 32)]],
  "FtInventoryVector"
);

var FtOutPoint = composeOf(
  [["hash", arrayOf(FtNum_B, 32)], ["index", FtNum_ILE]],
  "FtOutPoint"
);

var FtTxnIn = composeOf(
  [
    ["prev_output", FtOutPoint],
    ["sig_script", FtVarStr],
    ["sequence", FtNum_ILE]
  ],
  "FtTxnIn"
);

var FtTxnOut = composeOf(
  [["value", FtNum_qLE], ["pk_script", FtVarStr]],
  "FtTxnOut"
);

var FtTxn = composeOf(
  [
    ["version", FtNum_ILE],
    ["tx_in", arrayOf(FtTxnIn)],
    ["tx_out", arrayOf(FtTxnOut)],
    ["lock_time", FtNum_ILE],
    ["sig_raw", FtVarStr] // FtTxn.hash will exclude sig_raw
  ],
  "FtTxn",
  {
    hash: function() {
      var h = this.__hash;
      if (h === undefined) {
        var st = this._stream,
          sigLen = this._value.sig_raw.length;
        var tmp = createHash("sha256")
          .update(st.slice(0, st.length - 1 - sigLen))
          .digest();
        h = createHash("sha256")
          .update(tmp)
          .digest(); // exclude this._value.sig_raw
        this.__hash = h;
      }
      return h;
    }
  }
);

var FtBlockHeader = composeOf(
  [
    ["version", FtNum_ILE],
    ["link_no", FtNum_ILE],
    ["prev_block", arrayOf(FtNum_B, 32)],
    ["merkle_root", arrayOf(FtNum_B, 32)],
    ["timestamp", FtNum_ILE],
    ["bits", FtNum_ILE],
    ["nonce", FtNum_ILE], // 80 ~ 83, hash = sha256d(header.binary()[:84])
    ["miner", arrayOf(FtNum_B, 32)], // 84 ~ 115
    ["sig_tee", FtVarStr],
    ["txn_count", FtVarInt]
  ],
  "FtBlockHeader",
  {
    hash: function() {
      var h = this.__hash;
      if (h === undefined) {
        var tmp = createHash("sha256")
          .update(this._stream.slice(0, 84))
          .digest();
        h = createHash("sha256")
          .update(tmp)
          .digest();
        this.__hash = h;
      }
      return h;
    }
  }
);

var FtVarStrList = composeOf([["items", arrayOf(FtVarStr)]], "FtVarStrList");

var FtPayFrom = composeOf(
  [
    ["value", FtNum_qLE],
    ["address", FtVarStr] // base58 address: ver1 + vcn2 + pubhash32 + cointype
  ],
  "FtPayFrom"
);

var FtPayTo = composeOf(
  [
    ["value", FtNum_qLE],
    ["address", FtVarStr] // base58 address, or RETURN script (when value is 0)
  ],
  "FtPayTo"
);

var FtAccState = composeOf(
  [
    ["link_no", FtNum_ILE],
    ["timestamp", FtNum_ILE],
    ["account", FtVarStr],
    ["search", FtNum_ILE],
    ["found", arrayOf(FtUockValue)]
  ],
  "FtAccState"
);

var FtReplyHeaders = composeOf(
  [
    ["link_no", FtNum_ILE],
    ["heights", arrayOf(FtNum_ILE)],
    ["txcks", arrayOf(arrayOf(FtNum_B, 8))],
    ["headers", arrayOf(FtBlockHeader)]
  ],
  "FtReplyHeaders"
);

var FtUtxoState = composeOf(
  [
    ["link_no", FtNum_ILE],
    ["heights", arrayOf(FtNum_ILE)],
    ["indexes", arrayOf(FtNum_ILE)],
    ["txns", arrayOf(FtTxn)]
  ],
  "FtUtxoState"
);

var is_checksum = function(data) {
  const magic = Buffer.from([0xf9, 0x6e, 0x62, 0x74]);
  if (!data.slice(0, 4).equals(magic)) {
    throw Error("bad magic number");
  }
  var buf = data.slice(16, 20);
  var v2 = bufToNumer(buf);
  var payload = data.slice(24, 24 + v2);
  var checksum = toBuffer(sha256(toBuffer(sha256(payload)))).slice(0, 4);
  if (data.slice(20, 24).compare(checksum) != 0) {
    return "";
  }
  return payload;
};

function toBuffer(hex) {
  var typedArray = new Uint8Array(
    hex.match(/[\da-f]{2}/gi).map(function(h) {
      return parseInt(h, 16);
    })
  );
  var buffer = typedArray.buffer;
  buffer = Buffer.from(buffer);
  return buffer;
}

function bufToNumer(buf) {
  var t = 0;
  for (var i = 0; i < buf.length; i++) {
    t += parseInt(buf[i], 10) * Math.pow(256, buf.length - i - 1);
  }
  return t;
}

// module.exports = {
//     FtAccState:FtAccState
// };

// var network = FtNetworkAddr.from( {
//   timestamp: parseInt((new Date()).valueOf() / 1000),
//   services: 0,
//   address: '192.168.1.1',
//   port: 258 });
//   console.log(network);
// console.log(network.S);  // network._stream
// console.log(network.V.timestamp, network.V.services, network.V.address, network.V.port);
// console.log(network.V.timestamp.V, network.V.port.V);
// console.log(network.timestamp, network.port);

// var txn = FtTxn.from({
//   version: 0,

//   tx_in: [
//     {
//       prev_output: {
//         hash: [], // will auto fill 0
//         index: 1
//       },
//       sig_script: "",
//       sequence: 0
//     },
//     {
//       prev_output: {
//         hash: [], // will auto fill 0
//         index: 2
//       },
//       sig_script: "",
//       sequence: 1
//     }
//   ],

//   tx_out: [
//     {
//       value: 1,
//       pk_script: ""
//     },
//     {
//       value: 2,
//       pk_script: ""
//     }
//   ],

//   lock_time: 0,
//   sig_raw: ""
// });
// console.log(txn.tx_in[0].prev_output.hash,txn.tx_in[0].prev_output.index);

// var n = FtTxn.fromStream(txn.S, 0);
// console.log(n.tx_in[0].prev_output.hash, n.tx_in[0].prev_output.index);
