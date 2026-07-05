import path from "path";
import fs from "fs/promises";

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");

// Uploads to S3/R2 when configured; otherwise falls back to local disk,
// served back out via the /uploads static route in index.ts. Neither dev
// nor production currently has S3 creds set (see DEPLOY.md), so the local
// path is what actually runs today.
export async function uploadImage(buffer: Buffer, key: string, contentType: string): Promise<string> {
  if (process.env.S3_BUCKET) {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      region: process.env.S3_REGION ?? "auto",
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY!,
        secretAccessKey: process.env.S3_SECRET_KEY!,
      },
    });

    await client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );

    return `${process.env.S3_PUBLIC_URL}/${key}`;
  }

  const dest = path.join(UPLOAD_DIR, key);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, buffer);
  return `/uploads/${key}`;
}
