/*
 * @Author: kingweicai 
 * @Date: 2019-05-29 20:26:22 
 * @Last Modified by: kingweicai
 * @Last Modified time: 2019-07-21 11:31:46
 */

const child_process = require('child_process');
const vm = require('vm');
const path = require('path');
const wccjs = require('../index.js');
const wccjsUtil = require('../src/util.js');
const fs = require('fs');
const assert = require('assert').strict;

class Console {
  constructor(silent =  true){
    this._log = [];
    this._error = [];
    this._warn = [];
    this.silent = silent;
  }
  log(){
    let args = [];
    for(let i = 0; i < arguments.length; ++i){
      args.push(arguments[i]);
    }
    this._log.push(args);
    if(!this.silent){
      console.log.apply(console, args);
    }
  }
  error(){
    let args = [];
    for(let i = 0; i < arguments.length; ++i){
      args.push(arguments[i]);
    }
    this._error.push(args);
    if(!this.silent){
      console.error.apply(console, args);
    }
  }
  warn(){
    let args = [];
    for(let i = 0; i < arguments.length; ++i){
      args.push(arguments[i]);
    }
    this._warn.push(args);
    if(!this.silent){
      console.warn.apply(console, args);
    }
  }
  getLog(){
    return this._log;
  }
  clearLog(){
    this._log = [];
  }
  getError(){
    return this._error;
  }
  clearError(){
    this._error = [];
  }  
  getWarn(){
    return this._warn;
  }
  clearWarn(){
    this._warn = [];
  }
  setSilent(silent = true){
    this.silent = silent;
  }
}


exports.NOOP = function () {};
let wccPath = '';
if(process.platform === 'darwin'){
  wccPath = path.join(__dirname, './wcc');
}else if(process.platform === 'win32'){
  wccPath = path.join(__dirname, './wcc.exe');
}

exports.getWccExecArgs = function (config) {
  let args = [];
  let FILES = config.FILES || [];
  for(let i = 0; i < config.cmd.length; ++i){
    if(config.cmd[i] === '-gn'){
      args = args.concat(FILES);
    }
    args.push(config.cmd[i]);
  }
  return args;
};


exports.runWccjs = function (config) {
  return new Promise(function (resolve, reject) {
    wccjs(config).then(function (wccjsRes) {
      let code = wccjsRes.code;
      resolve(code);
    }).catch(function (err) {
      reject(err);
    });
  });
};

exports.runWcc = function (config) {
  return new Promise(function (resolve, reject) {
    let args = exports.getWccExecArgs(config);
    debugger
    let wcc = child_process.spawn(wccPath, args, {
      cwd: config.FILESBASE
    });
    let out = Buffer.from([]);
    let err = Buffer.from([]);
    wcc.stdout.on('data', (data) => {
      out = Buffer.concat([out, data]);
    });

    wcc.stderr.on('data', (data) => {
      err = Buffer.concat([err, data]);
    });

    wcc.on('close', (code) => {
      if(err.length){
        reject(err.toString());
        return;
      }
      if (code === 0) {
        let code = out.toString('utf8');
        resolve(code);
      } else {
        reject(err.toString());
      }
    });
  });
};

exports.runJs = function (code, unit) {
  let sandbox = {
    window: unit.window || {
      __webview_engine_version__: 100
    },
    console: new Console(false),
    JSON: JSON,
    global: unit.global || {}
  };
  return new Promise(function (resolve, reject) {
    vm.createContext(sandbox);
    try {
      let runRes = vm.runInContext(code, sandbox);
      return resolve({
        res: runRes,
        sandbox: sandbox
      });
    } catch (e) {
      reject(e);
    }
  });
};

exports.getVD = function (config, $gwx, filePath) {
  return new Promise(function (resolve, reject) {
    let global = {};
    let renderFn;
    try{
      renderFn = $gwx(filePath, global) || null;
    }catch(e){
      reject(e);
      return;
    }

    if (!renderFn) {
      debugger
      return reject(`no render functin for path: ${filePath}`);
    }
    let renderData = config.renderData || exports.NOOP;
    let data = renderData() || {};
    let vd;
    try{
      vd = renderFn(data.env || {}, data.dd || {}, data.global || {});
    }catch(e){
      reject(e);
      return;
    }
    resolve(vd);
  });
};
