exports.generateVariableNameSeed = (function () {
  let seed = 0;
  return function () {
    return ++seed;
  };
})();

exports.generateVariableName = (function () {
  let seedMap = {};
  let str = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let len = str.length;

  return function (seed) {
    if (typeof seed === 'undefined') {
      return '';
    }
    seedMap[seed] = seedMap[seed] || {
      id: 1
    };
    let variableName = '';
    let tmp = seedMap[seed].id;
    while (tmp > 0) {
      let s = str[(tmp - 1) % len];
      tmp = Math.floor(tmp / len);
      variableName = `${s}${variableName}`;
    }
    seedMap[seed].id++;
    variableName = `x_${variableName}`;
    return variableName;
  };
})();

const ATTR_DEFAULT_NONESTR_IF_EXIST = [
  'class',
  'bindTap',
  'id'
];



exports.getAttrsZGIdx = function (root, node) {
  
  let attrs = node.attributes || [];;
  let generics = node.generics || [];

  let attrs1 = [];
  let attrs2 = [];

  for(let i = 0; i < attrs.length; ++i){
    if (!attrs[i].value) {
      attrs1.push(attrs[i]);
    } else {
      attrs2.push(attrs[i]);
    }
  }
  attrs = attrs1.concat(attrs2);

  let generics1 = [];
  let generics2 = [];

  for(let i = 0; i < generics.length; ++i){
    if (!generics[i].value) {
      generics1.push(generics[i]);
    } else {
      generics2.push(generics[i]);
    }
  }
  generics = generics1.concat(generics2);
  let base = 0;
  let attrsRes = `[`;
  let genericsRes = `[`;

  for (let i = 0; i < attrs.length; ++i) {
    let z;
    let xi;
    if (!attrs[i].value) {
      xi = -1;
      z = xi + base;
    } else {
      z = attrs[i].value.zIdx;
      xi = z - base;
    }
    if (xi >= 0 && base === 0) {
      base = xi;
    }

    attrsRes = `${attrsRes}\"${attrs[i].name.str}\", ${xi}`;
    if (i < attrs.length - 1) {
      attrsRes = `${attrsRes},`
    }
  }
  attrsRes = `${attrsRes}]`;


  for (let i = 0; i < generics.length; ++i) {
    let z;
    let xi
    if (!generics[i].value) {
      xi = -1;
      z = xi + base;
    } else {
      z = generics[i].value.zIdx;
      xi = z - base
    }
    if (xi >= 0 && base === 0) {
      base = xi;
    }

    genericsRes = `${genericsRes}\"${'wx-' + generics[i].name.str}\", ${xi}`;
    if (i < generics.length - 1) {
      genericsRes = `${genericsRes},`
    }
  }
  genericsRes = `${genericsRes}]`;
  return {
    attrs: attrsRes,
    generics: genericsRes
  };

};

/**
  数组转换为字符串形式
*/
exports.arr2str = function (arr, eleHandler) {
  eleHandler = eleHandler || function (a) {
    return a.toString();
  };
  let res = `[`;
  for (let i = 0; i < arr.length; ++i) {
    res = `${res}${eleHandler(arr[i])}`;
  }
  if (i < arr.length - 1) {
    res = `${res},`
  }
  res = `${res}]`;
  return res;
}