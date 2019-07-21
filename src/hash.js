const crypto = require('crypto');


function sha256(txt){
  const hash = crypto.createHash('sha256');
  hash.update(txt);
  return hash.digest('hex');
}

exports.sha256 = sha256;
