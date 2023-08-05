import fs from "fs"
import path from "path"

import { S3, PutObjectCommand } from "@aws-sdk/client-s3"
import { uuid } from "uuidv4"

const accessKeyId = String(process.env.S3_KEY)
const secretAccessKey = String(process.env.S3_SECRET)

const s3Client = new S3({
	forcePathStyle: false,
	endpoint: "https://fra1.digitaloceanspaces.com",
	region: "eu-central-1",
	credentials: {
		accessKeyId,
		secretAccessKey,
	},
})

export async function uploadFileToS3(prefix: string, filePath: string) {
	const fileReadStream = fs.createReadStream(filePath)
	fileReadStream.on("error", function (err) {
		console.log("File Error", err)
	})

	const Key = prefix + "_" + uuid() + path.extname(filePath)

	const data = await s3Client.send(
		new PutObjectCommand({
			Bucket: "ylide-cdn",
			ACL: "public-read",
			Key,
			Body: fileReadStream,
		}),
	)

	if (data.$metadata.httpStatusCode === 200) {
		return `https://cdn.ylide.io/${Key}`
	} else {
		return null
	}
}
