import { DataSource } from "typeorm"
import fs from "fs"
import { MessageEntity } from "./entities/message.entity"
import { MessageAuthorEntity } from "./entities/message-author.entity"
import { AttachmentEntity } from "./entities/attachment.entity"
import { EmbedEntity } from "./entities/embed.entity"
import { ObservableLinkEntity } from "./entities/observable-link.entity"
import { ReferencedTweetEntity } from "./entities/referenced-tweet.entity"
import { ProjectEntity } from "./entities/project.entity"
import { ChannelEntity } from "./entities/channel.entity"
import { LinkPreviewEntity } from "./entities/link-preview"

export const AppDataSource = new DataSource({
	type: "postgres",
	host: process.env.POSTGRES_HOST,
	port: Number(process.env.POSTGRES_PORT),
	username: process.env.POSTGRES_USER,
	password: process.env.POSTGRES_PASSWORD,
	database: process.env.POSTGRES_DB,
	ssl:
		process.env.POSTGRES_SSL === "true"
			? {
					ca: fs.readFileSync("./ca-certificate.crt", "utf-8"),
			  }
			: false,
	// logging: true,
	entities: [
		AttachmentEntity,
		ChannelEntity,
		EmbedEntity,
		LinkPreviewEntity,
		MessageAuthorEntity,
		MessageEntity,
		ObservableLinkEntity,
		ProjectEntity,
		ReferencedTweetEntity,
	],
	subscribers: [],
	migrations: [],
	synchronize: true, // TODO dev only
})

export const messageRepository = AppDataSource.getRepository(MessageEntity)
export const channelRepository = AppDataSource.getRepository(ChannelEntity)
export const observableLinksRepository =
	AppDataSource.getRepository(ObservableLinkEntity)
export const projectRepository = AppDataSource.getRepository(ProjectEntity)
export const attachmentRepository =
	AppDataSource.getRepository(AttachmentEntity)
export const linkPreviewRepository =
	AppDataSource.getRepository(LinkPreviewEntity)
