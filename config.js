var env = require('./env');

module.exports = {
  s3: {
    key: env('S3_KEY'),
    secret: env('S3_SECRET'),
    bucket: env('S3_BUCKET'),
    domain: env.optional('S3_DOMAIN') ||
            env('S3_BUCKET') + '.s3.amazonaws.com'
  },
  creationKey: env('CREATION_KEY'),
  baseURL: env.optional('BASE_URL')
};
