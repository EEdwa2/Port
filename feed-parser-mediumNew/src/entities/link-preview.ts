import {
	Entity,
	Column,
	JoinColumn,
	ManyToOne,
	Index,
	PrimaryGeneratedColumn,
} from "typeorm"
import { MessageEntity } from "./message.entity"

@Entity()
export class LinkPreviewEntity {
	@PrimaryGeneratedColumn()
	id!: string

	@Column()
	@Index()
	rawUrl!: string

	@Column()
	expandedUrl!: string

	@Column()
	title!: string

	@Column()
	description!: string

	@Column()
	imagePreview!: string

	@Column()
	failed!: boolean

	@Column()
	website!: string

	@Column()
	websiteFavicon!: string

	@Column({ type: "jsonb", nullable: true, default: null })
	rawMeta!: any | null

	@ManyToOne(() => MessageEntity, message => message.previews)
	@JoinColumn()
	message!: MessageEntity
}
