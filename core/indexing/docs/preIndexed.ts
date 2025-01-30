import { Chunk } from "../../";
import request from "request";

export function getS3Filename(
  embeddingsProviderId: string,
  title: string,
): string {
  return `${embeddingsProviderId}/${title}`;
}

export enum S3Buckets {
  continueIndexedDocs = "continue-indexed-docs",
}

const AWS_REGION = "us-west-1";

/**
 * 该函数用于从 S3 下载指定存储桶中的文件，并将文件内容作为字符串返回。
 * @param bucket 
 * @param fileName 
 * @returns 
 */
export async function downloadFromS3(
  bucket: string,
  fileName: string,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let data = "";

    const download = request({
      url: `https://${bucket}.s3.${AWS_REGION}.amazonaws.com/${fileName}`,
    });
    download.on("response", (response: any) => {
      if (response.statusCode !== 200) {
        reject(new Error("No body returned when downloading from S3 bucket"));
      }
    });

    download.on("error", (err: any) => {
      reject(err);
    });

    download.on("data", (chunk: any) => {
      data += chunk;
    });

    download.on("end", () => {
      resolve(data);
    });
  });
}

export interface SiteIndexingResults {
  chunks: (Chunk & { embedding: number[] })[];
  url: string;
  title: string;
}
