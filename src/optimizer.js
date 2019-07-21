/**
 * optimize the ml ast tree
 */
const zParser = require('./zParser.js');
const xsParser = require('./xsParser.js');
const util = require('./util.js');
const error = require('./error.js');

function dfsWalk(root, parentNode, node, wcc) {
  let res;
  if (node.optimized) {
    return;
  }
  node.optimized = true;
  node.children = node.children || [];
  if (node.type === 'root') {
    //do nothing
  } else if (node.type === 'tag') {
    res = processTag(root, parentNode, node, wcc);
  } else if (node.type === 'text') {
    res = processText(root, parentNode, node, wcc);
  }

  if (res instanceof error.QccError) {
    return res;
  }

  while (true) {
    let childIdx = -1;
    for (let i = 0; i < node.children.length; ++i) {
      if (!node.children[i].optimized) {
        childIdx = i;
        break;
      }
    }
    if (childIdx >= 0) {
      res = dfsWalk(root, node, node.children[childIdx], wcc);
      if (res instanceof error.QccError) {
        return res;
      }
    } else {
      break;
    }
  }

  if(wcc.cmd.msn){
    if (node.type === 'tag') {
      let isStatic = true;
      let attributes = node.attributes || [];
      let children = node.children || [];
      for(let i = 0; i < attributes.length; ++i){
        isStatic = attributes[i].isStatic;
        if(!isStatic){
          break;
        }
      }
      if(isStatic){
        for(let i = 0; i < children.length; ++i){
          isStatic = children[i].isStatic;
          if(!isStatic){
            break;
          }
        }
      }
      node.isStatic = isStatic;
      if(node.isStatic){
        //非特殊的标签，才把子节点的isStatic属性去掉
        if(! (isTag(node, 'include') || isTag(node, 'import') || isTag(node, 'template') || isTag(node, 'block') ) ){
          for(let i = 0; i < children.length; ++i){
            children[i].isStatic = false;
          }
        }
        // try{
        //   node.rawHash = hash.sha256(JSON.stringify(node));
        //   for(let i = 0; i < attributes.length; ++i){
        //     delete attributes[i].isStatic;
        //   }
        // }catch(err){
        //   let path = root.path;
        //   let code = -1;
        //   let message = `${path}:${node.openTag.start.loc.line}:${node.openTag.start.loc.col}: rawHash calculate fail, ${err.message}\n`;
        //   return (new error.QccError(code, message));
        // }
      }
    }else if(node.type === 'text'){
      // if(node.isStatic){
        // try{
        //   node.rawHash = hash.sha256(JSON.stringify(node));
        // }catch(err){
        //   let path = root.path;
        //   let code = -1;
        //   let message = `${path}:${node.openTag.start.loc.line}:${node.openTag.start.loc.col}: rawHash calculate fail, ${err.message}\n`;
        //   return (new error.QccError(code, message));
        // }
      // }
    }
  }
  return res;
};

exports.optimize = function (templatesObjs = [], wcc) {
  let qccError;
  for (let idx = 0; idx < templatesObjs.length; ++idx) {
    let templatesObj = templatesObjs[idx];
    if (templatesObj.type === 'xml') {
      let ast = templatesObj.ast;
      ast.info.z = []; // z数组
      ast.info.ti = []; //import 数组
      ast.info.ic = []; //include 数组
      ast.template = []; // template 定义
      ast.xsD = []; //xs define
      ast.xsR = []; //xs require
      if (ast.optimized) {
        return;
      }
      let res = dfsWalk(ast, null, ast, wcc);
      if (res instanceof error.QccError) {
        qccError = res;
        break;
      }
    } else if (templatesObj.type === 'xs') {
      let parseRes = xsParser.parse(templatesObj.template, templatesObj.path || '', 1, wcc);
      if (parseRes instanceof error.QccError) {
        qccError = parseRes;
        break;
      }
      templatesObj.template = parseRes;
    }
  }
  if (qccError) {
    return qccError;
  } else {
    return templatesObjs;
  }
};

function processTag(root, parentNode, node, wcc) {
  let res;
  uniqueAttributes(node, wcc);
  if (isTag(node, 'include')) {
    res = processIncludeTag(root, parentNode, node, wcc);
  } else if (isTag(node, 'import')) {
    res = processImportTag(root, parentNode, node, wcc);
  } else if (isTag(node, 'template')) {
    res = processTemplateTag(root, parentNode, node, wcc);
  } else if (isTag(node, 'block')) {
    res = processBlockTag(root, parentNode, node, wcc);
  } else if (isTag(node, 'wxs')) {
    res = processWxsTag(root, parentNode, node, wcc);
  }
  if(res instanceof error.QccError){
    return res;
  }
  res = processGenericAttribute(root, parentNode, node, wcc); //抽象节点处理
  res = processForAttribute(root, parentNode, node, wcc);
  res = processIfAttribute(root, parentNode, node, wcc);
  res = processAttributes(root, parentNode, node, wcc);
  return res;
}

function isTag(node, tag) {
  let tagName = node.openTag.str;
  if (tagName === tag) {
    return true;
  } else {
    return false;
  }
}


function processGenericAttribute(root, parentNode, node, wcc) {
  let genericAttributes = getAndRemoveAttribute(node, {
    prefix: 'generic:'
  });
  node.generics = [];
  for (let i = 0; i < genericAttributes.length; ++i) {
    genericAttributes[i].name.str = genericAttributes[i].name.str.substring(8);
    let res = processAttribute(root, node, genericAttributes[i], wcc);
    if (res instanceof error.QccError) {
      return res;
    }
    node.generics.push(genericAttributes[i]);
  }
}

function processForAttribute(root, parentNode, node, wcc) {
  let forAttribute = getAndRemoveSpecialAttribute(node, 'for');
  if (!forAttribute) {
    forAttribute = getAndRemoveSpecialAttribute(node, 'for-items');
  } else {
    getAndRemoveSpecialAttribute(node, 'for-items');
  }
  if (!forAttribute || !forAttribute.value || !forAttribute.value.str) {
    getAndRemoveSpecialAttribute(node, 'for-index');
    getAndRemoveSpecialAttribute(node, 'for-item');
    getAndRemoveSpecialAttribute(node, 'key');
    return;
  }
  let forIndexAttribute = getAndRemoveSpecialAttribute(node, 'for-index');
  let forItemAttribute = getAndRemoveSpecialAttribute(node, 'for-item');
  let keyAttribute = getAndRemoveSpecialAttribute(node, 'key');
  let res = processAttribute(root, node, forAttribute, wcc);
  if (res instanceof error.QccError) {
    return res;
  }
  node.for = forAttribute;
  if (forIndexAttribute && forIndexAttribute.value && forIndexAttribute.value.str) {
    let res = processAttribute(root, node, forIndexAttribute, wcc);
    if (res instanceof error.QccError) {
      return res;
    }
    node.forIndex = forIndexAttribute;
  }
  if (forItemAttribute && forItemAttribute.value && forItemAttribute.value.str) {
    let res = processAttribute(root, node, forItemAttribute, wcc);
    if (res instanceof error.QccError) {
      return res;
    }
    node.forItem = forItemAttribute;
  }
  if (keyAttribute && keyAttribute.value && typeof  keyAttribute.value.str === 'string' ) {
    let res = processAttribute(root, node, keyAttribute, wcc);
    if (res instanceof error.QccError) {
      return res;
    }
    node.key = keyAttribute;
  }
}

function processIfAttribute(root, parentNode, node, wcc) {
  let ifAttribute = getAndRemoveSpecialAttribute(node, 'if');
  if (!ifAttribute) {
    ifAttribute = getAndRemoveAttribute(node, {
      name: 'wxIf'
    }); // wx-if 也支持，无语了
  }
  if (ifAttribute && ifAttribute.value && ifAttribute.value.str) {
    let res = processAttribute(root, node, ifAttribute, wcc);
    if (res instanceof error.QccError) {
      return res;
    }
    node.if = ifAttribute;
    node.ifSiblings = [];
    let startIdx = parentNode.children.indexOf(node);
    let endIdx = startIdx;
    for (let i = startIdx + 1; i < parentNode.children.length; ++i) {
      let curNode = parentNode.children[i];
      uniqueAttributes(curNode, wcc); //这里提前处理了兄弟节点，需要预处理下兄弟节点的属性
      let elifAttribute = getAndRemoveSpecialAttribute(curNode, 'elif');
      let elseAttribute = getAndRemoveSpecialAttribute(curNode, 'else');
      if (elseAttribute) {
        let res = processAttribute(root, node, elseAttribute, wcc);
        if (res instanceof error.QccError) {
          return res;
        }
        curNode.else = elseAttribute;
        curNode.ifSibling = true;
        endIdx = i;
        break;
      } else if (elifAttribute && elifAttribute.value && elifAttribute.value.str) {
        let res = processAttribute(root, node, elifAttribute, wcc);
        if (res instanceof error.QccError) {
          return res;
        }
        curNode.elif = elifAttribute;
        curNode.ifSibling = true;
        endIdx = i;
      } else {
        break;
      }
    }
    startIdx++;
    for (let i = startIdx; i <= endIdx; ++i) {
      node.ifSiblings.push(parentNode.children[i]);
    }
    getAndRemoveSpecialAttribute(node, 'elif');
    getAndRemoveSpecialAttribute(node, 'else');
  }

}

function processIncludeTag(root, parentNode, node, wcc) {
  let srcAttribute = getAndRemoveAttribute(node, {
    name: 'src'
  });
  if (srcAttribute && srcAttribute.value.str) {
    node.include = srcAttribute;
  }else{
    removeChild(parentNode, node);
  }
}

function processImportTag(root, parentNode, node, wcc) {
  let srcAttribute = getAndRemoveAttribute(node, {
    name: 'src'
  });
  if (srcAttribute && srcAttribute.value.str) {
    node.import = srcAttribute;
  }else{
    removeChild(parentNode, node);
  }
}

function processTemplateTag(root, parentNode, node, wcc) {
  let nameAttribute = getAndRemoveAttribute(node, {
    name: 'name'
  });
  let isAttribute = getAndRemoveAttribute(node, {
    name: 'is'
  });
  let dataAttribute = getAndRemoveAttribute(node, {
    name: 'data'
  });
  if (nameAttribute && nameAttribute.value && nameAttribute.value.str) {
    //template定义
    let res = processAttribute(root, node, nameAttribute, wcc);
    if (res instanceof error.QccError) {
      return res;
    }
    node.name = nameAttribute;
    removeChild(parentNode, node);
    root.template.push(node);
  } else if (isAttribute && isAttribute.value && isAttribute.value.str) {
    //template引用
    let res = processAttribute(root, node, isAttribute, wcc);
    if (res instanceof error.QccError) {
      return res;
    }
    node.is = isAttribute;
    if (dataAttribute && dataAttribute.value && dataAttribute.value.str) {
      let res = processAttribute(root, node, dataAttribute, wcc);
      if (res instanceof error.QccError) {
        return res;
      }
      node.data = dataAttribute;
    }
  }else{
    removeChild(parentNode, node);
  }
}

function processBlockTag(root, parentNode, node, wcc) {
  node.block = true;
}

function processWxsTag(root, parentNode, node, wcc) {
  let srcAttribute = getAndRemoveAttribute(node, {
    name: 'src'
  });
  let moduleAttribute = getAndRemoveAttribute(node, {
    name: 'module'
  });
  if (moduleAttribute && moduleAttribute.value) {
    if (srcAttribute && srcAttribute.value && srcAttribute.value.str) {
      //wxs外部依赖
      let src = srcAttribute.value.str;
      let path = root.path;
      let handledSrc = util.getNormalizePath(path, src);
      if(wcc.existTemplateObj(handledSrc)){
        root.xsR.push({
          src: srcAttribute,
          module: moduleAttribute,
          type: 'p_'
        });
      }else{
        let code = -1;
        let message = `${path}:${node.openTag.start.loc.line}:${node.openTag.start.loc.col}: ${src} not found from ${path}\n`;
        return (new error.QccError(code, message));
      }


    } else {
      //wxs内部依赖
      root.xsR.push({
        module: moduleAttribute,
        type: 'm_'
      });
      //wxs定义
      let children = node.children || [];
      if (children.length && children[0] && children[0].type === 'text' && children[0].value.str) {
        let parseRes = xsParser.parse(children[0].value.str, root.path || '', children[0].value.start.loc.line, wcc);
        if (parseRes instanceof error.QccError) {
          return parseRes;
        }
        children[0].value.str = parseRes;
        root.xsD.push({
          module: moduleAttribute,
          source: children[0]
        });
      }
    }
  }else{
    let path = root.path;
    let code = -1;
    let message = `${path}:${node.openTag.start.loc.line}:${node.openTag.start.loc.col}: module expected in wxs tag\n`;
    return (new error.QccError(code, message));
  }
  removeChild(parentNode, node);
  node.children = [];
};

function processAttributes(root, parentNode, node, wcc) {
  let attribute = getAndRemoveSpecialAttribute(node, 'else');
  if(attribute){
    let path = root.path;
    let code = -1;
    let message = `${path}:${attribute.name.start.loc.line}:${attribute.name.start.loc.col}: Bad attr \`wx:else\` with message: \`wx:if not found, then something must be wrong\`.\n`;
    return (new error.QccError(code, message));
  }
  attribute = getAndRemoveSpecialAttribute(node, 'elif');
  if(getAndRemoveSpecialAttribute(node, 'elif')){
    let path = root.path;
    let code = -1;
    let message = `${path}:${attribute.name.start.loc.line}:${attribute.name.start.loc.col}: Bad attr \`wx:elif\` with message: \`wx:if not found, then something must be wrong\`.\n`;
  }
  node.attributes = node.attributes || [];
  for (let i = 0; i < node.attributes.length; ++i) {
    let res = processAttribute(root, node, node.attributes[i], wcc);
    if (res instanceof error.QccError) {
      return res;
    }
  }
}

function camelizeAttributeKey(key) {
  if (key.substring(0, 5) === 'data-') {
    return key;
  } else if (key.substring(0, 3) === 'wx:') {
    return key;
  } else if (key.substring(0, 8) === 'generic:') {
    return key;
  } else if (key.substring(0, 13) === 'capture-bind:') {
    return key;
  } else {
    return util.camelize(key);
  }
};
/**
 * @description make a default attribute value
 * @param {*} attribute
 * @returns
 */
function makeDefaultAttributeValue(attribute) {
  if (attribute.value) {
    return;
  }
  attribute.value = {
    str: '',
    start: {
      c: '',
      loc: {
        line: -1,
        col: -1
      }
    },
    end: {
      c: '',
      loc: {
        line: -1,
        col: -1
      }
    }
  }
}

/**
 * @description 去掉重复的属性
 * @param {*} node
 */
function uniqueAttributes(node, wcc) {
  node.attributes = node.attributes || [];
  let newAttributes = [];
  let map = {};
  //相同属性名，取最后一个
  for (let i = node.attributes.length - 1; i >= 0; --i) {
    let attribute = node.attributes[i];
    let attributeName = attribute.name.str;
    attribute.name.str = camelizeAttributeKey(attributeName);
    let key = attribute.name.str;
    if (!map[key]) {
      newAttributes.push(attribute);
      map[key] = true;
    }
  }
  newAttributes.sort(function (attributeA, attributeB) {
    if (attributeA.name.str < attributeB.name.str) {
      return -1;
    } else if (attributeA.name.str > attributeB.name.str) {
      return 1;
    } else {
      return 0;
    }
  });
  node.attributes = newAttributes;
}
/**
 * @description 解析数据绑定
 * @param {*} root ats根节点
 * @param {*} node 节点，为attribute节点或者text节点
 * @param {*} type 节点类型，'attribute'或者'text'
 * @param {*} txt 需要解析数据绑定的字符串
 * @param {*} sholdWrapAsObject 是否需要用对象包裹数据绑定字符串，用在自定义模板的数据
 * @param {*} loc 位置信息
 * @param {*} isStatic 是否强制解析为静态的
 * @param {*} wcc qcc实例
 * @returns 解析结果或者错误对象
 */
function zParseTxt(root, node, type, txt, sholdWrapAsObject, loc, isStatic, wcc) {
  let path = root.path;
  let zParseRes = zParser.parse(txt, {
    sholdWrapAsObject,
    loc,
    path,
    isStatic,
    node,
    type,
    wcc
  });
  if (zParseRes instanceof error.QccError) {
    return zParseRes;
  }
  let zIdx = root.info.z.indexOf(zParseRes);
  if (zIdx === -1) {
    root.info.z.push(zParseRes);
    zIdx = root.info.z.length - 1;
  }
  return zIdx;
}

function processAttribute(root, ownerNode, attributeNode, wcc) {
  // !attributeNode.vale && makeDefaultAttributeValue(attributeNode);
  let attributeName = attributeNode.name.str;
  if (!attributeNode.value) {
    return;
  }
  let attributeValue = attributeNode.value.str;
  let sholdWrapAsObject = false;
  let isStatic = false;
  if (isTag(ownerNode, 'template') && attributeName === 'data') {
    sholdWrapAsObject = true;
  } else if (attributeName.indexOf('generic:') === 0) {
    //节点的 generic 引用 generic:xxx="yyy" 中，值 yyy 只能是静态值，不能包含数据绑定。
    isStatic = true;
  }
  let zIdx = zParseTxt(root, attributeNode, 'attribute', attributeValue, sholdWrapAsObject, attributeNode.value.start.loc, isStatic, wcc);
  if (zIdx instanceof error.QccError) {
    return zIdx;
  }
  attributeNode.value.zIdx = zIdx;
}

function processText(root, parentNode, textNode, wcc) {
  let textValue = textNode.value && textNode.value.str || '';
  if (!textValue) {
    return;
  }
  let zIdx = zParseTxt(root, textNode, 'text', textValue, false, textNode.value.start.loc, false, wcc);
  if (zIdx instanceof error.QccError) {
    return zIdx;
  }
  textNode.value.zIdx = zIdx;
}

function getAndRemoveAttribute(node, options = {}) {
  node.attributes = node.attributes || [];
  if (options.name) {
    let removeIdx = -1;
    for (let i = 0; i < node.attributes.length; ++i) {
      let attribute = node.attributes[i];
      if (options.name && attribute.name.str === options.name) {
        removeIdx = i;
        break;
      }
    }
    let removedAttribute = null;
    if (removeIdx >= 0) {
      removedAttribute = node.attributes[removeIdx];
      node.attributes.splice(removeIdx, 1);
    }
    return removedAttribute;
  } else if (options.prefix) {
    let newAttributes = [];
    let removedAttributes = [];
    for (let i = 0; i < node.attributes.length; ++i) {
      let attribute = node.attributes[i];
      if (options.prefix && attribute.name.str.substring(0, options.prefix.length) === options.prefix) {
        removedAttributes.push(attribute);
      } else {
        newAttributes.push(attribute);
      }
    }
    node.attributes = newAttributes;
    return removedAttributes;
  }
}

function getAndRemoveSpecialAttribute(node, name) {
  let wxName = 'wx:' + name;
  let wxAttribute = getAndRemoveAttribute(node, {
    name: wxName
  });
  if (wxAttribute) {
    return wxAttribute;
  } else {
    return null;
  }
}

function removeChild(parent, child) {
  let children = parent.children;
  let removeIdx = children.indexOf(child);
  if (removeIdx > -1) {
    children.splice(removeIdx, 1);
  }
  return removeIdx;
}