Error.stackTraceLimit = 99;
const config = require('../test/config.js');
const testUtil = require('../test/util.js');
const testConfigList = config.testConfigList;

testConfigList.forEach(function(testConfig) {

  let suitConfig = require(testConfig.configPath);

  describe(suitConfig.name, function(){
    let compilerConfig = suitConfig.compilerConfig;
    let ccCompileTime = 0;
    let wccCompileTime = 0;
    let fileNum = compilerConfig.FILES && compilerConfig.FILES.length || 0;

    it(suitConfig.name + `[compile ${fileNum} files to javascript]`, function(){
      return new Promise(function(resolve, reject) {
        let wccjsStartTime;
        let wccjsEndTime;
        let wccStartTime;
        let wccEndTime;
        wccjsStartTime = Date.now();
        testUtil.runWccjs(compilerConfig).then(function(code){
          wccjsEndTime = Date.now();
          wccStartTime = Date.now();
          testUtil.runWcc(compilerConfig).then(function(code){
            wccEndTime = Date.now();
            console.log(`[wcc.js] ${wccjsEndTime - wccjsStartTime} ms, [wcc] ${wccEndTime - wccStartTime} ms`);
            resolve();
          }).catch(function(err) {
            reject(err);
          });
        }).catch(function(err) {
          reject(err);
        });

      });
    });    
  });

});
