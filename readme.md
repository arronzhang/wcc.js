# 实现微信开发者工具的wcc编译器

`wcc.js`是`wxml`文件和`wxs`文件编译器的`nodejs`实现

目标：

- 二级制文件`wcc`实现为`nodejs`模块`wcc.js`
- 完善的测试用例支持
- 完善的性能测试
- 客观的编译性能

## 项目如何使用wcc.js

`npm`安装`wcc.js`依赖：

```sh
npm install wcc.js --save
```

代码示例：

```nodejs
let WCC = require('wcc.js');
let wccCompileConfig = {
  cmd: ['-d', '-cc', '-gn', '$gwx'], //指定运行的参数
  FILESBASE: [
    '/Users/xxx/proj/miniprogram/proj1/' //项目文件的目录
  ],
  FILES: [
    "./pages/index/index.wxml", // 在FILESBASE目录下的项目文件列表
  ]
};
WCC(wccCompileConfig).then(function (wccRes) {
  /*wccRes: {code: 'output code', templatesObjs: {}}*/
  let code = wccRes.code; // 编译后的代码
}).catch(function (err) {
  /*err: {code: -1, message: 'error message'}*/
  console.error(err);
});
```

## 本地开发wcc.js

### 下载代码

```sh
git https://github.com/caijw/wcc.js.git
cd wcc.js
npm install
```

### 代码提交前的自动化测试：***已经累计上千个测试用例***

支持`macOs`和`windows`，不支持`linux`

1 正向用例（wcc.js和wcc的正常运行且运行结果必须完全一致）

```sh
npm run test
```

2 反向用例（wcc.js和wcc都必须运行报错，提示开发者报错信息，报错信息不要求完全一致）

```sh
npm run test:fail
```

### 代码提交前的性能测试

支持`macOs`和`windows`，不支持`linux`

```sh
npm run benchmark
```

## wcc

微信开发者工具中的二进制编译器，用来将`wxml`和`wxs`文件，编译成`js`文件，

`js`文件在`jsCore`中执行后，可以得到`$gwx`函数，`$gwx`函数用来生成渲染页面

需要的虚拟`dom`节点的原始数据。

`mac`版本`wcc`文件地址: <https://github.com/caijw/wcc.js/blob/master/test/wcc>

`windows`版本`wcc`文件地址: <https://github.com/caijw/wcc.js/blob/master/test/wcc.exe>

如何获得`wcc`？ [下载mac版本微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)，安装后，打开`Applications`目录，找到微信开发者工具，右键`Show Package Contents`，在`Contents/Resources/package.nw/js/vender/wcc`（该目录可能会被调整）。

## 已经完成的功能

### 一. 数据绑定

参考文档：

<https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxml/data.html>

### 二. 列表渲染

参考文档：

<https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxml/list.html>

### 三. 条件渲染

参考文档：

<https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxml/conditional.html>

### 四. 模板

参考文档：

<https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxml/template.html>

### 五. 引用

参考文档：

<https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxml/import.html>

### 六. 编译参数支持

#### wcc编译用法

```sh
wcc [-d] [-o OUTPUT] [-xc XComponentDefine] [-om XComponentDefine] [-cb [callback.js...]] <FILES... | -s <SINGLE_FILE>
```

#### [-d] 参数 output code for debug

debug info，wxml模板的调试信息输出，主要是在目标代码执行报错后

输出文件解析的位置信息。

已经完美支持。

#### [-cc] 参数 output compelete code for custom component

输出完整的自定义组件代码

已经完美支持。

#### [-ds] 参数 insert debug wxs info

debug info，wxs代码的调试信息输出

主要是在z数组中添加数据的文件名、行号和列号等信息

已经支持

#### [-xc] 参数 output simplified code for custom component

输出简化的自定义组件代码

支持了部分特性，因为`wcc`的简化策略比较无规则，还没完美支持。

#### [-cb] 参数 add life cycle callback

不支持

#### [-om] 参数

不支持

#### [--config-path] 参数

windows下，命令行参数太多会有问题，

当参数太长，将所有的命令行参数写入文件中，传递一个文件名给wcc

不支持，wcc.js的实现暂时不需要跨进程。

### 七. 自动化测试

运行：

```sh
npm run test
```

```sh
npm run test:fail
```

测试样例地址：

<https://github.com/caijw/wcc.js/tree/master/test/succSuit>

<https://github.com/caijw/wcc.js/tree/master/test/failSuit>

完善的测试样例，换提交测试用例来继续完善该项目，以覆盖到大部分的场景。

正向用例-测试流程要点：

1. `wcc.js`将完整的小程序源码，编译成`js`代码[code.wccjs.js](https://github.com/caijw/wcc.js/blob/master/test/succSuit/suit1/out/code.wccjs.js)
2. `wcc`将完整的小程序源码，编译成`js`代码[code.wcc.js](https://github.com/caijw/wcc.js/blob/master/test/succSuit/suit1/out/code.wcc.js)
3. 运行`code.wccjs.js`获取`$gwx`函数`wccjs$gwx`
4. 运行`code.wcc.js`获取`$gwx`函数`wcc$gwx`
5. 对于每个小程序页面`path`，运行`wccjs$gwx`获取渲染函数并运行该渲染函数，获取类似虚拟`dom`的数据结构[path.wccjs.vd](https://github.com/caijw/wcc.js/blob/master/test/succSuit/suit1/out/0_.index.wxml.vd.wccjs.json)
6. 对于每个小程序页面`path`，运行`wcc$gwx`获取渲染函数并运行该渲染函数，获取类似虚拟`dom`的数据结构[path.wcc.vd](https://github.com/caijw/wcc.js/blob/master/test/succSuit/suit1/out/0_.index.wxml.vd.wcc.json)
7. 对比`path.wccjs.vd`和`path.wccjs.vd`是否完全一致

反向用例-测试流程要点：

测试样例均是不合法的样例

1. `wcc.js`编译样例项目，报错
2. `wcc`编译样例项目，报错
3. `wcc.js`和`wcc`是否都报错了

### 八. wxs

将`wxs`标签和`wxs`文件编译进行编译

参考文档：

<https://developers.weixin.qq.com/miniprogram/dev/reference/wxs/01wxs-module.html>

<https://developers.weixin.qq.com/miniprogram/dev/reference/wxs/02variate.html>

<https://developers.weixin.qq.com/miniprogram/dev/reference/wxs/03annotation.html>

<https://developers.weixin.qq.com/miniprogram/dev/reference/wxs/04operator.html>

<https://developers.weixin.qq.com/miniprogram/dev/reference/wxs/05statement.html>

<https://developers.weixin.qq.com/miniprogram/dev/reference/wxs/06datatype.html>

<https://developers.weixin.qq.com/miniprogram/dev/reference/wxs/07basiclibrary.html>

### 九. 性能测试

运行：

```sh
npm run benchmark
```

复用了自动化测试的测试样例，对比测试了`wcc.js`和`wcc`编译相同的小程序项目的耗时对比

## 实现细节

### wxml解析

改造了[htmlparser2](https://github.com/fb55/htmlparser2/blob/master/lib/Tokenizer.js)的token解析部分的实现，基于有穷状态的自动机，解析token十分高效！

wxml解析生成的[AST格式参考](https://github.com/caijw/wcc.js/blob/master/ml_ast_spec.md)

## 关于提交mr

欢迎提交测试样例，测试样例是完整的小程序源码，测试样例用来保证实现的正确性。

功能的实现可能不是很好，欢迎对代码进行改进。

提交前，前确保：

1. 测试样例全部通过
2. 确保改动后的性能不会变的太差
