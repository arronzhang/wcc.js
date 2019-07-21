var path = require("path");
var fs = require("fs");
var rootPath = '/Users/jingweicai/Documents/code/tencent/node_modules/qcc/test/succSuit/p_suit59/proj';

renameFilesInDir(rootPath);

function changeFileName(filepath) {
  fs.stat(filepath, function (err, stats) {
    if(err){
      throw err;
    }else if (stats.isFile()) {
      //console.log("isFile,chaning filename...");
      var filename = path.basename(filepath);
      var parentDir = path.dirname(filepath);
      //console.log(thisFilename);
      //这个if就是进行更改文件名的逻辑,可以自行定义,这里定义为将文件命名为当前文件夹的名字加"-文件自身名"
      if(/\.qml$/.test(filepath) ){
        var newFilepath = filepath.replace(/\.qml$/, '.wxml');
        console.log("going to rename from " + filepath + " to " + newFilepath);
        fs.renameSync(filepath, newFilepath);
      }else if(/\.qs$/.test(filepath) ){
        var newFilepath = filepath.replace(/\.qs$/, '.wxs');
        console.log("going to rename from " + filepath + " to " + newFilepath);
        fs.renameSync(filepath, newFilepath);
      }

    } else if (stats.isDirectory()) {
      renameFilesInDir(filepath);
    } else {
      throw (new Error("unknow type of file"));
    }
  });
}

function renameFilesInDir(dir) {
  fs.readdir(dir, function (error, files) {
    var len = files.length;
    var file = null;
    for (var i = 0; i < len; i++) {
      file = path.join(dir, files[i]);
      // console.log(file);
      changeFileName(file);
    }
  });
}