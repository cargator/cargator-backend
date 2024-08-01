import AWS from 'aws-sdk';
import environmentVars from '../constantsVars';

// Update AWS configuration
AWS.config.update({
    region: environmentVars.AWS_REGION,
    accessKeyId: environmentVars.AWS_ACCESS_KEY_ID,
    secretAccessKey: environmentVars.AWS_SECRET_ACCESS_KEY,
});

// Create an S3 instance
const s3 = new AWS.S3();

interface GetSignedUrlParams {
    Bucket: string;
    Key: string;
    [key: string]: any; // To accommodate additional optional parameters
}

/**
 * Get a signed URL for S3 operations.
 * @param {string} type - The type of operation ('put' for putObject, 'get' for getObject).
 * @param {GetSignedUrlParams} params - The parameters for the S3 operation.
 * @returns {Promise<string>} - A promise that resolves to the signed URL.
 */
export async function getSignedUrl(type: 'put' | 'get', params: any) {
    console.log("getsignedurl >>>>>", type, params);
    
    return new Promise((resolve, reject) => {
        s3.getSignedUrl(type == 'put' ? 'putObject' : 'getObject', params, (err, url) => {
            if (err) {
                reject(err);
            } else {
                resolve(url);
            }
        });
    });
}

export async function deleteObjectFromS3(bucketName: string, key: string): Promise<AWS.S3.DeleteObjectOutput> {
    const params: AWS.S3.DeleteObjectRequest = {
        Bucket: bucketName,
        Key: key,
    };

    return s3.deleteObject(params).promise();
}
