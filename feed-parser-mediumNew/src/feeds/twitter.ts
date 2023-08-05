import fs from "fs"
import TwitterApi, {
	MediaObjectV2,
	TweetV2,
	UserV2Result,
} from "twitter-api-v2"
import { v4 as uuid } from "uuid"

import { MessageEntity } from "../entities/message.entity"
import {
	attachmentRepository,
	messageRepository,
	observableLinksRepository,
} from "../database"
import { AttachmentEntity } from "../entities/attachment.entity"
import { AttachmentType } from "../types/types"
import { downloadAttachmentAndSaveToS3, typedLog } from "../utils/utils"
import { TWITTER_LINK_BASE, TWITTER_REFRESH_TIMEOUT_MS } from "../constraints"
import { ObservableLinkEntity } from "../entities/observable-link.entity"
import { ReferencedTweetEntity } from "../entities/referenced-tweet.entity"
import { slack } from "../utils/slack"
import { asyncDelay } from "../utils/asyncDelay"
import { MoreThan } from "typeorm"
import fetch from "node-fetch"
import { uploadFileToS3 } from "../s3/upload"

const SINCE_DATE = new Date(2022, 10, 1, 12, 0)

const initialize = () => {
	if (!fs.existsSync("./images")) {
		fs.mkdirSync("./images")
	}
	if (!fs.existsSync("./images/twitter")) {
		fs.mkdirSync("./images/twitter")
	}
	if (!fs.existsSync("./images/twitter/attachments")) {
		fs.mkdirSync("./images/twitter/attachments")
	}

	const bearer = process.env.TWITTER_APP_BEARER

	if (!bearer) {
		throw "Twitter bearer token must be specified"
	}

	const twitterClient = new TwitterApi(bearer)

	// Tell typescript it's a readonly app
	return twitterClient.readOnly
}

const client = initialize()

export const startTwitterParser = async (links: ObservableLinkEntity[]) => {
	typedLog(
		"twitter",
		links.map(l => l.link),
	)
	try {
		typedLog("twitter", "TWITTER START")

		const unknownUserIds = links
			.filter(l => !l.twitterUserId)
			.map(l => ({
				link: l,
				username: l.link.split("/").at(-1)!,
			}))

		const newUsers = await getUsersIds(unknownUserIds.map(l => l.username))

		const updateLinksTasks = newUsers.map(user =>
			updateLinkUserId(user.username, user),
		)

		await Promise.all(updateLinksTasks)

		const usersRaw = await observableLinksRepository.find({
			where: {
				twitterUserId: MoreThan(""),
			},
		})

		const users = usersRaw.map(u => ({
			username: u.link.split("/").at(-1)!,
			id: u.twitterUserId!,
		}))

		let counter = 1
		//Infinity update loop
		while (true) {
			for (const user of users) {
				await getTweetsFromUser(user.id, user.username)
			}

			typedLog("twitter", `GRAB CYCLE ${counter} FINISH`)
			counter++

			await asyncDelay(TWITTER_REFRESH_TIMEOUT_MS)
		}
	} catch (e: any) {
		typedLog("twitter", `Error ${e}`)
		await slack(`An error happend on Twitter: ${e.message}, ${e.stack}`)
	}
}

const getUsersIds = async (usernames: string[]) => {
	const users: UserV2Result[] = []

	for (let username of usernames) {
		users.push(
			await client.v2.userByUsername(username, {
				"user.fields": ["profile_image_url", "description"],
			}),
		)
		console.log(`${username} loaded`)
		await asyncDelay(500)
	}

	return users.map(user => ({
		username: user.data.username,
		id: user.data.id,
		description: user.data.description,
		name: user.data.name,
		avatarUrl: user.data.profile_image_url
			? user.data.profile_image_url.replace("_normal.jpg", "_x96.jpg")
			: null,
	}))
}

const getTweetsFromUser = async (userId: string, username: string) => {
	let link
	try {
		link = await findDbLink(username)
	} catch (err: any) {
		await slack(
			`An error happend on Twitter.findDbLink: ${err.message}, ${err.stack}`,
		)
		throw err
	}

	if (!link) return
	//fetch last saved message
	let lastSaved
	try {
		lastSaved = await messageRepository.find({
			where: {
				link: {
					id: link.id,
				},
			},
			skip: 0,
			take: 1,
			order: { createdTimestamp: "DESC" },
		})
	} catch (err: any) {
		await slack(
			`An error happend on Twitter.lastSaved: ${err.message}, ${err.stack}`,
		)
		throw err
	}
	const lastId: string | null = lastSaved[0]?.id
	const userTimeline = await client.v2.userTimeline(userId, {
		since_id: lastId,
		start_time: SINCE_DATE.toISOString(),
		"tweet.fields": [
			"text",
			"id",
			"created_at",
			"in_reply_to_user_id",
			"conversation_id",
			"referenced_tweets",
		],
		exclude: ["retweets"],
		expansions: ["attachments.media_keys"],
		"media.fields": ["type", "preview_image_url", "url", "variants"],
	})

	const messages: MessageEntity[] = []
	let messagesToSave: MessageEntity[] = []

	const chunk = 100
	let counter = 1

	for await (const tweet of userTimeline) {
		const medias = userTimeline.includes.medias(tweet)
		const dbMessage = createMessage(tweet, medias, link)
		messagesToSave.push(dbMessage)
		messages.push(dbMessage)

		//chunk saving messages
		//no parallel chunking by typeorm because of simultaneous saving same relation entities can give an error
		try {
			if (messagesToSave.length > counter * chunk) {
				try {
					await messageRepository.save(messagesToSave)
				} catch (err: any) {
					await slack(
						`An error happend on Twitter.messagesToSave: ${err.message}, ${err.stack}`,
					)
					throw err
				}
				messagesToSave = []
				typedLog(
					"twitter",
					`Saved ${messages.length} messages from ${username}`,
				)
			}
		} catch (e) {
			typedLog("twitter", `Error saving messages ${e}`)
		}
	}

	// save unsaved bunch
	let saved
	try {
		saved = await messageRepository.save(messagesToSave)
	} catch (err: any) {
		await slack(
			`An error happend on Twitter.messagesToSave (unsaved): ${err.message}, ${err.stack}`,
		)
		throw err
	}

	if (saved.length) {
		typedLog(
			"twitter",
			`Saved ${messages.length} messages from ${username}`,
		)
	}

	const attachments = messages
		.map(msg => msg.attachments)
		.flat(1)
		.filter(elem => elem) as AttachmentEntity[]
	const downloadAttachmentsTask = downloadAttachmentsAndSaveToS3(attachments)

	try {
		const uploadedAttachments = await Promise.all([downloadAttachmentsTask])

		await attachmentRepository.save(...uploadedAttachments)
	} catch (err: any) {
		await slack(
			`An error happend on Twitter.downloadAttachmentsTask: ${err.message}, ${err.stack}`,
		)
		throw err
	}
}

const createMessage = (
	tweet: TweetV2,
	medias: MediaObjectV2[],
	link: ObservableLinkEntity,
) => {
	const dbMessage = new MessageEntity()

	dbMessage.id = tweet.id
	dbMessage.content = tweet.text
	dbMessage.createdTimestamp = tweet.created_at
		? new Date(tweet.created_at)
		: null
	dbMessage.attachments = createAttachments(medias, dbMessage)
	dbMessage.replyToUserId = tweet.in_reply_to_user_id || null
	dbMessage.conversationId = tweet.conversation_id || null
	dbMessage.referencedTweets = createReferences(tweet, dbMessage)
	dbMessage.link = link

	return dbMessage
}

const createAttachments = (
	medias: MediaObjectV2[],
	dbMessage: MessageEntity,
): AttachmentEntity[] | null => {
	const attachments: (AttachmentEntity | null)[] = medias.map(attachment =>
		createAttachment(attachment, dbMessage),
	)
	const filteredAttachments: AttachmentEntity[] = attachments.filter(
		elem => !!elem,
	) as AttachmentEntity[]
	return filteredAttachments.length ? filteredAttachments : null
}

const createAttachment = (media: MediaObjectV2, message: MessageEntity) => {
	const attachment = new AttachmentEntity()

	let type: AttachmentType | null = null
	if (media.type === "photo" || media.type === "animated_gif") {
		type = "image"
	} else if (media.type === "video") {
		type = "video"
	}

	if (!type) return null

	attachment.id = uuid()
	attachment.type = type
	attachment.url = media.url || media.variants?.[0]?.url || null
	attachment.previewImageUrl = media.preview_image_url || null
	attachment.message = message

	return attachment
}

const createReferences = (tweet: TweetV2, message: MessageEntity) => {
	const references: ReferencedTweetEntity[] = []
	tweet.referenced_tweets?.forEach(ref => {
		const referenceEntity = new ReferencedTweetEntity()
		const type = ref.type
		if (type === "retweeted") return

		referenceEntity.type = type
		referenceEntity.referencedId = ref.id
		referenceEntity.message = message

		references.push(referenceEntity)
	})

	return references.length ? references : null
}

const downloadAttachmentsAndSaveToS3 = async (
	attachments: AttachmentEntity[],
) => {
	const tasks = attachments.map(attachment => {
		if (attachment.type === "image") {
			return downloadAttachmentAndSaveToS3(attachment, "twitter")
		}
	})
	const links = await Promise.all(tasks)

	const uploadedAttachments: AttachmentEntity[] = []
	links.forEach(link => {
		if (link?.url) {
			const attachment = link.attachment
			attachment.s3Url = link.url
			uploadedAttachments.push(attachment)
		}
	})

	return uploadedAttachments
}

const updateLinkUserId = async (username: string, user: any) => {
	const link = await findDbLink(username)

	if (link) {
		if (user.avatarUrl) {
			const avatarId = uuid() + ".jpg"
			const buffer = await (await fetch(user.avatarUrl)).buffer()
			const localPath = await new Promise<string>((resolve, reject) => {
				const path = `images/twitter/${avatarId}`
				return fs.writeFile(path, buffer, err => {
					if (err) {
						return reject(err)
					} else {
						console.log(`saved avatar ${path}`)
						resolve(path)
					}
				})
			})
			const s3Url = await uploadFileToS3("twitter", localPath)
			user.cdnAvatarUrl = s3Url
		}
		link.twitterUserId = user.id
		link.meta = user
		await observableLinksRepository.save(link)
	} else {
		slack(`Twitter findDbLink not found: ${user}, ${username}`)
	}
}

const findDbLink = async (username: string) => {
	return observableLinksRepository
		.createQueryBuilder("l")
		.select()
		.where(`LOWER(l.link) = :li`, {
			li: `${TWITTER_LINK_BASE}${username.toLowerCase()}`,
		})
		.getOne()
}
