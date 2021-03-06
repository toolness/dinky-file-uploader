var express = require('express'),
    pauseStream = require('./pause'),
    fs = require('fs'),
    knox = require('knox'),
    app = express.createServer(),
    config = require('./config');

var s3 = knox.createClient({
  key: config.s3.key,
  secret: config.s3.secret,
  bucket: config.s3.bucket
});

const TINY_ALPHABET = 'abcdefghijklmnopqrstuvwxyz',
      TINY_LENGTH = 5,
      BIG_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' +
                     '0123456789',
      BIG_LENGTH = 48,
      PRIVATE_METADATA_SUFFIX = '.private';

app.generateRandomKey = function(alphabet, numChars) {
  var key = '',
      alphabet = alphabet || DEFAULT_ALPHABET,
      numChars = numChars || DEFAULT_NUM_CHARS;

  // https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Math/random
  // Returns a random integer between min and max  
  // Using Math.round() will give you a non-uniform distribution!  
  function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;  
  }
  
  for (var i = 0; i < numChars; i++)
    key += alphabet[getRandomInt(0, alphabet.length-1)];
  
  return key;
};

app.locationsTaken = {};

function getPrivateMetadata(s3, loc, cb) {
  var req = s3.get(loc + PRIVATE_METADATA_SUFFIX);
  req.on('response', function(res) {
    if (res.statusCode != 200)
      return cb('metadata get error - ' + res.statusCode);
    var obj = '';
    res.setEncoding('utf8');
    res.on('data', function(chunk) {
      obj += chunk;
    });
    res.on('end', function() {
      cb(null, JSON.parse(obj));
    });
  }).end();
}

function putPrivateMetadata(s3, loc, obj, cb) {
  var metadata = JSON.stringify(obj);
  var req = s3.put(loc + PRIVATE_METADATA_SUFFIX, {
    'Content-Length': metadata.length,
    'Content-Type': 'application/json',
    'x-amz-storage-class': 'REDUCED_REDUNDANCY',
    'x-amz-acl': 'private'
  });
  req.on('response', function(res) {
    if (res.statusCode == 200)
      cb();
    else
      cb('metadata put error - ' + res.statusCode);
  });
  req.end(metadata);
}

function putIntoRandomLocation(s3, inputStream, options, cb, paused) {
  function tryAnotherLocation() {
    return putIntoRandomLocation(s3, inputStream, options, cb, paused);
  }
  
  if (!paused)
    paused = pauseStream(inputStream);
  
  var candidateLoc = '/' + app.generateRandomKey(TINY_ALPHABET, TINY_LENGTH);
  if (candidateLoc in app.locationsTaken)
    return tryAnotherLocation();
  app.locationsTaken[candidateLoc] = true;
  s3.get(candidateLoc).on('response', function(isTakenRes) {
    if (isTakenRes.statusCode != 404)
      return tryAnotherLocation();

    var result = {
      id: candidateLoc.slice(1),
      location: candidateLoc,
      revocationKey: app.generateRandomKey(BIG_ALPHABET, BIG_LENGTH)
    };
    var reqsLeft = 2;
    
    function reqDone(error) {
      if (error)
        result.error = error;
      reqsLeft--;
      if (!reqsLeft) {
        if (result.error)
          cb(result.error, null);
        else
          cb(null, result);
      }
    }
    
    putPrivateMetadata(s3, candidateLoc, {
      revocationKey: result.revocationKey
    }, reqDone);
    
    var putReq = s3.put(candidateLoc, options);
    putReq.on('response', function(putRes) {
      if (putRes.statusCode == 200)
        reqDone();
      else
        reqDone('put error - ' + putRes.statusCode);
    });
    inputStream.pipe(putReq);
    paused.resume();
  }).end();
}

app.s3 = s3;

app.removeUpload = function(s3, id, cb) {
  var loc = '/' + id;
  var reqsLeft = 2;
  var errorsOccured = null;
  
  function reqDone(delRes) {
    if (delRes.statusCode != 204)
      errorsOccured = "could not delete content and/or metadata";
    reqsLeft--;
    if (!reqsLeft)
      cb(errorsOccured);
  }
  
  s3.del(loc).on('response', reqDone).end();
  s3.del(loc + PRIVATE_METADATA_SUFFIX).on('response', reqDone).end();
};

app.post('/save-passkey', function(req, res) {
  return res.redirect(config.baseURL || '/');
});

app.post('/remove/:id', function(req, res) {
  var loc = '/' + req.params.id;
  getPrivateMetadata(s3, loc, function(err, metadata) {
    if (err)
      return res.send(err, 400);
    if (req.header('x-revocation-key') != metadata.revocationKey)
      return res.send(403);
    
    app.removeUpload(s3, req.params.id, function(err) {
      if (err)
        res.send(err, 500);
      else
        res.send(204);
    });
  });
});

app.post('/upload', function(req, res) {
  if (req.header('x-creation-key') != config.creationKey)
    return res.send(403);
  
  putIntoRandomLocation(s3, req, {
    'Content-Length': req.header('content-length'),
    'Content-Type': req.header('content-type'),
    'x-amz-storage-class': 'REDUCED_REDUNDANCY'
  }, function(err, result) {
    if (err)
      res.send({
        message: err
      }, 500);
    else
      res.send({
        id: result.id,
        url: 'http://' + config.s3.domain + result.location,
        revocationKey: result.revocationKey
      });
  });
});

app.use(express.static(__dirname + '/static'));

module.exports = app;

var port = process.env['PORT'] || 3000;

if (!module.parent)
  app.listen(port, function() {
    console.log('listening on port ' + port);
  });
  