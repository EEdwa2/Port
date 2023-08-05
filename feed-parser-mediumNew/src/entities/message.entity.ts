import {
	Entity,
	Column,
	PrimaryColumn,
	ManyToOne,
	JoinColumn,
	OneToMany,
	Index,
} from "typeorm"
import { MessageAuthorEntity } from "./message-author.entity"
import { AttachmentEntity } from "./attachment.entity"
import { EmbedEntity } from "./embed.entity"
import { ObservableLinkEntity } from "./observable-link.entity"
import { ReferencedTweetEntity } from "./referenced-tweet.entity"
import { ProjectEntity } from "./project.entity"
import { ChannelEntity } from "./channel.entity"
import { LinkPreviewEntity } from "./link-preview"

@Entity()
export class MessageEntity {
	@PrimaryColumn({ type: "text" })
	id!: string

	@Column({ type: "text", nullable: true })
	tGMessageId!: string | null

	@Column({ type: "text", nullable: true })
	guildId!: string | null

	@Column({ type: "text", nullable: true })
	discord_channelId!: string | null

	@Column({ type: "text" })
	content!: string

	@Column({ type: "text", nullable: true })
	mediumJSONcontent!: string | null

	@Column({ type: "text", nullable: true })
	linkToMessage!: string | null

	@Column({ type: "text", nullable: true })
	title!: string | null

	@Column({ type: "boolean", nullable: true })
	pinned!: boolean | null

	@Column({ type: "text", nullable: true })
	replyToUserId!: string | null

	@Column({ type: "text", nullable: true })
	conversationId!: string | null

	@OneToMany(() => ReferencedTweetEntity, reference => reference.message, {
		cascade: true,
		nullable: true,
	})
	@JoinColumn()
	referencedTweets!: ReferencedTweetEntity[] | null

	@Column({ type: "timestamp", nullable: true })
	@Index()
	createdTimestamp!: Date | null

	@Column({ type: "timestamp", nullable: true })
	editedTimestamp!: Date | null

	@Column({ default: false, nullable: false })
	ogEnriched!: boolean

	@ManyToOne(() => MessageAuthorEntity, author => author.messages, {
		cascade: true,
		nullable: true,
	})
	@JoinColumn()
	author!: MessageAuthorEntity

	@ManyToOne(() => ProjectEntity, project => project.messages)
	@JoinColumn()
	project!: ProjectEntity

	@OneToMany(() => AttachmentEntity, attachment => attachment.message, {
		cascade: true,
		nullable: true,
	})
	@JoinColumn()
	attachments!: AttachmentEntity[] | null

	@OneToMany(() => EmbedEntity, embed => embed.message, {
		cascade: true,
		nullable: true,
	})
	@JoinColumn()
	embeds!: EmbedEntity[] | null

	@OneToMany(() => LinkPreviewEntity, link => link.message, {
		cascade: true,
		nullable: true,
	})
	@JoinColumn()
	previews!: LinkPreviewEntity[] | null

	@ManyToOne(() => ObservableLinkEntity, link => link.messages, {
		cascade: true,
		nullable: true,
	})
	@JoinColumn()
	link!: ObservableLinkEntity | null

	@ManyToOne(() => ChannelEntity, channel => channel.posts, {
		nullable: true,
		cascade: true,
	})
	@JoinColumn()
	channel!: ChannelEntity | null
}
