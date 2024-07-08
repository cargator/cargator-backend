import environmentVars from '../constantsVars';

const AWS = require('aws-sdk');

AWS.config.update({
  region: environmentVars.AWS_REGION,
  accessKeyId: environmentVars.AWS_ACCESS_KEY_ID,
  secretAccessKey: environmentVars.AWS_SECRET_ACCESS_KEY,
});

export const s3 = new AWS.S3();

export async function getSignedUrl(type: string, s3Params: any) {
  return await s3.getSignedUrl(
    type == 'put' ? 'putObject' : 'getObject',
    s3Params,
  );
}
