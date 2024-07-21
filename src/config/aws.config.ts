import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectCommandInput,
  PutObjectCommandInput,
  GetObjectCommandInput,
  DeleteObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import environmentVars from '../constantsVars';

const s3Client: any = new S3Client({
  region: environmentVars.AWS_REGION,
  credentials: {
    accessKeyId: environmentVars.AWS_ACCESS_KEY_ID,
    secretAccessKey: environmentVars.AWS_SECRET_ACCESS_KEY,
  },
});

interface GetSignedUrlParams {
  Bucket: string;
  Key: string;
  [key: string]: any;
}

export async function getSignedUrlForS3(
  type: 'put' | 'get',
  params: GetSignedUrlParams,
): Promise<string> {
  const command: any =
    type === 'put'
      ? new PutObjectCommand(params as PutObjectCommandInput)
      : new GetObjectCommand(params as GetObjectCommandInput);

  try {
    return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  } catch (error) {
    console.error('Error getting signed URL:', error);
    throw error;
  }
}

export async function deleteObjectFromS3(
  bucketName: string,
  key: string,
): Promise<DeleteObjectCommandOutput> {
  const params: DeleteObjectCommandInput = {
    Bucket: bucketName,
    Key: key,
  };

  const command = new DeleteObjectCommand(params);
  try {
    return await s3Client.send(command);
  } catch (error) {
    console.error('Error deleting object from S3:', error);
    throw error;
  }
}
