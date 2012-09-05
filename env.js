var fs = require('fs');
var envFile = __dirname + '/.env';

if (fs.existsSync(envFile))
  fs.readFileSync(envFile, 'utf8').split('\n').forEach(function(line) {
    var eq = line.indexOf('=');
    var key = line.slice(0, eq).trim();
    var value = line.slice(eq+1).trim();
    process.env[key] = value;
  });

function env(key) {
  var val = process.env[key];
  if (typeof(val) == "undefined" || val === '')
    throw new Error('environment variable ' + key + ' not found');
  return val;
}

env.optional = function(key) { return process.env[key]; };

module.exports = env;
