var app = require('./app');

if (process.argv.length < 3) {
  console.log("usage: kill.js <upload-id>");
  process.exit(1);
}

app.removeUpload(app.s3, process.argv[2], function(err) {
  if (err) {
    console.log(err);
    process.exit(1);
  }
  console.log("success!");
  process.exit(0);
});
