const astParser = require('./astParser.js');
const optimizer = require('./optimizer.js');
const codeGenerater = require('./codeGenerater.js');
const error = require('./error.js');

class WCC {
  constructor(config) {
    this.templatesObjs = [];
    this.asts = [];
    this.out = [];
    this.config = config;
    this.cmd = {};
    this.parseCmd();
  }
  async parse(templatesObjs) {
    let wcc = this;
    return new Promise(function (resolve, reject) {
      wcc.errorCallback = function (err) {
        if (err) {
          reject(err);
        }
      };
      //sort by path
      templatesObjs.sort(function (templatesObjA, templatesObjsB) {
        if (templatesObjA.path < templatesObjsB.path) {
          return -1;
        } else if (templatesObjA.path > templatesObjsB.path) {
          return 1;
        } else {
          return 0;
        }
      });
      let xmlIdx = 0;
      for (let i = 0; i < templatesObjs.length; ++i) {
        let path = templatesObjs[i].path || "";
        let template = templatesObjs[i].template || "";
        if (path && template) {
          path = path.replace(/\.qs$/, '.wxs'); //统一后缀
          path = path.replace(/\.qml$/, '.wxml'); //统一后缀
          if (/\.wxs$/.test(path)) {
            //transform xs files
            wcc.templatesObjs.push({
              path: path,
              template: template,
              type: 'xs'
            });
          } else if (/\.wxml$/.test(path)) {
            //transform ml 2 ast
            let ast = astParser.astParse(template, path, wcc);
            if (ast instanceof error.QccError) {
              return reject(ast);
            }
            wcc.templatesObjs.push({
              path: path,
              template: template,
              type: 'xml',
              ast: ast,
              idx: xmlIdx++
            });
          }
        }
      }
      //optimise ast
      wcc.optimize();
      //generate code
      wcc.codeGenerate();
      resolve();
    });
  }
  optimize() {
    let res = optimizer.optimize(this.templatesObjs, this);
    if (res instanceof error.QccError) {
      this.errorCallback(res);
    }
  }
  codeGenerate() {
    this.out = codeGenerater.codeGenerate(this.templatesObjs, this);
    if (this.out instanceof error.QccError) {
      this.errorCallback(this.out);
    }
  }
  output() {
    return this.out;
  }
  parseCmd() {
    let cmd = this.config.cmd || [];
    let idx = -1;
    //output code for debug
    idx = cmd.indexOf('-d');
    if (idx > -1) {
      this.cmd.d = true;
    } else {
      this.cmd.d = false;
    }
    //output simplified code for custom component
    idx = cmd.indexOf('-xc');
    if (idx > -1) {
      this.cmd.xc = cmd[idx + 1] || true;
      idx = cmd.indexOf('--split');
      if(idx > -1){
        this.cmd.split = cmd[idx + 1] || '';
      }else{
        this.cmd.split = '';
      }
    } else {
      this.cmd.xc = '';
    }
    //output compelete code for custom component
    idx = cmd.indexOf('-cc');
    if (idx > -1) {
      this.cmd.cc = cmd[idx + 1] || true;
      idx = cmd.indexOf('--split');
      if(idx > -1){
        this.cmd.split = cmd[idx + 1] || '';
      }else{
        this.cmd.split = '';
      }
    } else {
      this.cmd.cc = '';
    }
    //insert debug wxs info
    idx = cmd.indexOf('-ds');
    if (idx > -1) {
      this.cmd.ds = true;
    } else {
      this.cmd.ds = false;
    }
    //add life cycle callback
    idx = cmd.indexOf('-cb');
    if (idx > -1) {
      this.cmd.cb = cmd[idx + 1] || '';
    } else {
      this.cmd.cb = '';
    }
    //render function name
    idx = cmd.indexOf('-gn');
    if(idx > -1){
      this.cmd.gn = cmd[idx + 1] || '$gwx';
    }else{
      this.cmd.gn = '$gwx';
    }
    //是否标记静态节点 mark static node
    idx = cmd.indexOf('-msn');
    if(idx > -1){
      this.cmd.msn = true;
    }else{
      this.cmd.msn = false;
    }
  }
  existTemplateObj(path){
    let res = false;
    for(let i = 0; i < this.templatesObjs.length; ++i){
      if(this.templatesObjs[i].path === path){
        res = true;
        break;
      }
    }
    return res;
  }
}

module.exports = WCC;