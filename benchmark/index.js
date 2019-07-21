Error.stackTraceLimit = 99;
const config = require('../test/config.js');
const testUtil = require('../test/util.js');
const testConfigList = config.testConfigList;

testConfigList.forEach(function(testConfig) {

  let suitConfig = require(testConfig.configPath);

  describe(suitConfig.name, function(){
    let compilerConfig = suitConfig.compilerConfig;
    let qccCompileTime = 0;
    let wccCompileTime = 0;
    let fileNum = compilerConfig.FILES && compilerConfig.FILES.length || 0;

    it(suitConfig.name + `[compile ${fileNum} files to javascript]`, function(){
      return new Promise(function(resolve, reject) {
        let qccStartTime;
        let qccEndTime;
        let wccStartTime;
        let wccEndTime;
        qccStartTime = Date.now();
        testUtil.runQcc(compilerConfig).then(function(code){
          qccEndTime = Date.now();
          wccStartTime = Date.now();
          testUtil.runWcc(compilerConfig).then(function(code){
            wccEndTime = Date.now();
            console.log(`[wcc.js] ${qccEndTime - qccStartTime} ms, [wcc] ${wccEndTime - wccStartTime} ms`);
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
