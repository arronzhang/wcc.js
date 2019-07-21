# ml ast spec

## {token}结构 ml解析生成的token

str: {string} token的字符串
start: {loc} token开始字符的位置信息
end: {loc} token结束字符的位置信息

## {loc}结构 字符的位置信息

line: {number} 行号
col: {number} 列号

## root节点

type: {string} ['root'] 根节点类型
children: {array} 子节点
path: {string} 文件路径

## tag节点

type: {string} ['tag'] tag标签
openTag: {token} 开始标签的标签名token
attributes: {array} 属性节点
children: {array} 子节点
closeTag: {token} 结束标签的标签名token

## attribute节点

type: {string} ['attribute']
name: {token} 属性key的token
value: {token} 属性value的token

## text节点

type: {string} ['text']
value: {token} 文本的token
