Error.stackTraceLimit = 99;
const testUtil = require('./util.js');
const config = require('./config.js');
const failConfig = require('./failConfig.js');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const util = require('util');


let testConfigList = failConfig.testConfigList;
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
    let wccjsErrorMessage = NaN;
    let wccErrorMessage = NaN;

    it(suitConfig.name + ' [wcc.js compiles files to javascript meet error]', function () {
      return new Promise(function (resolve, reject) {
        let startTime = Date.now();
        testUtil.runWccjs(compilerConfig).then(function (code) {
          let endTime = Date.now();
          wccjsCompileTime = endTime - startTime;
          wccjsOutPutCode = code;
          fs.writeFileSync(path.join(compilerConfig.outputDir, './code.wccjs.js'), code, {
            encoding: 'utf8'
          });
          reject('wcc.js compiles files to javascript meet no error');
        }).catch(function (err) {
          wccjsErrorMessage = err.message;
          resolve();
        });
      });
    });
    it(suitConfig.name + ' [wcc compiles files to javascript meet error]', function () {
      return new Promise(function (resolve, reject) {
        let startTime = Date.now();
        testUtil.runWcc(compilerConfig).then(function (code) {
          let endTime = Date.now();
          wccCompileTime = endTime - startTime;
          wccOutPutCode = code;
          fs.writeFileSync(path.join(compilerConfig.outputDir, './code.wcc.js'), code, {
            encoding: 'utf8'
          });
          reject('wcc compiles files to javascript meet no error');
        }).catch(function (err) {
          wccErrorMessage = err;
          resolve();
        });
      });
    });
    it(suitConfig.name + ` [display wcc.js error message and wcc error message]`, function () {
      return new Promise(function (resolve, reject) {
        // try{
          console.log(util.inspect(`wcc.js error message: [${wccjsErrorMessage}]`));
          console.log(util.inspect(`wcc error message: [${wccErrorMessage}]`));
        //   assert.deepEqual(wccjsErrorMessage, wccErrorMessage);
        // }catch(e){
        //   reject(e);
        // }
        resolve();
      });
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