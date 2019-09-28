## format.js 模块设计说明

format 模块提供 NBC 区块链的消息组包与解包功能，它与 python 客户端的 format.py 文件对应。

format.js 不支持在 Node 中运行，只支持在网页的 javascript 中运行。


## 数据类型
 
format 模块定义如下数据类型：

1. 数值型基础类型（与 javascript 的 Number 对应），包括：

 - FtNum_b    带符号单字节整数，范围：-0x80 ~ 0x7f
 - FtNum_B    无符号单字节整数，范围：0 ~ 0xff
 
 - FtNum_hBE  带符号双字节整数，大端格式，范围：-0x8000 ~ 0x7fff
 - FtNum_HBE  无符号单字节整数，大端格式，范围：0 ~ 0xffff
 - FtNum_hLE  带符号双字节整数，小端格式，范围：-0x8000 ~ 0x7fff
 - FtNum_HLE  无符号单字节整数，小端格式，范围：0 ~ 0xffff
 
 - FtNum_iBE  带符号4字节整数，大端格式，范围：-0x80000000 ~ 0x7fffffff
 - FtNum_IBE  无符号4字节整数，大端格式，范围：0 ~ 0xffffffff
 - FtNum_iLE  带符号4字节整数，小端格式，范围：-0x80000000 ~ 0x7fffffff
 - FtNum_ILE  无符号4字节整数，小端格式，范围：0 ~ 0xffffffff
 
 - FtNum_qBE  带符号8字节整数，大端格式，范围：-0x1fffffffffffff ~ 0x1fffffffffffff
 - FtNum_QBE  无符号8字节整数，大端格式，范围：0 ~ 0x1fffffffffffff
 - FtNum_qLE  带符号8字节整数，小端格式，范围：-0x1fffffffffffff ~ 0x1fffffffffffff
 - FtNum_QLE  无符号8字节整数，小端格式，范围：0 ~ 0x1fffffffffffff

注意：受 javascript 最大整数范围限制，上述 8 字节整数最多能用 53 位，即 0x1fffffffffffff，
如遇值域超出，请改用 arrayOf(FtNum_B,8) 数组的形式表达。

2. 变长整数 FtVarInt

可表达 1 字节、2 字节、4 字节、8 字节的无符号整数，同样最大整数限为 0x1fffffffffffff

3. 变长字串 FtVarStr（与 javascript 的 String 对应）

FtVarStr 由两部分组成，头部用 FtVarInt 指示长度，尾部用 FtVarStr 表达字串内容

4. IP 地址 FtIPAddr，支持 IPv4 或 IPv6 格式的字串表达，转成二进制码流则占用 16 字节长

5. arrayOf(FtNum_B,n) 常规缓冲区类型，与 javascript 中的 Buffer 对应

以上 5 种是基本类型，format 模块对这些类型的数据自动按原子数据方式处理。

6. 数组复合类型 `arrayOf(aType,n)`

如果创建数组类型时 n 取 undefined 时（缺省未指定该参数自动取 undefined），表示创建
变长数组类型，否则创建指定 n 长度的指定类型数组。变长数组将在头部额外添加一个 FtVarInt
指示数组长度。

7. 组合结构类型 `composeOf(typeList)`

用一个数组类型列表指明若干子成员。

以上用 `arrayOf(aType,n)` 与 `composeOf(typeList)` 生成的是复合类型，与前述基本类型
分属两大类，使用上有差异。


## 常用静态方法

所有类型都定义如下静态属性或方法：

1. `aType.from(value)`   用于生成一个指定类型的数据实例

2. `aType.toBinary(value)`  用于生成指定类型的数据及二进制码流
  返回 `[stream,value]`，这两项值自动记录到数据实例 obj 的 `obj._stream` 与 `obj._value` 中

3. `aType.fromStream(stream,off)`  用于从二进制码流中读入数据实例

4. `aType.name`  记录类型名称

5. `aType._flag`  记录类型标记
取值 undefined 或 0 表示这是基础类型，取值 1 表示 UInt8 数组，取值 2 是其它数组，取值 3 复合结构

## 常用类方法

1. `obj.toString()`  取字串化描述

2. `obj.binary()`  生成码流，通过不用，因为生成 obj 时自动将码流安装到 `obj._stream` 了

3. `obj.typeOf()`  取数据实例的类型

4. `obj.init()`  初始化调用函数，只在特别定制时用到

除了上述方法，本模块还自动将 `obj._stream` 定义成 `obj.S`，将 `obj._value` 定义成 `obj.V`，
一方面为了简化使用（少敲字符），另一方面，这两属性是只读的，推荐用户仅按只读方式使用 obj 数据实例。

## 全局类型注册

上述基础类型已注册到全局表（注：变长数组不注册），注册到全局表的好处是，可以用字串表达类型，比如：

```js
var MyType1 = composeOf( [
  ['name',FtVarStr],
  ['desc','FtVarStr'],
], 'MyType1');
```

这里，用 `'FtVarStr'` 也能表达类型，因为它已在全局表注册。`arrayOf(aType,n,name)` 与 
`composeOf(typeList,name,methods)` 都有 name 参数指示是否将申明的类型注册到全局表，
如果 name 取 undefined 则不注册。


## 复合数据类型取子成员

由 arrayOf 或 composeOf 生成的类型而创建的数据实例，可用 `obj[index]` 或 `obj.attr`
方式取子成员，本模块对多层结构已作封装，可以多级连续表达，比如 `obj.in_txn[0].value`。

多级用 `'[n]'` 或 `'.attr'` 连续取值时，末级数据若是基础类型，取得的值是常规 js 数据，
可以是 String、Number、Buffer。如果末级是复合类型，取得的值是数据实例，可用 `obj.V` 或
`obj.S` 进一步取值。注意：`arrayOf(FtNum_B,n)` 视作基础类型，对应 js 中的 Buffer 类型。

## 使用举例

略
