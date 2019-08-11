# 微信小程序数据绑定底层揭秘

数据绑定是通过解析表达式{{和}}之间的表达式，把表达式

存放到数组里面，就把该数组叫做Z数组。

## 生成数据绑定

数据绑定是通过数组来表示的，其中最重要的是Z数组的

表示，微信小程序设计了1-12的数字前缀来表示不同

的数据绑定类型。

### Z数组的格式

根据ast节点类型生成Z数组

一些约定：

1. node: babel解析表达式后的ast节点

根据node的不同类型，Z数组的生成规则如下：

#### Identifier

标识符类型

node.name: 标识符的名字

如果要解析为静态的值：

[3, "${node.name}"]

否则

[[7],[3, "${node.name}"]]

#### RegExpLiteral、BooleanLiteral、NumericLiteral、StringLiteral

一些常量类型

node.value: 常量的值

`[1, ${(node.value)}]`

#### NullLiteral

null常量类型

`[1, null]`

#### MemberExpression

对象成员表达式类型

对象取属性值，比如：

1. a.b，computed: false
2. a['b']，computed: true

computed: 属性是否需要求值，如果为false，则解析value的时候解析为静态的

a为object，b为key

objectRes: object的Z数组解析结果

keyRes: key的Z数组解析结果

`[[6],${objectRes},${b的解析结果}]`

#### BinaryExpression、LogicalExpression

二元表达式类型(a + b)、逻辑表达式类型(a && b)

node.operator: 操作符

leftRes: 第一个操作数的Z数组解析结果

rightRes: 第一个操作数的Z数组解析结果

`[[2, "${node.operator}"], ${leftRes}, ${rightRes}]`

#### UnaryExpression

一元表达式类型

node.operator: 操作符

argumentRes: 操作数的Z数组解析结果

`[[2, "${node.operator}"], ${argumentRes}]`

#### ArrayExpression

数组表达式类型

如果数组长度为0:

`[[4], [[5]]]`

否则:

arrRes: 数组所有项的Z数组解析结果

`[[4], ${arrRes}]`

比如例子[a1, a2, a3]，arrRes解析如下: 

a1Res: a1的Z数组接卸结果
a2Res: a2的Z数组接卸结果
a3Res: a3的Z数组接卸结果

`[ [5], [[5], [[5], ${a1Res}], ${a2Res}], ${a3Res} ]`

#### SpreadElement

析构赋值类型

比如：template标签的data属性

```wxml
<template is="msgItem" data="{{...item, a: b}}" />
```

item就是一个析构赋值类型

argumentRes: 析构赋值参数(例子中是item)的Z数组解析结果

`[[10], ${argumentRes}]`

#### ConditionalExpression

三元表达式类型

比如: a ? b : c

testRes: 例子中的a的Z数组解析结果
consequentRes: 例子中的b的Z数组解析结果
alternateRes: 例子中的c的Z数组解析结果

`[[2,'?:'],${testRes},${consequentRes},${alternateRes}]`

#### ObjectExpression

对象表达式类型

只有一个属性:

比如: {key1: value1}

返回该属性的Z数组的解析结果

多余一个属性:

比如{key1: value1, key2: value2, key3: value3}

prop1Res: 第1个对象属性的Z数组解析结果，这里是key1: value1
prop2Res: 第2个对象属性的Z数组解析结果，这里是key2: value2
prop3Res: 第3个对象属性的Z数组解析结果，这里是key3: value3

`[[9], [[9], ${prop1Res}, ${prop2Res}], ${prop3Res}]`

#### ThisExpression

this表达式类型

`[[7], [3, 'this']]`

#### ObjectProperty

对象属性类型

node.key.name: 属性的key
valueRes: 属性的值的Z数组解析结果

`[[8], "${node.key.name}", ${valueRes}]`

#### DirectiveLiteral

其他常量指令

node.value: 常量的值

`[1, "${node.value}"]`

#### CallExpression

函数调用类型，例如wxs函数调用

例如: a.b.c(d, e, f)

calleeRes: 函数调用者的Z数组解析结果，例子中是a.b.c
argumentsRes: 函数调用参数的Z数组解析结果，例子中是d, d, f

`[[12], ${calleeRes}, ${argumentsRes}]`

对于argumentsRes，解析结果为一个数组的Z数组表示，对于例子:

dRes: 参数d的Z数组解析结果
eRes: 参数e的Z数组解析结果
fRes: 参数f的Z数组解析结果

`[[5], [[5], [[5], ${dRes}], ${eRes}],${fRes}]`

#### 其他

没有数据绑定，普通的字符串:

str: 字符串的值

`[[3], ${str}]`

### 最后

所有数据绑定解析完后，将所有解析结果res[i]，存放到数组中:

`[a, ${res[0]}, ${res[1]}, ...]`作为wxml文件最终的数据绑定

的表示。

## 根据Z数组得到数据绑定后的结果

比如对于例子:

data:

```json
{
    "text": "hello world"
}

```

wxml:

```wxml
<view>{{text}}</view>
```

如何得到{{text}}的值的呢？

其实就是先查找text的Z数组表示，这里为`[3, "text"]`，

表示这是一个Identifier类型，于是从data里面查找key为text的

值"hello world"，于是得到:

```wxml
<view>hello world</view>
```

具体的细节，可以阅读wcc.js生成后的目标代码，建议格式化下

不然比较难阅读。
