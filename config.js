var fs = require('fs');
var envFile = __dirname + '/.env';

if (fs.existsSync(envFile))
  fs.readFileSync(envFile, 'utf8').split('\n').forEach(function(line) {
    var eq = line.indexOf('=');
    var key = line.slice(0, eq).trim();
    var value = line.slice(eq+1).trim();
    process.env[key] = value;
  });

function env(key, optional) {
  var val = process.env[key];
  if ((typeof(val) == "undefined" || val.length == 0) && !optional)
    throw new Error('environment variable ' + key + ' not found');
  return val;
}

module.exports = {
  s3: {
    key: env('S3_KEY'),
    secret: env('S3_SECRET'),
    bucket: env('S3_BUCKET'),
    domain: env('S3_DOMAIN', true) ||
            env('S3_BUCKET') + '.s3.amazonaws.com'
  },
  creationKey: env('CREATION_KEY')
};
