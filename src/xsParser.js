const babelParser = require('@babel/parser');
const babelTraverse = require('@babel/traverse').default;
const babelGenerate = require('@babel/generator').default;
const babelTypes = require('@babel/types');
const util = require('./util');
const acorn = require("acorn");
const error = require('./error.js');

const WhiteVariableIdentifier = [
  'delete',
  'void',
  'typeof',
  'null',
  'undefined',
  'NaN',
  'Infinity',
  'var',
  'if',
  'else',
  'true',
  'false',
  'require',
  'this',
  'function',
  'arguments',
  'return',
  'for',
  'while',
  'do',
  'break',
  'continue',
  'switch',
  'case',
  'default'
];



exports.parse = function (source, filePath, startLine, wcc) {
  startLine = startLine || 1;
  if (!source) {
    return '';
  }
  let ast;
  /**
   * https://developers.weixin.qq.com/miniprogram/dev/reference/wxs/03annotation.html
   * 第三种注释特殊处理
   * TODO 改为不用正则表达式
   */
  source = source.replace(/\*\s*\//gm, '*/');
  source = source.replace(/\/\s*\*/gm, '/*');
  let leftNum = 0;
  let i = 0;
  while (i < source.length) {
    if (((i - 1 >= 0 && source[i - 1] !== '/') || i - 1 < 0) && source[i] === '/' && ((i + 1 < source.length) && source[i + 1] === '*')) {
      leftNum++;
      i++;
    } else if (source[i] === '*' && ((i + 1 < source.length) && source[i + 1] === '/') && (i + 2 >= source.length || ((i + 2 < source.length) && source[i + 2] !== '/'))) {
      leftNum = 0;
      i++;
    }
    i++;
  }
  if (leftNum) {
    source += '*/';
  }

  try {
    //小程序的wxs是es5标准，babel没有es5的parse，先用acorn进行parse
    ast = acorn.parse(source, {
      sourceType: 'script',
      sourceFile: filePath,
      allowReserved: 'never', //保留字不能作为变量声明和属性
      ecmaVersion: 5
    });
  } catch (err) {
    let msg = err.message;
    let idx1 = msg.lastIndexOf('(');
    let msg1 = msg.substring(0, idx1);
    let message = `${filePath}:${err.loc.line + startLine - 1}:${err.loc.column}: ${err.name}: ${msg1}\n`;
    return (new error.QccError(error.CODE.ES5_PARSE_ERROR, message));
  }

  try {
    //由于babel的ast跟ESTree Spec有差异，如果es5检查通过，再用bable parse解析ast
    ast = babelParser.parse(source, {
      sourceFilename: filePath,
      // startLine: startLine,
      ecmaVersion: 5
    });
  } catch (err) {
    let msg = err.message;
    let idx1 = msg.lastIndexOf('(');
    let msg1 = msg.substring(0, idx1);
    let message = `${filePath}:${err.loc.line + startLine - 1}:${err.loc.column}: ${err.name}: ${msg1}\n`;
    return (new error.QccError(error.CODE.BABEL_PARSE_ERROR, message));
  }

  let qccError;

  babelTraverse(ast, {
    enter(path) {

      if (path.node._qcc_handled) {
        path.skip();
        return;
      }
      /**
       * 对象声明的属性不能是数字
       * a = {0: 0} 是非法的！
       */
      if (path.isObjectProperty() && babelTypes.isNumericLiteral(path.node.key)) {
        let message = `${filePath}:${path.node.key.loc.start.line + startLine - 1}:${path.node.key.loc.start.column}: Unexpected token \`:\`\n`;
        qccError = (new error.QccError(-1, message));
        path.stop();
        return;
      }

      /**
       * 判断下是否有保留标识符
       * https://developers.weixin.qq.com/miniprogram/dev/reference/wxs/02variate.html
       */
      if (path.isVariableDeclaration()) {
        //变量声明 var NaN  = 1;
        for (let i = 0; i < path.node.declarations.length; ++i) {
          let idNode = path.node.declarations[i].id;
          if (babelTypes.isIdentifier(idNode) && WhiteVariableIdentifier.indexOf(idNode.name) > -1) {
            let message = `${filePath}:${idNode.loc.start.line + startLine - 1}:${idNode.loc.start.column}: SyntaxError: invalid reserved identifier \`${idNode.name}\`\n`;
            qccError = new error.QccError(error.CODE.INVALID_RESERVED_IDENTIFIER, message);
            path.stop();
            return;
          }
        }
      }
      if (path.isIdentifier() && WhiteVariableIdentifier.indexOf(path.node.name) > -1 && babelTypes.isObjectProperty(path.parent)) {
        //对象属性 var a = {NaN: 1}
        let message = `${filePath}:${path.node.loc.start.line + startLine - 1}:${path.node.loc.start.column}: SyntaxError: invalid ObjectProperty \`${path.node.name}\`\n`;
        qccError = new error.QccError(error.CODE.INVALID_OBJECTPROPERTY, message);
        path.stop();
        return;
      }
      if (path.isIdentifier() && WhiteVariableIdentifier.indexOf(path.node.name) > -1 && babelTypes.isMemberExpression(path.parent) && path.parent.property === path.node && !path.parent.computed) {
        //对象属性访问 a.NaN
        let message = `${filePath}:${path.node.loc.start.line + startLine - 1}:${path.node.loc.start.column}: SyntaxError: invalid MemberExpression \`${path.node.name}\`\n`;
        qccError = new error.QccError(error.CODE.INVALID_MEMBEREXPRESSION, message);
        path.stop();
        return;
      }


      /**
       * 判断是否有正则表达式
       */
      if (path.isRegExpLiteral()) {
        let message = `${filePath}:${path.node.loc.start.line + startLine - 1}:${path.node.loc.start.column}: SyntaxError: Unexpected token \`/\`\n`;
        qccError = new error.QccError(error.CODE.UNEXPECTED_TOKEN, message);
        path.stop();
        return;
      }

      /**
       * 变量和属性添加nv_前缀
       */
      if (path.isIdentifier()) {
        if (path.node.name !== 'arguments' && path.node.name !== 'Infinity' && path.node.name !== 'undefined' && path.node.name !== 'NaN' && path.node.name !== 'Math' && path.node.name !== 'Number') {
          path.node.name = `nv_${path.node.name}`;
        }
      }
      if (path.isObjectProperty() && babelTypes.isStringLiteral(path.node.key)) {
        path.node.key.value = `nv_${path.node.key.value}`;
      }
      if (path.isMemberExpression() && babelTypes.isStringLiteral(path.node.property)) {
        path.node.property.value = `nv_${path.node.property.value}`;
      }

      /**
       * reqiure修改
       * 1. 路径修改
       * 2. require(a) => require(a)()
       */
      if (path.isCallExpression()) {
        let ce = path.get('callee');
        let args = path.get('arguments');
        if (ce.isIdentifier({
            name: 'require'
          }) && args.length === 1 && args[0].isStringLiteral() && /\.wxs$/.test(args[0].node.value)) {
          ce.node.name = 'nv_' + ce.node.name;
          args[0].node.value = 'p_' + util.getNormalizePath(filePath, args[0].node.value);
          let newNode = babelTypes.callExpression(path.node.callee, path.node.arguments);
          let newNode1 = babelTypes.callExpression(newNode, []);
          path.replaceWith(newNode1);
          path.skip(); // 子节点无限访问 防止无限递归traverse
        }
      }
      /**
       * this
       * 合法的两种使用场景
       * 1. 对象成员访问 var a = this.x;
       * 2. 函数调用参数 console.log(a, b, c, this)
       * 合法的场景，需要把this替换为(this.constructor === Window ? {} : this)
       */
      if (path.isThisExpression()) {
        if (!(babelTypes.isMemberExpression(path.parent) || babelTypes.isCallExpression(path.parent))) {
          let message = `${filePath}:${path.node.loc.start.line + startLine - 1}:${path.node.loc.start.column}: SyntaxError: invalid usage of identifier \`this\`\n`;
          qccError = new error.QccError(error.CODE.INVALID_THIS, message);
          path.stop();
          return;
        } else if (!path.node._qcc_handled) {

          let thisNode = babelTypes.expressionStatement(
            babelTypes.conditionalExpression(
              babelTypes.binaryExpression(
                "===",
                babelTypes.memberExpression(
                  path.node,
                  babelTypes.identifier('constructor'),
                  false
                ),
                babelTypes.identifier('Window')
              ),
              babelTypes.objectExpression([]),
              path.node
            )
          )
          path.replaceWith(thisNode);
          path.skip(); // 子节点无限访问 防止无限递归traverse
        }
      }
      /**
       * arguments
       * 合法的两种使用场景：
       * 1. 函数内部，对象成员访问,读取arguments属性
       * 2. 函数内部，函数调用参数
       * 如果函数有引用arguments，需要在函数开头增加 'arguments.nv_length = arguments.length;'
       */
      if (path.isIdentifier({
          name: 'arguments'
        })) {
        let functionPath = path.findParent((path) => path.isFunctionDeclaration()) || path.findParent((path) => path.isFunctionExpression());
        if (!(functionPath)) {
          let message = `${filePath}:${path.node.loc.start.line + startLine - 1}:${path.node.loc.start.column}: SyntaxError: invalid usage of identifier \`arguments\`\n`;
          qccError = new error.QccError(error.CODE.INVALID_ARGUMENTS, message);
          path.stop();
          return;
        } else if (!(babelTypes.isMemberExpression(path.parent) || babelTypes.isCallExpression(path.parent))) {
          let message = `${filePath}:${path.node.loc.start.line + startLine - 1}:${path.node.loc.start.column}: SyntaxError: invalid usage of identifier \`arguments\`\n`;
          qccError = new error.QccError(error.CODE.INVALID_ARGUMENTS, message);
          path.stop();
          return;
        } else {
          functionPath.node._qcc_arguments_Referenced = true;
        }
      }
      //字符串处理
      if (path.isStringLiteral()) {
        //特殊字符转换为unicode
        let tmp = path.node.extra.raw.substring(1, path.node.extra.raw.length - 1);
        tmp = util.escapeTxt(tmp);
        tmp = path.node.extra.raw[0] + tmp + path.node.extra.raw[path.node.extra.raw.length - 1];
        path.node.extra.raw = tmp;
      }
    },
    exit: function (path) {
      if ((path.isFunctionDeclaration() || path.isFunctionExpression()) && path.node._qcc_arguments_Referenced) {
        //如果函数有引用arguments，需要在函数开头增加 'arguments.nv_length = arguments.length;'
        let stateMent = babelTypes.expressionStatement(
          babelTypes.assignmentExpression(
            '=',
            babelTypes.memberExpression(
              babelTypes.identifier('arguments'),
              babelTypes.identifier('nv_length'),
              false
            ),
            babelTypes.memberExpression(
              babelTypes.identifier('arguments'),
              babelTypes.identifier('length'),
              false
            )
          )
        );
        stateMent._qcc_handled = true; // 打个标记
        path.get('body').unshiftContainer('body', stateMent);
      }
      /**
       * e['sdf' + 2] => 
       * e[((nt_1 = ('sdf' + 2), null == nt_1 ? undefined : 'number' === typeof nt_1 ? nt_1 : "nv_" + nt_1))]
       */
      if (path.isMemberExpression() && path.node.computed) {
        let oldProperty = path.node.property;
        if (!(babelTypes.isStringLiteral(oldProperty) || babelTypes.isNumericLiteral(oldProperty))) {
          let tmpVar = 'nt_1';
          let newProperty = babelTypes.sequenceExpression([
            babelTypes.assignmentExpression(
              '=',
              babelTypes.identifier(tmpVar),
              oldProperty
            ),
            babelTypes.conditionalExpression(
              babelTypes.binaryExpression(
                '==',
                babelTypes.nullLiteral(),
                babelTypes.identifier(tmpVar)
              ),
              babelTypes.identifier('undefined'),
              babelTypes.conditionalExpression(
                babelTypes.binaryExpression(
                  '===',
                  babelTypes.stringLiteral('number'),
                  babelTypes.unaryExpression(
                    'typeof',
                    babelTypes.identifier(tmpVar),
                    true
                  )
                ),
                babelTypes.identifier(tmpVar),
                babelTypes.binaryExpression(
                  '+',
                  babelTypes.stringLiteral('nv_'),
                  babelTypes.identifier(tmpVar)
                )
              )
            )
          ]);
          let oldMemberExpression = path.node;
          let newMemberExpression = babelTypes.memberExpression(
            oldMemberExpression.object,
            newProperty,
            oldMemberExpression.computed
          );
          newMemberExpression._qcc_handled = true;
          path.replaceWith(newMemberExpression);
        }
      }


    }
  });

  if (qccError) {
    return qccError;
  }
  let res;
  try {
    res = babelGenerate(ast, {
      comments: false
    }).code || '';
  } catch (e) {
    let message = `${path}: generate error:${e.message}\n`;
    return (new error.QccError(error.CODE.BABEL_GENERATE, message));
  }
  // res = res.replace(/\\\\x/gm, '\\x');
  // res = util.escapeTxt(res);
  return res;
};