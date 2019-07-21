const fs = require('fs');
const path = require('path');

exports.getFileContent = async function (FILES, FILESBASE) {
  let promises = [];
  FILES.forEach(element => {
    let promise = new Promise(function (resolve, reject) {
      if (FILESBASE) {
        element = path.join(FILESBASE, element);
      }
      fs.readFile(element, (err, data) => {
        if (err) {
          return reject(err);
        } else {
          return resolve(data);
        }
      });
    });
    promises.push(promise);
  });
  return Promise.all(promises);
};

exports.addElementToArray = function (arr, ele, noAddTest) {
  let toAdd = true;
  for (let i = 0; i < arr.length; ++i) {
    if (noAddTest(arr[i], ele)) {
      toAdd = false;
      break;
    }
  }
  if (toAdd) {
    arr.push(ele);
  }
  return toAdd;
};

const camelizeRE = /-(\w)/g
exports.camelize = (str) => {
  return str.replace(camelizeRE, (_, c) => c ? c.toUpperCase() : '');
};



exports.isCyclicObj = function (obj) {
  var handled = [];
  var res = [];

  function detect(obj, objKey) {
    if (obj && typeof obj === 'object') {
      var handledObj = false;
      for (var i = 0; i < handled.length; ++i) {
        if (handled[i].obj === obj) {
          handledObj = true;
          handled[i].keys.push(objKey);
          break;
        }
      }
      if (!handledObj) {
        handled.push({
          keys: [objKey],
          obj: obj
        });
        for (var key in obj) {
          if (obj.hasOwnProperty(key)) {
            detect(obj[key], objKey + '.' + key)
          }
        }
      }
    }
  }

  detect(obj, 'root');
  for (var i = 0; i < handled.length; ++i) {
    if (handled[i].keys.length > 1) {
      res.push(handled[i].keys);
    }
  }
  return res;
};

exports.getNormalizePath = function (path1, path2) {
  let path3 = path.posix.join(path.posix.dirname(path1), path2);
  path3 = `./${path3}`;
  return path3;
};

exports.NOOP = function () {};

exports.uniqueArray = function(arr = []) {
  let map = {};
  let res = [];
  for(let i = 0; i < arr.length; ++i){
    if(!map[arr[i]]){
      res.push(arr[i]);
      map[arr[i]] = 1;
    }
  }
  return res;
};

exports.escapeTxt = function (str) {
  const map = [{
      ori: /(\\)([^nrt\\])/g,
      n: "\\x5c$2"
    },
    {
      ori: /&/g,
      n: "\\x26"
    },
    {
      ori: /\\$/g,
      n: "\\x5c"
    },
    {
      ori: /</g,
      n: "\\x3c"
    },
    {
      ori: />/g,
      n: "\\x3e"
    },
    {
      ori: /"/g,
      n: "\\x22"
    },
    {
      ori: /'/g,
      n: "\\x27"
    },
    {
      ori: /\n/g, // multiline to oneline
      n: "\\n"
    },
    {
      ori: /\r/g,
      n: "\\r"
    },
    {
      ori: /=/g,
      n: "\\x3d"
    }
  ];
  map.forEach(v => (str = str.replace(v.ori, v.n)));
  return str;
};

exports.escapeTxt1 = function (str) {
  const map = [{
      ori: /(\\)([^nrt\\])/g,
      n: "\\x5c$2"
    },
    {
      ori: /&/g,
      n: "\\x26"
    },
    {
      ori: /\\$/g,
      n: "\\x5c"
    },
    {
      ori: /</g,
      n: "\\x3c"
    },
    {
      ori: />/g,
      n: "\\x3e"
    },
    {
      ori: /"/g,
      n: "\\x22"
    },
    {
      ori: /'/g,
      n: "\\x27"
    },
    {
      ori: /\n/g, // multiline to oneline
      n: "\\n"
    },
    {
      ori: /\r/g,
      n: "\\r"
    },
    {
      ori: /=/g,
      n: "\\x3d"
    },
    {
      ori: /\?/g,
      n: "\\x5c?"
    }
  ];
  map.forEach(v => (str = str.replace(v.ori, v.n)));
  return str;
};