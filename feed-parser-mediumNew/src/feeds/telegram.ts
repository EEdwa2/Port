import * as fs from "fs"

import { uuid } from "uuidv4"
// @ts-ignore
import input from "input"
import { Api, TelegramClient } from "telegram"

import { ChannelEntity } from "../entities/channel.entity"
import { MessageEntity } from "../entities/message.entity"
import { StringSession } from "telegram/sessions"
import { AttachmentEntity } from "../entities/attachment.entity"

import { ObservableLinkEntity } from "../entities/observable-link.entity"
import { messageRepository, observableLinksRepository } from "../database"
import { slack } from "../utils/slack"
import { asyncDelay } from "../utils/asyncDelay"
import { uploadFileToS3 } from "../s3/upload"
import { load as cheerioLoad } from "cheerio"
import fetch from "node-fetch"

const SINCE_DATE = new Date(2022, 9, 1, 12, 0)

export async function startTelegramParser(
	projectsLinks: ObservableLinkEntity[],
) {
	if (!fs.existsSync("./images")) {
		fs.mkdirSync("./images")
	}
	if (!fs.existsSync("./images/telegram")) {
		fs.mkdirSync("./images/telegram")
	}

	const client: TelegramClient = await authorization()

	while (true) {
		await getMessages(client, projectsLinks)
		await asyncDelay(240000)
	}
}

const authorization = async () => {
	console.log("Telegram is starting")

	const apiId = Number(process.env.TELEGRAM_API_ID)
	const apiHash = String(process.env.TELEGRAM_API_HASH)
	const stringSession = new StringSession(
		String(process.env.TELEGRAM_SESSION),
	)

	const client = new TelegramClient(stringSession, apiId, apiHash, {})
	await client.start({
		phoneNumber: async () => await input.text("Please enter your number: "),
		password: async () => await input.text("Please enter your password: "),
		phoneCode: async () =>
			await input.text("Please enter the code you received: "),
		onError: err => {
			slack(`An error happend on Telegram: ${err.message}, ${err.stack}`)
		},
	})
	console.log("You should now be connected.")

	return client
}

async function fetchShallowChannel(link: string) {
	const data = await (await fetch(link)).text()
	const $ = cheerioLoad(data)
	if ($(".tgme_page_icon i.tgme_icon_user").length) {
		return null
	}
	const title = $(".tgme_page_title span").text()
	const description = $(".tgme_page_description").html()
	const subscribersString = $(".tgme_page_extra").text().split(" ")
	subscribersString.pop()
	const subscribers = Number(subscribersString.join(""))
	const avatar = $("img.tgme_page_photo_image").length
		? $("img.tgme_page_photo_image").attr("src")
		: null
	return {
		title,
		description,
		subscribers,
		avatar,
	}
}

const channedDataCache: Record<string, any> = {}

async function getMessages(
	client: TelegramClient,
	links: ObservableLinkEntity[],
) {
	const limit = 100

	console.log("Loading telegrams")

	let i = 0

	for (const link of links) {
		console.log(`Loading telegram ${i} / ${links.length}`)
		i++
		let messagesData: Api.TypeMessage[] = []
		let tmpMessage: MessageEntity | null = null

		if (!link.meta) {
			console.log(`Fetching meta for ${link.link}`)
			const result = await fetchShallowChannel(link.link)
			if (result && result.avatar) {
				console.log(`Fetching avatar for ${link.link}`)
				const avatarId = uuid() + ".jpg"
				const buffer = await (await fetch(result.avatar)).buffer()
				const localPath = await new Promise<string>(
					(resolve, reject) => {
						const path = `images/telegram/${avatarId}`
						return fs.writeFile(path, buffer, err => {
							if (err) {
								return reject(err)
							} else {
								console.log(`saved avatar ${path}`)
								resolve(path)
							}
						})
					},
				)
				const s3Url = await uploadFileToS3("telegram", localPath)
				link.meta = {
					...result,
					avatarCdnUrl: s3Url,
				}
				await observableLinksRepository.save(link)
				console.log("Meta saved")
			} else {
				console.log("No avatar meta found")
			}
		}

		const lastSaved = await messageRepository.find({
			where: {
				channel: {
					link: {
						id: link.id,
					},
				},
			},
			skip: 0,
			take: 1,
			order: { createdTimestamp: "DESC" },
		})

		while (true) {
			const result: Api.messages.TypeMessages = await client.invoke(
				new Api.messages.GetHistory({
					peer: channedDataCache[link.link]
						? channedDataCache[link.link]
						: link.link,
					limit: limit,
					offsetId: messagesData[messagesData.length - 1]?.id,
					minId: Number(lastSaved[0]?.tGMessageId),
				}),
			)

			if (result.className === "messages.MessagesNotModified") continue
			const chats = result.chats
			const messagesDatafiltered = result.messages.filter(
				md => md.className == "Message",
			) as Api.Message[]
			const lastMessageDate =
				messagesDatafiltered[messagesDatafiltered.length - 1]?.date
			const reachedSinceDate = lastMessageDate
				? lastMessageDate * 1000 < SINCE_DATE.getTime()
				: false
			const sinceDateFiltered = reachedSinceDate
				? messagesDatafiltered.filter(
						lastMessage =>
							lastMessage.date * 1000 > SINCE_DATE.getTime(),
				  )
				: messagesDatafiltered
			messagesData.push(...messagesDatafiltered)
			let counter = 0

			for (const message of sinceDateFiltered) {
				counter++
				//закоминтил которое работает для проверки слособа вложений
				const peerId = message.peerId as Api.PeerChannel
				const channel = chats.find(
					chat => chat.id.toString() === peerId.channelId.toString(),
				) as Api.Chat | undefined
				channedDataCache[link.link] =
					channedDataCache[link.link] || channel

				if (!channel) continue

				if (tmpMessage === null) {
					tmpMessage = await createMessage(
						message,
						channel,
						link,
						client,
					)
					continue
				}
				// не уникальный
				if (
					message.date * 1000 ===
					tmpMessage.createdTimestamp?.getTime()
				) {
					const attachArr = await createAttachments(
						channel,
						message,
						tmpMessage,
						client,
					)
					if (attachArr) {
						if (tmpMessage.attachments !== null) {
							tmpMessage.attachments.push(...attachArr)
						} else {
							tmpMessage.attachments = attachArr
						}
					}
					tmpMessage.content =
						message.message + " @%%%@ " + tmpMessage.content
				} else {
					console.log("Msg added")
					await messageRepository.save(tmpMessage)
					tmpMessage = await createMessage(
						message,
						channel,
						link,
						client,
					)
					continue
				}
				if (counter === sinceDateFiltered.length) {
				}
			}

			if (result.messages.length < limit || reachedSinceDate) {
				console.log("Reached end")
				break
			}
		}
		if (tmpMessage) {
			console.log("Final msg added")
			await messageRepository.save(tmpMessage)
		}

		await asyncDelay(10000)
	}

	console.log("Loaded telegrams")
}

const createChannel = (
	channel: Api.Chat,
	link: ObservableLinkEntity,
): ChannelEntity => {
	const dbChannel = new ChannelEntity()

	dbChannel.id = channel.id.toString()
	dbChannel.name = channel.title
	dbChannel.link = link
	dbChannel.peerData = channel.toJSON()

	return dbChannel
}

const createMessage = async (
	post: Api.Message,
	channel: Api.Chat,
	link: ObservableLinkEntity,
	client: TelegramClient,
): Promise<MessageEntity> => {
	const dbMessage = new MessageEntity()

	dbMessage.id = uuid()
	dbMessage.tGMessageId = post.id.toString()
	dbMessage.channel = channel ? createChannel(channel, link) : null
	dbMessage.createdTimestamp = new Date(post.date * 1000)
	dbMessage.content = post.message
	dbMessage.editedTimestamp = post.editDate
		? new Date(post.editDate * 1000)
		: null
	dbMessage.pinned = post.pinned ? post.pinned : null
	dbMessage.linkToMessage = `${link.link}/${post.id}`

	dbMessage.attachments = await createAttachments(
		channel,
		post,
		dbMessage,
		client,
	)

	return dbMessage
}

const createAttachments = async (
	channel: Api.Chat,
	post: Api.Message,
	dbMessage: MessageEntity,
	client: TelegramClient,
): Promise<AttachmentEntity[] | null> => {
	const media = post.media
	const attachment = new AttachmentEntity()
	const attachments: AttachmentEntity[] = []

	if (media?.className === "MessageMediaPhoto" && media.photo) {
		const mediaID = media.photo.id
		const buffer = await client.downloadMedia(media)
		if (buffer) {
			const localPath = await new Promise<string>((resolve, reject) => {
				const path = `images/telegram/${mediaID}.png`
				return fs.writeFile(
					`images/telegram/${mediaID}.png`,
					buffer,
					err => {
						if (err) {
							return reject(err)
						} else {
							console.log(`saved image ${mediaID}`)
							resolve(path)
						}
					},
				)
			})
			const s3Url = await uploadFileToS3("telegram", localPath)
			attachment.id = mediaID.toString()
			attachment.type = "image"
			attachment.message = dbMessage
			attachment.s3Url = s3Url
		}
		if (attachment.id) attachments.push(attachment)
	} else if (media?.className === "MessageMediaDocument" && media.document) {
		const channelId = channel.id.toString()
		const documentId = media.document?.id.toString()

		attachment.id = documentId
		attachment.type = "video"
		attachment.message = dbMessage
		attachment.url = `https://web.telegram.org/z/progressive/msg-${channelId}-${post.id}:${documentId}`
		if (attachment.id) attachments.push(attachment)
	}

	return attachments.length ? attachments : null
}
