import fs from "fs"
import axios from "axios"
import path from "path"
import { AttachmentEntity } from "../entities/attachment.entity"
import { Social } from "../types/types"
import { uploadFileToS3 } from "../s3/upload"

export const downloadFile = async (
	fileUrl: string,
	outputLocationPath: string,
): Promise<string> => {
	const writer = fs.createWriteStream(outputLocationPath)
	console.log(fileUrl)
	return await axios({
		method: "get",
		url: fileUrl,
		responseType: "stream",
	}).then(response => {
		return new Promise((resolve, reject) => {

			response.data.pipe(writer)

			let error: any = null
			writer.on("error", (err: any) => {
				error = err
				console.log("error", error)
				writer.close()
				reject(err)
			})
			writer.on("close", () => {
				if (!error) {
					console.log("Successfully downloaded", outputLocationPath)
					resolve(outputLocationPath)
				}
				//no need to call the reject here, as it will have been called in the
				//'error' stream
			})
		})
	})
}

export const fileExist = async (path: string) => {
	return !!(await fs.promises.stat(path).catch(e => false))
}

export const getFilePath = (
	social: Social,
	type: "avatars" | "attachments",
	filename: string,
	url: string,
): string => {
	const folder = path.resolve(__dirname, "../../", "images", social, type)

	console.log(url)

	let avatarExtension = getExtensionFromFileUrl(url)?.extension

	if (!avatarExtension) avatarExtension = "png"

	const avatarFilename = filename + "." + avatarExtension
	return path.resolve(folder, avatarFilename)
}

export const downloadAttachment = async (
	attachment: AttachmentEntity,
	social: Social,
): Promise<string | null> => {
	try {
		if (!attachment.url) {
			console.warn("ATTACHMENT DOES NOT CONTAIN URL TO DOWNLOAD")
			return null
		}
		console.log(attachment.url)
		const imagePath = getFilePath(
			social,
			"attachments",
			attachment.id,
			attachment.url,
		)
		console.log(imagePath)
		const imageAlreadyExist = await fileExist(imagePath)
		console.log(imageAlreadyExist)

		if (!imageAlreadyExist) {
			return await downloadFile(attachment.url, imagePath)
		} else {
			return imagePath
		}
	} catch (e) {
		console.log("Error downloading attachment", e)
		return null
	}
}

export interface AttachmentEntityWithS3Url {
	attachment: AttachmentEntity
	url: string | null
}

export const downloadAttachmentAndSaveToS3 = async (
	attachment: AttachmentEntity,
	social: Social,
): Promise<AttachmentEntityWithS3Url | null> => {
	try {
		const localPath = await downloadAttachment(attachment, social)

		if (localPath) {
			return {
				url: await uploadFileToS3(social, localPath),
				attachment: attachment,
			}
		} else {
			return null
		}
	} catch (e) {
		console.log("Error uploading file to S3", e)
		return null
	}
}

export const typedLog = (social: Social, log: any) => {
	console.log(`${social} | `, log)
}

export const safeJsonParse =
	<T>(guard: (o: any) => o is T) =>
	(text: string): ParseResult<T> => {
		const parsed = JSON.parse(text)
		return guard(parsed) ? { parsed, hasError: false } : { hasError: true }
	}

type ParseResult<T> =
	| { parsed: T; hasError: false; error?: undefined }
	| { parsed?: undefined; hasError: true; error?: unknown }

export interface File {
	extension: string
	link: string
}

export const findImagesAndVideosFromMarkdown = (
	text: string,
): {
	images: File[]
	videos: File[]
} => {
	const VIDEO_FORMATS = [
		"mp4",
		"mov",
		"avi",
		"flv",
		"mkv",
		"wmv",
		"avchd",
		"webm",
		"mpeg-4",
	]

	const PHOTO_FORMATS = ["jpeg", "jpg", "png", "gif", "svg"]

	const files = findFilesLinksFromMarkdown(text)

	const images: File[] = []
	const videos: File[] = []

	files.forEach(file => {
		if (PHOTO_FORMATS.includes(file.extension)) {
			images.push(file)
		} else if (VIDEO_FORMATS.includes(file.extension)) {
			videos.push(file)
		}
	})

	return {
		images,
		videos,
	}
}

const findFilesLinksFromMarkdown = (text: string): File[] => {
	const urlRegex = /[\(](https:\/\/[^\)]+)/gm
	const results = [...text.matchAll(urlRegex)]

	const linksArray = results
		.map(el => el[1])
		.map(l => {
			return l.replace("\\_", "_")
		})

	const filesLinks: File[] = []
	linksArray.forEach(link => {
		const result = getExtensionFromFileUrl(link)

		if (result?.url && result?.extension) {
			filesLinks.push({
				extension: result.extension,
				link: result.url,
			})
		}
	})

	const filteredFromJunk: File[] = filesLinks.map(file => {
		const filteredLink = file.link.replace("\\", "")
		return {
			link: filteredLink,
			extension: file.extension,
		}
	})

	return filteredFromJunk
}

const getExtensionFromFileUrl = (link: string) => {
	const extensionFromUrlRegex = /\.(\w{3,4})(?:$|\?)/g

	const result = [...link.matchAll(extensionFromUrlRegex)].map(el => {
		if (el[1] && el["input"]) {
			return {
				url: el["input"],
				extension: el[1],
			}
		} else {
			return null
		}
	})

	if (!result[0]) return null

	return {
		url: result[0].url,
		extension: result[0].extension,
	}
}