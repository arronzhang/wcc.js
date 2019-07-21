const babelParser = require("@babel/parser");
const error = require('./error.js');
const babelTypes = require('@babel/types');
const util = require('./util.js');

const OUT_SEPARATOR = 'OUT_SEPARATOR';
const MEET_SEPARATOR_1 = 'MEET_SEPARATOR_1'; //{
const MEET_SEPARATOR_2 = 'MEET_SEPARATOR_2'; //{{
const IN_SEPARATOR = 'IN_SEPARATOR';
const MEET_SEPARATOR_3 = 'MEET_SEPARATOR_3'; // }
const MEET_SEPARATOR_4 = 'MEET_SEPARATOR_4'; // }}

function getSection(cItems, startIdx, endIdx) {
  let start = cItems[startIdx];
  let end = cItems[endIdx];
  let setion = {
    start: start,
    end: end
  };
  let data = [];
  for (let i = startIdx; i <= endIdx; ++i) {
    data.push(cItems[i].c);
  }
  setion.str = data.join('');
  return setion;
}

function text2Items(text = '', startLine = 1, startCol = 1) {
  let cItems = [];
  let baseLine = startLine;
  let baseCol = startCol;
  for (let i = 0; i < text.length; ++i) {
    cItems.push({
      c: text[i],
      loc: {
        line: baseLine,
        col: baseCol
      }
    });
    if (text[i] === '\n') {
      baseLine++;
      baseCol = 0;
    }
    baseCol++;
  }
  return cItems;
}

function _state_OUT_SEPARATOR(store) {
  let item = store.cItems[store.index];
  let c = item.c;
  if (c === '{') {
    store.state = MEET_SEPARATOR_1;
  }
}

function _state_MEET_SEPARATOR_1(store) {
  let item = store.cItems[store.index];
  let c = item.c;
  if (c === '{') {
    store.state = MEET_SEPARATOR_2;
  } else {
    store.state = OUT_SEPARATOR;
  }
}

function _state_MEET_SEPARATOR_2(store) {
  let item = store.cItems[store.index];
  let c = item.c;
  if (store.index - 2 > store.sectionStart) {
    let section = getSection(store.cItems, store.sectionStart, store.index - 3);
    store.bindings.push({
      type: 'static',
      section: section
    });
  }
  store.sectionStart = store.index;
  store.meetDQ = false;
  store.meetSQ = false;

  if (c === '}') {
    store.state = MEET_SEPARATOR_3;
  } else {
    store.state = IN_SEPARATOR;
    store.index--;
  }
}

function _state_IN_SEPARATOR(store) {
  let item = store.cItems[store.index];
  let c = item.c;
  if (c ===  `\\`) {
    //转义字符
    store.index++;
    if (store.index < store.cItems.length) {
      store.index++;
    }
  } else if (c === `"`) {
    if (!store.meetSQ) {
      store.meetDQ = !store.meetDQ;
    }

  } else if (c === `'`) {
    if (!store.meetDQ) {
      store.meetSQ = !store.meetSQ;
    }
  } else if (c === ';') {
    if (!store.meetDQ && !store.meetSQ) {
      let option = store.option;
      let message = ``;
      let code = -1;
      message = `unexpected \`${c}\``;
      return makeQccError(option, {line: item.loc.line, col: item.loc.col}, code, message);
    }
  } else if( c === '='){
    if(!store.meetDQ && !store.meetSQ){
      let preItem = store.cItems[store.index - 1];
      let postItem = store.cItems[store.index + 1];
      if( ( preItem && ( preItem.c === '=' || preItem.c === '!' || preItem.c === '<' || preItem.c === '>' ) ) ){
        // ==x 或者 !=x
      }else if( (postItem && postItem.c === '=') ){
        // x==
      }else{
        let option = store.option;
        let message = ``;
        let code = -1;
        message = `unexpected \`${c}\``;
        return makeQccError(option, {line: item.loc.line, col: item.loc.col}, code, message);
      }
    }
  } else if (c === '}') {
    if(!store.meetDQ && !store.meetSQ){
      store.state = MEET_SEPARATOR_3;
    }
  }
}

function _state_MEET_SEPARATOR_3(store) {
  let item = store.cItems[store.index];
  let c = item.c;
  if (c === '}') {
    store.state = MEET_SEPARATOR_4;
  } else {
    store.state = IN_SEPARATOR;
  }
}

function _state_MEET_SEPARATOR_4(store) {
  let item = store.cItems[store.index];
  let c = item.c;

  if (store.index - 2 > store.sectionStart) {
    let section = getSection(store.cItems, store.sectionStart, store.index - 3);
    store.bindings.push({
      type: 'bind',
      section: section
    });
  }
  store.sectionStart = store.index;
  if (c === '{') {
    store.state = MEET_SEPARATOR_1;
  } else {
    store.state = OUT_SEPARATOR;
    store.index--;
  }
}


function parseBinding(text = '', option = {}) {
  if (!text) {
    return [];
  }
  let startLine = option.loc.line || 1;
  let startCol = option.loc.col || 1;
  let path = option.path || '';
  let cItems = text2Items(text, startLine, startCol);
  //make the store
  let store = {
    text: text,
    path: path,
    state: OUT_SEPARATOR,
    cItems: cItems,
    bindings: [],
    sectionStart: 0,
    index: 0,
    option: option,
    meetDQ: false,
    meetSQ: false
  };
  while (store.index < store.cItems.length) {

    let item = store.cItems[store.index];
    let res;
    
    if (store.state === OUT_SEPARATOR) {
      res = _state_OUT_SEPARATOR(store);
    } else if (store.state === MEET_SEPARATOR_1) {
      res = _state_MEET_SEPARATOR_1(store);
    } else if (store.state === MEET_SEPARATOR_2) {
      res = _state_MEET_SEPARATOR_2(store);
    } else if (store.state === IN_SEPARATOR) {
      res = _state_IN_SEPARATOR(store);
    } else if (store.state === MEET_SEPARATOR_3) {
      res = _state_MEET_SEPARATOR_3(store);
    } else if (store.state === MEET_SEPARATOR_4) {
      res = _state_MEET_SEPARATOR_4(store);
    } else {
      let message = `unknow expression state for ${text}`;
      res = makeQccError(store.option, {line: item.loc.line, col: item.loc.col}, error.CODE.Z_PARSE, message);
    }
    if (res instanceof error.QccError) {
      return res;
    }
    store.index++;
  }
  //剩余字符串处理
  if (store.state === OUT_SEPARATOR) {
    let section = getSection(store.cItems, store.sectionStart, store.index - 1);
    store.bindings.push({
      type: 'static',
      section: section
    });
  } else if (store.state === MEET_SEPARATOR_1) {
    let section = getSection(store.cItems, store.sectionStart, store.index - 1);
    store.bindings.push({
      type: 'static',
      section: section
    });
  } else if (store.state === MEET_SEPARATOR_2) {
    let section = getSection(store.cItems, store.sectionStart, store.index - 1);
    let message = `did you forget }}, \' or \".\n`;
    return makeQccError(store.option, {line: section.start.loc.line, col: section.start.loc.col}, -1, message);
  } else if (store.state === IN_SEPARATOR) {
    let section = getSection(store.cItems, store.sectionStart, store.index - 1);
    let message = `did you forget }}, \' or \".\n`;
    return makeQccError(store.option, {line: section.start.loc.line, col: section.start.loc.col}, -1, message);
  } else if (store.state === MEET_SEPARATOR_3) {
    let section = getSection(store.cItems, store.sectionStart, store.index - 1);
    let message = `did you forget }}, \' or \".\n`;
    return makeQccError(store.option, {line: section.start.loc.line, col: section.start.loc.col}, -1, message);
  } else if (store.state === MEET_SEPARATOR_4) {
    if (store.sectionStart < store.index - 2) {
      let section = getSection(store.cItems, store.sectionStart, store.index - 3);
      store.bindings.push({
        type: 'bind',
        section: section
      });
    }
  }
  return store.bindings;
}

exports.parse = function (text, option = {}) {
  if (option.isStatic) {
    option.node.isStatic = true;
    //只能是静态的，直接返回
    if(option.wcc.cmd.ds){
      return `[3, '${util.escapeTxt(text)}'], [\"${option.path}\", ${option.loc.line}, ${option.loc.col}]`;
    }else{
      return `[3, '${util.escapeTxt(text)}']`;
    }
  }
  let bindings = parseBinding(text, option);
  if (bindings instanceof error.QccError) {
    return bindings;
  }
  //没有数据绑定，长度为1，类型为static
  if (bindings.length === 1 && bindings[0].type === 'static') {
    option.node.isStatic = true;
    if(option.wcc.cmd.ds){
      return `[3, '${util.escapeTxt(bindings[0].section.str)}'], [\"${option.path}\", ${option.loc.line}, ${option.loc.col}]`;
    }else{
      return `[3, '${util.escapeTxt(bindings[0].section.str)}']`;
    }
  }
  //存在数据绑定
  let parseRes = [];
  for (let i = 0; i < bindings.length; ++i) {
    let exp = parseExp(bindings[i], option);
    if (exp instanceof error.QccError) {
      return exp;
    }
    parseRes.push(exp);
  }
  let res = ``;
  if (parseRes.length > 1) {
    //大于一个解析结果
    option.node.isStatic = false;
    res = `[a, ${parseRes.join(",")}]`;
  } else if (parseRes.length === 1 && option.type === 'text') {
    //一个文本节点
    option.node.isStatic = false;
    res = `[a, ${parseRes[0]}]`;
  } else if (parseRes.length === 1 && !(option.type === 'text')) {
    //一个非文本节点
    option.node.isStatic = false;
    res = parseRes[0];
  } else {
    // length 为0 
    option.node.isStatic = true;
    res = `[3, '${util.escapeTxt(text)}']`;
  }
  if(option.wcc.cmd.ds){
    res = `${res}, [\"${option.path}\", ${option.loc.line}, ${option.loc.col}]`;
  }
  return res;
}

function parseExp(binding, option) {
  if (binding.type === 'static') {
    return `[3, '${util.escapeTxt(binding.section.str)}']`;
  } else if (binding.type === 'bind') {
    let ast;
    let sholdWrapAsObject = option.sholdWrapAsObject;
    let path = option.path;
    let txt = binding.section.str;
    let loc = binding.section.start.loc;
    try {
      if (sholdWrapAsObject) {
        txt = `obj = {${txt}}`
      }
      ast = babelParser.parse(txt, {
        plugins: ['objectRestSpread']
      });
      if (sholdWrapAsObject) {
        ast = ast.program.body[0].expression.right;
      }
    } catch (err) {
      let message = err.message.replace(', expected ";"', '');
      return makeQccError(option, loc, error.CODE.BABEL_PARSE_EXPRESSIO, message);
    }

    return walk(ast, binding, option, false);
  } else {
    return ``;
  }
}

function makeQccError(option, loc = {
  line: -1,
  col: -1
}, code, message) {
  if (option.type === 'attribute') {
    message = `${option.path}:${option.node.name.start.loc.line}:${option.node.name.start.loc.col}: Bad attr \`${option.node.name.str}\` with message: ${message} at ${loc.line}:${loc.col}.\n`;
    return (new error.QccError(code, message));
  } else if (option.type === 'text') {
    message = `${option.path}:${option.node.value.start.loc.line}:${option.node.value.start.loc.col}: Bad value with message: ${message} at ${loc.line}:${loc.col}.\n`;
    return (new error.QccError(code, message));
  }else{
    message = `${option.path}:${option.node.value.start.loc.line}:${option.node.value.start.loc.col}: unknow binding type at ${loc.line}:${loc.col}.\n`;
    return (new error.QccError(code, message));
  }
}

function walk(node, binding, option, isStatic) {
  if (node) {
    if (babelTypes.isFile(node)) {
      return walk(node.program, binding, option, isStatic);
    } else if (babelTypes.isProgram(node)) {
      if (node.body && node.body.length === 1) {
        return walk(node.body[0], binding, option, isStatic);
      } else if (node.body && node.body.length > 1) {
        return makeQccError(option, {}, -1, 'too much expression');
      } else if (node.directives && node.directives.length === 1) {
        /**
        {{"hello"}} 会被解析为directives属性的type为Directive的节点，节点的value的type为DirectiveLiteral
        */
        return walk(node.directives[0], binding, option, isStatic);
      } else if (node.directives && node.directives.length > 1) {
        return makeQccError(option, {}, error.CODE.TOO_MUCH_AST_DIRECTIVES, 'too much expression');
      } else {
        return '';
      }
    } else if (babelTypes.isExpressionStatement(node)) {
      return walk(node.expression, binding, option, isStatic);
    } else if (babelTypes.isIdentifier(node)) {
      if (isStatic) {
        return `[3, "${node.name}"]`;
      } else {
        return `[[7],[3, "${node.name}"]]`;
      }
    } else if (babelTypes.isRegExpLiteral(node) || babelTypes.isBooleanLiteral(node) || babelTypes.isNumericLiteral(node)) {
      return `[1, ${(node.value)}]`;
    } else if(babelTypes.isNullLiteral(node)){
      return `[1, null]`;
    } else if (babelTypes.isStringLiteral(node)) {
      return `[1, "${util.escapeTxt(node.value)}"]`;
    } else if (babelTypes.isMemberExpression(node)) {
      /*
      对象取属性值: a.b 或者 a['b']
      computed: 属性是否需要求值
      */
      let objectRes = walk(node.object, binding, option, isStatic);
      if (objectRes instanceof error.QccError) {
        return objectRes;
      }
      let propertyRes = walk(node.property, binding, option, !node.computed);
      if (propertyRes instanceof error.QccError) {
        return propertyRes;
      }
      return `[[6],${objectRes},${propertyRes}]`;
    } else if (babelTypes.isBinaryExpression(node)) {
      /*
      二元表达式
      */
      let leftRes = walk(node.left, binding, option, isStatic);
      if (leftRes instanceof error.QccError) {
        return leftRes;
      }
      let rightRes = walk(node.right, binding, option, isStatic);
      if (rightRes instanceof error.QccError) {
        return rightRes;
      }
      return `[[2, "${node.operator}"], ${leftRes}, ${rightRes}]`;
    } else if (babelTypes.isLogicalExpression(node)) {
      /*
      逻辑表达式
      */
      let leftRes = walk(node.left, binding, option, isStatic);
      if (leftRes instanceof error.QccError) {
        return leftRes;
      }
      let rightRes = walk(node.right, binding, option, isStatic);
      if (rightRes instanceof error.QccError) {
        return rightRes;
      }
      return `[[2, "${node.operator}"],${leftRes},${rightRes}]`;
    } else if (babelTypes.isUnaryExpression(node)) {
      /*
      一元表达式，只有一个操作数
      */
      let argumentRes = walk(node.argument, binding, option, isStatic);
      if (argumentRes instanceof error.QccError) {
        return argumentRes;
      }
      return `[[2, "${node.operator}"], ${argumentRes}]`;
    } else if (babelTypes.isArrayExpression(node)) {
      /*
      数组
      第一项是[4]
      第二项是一个数组，数组第一项是[5]，
      */
      if (node.elements.length) {
        //数组长度可能为1, 2, 3...
        let arrRes = node.elements.reduce(function (preRes, curNode) {
          if (preRes instanceof error.QccError) {
            return preRes;
          } else {
            let curRes = walk(curNode, binding, option, isStatic);
            if (curRes instanceof error.QccError) {
              return curRes;
            } else {
              return `[[5], ${preRes} ${preRes && ','}${curRes}]`;
            }
          }
        }, '');

        if (arrRes instanceof error.QccError) {
          return arrRes;
        }
        return `[[4], ${arrRes}]`;
      } else {
        //数组为空
        return `[[4], [[5]]]`;
      }
    } else if (babelTypes.isSpreadElement(node)) {
      /**
      template的析构赋值
      <template is="msgItem" data="{{...item}}" />
      */
      let argumentRes = walk(node.argument, binding, option, isStatic);
      if (argumentRes instanceof error.QccError) {
        return argumentRes;
      }
      return `[[10], ${argumentRes}]`;
    } else if (babelTypes.isConditionalExpression(node)) {
      /**
      三元运算符 a ? b : c
      */
      let consequentRes = walk(node.consequent, binding, option, isStatic);
      if (consequentRes instanceof error.QccError) {
        return consequentRes;
      }
      let alternateRes = walk(node.alternate, binding, option, isStatic);
      if (alternateRes instanceof error.QccError) {
        return alternateRes;
      }
      let testRes = walk(node.test, binding, option, isStatic);
      if (testRes instanceof error.QccError) {
        return testRes;
      }
      return `[[2,'?:'],${testRes},${consequentRes},${alternateRes}]`;
    } else if (babelTypes.isObjectExpression(node)) {
      /**
      对象表达式
      */
      if (node.properties.length === 1) {
        /** 
        只有一个属性，继续walk，最后返回的是[[8], 'xxx', xxx]
        */
        return walk(node.properties[0], binding, option, isStatic);
      } else if (node.properties.length > 1) {
        /**
        多于一个属性，返回[[9], [xxx], [xxx]]
        */
        let res = ''
        let props = node.properties || [];
        //先取前两个
        let prop0Res = walk(props[0], binding, option, isStatic);
        if (prop0Res instanceof error.QccError) {
          return prop0Res;
        }
        let prop1Res = walk(props[1], binding, option, isStatic);
        if (prop1Res instanceof error.QccError) {
          return prop1Res;
        }
        res = `[[9], ${prop0Res}, ${prop1Res}]`;
        //大于两个，后面继续合并为依赖
        for (let i = 2, len = props.length; i < len; i++) {
          let propRes = walk(props[i], binding, option, isStatic);
          if (propRes instanceof error.QccError) {
            return propRes;
          }
          res = `[[9], ${res}, ${propRes}]`;
        }
        return res;
      } else {
        return ``;
      }

    } else if (babelTypes.isDirective(node)) {
      return walk(node.value, binding, option, isStatic);
    } else if (babelTypes.isThisExpression(node)) {
      /**
      this表达式
      */
      return `[[7], [3, 'this']]`;
    } else if (babelTypes.isObjectProperty(node)) {
      /**
      对象属性
      */
      if (node.key.name && typeof node.value === 'object') {
        let valueRes = walk(node.value, binding, option, isStatic);
        if (valueRes instanceof error.QccError) {
          return valueRes;
        }
        return `[[8], "${node.key.name}", ${valueRes}]`;
      } else {
        return ``;
      }
    } else if (babelTypes.isDirective(node)) {
      return walk(node.value, binding, option, isStatic);
    } else if (babelTypes.isDirectiveLiteral(node)) {
      return `[1, "${node.value}"]`;
    } else if (babelTypes.isCallExpression(node)) {
      /**
       * 函数调用，例如wxs函数调用
       * 调用的函数
       * 函数的参数为一个数组
       */
      let callee = node.callee;
      let arguments = node.arguments || [];
      let res = ``;
      let calleeRes = walk(callee, binding, option, isStatic);
      if (calleeRes instanceof error.QccError) {
        return calleeRes;
      }
      if (arguments.length) {
        let argumentsRes = arguments.reduce((preRes, curNode) => {
          if (preRes instanceof error.QccError) {
            return preRes;
          }
          let curRes = walk(curNode, binding, option, isStatic);
          if (curRes instanceof error.QccError) {
            return curRes;
          }
          return `[[5], ${preRes} ${preRes && ','}${curRes}]`;
        }, '');
        if (argumentsRes instanceof error.QccError) {
          return argumentsRes;
        }
        res = `[[12], ${calleeRes}, ${argumentsRes}]`;
      } else {
        res = `[[12], ${calleeRes}, [ [5] ] ]`;
      }
      return res;
    } else {
      //非法的表达式
      return makeQccError(option, {
        line: binding.section.start.loc.line + node.loc.start.line - 1,
        col: binding.section.start.loc.col + node.loc.start.column
      }, error.CODE.WRONG_EXPRESSION_TYPE, 'unknow expression');

    }

  } else {
    return ``;
  }
}
