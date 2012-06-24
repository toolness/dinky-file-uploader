var assert = require('assert'),
    app = require('./app'),
    request = require('request'),
    config = require('./config');

const TEST_PORT = 8034;

assert.equal(app.generateRandomKey(['a'], 3), 'aaa');
assert(app.generateRandomKey(['abc'], 3).match(/[abc]+/));
console.log('app.generateRandomKey() OK');

function serverURL(path) {
  return 'http://127.0.0.1:' + TEST_PORT + path;
}

function end() {
  console.log("All tests finished.");
  app.close();
}

function removeNonexistentContent(result) {
  request({
    method: 'POST',
    url: serverURL('/remove/' + result.id),
    headers: {
      'X-Revocation-Key': result.revocationKey
    }
  }, function(error, response, body) {
    assert(response.statusCode, 400);
    console.log("POST /remove/" + result.id + " == 400 OK");
    end();
  });
}

function ensureContentIsRemoved(result) {
  request(result.url, function(error, response, body) {
    assert.equal(response.statusCode, 403);
    console.log("GET " + result.url + " == 403 OK");
    removeNonexistentContent(result);
  });
}

function removeContent(result) {
  request({
    method: 'POST',
    url: serverURL('/remove/' + result.id),
    headers: {
      'X-Revocation-Key': result.revocationKey
    }
  }, function(error, response, body) {
    assert(!error);
    assert(response.statusCode, 204);
    console.log("POST /remove/" + result.id + " == 204 OK");
    ensureContentIsRemoved(result);
  });
}

function removeContentWithBadKey(result) {
  request({
    method: 'POST',
    url: serverURL('/remove/' + result.id),
    headers: {
      'X-Revocation-Key': 'BAD KEY!'
    }
  }, function(error, response, body) {
    assert.equal(response.statusCode, 403);
    console.log("POST /remove/" + result.id + " == 403 OK");
    removeContent(result);
  });
}

function getContent(result) {
  request(result.url, function(error, response, body) {
    assert(!error);
    assert.equal(body, "hai2u");
    console.log("GET " + result.url + " == 200 OK");
    removeContentWithBadKey(result);
  });
}

function putContent() {
  request({
    method: 'POST',
    url: serverURL('/upload'), 
    body: "hai2u",
    encoding: 'utf8',
    headers: {
      'Content-Type': 'text/plain',
      'X-Creation-Key': config.creationKey
    }
  }, function(error, response, body) {
    assert(!error);
    assert.equal(response.statusCode, 200);
    console.log("POST /upload == 200 OK");
    getContent(JSON.parse(body));
  });
}

function putContentWithBadKey() {
  request({
    method: 'POST',
    url: serverURL('/upload'), 
    body: "hai2u",
    encoding: 'utf8',
    headers: {
      'Content-Type': 'text/plain',
      'X-Creation-Key': config.creationKey + "BAD"
    }
  }, function(error, response, body) {
    assert.equal(response.statusCode, 403);
    console.log("POST /upload == 403 OK");
    putContent();
  });
}

app.listen(TEST_PORT, putContentWithBadKey);
