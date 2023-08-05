import {
	Column,
	Entity,
	JoinColumn,
	ManyToOne,
	OneToMany,
	PrimaryGeneratedColumn,
} from "typeorm"
import { LinkType } from "../types/types"
import { MessageEntity } from "./message.entity"

@Entity()
export class ObservableLinkEntity {
	@PrimaryGeneratedColumn()
	id!: number

	@Column({
		type: "enum",
		enum: LinkType,
		nullable: false,
	})
	type!: LinkType

	@Column({ type: "jsonb", default: null, nullable: true })
	meta!: any

	@Column({ default: false })
	enabled!: boolean

	@Column({ type: "text", nullable: true })
	guildName!: string | null

	@Column({ type: "text", nullable: true })
	channelName!: string | null

	@Column({ type: "text", nullable: true, unique: true })
	twitterUserId!: string | null

	@Column({ type: "text", unique: true })
	link!: string

	@Column({ type: "text", nullable: true })
	category!: string | null

	@OneToMany(() => MessageEntity, message => message.link)
	messages!: MessageEntity[]
}
