Error.stackTraceLimit = 99;
const testUtil = require('./util.js');
const config = require('./config.js');
const failConfig = require('./failConfig.js');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let testConfigList = config.testConfigList;

let testCase = null;

process.argv.forEach(function (val, index) {
  if (val === '--case') {
    let tmp = process.argv[index + 1];
    tmp = tmp.split('_');
    if (tmp.length === 2) {
      testCase = [tmp[0], parseInt(tmp[1], 10)];
    }
  }
});

function runSuit(suitConfig) {
  describe(suitConfig.name, function () {
    let compilerConfig = suitConfig.compilerConfig;
    let wccjsOutPutCode = '';
    let wccOutPutCode = '';
    let wccjsCompileTime = 0;
    let wccCompileTime = 0;
    let wccjs$gwx = testUtil.NOOP;
    let wcc$gwx = testUtil.NOOP;
    let wccjsSandbox;
    let wccSandbox;

    it(suitConfig.name + ' [wcc.js compiles files to javascript]', function () {
      return new Promise(function (resolve, reject) {
        let startTime = Date.now();
        testUtil.runwccjs(compilerConfig).then(function (code) {
          let endTime = Date.now();
          wccjsCompileTime = endTime - startTime;
          wccjsOutPutCode = code;
          fs.writeFileSync(path.join(compilerConfig.outputDir, './code.wccjs.js'), code, {
            encoding: 'utf8'
          });
          resolve();
        }).catch(function (err) {
          debugger;
          reject(err);
        });
      });
    });
    // if(!suitConfig.noWcc){
      it(suitConfig.name + ' [wcc compiles files to javascript]', function () {
        return new Promise(function (resolve, reject) {
          let startTime = Date.now();
          testUtil.runWcc(compilerConfig).then(function (code) {
            let endTime = Date.now();
            wccCompileTime = endTime - startTime;
            wccOutPutCode = code;
            fs.writeFileSync(path.join(compilerConfig.outputDir, './code.wcc.js'), code, {
              encoding: 'utf8'
            });
            resolve();
          }).catch(function (err) {
            debugger;
            reject(err);
          });
        });
      });
    // }
    it(suitConfig.name + ' [wcc.js generate $gwx function]', function () {
      return new Promise(function (resolve, reject) {
        testUtil.runJs(wccjsOutPutCode, suitConfig).then(function (runRes) {
          let gn = '$gwx';
          wccjs$gwx = runRes.sandbox[gn] || null;
          wccjsSandbox = runRes.sandbox;
          runRes.sandbox.console.clearLog();
          runRes.sandbox.console.clearError();
          runRes.sandbox.console.clearWarn();
          if (!wccjs$gwx) {
            reject(runRes.res);
          } else {
            resolve();
          }
        }).catch(function (err) {
          reject(err);
        });
      });
    });
    if(!suitConfig.noWcc){
      it(suitConfig.name + ' [wcc generate $gwx function]', function () {
        return new Promise(function (resolve, reject) {
          testUtil.runJs(wccOutPutCode, suitConfig).then(function (runRes) {
            let gn = '$gwx';
            wcc$gwx = runRes.sandbox[gn] || null;
            wccSandbox = runRes.sandbox;
            runRes.sandbox.console.clearLog();
            runRes.sandbox.console.clearError();
            runRes.sandbox.console.clearWarn();
            if (!wcc$gwx) {
              reject(runRes.res);
            } else {
              resolve();
            }
          }).catch(function (err) {
            reject(err);
          });
        });
      });
    }

    let units = suitConfig.units;
    units.forEach(function (unit, idx) {
      function runCase() {
        let wccjsVd = null;
        let wccVd = null;
        it(idx + ' ' + unit.name + ' [wcc.js get vd]', function () {
          return new Promise(function (resolve, reject) {

            if (typeof unit.silentLog !== 'undefined') {
              let silent = unit.silentLog ? true : false;
              wccjsSandbox && wccjsSandbox.console.setSilent(silent);
              wccSandbox && wccSandbox.console.setSilent(silent);
            }
            testUtil.getVD(unit, wccjs$gwx, unit.renderPath).then(function (vd) {
              wccjsVd = vd;
              let wccjsJsonPath = path.join(compilerConfig.outputDir, (idx + '_' + unit.name + '.vd.wccjs.json').replace(/\//gi, '.').replace(/\.\./gi, '.').replace(/^\./gi, './'));
              fs.writeFileSync(wccjsJsonPath, JSON.stringify(vd), {
                encoding: 'utf8'
              });
              resolve();
            }).catch(function (err) {
              reject(err);
            });
          });
        });
        if(!suitConfig.noWcc){
          it(idx + ' ' + unit.name + ' [wcc get vd]', function () {
            return new Promise(function (resolve, reject) {
              testUtil.getVD(unit, wcc$gwx, unit.renderPath).then(function (vd) {
                wccVd = vd;
                let wccJsonPath = path.join(compilerConfig.outputDir, (idx + '_' + unit.name + '.vd.wcc.json').replace(/\//gi, '.').replace(/\.\./gi, '.').replace(/^\./gi, './'));
                fs.writeFileSync(wccJsonPath, JSON.stringify(vd), {
                  encoding: 'utf8'
                });
                resolve();
              }).catch(function (err) {
                reject(err);
              });
            });
          });
        }else{
          wccVd = unit.standardOut;
          let wccJsonPath = path.join(compilerConfig.outputDir, (idx + '_' + unit.name + '.vd.unit.json').replace(/\//gi, '.').replace(/\.\./gi, '.').replace(/^\./gi, './'));
          fs.writeFileSync(wccJsonPath, JSON.stringify(wccVd), {
            encoding: 'utf8'
          });
        }
        it(idx + ' ' + unit.name + ' [assert wcc.js vd and wcc vd]', function () {
          return new Promise(function (resolve, reject) {
            try {
              assert.deepEqual(wccjsVd, wccVd);
            } catch (err) {
              try {
                let wccjsVd1 = JSON.parse(JSON.stringify(wccjsVd));
                let wccVd1 = JSON.parse(JSON.stringify(wccVd));
                assert.deepEqual(wccjsVd1, wccVd1);
              } catch (err1) {
                reject(err1);
              }
            }
            resolve();
          });
        });
        if (unit.console && unit.console.log) {
          it(idx + ' ' + unit.name + ' [assert wcc.js vd console log and wcc vd console log]', function () {
            return new Promise(function (resolve, reject) {
              try {
                let wccjsLog = wccjsSandbox.console.getLog();
                let wccLog = wccSandbox.console.getLog();
                wccjsSandbox.console.clearLog();
                wccSandbox.console.clearLog();
                assert.deepEqual(wccjsLog, wccLog);
              } catch (err) {
                reject(err);
              }
              resolve();
            });
          });
        }
        if (unit.console && unit.console.error) {
          it(idx + ' ' + unit.name + ' [assert wcc.js vd console error and wcc vd console error]', function () {
            return new Promise(function (resolve, reject) {
              try {
                let wccjsError = wccjsSandbox.console.getError();
                let wccError = wccSandbox.console.getError();
                wccjsSandbox.console.clearError();
                wccSandbox.console.clearError();
                assert.deepEqual(wccjsError, wccError);
              } catch (err) {
                reject(err);
              }
              resolve();
            });
          });
        }
        if (unit.console && unit.console.warn) {
          it(idx + ' ' + unit.name + ' [assert wcc.js vd console warn and wcc vd console warn]', function () {
            return new Promise(function (resolve, reject) {
              try {
                let wccjsWarn = wccjsSandbox.console.getWarn();
                let wccWarn = wccSandbox.console.getWarn();
                wccjsSandbox.console.clearWarn();
                wccSandbox.console.clearWarn();
                assert.deepEqual(wccjsWarn, wccWarn);
              } catch (err) {
                reject(err);
              }
              resolve();
            });
          });
        }
      }

      if (testCase && testCase.length) {
        if (suitConfig.name === testCase[0]) {
          if (testCase[1] === -1) {
            runCase();
          } else if (testCase[1] === idx) {
            runCase();
          }
        }
      } else {
        runCase();
      }

    });

  });
}

testConfigList.forEach(function (testConfig) {
  let suitConfig = require(testConfig.configPath);

  if (testCase && testCase.length) {

    if (suitConfig.name === testCase[0]) {
      runSuit(suitConfig);
    }

  } else {
    runSuit(suitConfig);
  }

});