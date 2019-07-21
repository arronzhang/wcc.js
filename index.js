const WCC = require("./src/wcc.js");
const WccUtil = require("./src/util.js");

module.exports = async function (config = {}) {
  return new Promise(function (resolve, reject) {
    let FILES = config.FILES || [];
    if (!FILES.length) {
      return reject("no FILES");
    }
    FILES = WccUtil.uniqueArray(FILES);
    WccUtil.getFileContent(FILES, config.FILESBASE).then(function (contents) {
      let templatesObjs = [];
      FILES.forEach((FILE, idx) => {
        templatesObjs.push({
          path: FILE,
          template: contents[idx].toString('utf8')
        });
      });
      let wcc = new WCC(config);
      wcc.parse(templatesObjs).then(function(){
        let wccOut = wcc.output();
        resolve(wccOut);
      }).catch(function(err) {
        reject(err);
      });

    }).catch(function (err) {
      return reject(err);
    });
  });
};