import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm"
import { MessageEntity } from "./message.entity"
import { AttachmentType } from "../types/types"

@Entity()
export class AttachmentEntity {
	@PrimaryColumn({ type: "text" })
	id!: string

	@Column({ type: "text" })
	type!: AttachmentType

	@Column({ type: "text", nullable: true })
	url!: string | null

	@Column({ type: "text", nullable: true })
	previewImageUrl!: string | null

	@Column({ type: "text", nullable: true })
	name!: string | null

	@Column({ type: "text", nullable: true })
	s3Url!: string | null

	@ManyToOne(() => MessageEntity, message => message.attachments)
	@JoinColumn()
	message!: MessageEntity
}
