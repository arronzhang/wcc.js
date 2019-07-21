/**
 * generate code
 */
const helper = require('./helper');
const template = require('./template.js');
const util = require('./util.js');
const hash = require('./hash.js');

exports.codeGenerate = function (templatesObjs, wcc) {
  let z = buildZ(templatesObjs, wcc);
  let xs = buildXs(templatesObjs, wcc);
  let m = buildM(templatesObjs, wcc);

  let code = {
    z: z,
    m: m,
    xs
  };

  return {
    code: template.getFinalCode(code, wcc),
    templatesObjs: templatesObjs
  }
};
/**
 * @description 生成z数组
 * @param {*} templatesObjs
 * @returns
 */
function buildZ(templatesObjs, wcc) {
  let zCode = [];
  templatesObjs.forEach(function (templatesObj) {
    if (templatesObj.type === 'xml') {
      let ast = templatesObj.ast;
      let idx = templatesObj.idx;
      let z = ast.info.z || [];
      zCode.push(
        `function gz${wcc.cmd.gn}_${idx + 1}(){
if( __WXML_GLOBAL__.ops_cached.${wcc.cmd.gn}_${idx + 1})return __WXML_GLOBAL__.ops_cached.${wcc.cmd.gn}_${idx + 1}
__WXML_GLOBAL__.ops_cached.${wcc.cmd.gn}_${idx + 1}=[];
(function(z){var a=11;${wcc.cmd.ds ? `function Z(ops, debugLine) {z.push([\'11182016\', ops, debugLine]);}` : `function Z(ops){z.push(ops)}`}
${z.map(zItem => `Z(${zItem});`).join('')}
})(__WXML_GLOBAL__.ops_cached.${wcc.cmd.gn}_${idx + 1});return __WXML_GLOBAL__.ops_cached.${wcc.cmd.gn}_${idx + 1}
}`);
    }
  });
  return zCode.join('');
}

function buildXs(templatesObjs, wcc) {
  let npIdx = 0;
  let nnm = {};
  let preCode = ``;
  let bodyCode = ``;
  let postCode = ``;
  let code = ``;
  templatesObjs.forEach(function (templatesObj) {
    if (templatesObj.type === 'xml') {
      let ast = templatesObj.ast;
      let path = ast.path;
      let xsD = ast.xsD;
      let xsR = ast.xsR;
      if (xsR.length) {
        bodyCode = `${bodyCode}f_[\"${path}\"] = {};`;
        xsR.forEach(function (xsRI) {
          let type = xsRI.type;
          if (type === 'p_') {
            //外部模块
            let srcAttribute = xsRI.src;
            let moduleAttribute = xsRI.module;
            let src = srcAttribute.value.str;
            let module = moduleAttribute.value.str;
            bodyCode = `${bodyCode}f_[\"${path}\"][\"${module}\"] = f_[\"${util.getNormalizePath(path, src)}\"] || nv_require(\"p_${util.getNormalizePath(path, src)}\");`;
            bodyCode = `${bodyCode}f_[\"${path}\"][\"${module}\"]();`
          } else if (type === 'm_') {
            //内部模块
            let moduleAttribute = xsRI.module;
            let module = moduleAttribute.value.str;
            bodyCode = `${bodyCode}f_[\"${path}\"][\"${module}\"] = nv_require(\"m_${path}:${module}\");`;
          }
        });
      }
      if (xsD.length) {
        xsD.forEach(function (xsDI) {
          let moduleAttribute = xsDI.module;
          let sourceNode = xsDI.source;
          let module = moduleAttribute.value.str;
          bodyCode = `${bodyCode}function np_${npIdx}(){`;
          bodyCode = `${bodyCode}var nv_module = {nv_exports: {}};`
          bodyCode = `${bodyCode}${sourceNode.value.str}`;
          bodyCode = `${bodyCode}return nv_module.nv_exports;}`;
          nnm[`m_${path}:${module}`] = `np_${npIdx}`;
          npIdx++;
        });
      }
    } else if (templatesObj.type === 'xs') {
      let path = templatesObj.path;
      bodyCode = `${bodyCode}f_[\"${path}\"] = nv_require(\"p_${path}\");`
      bodyCode = `${bodyCode}function np_${npIdx}(){`;
      bodyCode = `${bodyCode}var nv_module = {nv_exports: {}};`
      bodyCode = `${bodyCode}${templatesObj.template}`;
      bodyCode = `${bodyCode}return nv_module.nv_exports;}`;
      nnm[`p_${path}`] = `np_${npIdx}`;
      npIdx++;
    }
  });
  preCode = `${preCode}var nv_require = function () {`;
  preCode = `${preCode}var nnm = {};`;
  for (let key in nnm) {
    if (nnm.hasOwnProperty(key)) {
      preCode = `${preCode}nnm[\"${key}\"] = ${nnm[key]};`;
    }
  }
  preCode = (
    `${preCode}
var nom = {};
return function (n) {
return function () {
if (!nnm[n]) return undefined;
try {
if (!nom[n]) nom[n] = nnm[n]();
return nom[n];
} catch (e) {
e.message = e.message.replace(/nv_/g, \"\");
var tmp = e.stack.substring(0, e.stack.lastIndexOf(n));
e.stack = tmp.substring(0, tmp.lastIndexOf('\\n'));
e.stack = e.stack.replace(/\snv_/g, \" \");
e.stack = $gstack(e.stack);
e.stack += \"\\n    at \" + n.substring(2);
console.error(e);
}
}
}
}();`);
  code = `${preCode}${bodyCode}${postCode}`;
  return code;

};


/**
 * @description 模块template定义，模块渲染函数，模块imort和include依赖
 * @param {*} asts
 * @returns code代码
 */
function buildM(templatesObjs, wcc) {
  let allM = [];
  templatesObjs.forEach(function (templatesObj) {
    if (templatesObj.type === 'xml') {
      let ast = templatesObj.ast;
      let idx = templatesObj.idx;
      let path = ast.path;
      let variableNameSeed = helper.generateVariableNameSeed();
      let functionScope = {
        z: 'z',
        env: 'e',
        scope: 's',
        global: 'gg',
        nodeVariableName: 'r',
        mFunctionName: `m${idx}`,
        variableNameSeed: variableNameSeed,
        importVariableName: helper.generateVariableName(variableNameSeed),
        includeVariableName: helper.generateVariableName(variableNameSeed)
      };

      let preCode = ``;
      let bodyCode = ``;
      let postCode = ``;
      let code = ``;
      preCode = `${preCode}${buildTemplateRenderFunction(ast, idx, functionScope, wcc)}`;
      preCode = `${preCode}var ${functionScope.mFunctionName}= function(${functionScope.env}, ${functionScope.scope}, ${functionScope.nodeVariableName}, ${functionScope.global}){`;
      preCode = `${preCode}var ${functionScope.z} = gz${wcc.cmd.gn}_${idx + 1}();`;

      let preTiLen = ast.info.ti.length;
      let preIcLen = ast.info.ic.length;

      for (let i = 0; i < ast.children.length; ++i) {
        bodyCode = `${bodyCode}${buildChildBlock(ast, ast, ast.children[i], functionScope, wcc)}`;
      }
      let postTiLen = ast.info.ti.length;
      let postIcLen = ast.info.ic.length;

      if (postTiLen > preTiLen) {
        preCode = `${preCode}${functionScope.importVariableName}=e_["${path}"].i;`
        for (let i = preTiLen; i < postTiLen; ++i) {
          postCode = `${functionScope.importVariableName}.pop();${postCode}`;
        }
      }

      if (postIcLen > preIcLen) {
        preCode = `${preCode}${functionScope.includeVariableName}=e_["${path}"].j;`
        for (let i = preIcLen; i < postIcLen; ++i) {
          postCode = `${functionScope.includeVariableName}.pop();${postCode}`
        }
      }

      postCode = `${postCode}return ${functionScope.nodeVariableName};};`;
      postCode = `${postCode}e_["${path}"] = {f: ${functionScope.mFunctionName},j: [],i: [],ti: ${JSON.stringify(ast.info.ti)},ic: ${JSON.stringify(ast.info.ic)}};`

      code = `${preCode}${bodyCode}${postCode}`;
      allM.push(code);
    }
  });
  return allM.join(``);
}

function buildTemplateRenderFunction(ast, idx, parentScope, wcc) {
  let path = ast.path;
  let variableNameSeed = helper.generateVariableNameSeed();
  let functionScope = {
    z: 'z',
    env: 'e',
    scope: 's',
    global: 'gg',
    nodeVariableName: 'r',
    variableNameSeed: variableNameSeed,
    importVariableName: helper.generateVariableName(variableNameSeed),
    includeVariableName: helper.generateVariableName(variableNameSeed)
  };
  let code = ``;
  code = `${code}d_["${path}"] = {};`;
  let template = ast.template;
  for (let i = 0; i < template.length; ++i) {
    let preCode = ``;
    let bodyCode = ``;
    let postCode = ``;
    let templateName = template[i].name.value.str;
    let templatePathVariableName = helper.generateVariableName(variableNameSeed);
    preCode = `d_["${path}"]["${templateName}"] = function (${functionScope.env}, ${functionScope.scope}, ${functionScope.nodeVariableName}, ${functionScope.global}) {`;
    preCode = `${preCode}var ${functionScope.z} = gz${wcc.cmd.gn}_${idx + 1}();`;
    preCode = `${preCode}var ${templatePathVariableName} = "${path}" + ":${templateName}";`;
    preCode = `${preCode}r.wxVkey = ${templatePathVariableName};`;
    preCode = `${preCode}gg.f = $gdc(f_["${path}"], "", 1);`;
    preCode = `${preCode}if(p_[${templatePathVariableName}]){_wl(${templatePathVariableName}, "${path}");return;}`;
    preCode = `${preCode}p_[${templatePathVariableName}] = true;try {`;
    for (let j = 0; j < template[i].children.length; ++j) {
      bodyCode = `${bodyCode}${buildChildBlock(ast, ast, template[i].children[j], functionScope, wcc)}`;
    }

    postCode = `}catch (err){`;
    postCode = `${postCode}p_[${templatePathVariableName}] = false;throw err;}`;
    postCode = `${postCode}p_[${templatePathVariableName}] = false; return ${functionScope.nodeVariableName};};`
    code = `${code}${preCode}${bodyCode}${postCode}`;
  }
  return code;
}

/**
 * @description 构建产生节点元素的代码块
 * @param {*} root
 * @param {*} parentNode
 * @param {*} node
 * @returns 代码段
 */
function buildChildBlock(root, parentNode, node, parentScope, wcc) {
  let code = ``;
  if (node.type === 'tag') {
    if (node.for && !node.forBuild) {
      node.forBuild = true;
      let variableNameSeed = parentScope.variableNameSeed;
      let blockScope = {
        z: parentScope.z,
        env: parentScope.env,
        scope: parentScope.scope,
        global: parentScope.global,
        variableNameSeed: variableNameSeed,
        nodeVariableName: helper.generateVariableName(variableNameSeed),
        forElementFunctionName: helper.generateVariableName(variableNameSeed),
        importVariableName: helper.generateVariableName(variableNameSeed),
        includeVariableName: helper.generateVariableName(variableNameSeed)
      };
      let path = root.path;
      let preCode = ``;
      preCode = `var ${blockScope.nodeVariableName} = _v();`;
      preCode = `${preCode}_(${parentScope.nodeVariableName}, ${blockScope.nodeVariableName});`;
      if (wcc.cmd.d) {
        preCode = `${preCode}cs.push(\"${path}:${node.openTag.str}:${node.openTag.start.loc.line}:${node.openTag.start.loc.col}\");`;
      }
      let forElementFunctionCode = buildForElementFunction(root, parentNode, node, blockScope, wcc);
      let forIterIdx = node.for.value.zIdx;
      let indexName = node.forIndex ? node.forIndex.value.str : 'index';
      let itemName = node.forItem ? node.forItem.value.str : 'item';
      let keyName = node.key ? node.key.value.str : '';
      let postCode = ``;
      if (!node.key && wcc.cmd.d) {
        postCode = `${postCode}_wp(\"${path}:${node.openTag.str}:${node.openTag.start.loc.line}:${node.openTag.start.loc.col}: Now you can provide attr \`wx:key\` for a \`wx:for\` to improve performance.\");`;
      }
      postCode = `${postCode}${blockScope.nodeVariableName}.wxXCkey = 2;_2z(${blockScope.z}, ${forIterIdx}, ${blockScope.forElementFunctionName}, ${blockScope.env}, ${blockScope.scope}, ${blockScope.global}, ${blockScope.nodeVariableName}, \'${itemName}\', \'${indexName}\', \'${keyName}\');`;
      if (wcc.cmd.d) {
        postCode = `${postCode}cs.pop();`;
      }
      code = `${preCode}${forElementFunctionCode}${postCode}`;
      node.build = true;
    } else if ((node.if || node.else || node.elif) && !node.ifBuild) {
      let variableNameSeed = parentScope.variableNameSeed;
      let blockScope = {
        z: parentScope.z,
        env: parentScope.env,
        scope: parentScope.scope,
        global: parentScope.global,
        variableNameSeed: variableNameSeed,
        nodeVariableName: helper.generateVariableName(variableNameSeed),
        importVariableName: helper.generateVariableName(variableNameSeed),
        includeVariableName: helper.generateVariableName(variableNameSeed)
      };
      let path = root.path;
      let ifNodes = [].concat(node, node.ifSiblings);
      let preCode = ``;
      preCode = `var ${blockScope.nodeVariableName} = _v();`;
      preCode = `${preCode}_(${parentScope.nodeVariableName}, ${blockScope.nodeVariableName});`;
      let bodyCode = ``;
      let postCode = `${blockScope.nodeVariableName}.wxXCkey = 1;`;

      for (let i = 0; i < ifNodes.length; ++i) {
        ifNodes[i].ifBuild = true;
        let preTiLen = root.info.ti.length;
        let preIcLen = root.info.ic.length;
        let ifCodePre;
        let ifBodyCode = buildChildBlock(root, parentNode, ifNodes[i], blockScope, wcc);
        let ifPostCode = `}`;
        if (ifNodes[i].if) {
          let zIndex = ifNodes[i].if.value.zIdx;
          ifCodePre = `if(_oz(${blockScope.z}, ${zIndex}, ${blockScope.env}, ${blockScope.scope}, ${blockScope.global})){ ${blockScope.nodeVariableName}.wxVkey = ${i+1};`;
        } else if (ifNodes[i].elif) {
          let zIndex = ifNodes[i].elif.value.zIdx;
          ifCodePre = `else if(_oz(${blockScope.z}, ${zIndex}, ${blockScope.env}, ${blockScope.scope}, ${blockScope.global})) { ${blockScope.nodeVariableName}.wxVkey = ${i+1};`;
        } else if (ifNodes[i].else) {
          ifCodePre = `else{ ${blockScope.nodeVariableName}.wxVkey = ${i+1};`;
        }
        if (wcc.cmd.d) {
          ifCodePre = `${ifCodePre}cs.push(\"${path}:${ifNodes[i].openTag.str}:${ifNodes[i].openTag.start.loc.line}:${ifNodes[i].openTag.start.loc.col}\");`;
          ifPostCode = `cs.pop();${ifPostCode}`;
        }

        let postTiLen = root.info.ti.length;
        let postIcLen = root.info.ic.length;

        if (postTiLen > preTiLen) {
          ifCodePre = `${ifCodePre}${blockScope.importVariableName}=e_["${path}"].i;`
          for (let i = preTiLen; i < postTiLen; ++i) {
            ifPostCode = `${blockScope.importVariableName}.pop();${ifPostCode}`;
            root.info.ti.pop();
          }
        }

        if (postIcLen > preIcLen) {
          ifCodePre = `${ifCodePre}${blockScope.includeVariableName}=e_["${path}"].j;`
          for (let i = preIcLen; i < postIcLen; ++i) {
            ifPostCode = `${blockScope.includeVariableName}.pop();${ifPostCode}`
            root.info.ic.pop();
          }
        }

        bodyCode = `${bodyCode}${ifCodePre}${ifBodyCode}${ifPostCode}`;
        ifNodes[i].build = true;
      }
      code = `${preCode}${bodyCode}${postCode}`;
    } else if (node.is && !node.isBuild) {
      node.isBuild = true;
      let variableNameSeed = parentScope.variableNameSeed;
      let blockScope = {
        z: parentScope.z,
        env: parentScope.env,
        scope: parentScope.scope,
        global: parentScope.global,
        variableNameSeed: variableNameSeed,
        nodeVariableName: helper.generateVariableName(variableNameSeed),
        importVariableName: parentScope.importVariableName,
        includeVariableName: parentScope.includeVariableName
      };
      let isVariableName = helper.generateVariableName(variableNameSeed);
      let dataVariableName = helper.generateVariableName(variableNameSeed);
      let templateRenderVariableName = helper.generateVariableName(variableNameSeed);
      let path = root.path;
      let isZMapIdx = node.is.value.zIdx;
      let dataZmapIdx = -1;

      if (node.data) {
        dataZmapIdx = node.data.value.zIdx;
      }
      code = `${code}var ${blockScope.nodeVariableName} = _v();`;
      code = `${code}_(${parentScope.nodeVariableName}, ${blockScope.nodeVariableName});`;
      if (wcc.cmd.d) {
        code = `${code}cs.push(\"${path}:${node.openTag.str}:${node.openTag.start.loc.line}:${node.openTag.start.loc.col}\");`
      }
      code = `${code}var ${isVariableName} = _oz(${blockScope.z}, ${isZMapIdx}, ${blockScope.env}, ${blockScope.scope}, ${blockScope.global});`;
      code = `${code}var ${templateRenderVariableName} = _gd("${path}", ${isVariableName}, e_, d_);`;
      code = `${code}if(${templateRenderVariableName}){`;
      if (dataZmapIdx >= 0) {
        code = `${code}var ${dataVariableName} = _1z(${blockScope.z}, ${dataZmapIdx}, ${blockScope.env}, ${blockScope.scope}, ${blockScope.global}) || {};`;
      } else {
        code = `${code}var ${dataVariableName} = {};`;
      }
      code = `${code}var cur_globalf = gg.f;${blockScope.nodeVariableName}.wxXCkey = 3;${templateRenderVariableName}(${dataVariableName}, ${dataVariableName}, ${blockScope.nodeVariableName}, ${blockScope.global});gg.f = cur_globalf;`;
      code = `${code}}else{_w(${isVariableName}, "${path}", ${node.is.name.start.loc.line}, ${node.is.name.start.loc.col});}`
      if (wcc.cmd.d) {
        code = `${code}cs.pop();`
      }
      node.build = true;
    } else if (node.block && !node.blockBuild) {
      node.blockBuild = true;
      let variableNameSeed = parentScope.variableNameSeed;
      let blockScope = {
        z: parentScope.z,
        env: parentScope.env,
        scope: parentScope.scope,
        global: parentScope.global,
        variableNameSeed: variableNameSeed,
        nodeVariableName: parentScope.nodeVariableName,
        importVariableName: parentScope.importVariableName,
        includeVariableName: parentScope.includeVariableName
      };
      let path = root.path;
      let preCode = ``;
      let postCode = ``;
      if (wcc.cmd.d) {
        preCode = `${preCode}cs.push(\"${path}:${node.openTag.str}:${node.openTag.start.loc.line}:${node.openTag.start.loc.col}\");`;
        postCode = `cs.pop();${postCode}`;
      }
      let childEleCode = node.children.map(child => buildChildBlock(root, node, child, blockScope, wcc)).join('');
      code = `${preCode}${childEleCode}${postCode}`;
    } else if (node.import && !node.importBuild) {
      node.importBuild = true;
      let variableNameSeed = parentScope.variableNameSeed;
      let blockScope = {
        z: parentScope.z,
        env: parentScope.env,
        scope: parentScope.scope,
        global: parentScope.global,
        variableNameSeed: variableNameSeed,
        importVariableName: parentScope.importVariableName,
        includeVariableName: parentScope.includeVariableName
      };
      let src = node.import.value.str;
      let path = root.path;
      root.info.ti.push(src);
      code = `_ai(${blockScope.importVariableName}, "${src}", e_, "${path}", ${node.openTag.start.loc.line}, ${node.openTag.start.loc.col});`;
      node.build = true;
    } else if (node.include && !node.includeBuild) {
      node.includeBuild = true;
      let variableNameSeed = parentScope.variableNameSeed;
      let blockScope = {
        z: parentScope.z,
        env: parentScope.env,
        scope: parentScope.scope,
        global: parentScope.global,
        variableNameSeed: variableNameSeed,
        importVariableName: parentScope.importVariableName,
        includeVariableName: parentScope.includeVariableName
      };
      let src = node.include.value.str;
      let path = root.path;
      root.info.ic.push(src);
      if (wcc.cmd.d) {
        code = `${code}cs.push(\"${path}:${node.openTag.str}:${node.openTag.start.loc.line}:${node.openTag.start.loc.col}\");`;
      }
      code = `${code}_ic("${src}", e_, "${path}", ${blockScope.env}, ${blockScope.scope}, ${parentScope.nodeVariableName}, ${blockScope.global});`
      if (wcc.cmd.d) {
        code = `${code}cs.pop();`;
      }
      node.build = true;
    } else if (!node.build) {
      node.build = true;
      let variableNameSeed = parentScope.variableNameSeed;
      let blockScope = {
        z: parentScope.z,
        env: parentScope.env,
        scope: parentScope.scope,
        global: parentScope.global,
        variableNameSeed: variableNameSeed,
        nodeVariableName: helper.generateVariableName(variableNameSeed),
        importVariableName: parentScope.importVariableName,
        includeVariableName: parentScope.includeVariableName
      };
      let path = root.path;
      let attrLen = node.attributes.length;
      let attributes = node.attributes || [];
      let generics = node.generics || [];

      let preCode = '';
      let childEleCode = node.children.map(child => buildChildBlock(root, node, child, blockScope, wcc)).join('');
      let postCode = `_(${parentScope.nodeVariableName}, ${blockScope.nodeVariableName});`;
      if (wcc.cmd.d) {
        preCode = `${preCode}cs.push(\"${path}:${node.openTag.str}:${node.openTag.start.loc.line}:${node.openTag.start.loc.col}\");`;
        postCode = `cs.pop();${postCode}`;
      }
      if(attributes.length === 0 && generics.length === 0){
        if(wcc.cmd.msn){
          let rawHash = '';
          if(node.isStatic){
            try{
              rawHash = hash.sha256(JSON.stringify(node));
            }catch(err){
              node.isStatic = false;
              rawHash = '';
            }
          }
          preCode = `${preCode}var ${blockScope.nodeVariableName} = _n(\"${node.openTag.str}\", ${node.isStatic || false}, \"${rawHash || ''}\");`;
        }else{
          preCode = `${preCode}var ${blockScope.nodeVariableName} = _n(\"${node.openTag.str}\", false);`;
        }

      }else if(attributes.length === 1 && generics.length === 0){
        let attribute = node.attributes[0];
        if(wcc.cmd.msn){
          let rawHash = '';
          if(node.isStatic){
            try{
              rawHash = hash.sha256(JSON.stringify(node));
            }catch(err){
              node.isStatic = false;
              rawHash = '';
            }
          }
          preCode = `${preCode}var ${blockScope.nodeVariableName} = _n(\"${node.openTag.str}\", ${node.isStatic || false}, \"${rawHash || ''}\");`;
        }else{
          preCode = `${preCode}var ${blockScope.nodeVariableName} = _n(\"${node.openTag.str}\", false);`;
        }
        if(!attribute.value){
          preCode = `${preCode}${blockScope.nodeVariableName}.attr[\"${attribute.name.str}\"] = true;`
        }else{
          preCode = `${preCode}_rz(${blockScope.z}, ${blockScope.nodeVariableName}, '${attribute.name.str}', ${attribute.value.zIdx}, ${blockScope.env}, ${blockScope.scope}, ${blockScope.global});`;
        }
        
      }else if(attributes.length === 0 && generics.length === 1){
        let generic = generics[0];
        if(wcc.cmd.msn){
          let rawHash = '';
          if(node.isStatic){
            try{
              rawHash = hash.sha256(JSON.stringify(node));
            }catch(err){
              node.isStatic = false;
              rawHash = '';
            }
          }
          preCode = `${preCode}var ${blockScope.nodeVariableName} = _n(\"${node.openTag.str}\", ${node.isStatic || false}, \"${rawHash || ''}\");`;
        }else{
          preCode = `${preCode}var ${blockScope.nodeVariableName} = _n(\"${node.openTag.str}\", false);`
        }

        if(!generic.value){
          preCode = `${preCode}${blockScope.nodeVariableName}.generics[\"${'wx-' + generic.name.str}\"] = \"\";`;
        }else{
          preCode = `${preCode}var $tmp = grb(z[${generic.value.zIdx}], ${blockScope.env}, ${blockScope.scope}, ${blockScope.global});`;
          preCode = `${preCode}if($tmp != \"\"){$tmp = \"wx-\" + $tmp;}`;
          preCode = `${preCode}${blockScope.nodeVariableName}.generics[\"${'wx-' + generic.name.str}\"] = $tmp;`;
        }

      }else{
        let zgIdxRes = helper.getAttrsZGIdx(root, node);
        if(wcc.cmd.msn){
          let rawHash = '';
          if(node.isStatic){
            try{
              rawHash = hash.sha256(JSON.stringify(node));
            }catch(err){
              node.isStatic = false;
              rawHash = '';
            }
          }
          preCode = `${preCode}var ${blockScope.nodeVariableName} = _mz(${blockScope.z}, '${node.openTag.str}', ${zgIdxRes.attrs}, ${zgIdxRes.generics}, ${blockScope.env},${blockScope.scope},${blockScope.global},${node.isStatic || false},\"${rawHash || ''}\");`;
        }else{
          preCode = `${preCode}var ${blockScope.nodeVariableName} = _mz(${blockScope.z}, '${node.openTag.str}', ${zgIdxRes.attrs}, ${zgIdxRes.generics}, ${blockScope.env},${blockScope.scope},${blockScope.global},false);`;
        }

      }

      code = `${preCode}${childEleCode}${postCode}`;
    }
  } else if (node.type === 'text') {
    let variableNameSeed = parentScope.variableNameSeed;
    let blockScope = {
      z: parentScope.z,
      env: parentScope.env,
      scope: parentScope.scope,
      global: parentScope.global,
      variableNameSeed: variableNameSeed,
      nodeVariableName: helper.generateVariableName(variableNameSeed)
    };
    let preCode = `var ${blockScope.nodeVariableName} = _oz(${blockScope.z}, ${node.value.zIdx}, ${blockScope.env}, ${blockScope.scope}, ${blockScope.global});`;
    let postCode = `_(${parentScope.nodeVariableName}, ${blockScope.nodeVariableName});`;
    code = `${preCode}${postCode}`;
  }
  return code;
}

function buildForElementFunction(root, parentNode, node, parentScope, wcc) {
  let variableNameSeed = helper.generateVariableNameSeed();
  let functionScope = {
    z: parentScope.z,
    env: helper.generateVariableName(variableNameSeed),
    scope: helper.generateVariableName(variableNameSeed),
    global: helper.generateVariableName(variableNameSeed),
    nodeVariableName: helper.generateVariableName(variableNameSeed),
    variableNameSeed: variableNameSeed,
    importVariableName: parentScope.importVariableName,
    includeVariableName: parentScope.includeVariableName
  };
  let path = root.path;
  let preTiLen = root.info.ti.length;
  let preIcLen = root.info.ic.length;

  let preCode = `var ${parentScope.forElementFunctionName} = function (${functionScope.env}, ${functionScope.scope}, ${functionScope.nodeVariableName}, ${functionScope.global}) {`;
  let bodyCode = buildChildBlock(root, parentNode, node, functionScope, wcc);
  let postCode = `return ${functionScope.nodeVariableName};};`;

  let postTiLen = root.info.ti.length;
  let postIcLen = root.info.ic.length;

  if (postTiLen > preTiLen) {
    preCode = `${preCode}${functionScope.importVariableName}=e_["${path}"].i;`
    for (let i = preTiLen; i < postTiLen; ++i) {
      postCode = `${functionScope.importVariableName}.pop();${postCode}`;
      root.info.ti.pop();
    }
  }

  if (postIcLen > preIcLen) {
    preCode = `${preCode}${functionScope.includeVariableName}=e_["${path}"].j;`
    for (let i = preIcLen; i < postIcLen; ++i) {
      postCode = `${functionScope.includeVariableName}.pop();${postCode}`
      root.info.ic.pop();
    }
  }

  let code = `${preCode}${bodyCode}${postCode}`;
  return code;
}