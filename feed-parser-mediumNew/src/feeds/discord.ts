import fs from "fs"
import {
	type Guild,
	type TextChannel,
	Collection,
	Message,
	User,
	MessageAttachment,
	Client,
	PartialMessage,
	MessageEmbed,
} from "discord.js-selfbot-v13"

import { ALLOWED_DISCORD_CHANNELS, DISCORD_LINK_BASE } from "../constraints"
import {
	attachmentRepository,
	messageRepository,
	observableLinksRepository,
} from "../database"
import { MessageEntity } from "../entities/message.entity"
import { MessageAuthorEntity } from "../entities/message-author.entity"
import {
	downloadAttachment,
	downloadAttachmentAndSaveToS3,
	downloadFile,
	fileExist,
	getFilePath,
	typedLog,
} from "../utils/utils"
import { AttachmentEntity } from "../entities/attachment.entity"
import { AttachmentType } from "../types/types"
import { UpdateMessageDto } from "../dto/updateMessageDto"
import { ObservableLinkEntity } from "../entities/observable-link.entity"
import { EmbedEntity } from "../entities/embed.entity"
import { slack } from "../utils/slack"

const client = new Client({
	checkUpdate: false,
})

let guilds = new Map<string, string[]>()

const SINCE_DATE = new Date(2022, 5, 1, 12, 0)

export const startDiscordParser = async (
	observableGuilds: Map<string, string[]>,
) => {
	if (!fs.existsSync("./images")) {
		fs.mkdirSync("./images")
	}
	if (!fs.existsSync("./images/discord")) {
		fs.mkdirSync("./images/discord")
	}
	if (!fs.existsSync("./images/discord/avatars")) {
		fs.mkdirSync("./images/discord/avatars")
	}

	guilds = observableGuilds

	typedLog("discord", guilds)

	client.on("ready", async () => {
		try {
			typedLog("discord", `${client.user?.username} is ready!`)

			for (let [guildId, channels] of guilds) {
				try {
					await fetchGuildWithMessages(guildId, channels)
				} catch (err: any) {
					if (!err.message.includes("Missing Access")) {
						await slack(
							`An error happend on Discord fetchGuildWithMessages(${guildId}): ${err.message}, ${err.stack}`,
						)
					}
				}
			}

			typedLog("discord", "FINISH")
		} catch (err: any) {
			await slack(
				`An error happend on Discord start: ${err.message}, ${err.stack}`,
			)
		}
	})

	// live receive new messages from all conversations and guilds
	client.on("messageCreate", newMessageHandler)
	client.on("messageUpdate", data => updateMessageHandler(data))
	client.on("error", async err => {
		await slack(`An error happend on Discord: ${err.message}, ${err.stack}`)
	})

	await client.login(process.env.DISCORD_TOKEN)
}

const newMessageHandler = async (message: Message) => {
	//if we listen this channel
	if (
		message.guildId &&
		guilds.get(message.guildId)?.includes(message.channelId)
	) {
		typedLog("discord", `New message handled ${message}`)

		let messages: Collection<string, Message> = new Collection<
			string,
			Message
		>()

		messages.set(message.id, message)

		//save message
		try {
			const link = await findDbLink(message.guildId, message.channelId)

			if (!link) return
			const dbMessage = createDatabaseMessage(message, link)
			await saveMessagesWithImages([dbMessage])
		} catch (e) {
			typedLog("discord", `We haven't save new message ${message.id}`)
		}
	}
}

const updateMessageHandler = async (message: Message | PartialMessage) => {
	//if we listen this channel
	if (
		message.guildId &&
		message.id &&
		message.channelId &&
		guilds.get(message.guildId)?.includes(message.channelId)
	) {
		typedLog("discord", `Message update handled ${message}`)

		await updateMessage(message.id, {
			editedTimestamp: message.reactions?.message.editedTimestamp
				? new Date(message.reactions.message.editedTimestamp)
				: undefined,
			content: message.reactions?.message.content,
		})
	}
}

const fetchGuildWithMessages = async (
	guildId: string,
	listeningChannels: string[],
) => {
	typedLog("discord", `Fetching guild ${guildId}`)
	//Fetching guild
	const guild: Guild = await client.guilds.fetch({
		guild: guildId,
	})

	typedLog("discord", `guild ${guild.name}`)

	//fetch all channels
	const channels: Collection<string, TextChannel> = await fetchTextChannels(
		guild,
	)

	//Filter to only listening channels
	const filteredChannels = channels.filter(channel =>
		listeningChannels.includes(channel.id),
	)

	//Set names to db links
	const tasks = filteredChannels.map(channel => updateChannelNames(channel))
	await Promise.all(tasks)

	typedLog(
		"discord",
		`we are listening ${filteredChannels.size} channels from guild ${guild.name}`,
	)

	await fetchAllChannelsMessages(filteredChannels)
}

const updateChannelNames = async (channel: TextChannel) => {
	const link = await findDbLink(channel.guildId, channel.id)

	if (link) {
		let updatedLink = link
		link.channelName = channel.name
		link.guildName = channel.guild.name
		await observableLinksRepository.save(updatedLink)
	}
}

const fetchTextChannels = async (
	guild: Guild,
): Promise<Collection<string, TextChannel>> => {
	//Fetch all channels and categories from guild
	const channels = await guild.channels.fetch()

	//Filter only allowed channel types
	const filtered = channels.filter(
		channel =>
			channel?.type && ALLOWED_DISCORD_CHANNELS.includes(channel.type),
	)

	return filtered as Collection<string, TextChannel>
}

const fetchAllChannelsMessages = async (
	channels: Collection<string, TextChannel>,
) => {
	//No multi tasks at the same time because saving database broke trying to save author with same id
	for (const [_, channel] of channels) {
		await fetchChannelMessages(channel)
	}
}

const fetchChannelMessages = async (channel: TextChannel) => {
	//last saved message from this channel
	const lastSaved = await messageRepository.find({
		where: {
			discord_channelId: channel.id,
		},
		skip: 0,
		take: 1,
		order: { createdTimestamp: "DESC" },
	})

	const link = await findDbLink(channel.guildId, channel.id)

	if (!link) return

	let messages: MessageEntity[] = []

	//max limit is 100 but browser app using 50 by default
	const fetchLimit = 50
	while (true) {
		const messagesBunch = await channel.messages.fetch({
			limit: fetchLimit,
			before: messages.at(-1)?.id,
			after: lastSaved[0]?.id,
		})

		const filtered = messagesBunch.filter(message => !message.system)

		const lastMessageDate = messagesBunch.first()?.createdAt
		const reachedSinceDate = lastMessageDate
			? lastMessageDate.getTime() < SINCE_DATE.getTime()
			: false
		const sinceDateFiltered = reachedSinceDate
			? filtered.filter(
					msg => msg.createdAt.getTime() > SINCE_DATE.getTime(),
			  )
			: filtered

		try {
			const dbMessages = sinceDateFiltered.map(msg =>
				createDatabaseMessage(msg, link),
			)

			await saveMessagesWithImages(dbMessages)

			messages.push(...dbMessages)
		} catch (e) {
			typedLog(
				"discord",
				`UNNABLE TO SAVE MESSAGES, BREAK IN ORDER TO NOT HAVE SKIPS, CHANNEL ID: ${channel.id}`,
			)
			console.error("err: ", e)
			break
		}

		typedLog(
			"discord",
			`Fetched ${messages.length} messages from guild ${channel.guild.name} channel ${channel.name}`,
		)

		console.log(reachedSinceDate, messagesBunch.size, fetchLimit)

		if (reachedSinceDate || messagesBunch.size < fetchLimit) break
	}
}

const downloadImages = async (messages: MessageEntity[]) => {
	const downloadAvatarTasks = messages.map(msg => downloadAvatar(msg.author))
	const downloadAttachmentsTasks: Promise<{
		url: string | null
		attachment: AttachmentEntity
	} | null>[] = []

	messages.forEach(msg =>
		msg.attachments?.forEach(attachment => {
			if (attachment.type === "image") {
				const task = downloadAttachmentAndSaveToS3(
					attachment,
					"twitter",
				)
				downloadAttachmentsTasks.push(task)
			}
		}),
	)

	const attachments = await Promise.all(downloadAttachmentsTasks)

	await Promise.all(downloadAvatarTasks)

	return attachments.filter(elem => !!elem?.url) as {
		url: string
		attachment: AttachmentEntity
	}[]
}

const createDatabaseMessage = (
	message: Message,
	link: ObservableLinkEntity,
) => {
	const dbMessage = new MessageEntity()

	dbMessage.guildId = message.guildId as string
	dbMessage.discord_channelId = message.channelId
	dbMessage.id = message.id
	dbMessage.content = message.content
	dbMessage.createdTimestamp = new Date(message.createdTimestamp)
	dbMessage.editedTimestamp = message.editedTimestamp
		? new Date(message.editedTimestamp)
		: null
	dbMessage.pinned = message.pinned

	dbMessage.link = link

	dbMessage.author = createAuthor(message.author)

	const attachments: (AttachmentEntity | null)[] = message.attachments.map(
		attachment => createAttachment(attachment, dbMessage),
	)

	const filteredAttachments: AttachmentEntity[] = attachments.filter(
		elem => !!elem,
	) as AttachmentEntity[]

	dbMessage.attachments = filteredAttachments.length
		? filteredAttachments
		: null

	const filteredEmbeds = message.embeds.filter(embed => embed.type === "rich")
	dbMessage.embeds = filteredEmbeds.map(embed =>
		createEmbed(embed, dbMessage),
	)

	return dbMessage
}

const createEmbed = (
	embed: MessageEmbed,
	message: MessageEntity,
): EmbedEntity => {
	const dbEmbed = new EmbedEntity()

	dbEmbed.url = embed.url
	dbEmbed.color = embed.color
	dbEmbed.title = embed.title
	dbEmbed.description = embed.description
	dbEmbed.message = message

	return dbEmbed
}

const createAttachment = (
	attachment: MessageAttachment,
	message: MessageEntity,
): AttachmentEntity | null => {
	const contentType = attachment.contentType
	const splitType = contentType?.split("/")
	const parsedType = splitType?.[0]

	let type: AttachmentType | null = null
	if (parsedType === "image") {
		type = "image"
	} else if (parsedType === "video") {
		type = "video"
	}

	if (!type) return null

	const dbAttachment = new AttachmentEntity()

	dbAttachment.id = attachment.id
	dbAttachment.name = attachment.name
	dbAttachment.url = attachment.url
	dbAttachment.type = type
	dbAttachment.message = message

	return dbAttachment
}

const createAuthor = (author: User): MessageAuthorEntity => {
	const dbAuthor = new MessageAuthorEntity()

	dbAuthor.id = author.id
	dbAuthor.username = author.username
	dbAuthor.bio = author.bio
	dbAuthor.system = author.system
	dbAuthor.bot = author.bot
	dbAuthor.avatarUrl = author.avatarURL()
	dbAuthor.avatarHash = author.avatar

	return dbAuthor
}

const downloadAvatar = async (user: MessageAuthorEntity) => {
	if (user.avatarUrl) {
		try {
			const avatarPath = getFilePath(
				"discord",
				"avatars",
				user.id + "-" + user.avatarHash,
				user.avatarUrl,
			)
			const avatarAlreadyExist = await fileExist(avatarPath)


			if (!avatarAlreadyExist) {
				await downloadFile(user.avatarUrl, avatarPath)
				typedLog("discord", `Avatar downloaded ${avatarPath}`)
			}
		} catch (e) {
			typedLog("discord", `Error downloading avatar ${e}`)
		}
	}
}

const saveMessages = async (messages: MessageEntity[]) => {
	try {
		await messageRepository.save(messages)
	} catch (e) {
		typedLog("discord", `Error saving messages ${e}`)
		throw e
	}
}

const saveMessagesWithImages = async (messages: MessageEntity[]) => {
	await saveMessages(messages)
	const uploadedAttachments = await downloadImages(messages)
	const newAttachments = uploadedAttachments.map(elem => {
		const attachment = elem.attachment
		attachment.s3Url = elem.url
		return attachment
	})

	await attachmentRepository.save(newAttachments)
}

const updateMessage = async (id: string, updateFields: UpdateMessageDto) => {
	try {
		await messageRepository.update(id, updateFields)
	} catch (e) {
		typedLog("discord", `Error updating message id: ${id}`)
	}
}

const findDbLink = async (guildId: string, channelId: string) => {
	return observableLinksRepository.findOneBy({
		link: `${DISCORD_LINK_BASE}${guildId}/${channelId}`,
	})
}
