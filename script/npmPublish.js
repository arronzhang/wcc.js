const child_process = require('child_process');
const path = require('path');
const cwd = path.join(__dirname, '../dist');
const fs = require('fs');

const cpJobs = [
  {
    src: path.join(__dirname, '../src/'),
    dest: path.join(__dirname, '../dist/src'),
  },
  {
    src: path.join(__dirname, '../index.js'),
    dest: path.join(__dirname, '../dist'),
  },
  {
    src: path.join(__dirname, '../package.json'),
    dest: path.join(__dirname, '../dist'),
  },
  {
    src: path.join(__dirname, '../readme.md'),
    dest: path.join(__dirname, '../dist'),
  },
]

let promises = [];

// let res = fs.mkdirSync(path.join(__dirname, '../dist'));

// console.log(res);

false && fs.mkdir(path.join(__dirname, '../dist'), (err) => {
  if(err){
    console.log(err);
  }
});
fs.mkdir(path.join(__dirname, '../dist/src/'), { recursive: true }, (err) => {
  if(err){
    throw err;
  }else{
    cpJobs.forEach(function(cpJob){
      promises.push(new Promise(function(resolve, reject){
        let cmd = `cp -r -v ${cpJob.src} ${cpJob.dest}`;
        child_process.exec(cmd, function(error, stdout, stderr){
          if(error){
            reject(error);
            return;
          }
          if(stdout){
            resolve(stdout);
            return;
          }
          if(stderr){
            reject(stderr);
            return;
          }
          resolve(`move ${cpJob.src} to ${cpJob.dest} done~`);
        });
      }));
    });
    
    Promise.all(promises).then(function(values){
      for(let i = 0; i < values.length; ++i){
        console.log(values[i]);
      }
      console.log('move to dist done~');
      let cmd = 'npm publish';
      child_process.exec(cmd, {
        cwd: cwd
      }, function(error, stdout, stderr){
        if(error){
          console.log(error);
        }
        if(stdout){
          console.log(stdout);
        }
        if(stderr){
          console.log(stderr);;
        }
        console.log('npm publish done~');
      });
    
    }).catch(function(err){
      throw err;
    });
  }
});


