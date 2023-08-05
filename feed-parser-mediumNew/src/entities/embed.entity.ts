import {
	Column,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from "typeorm"
import { MessageEntity } from "./message.entity"

@Entity()
export class EmbedEntity {
	@PrimaryGeneratedColumn()
	id!: number

	@Column({ type: "text", nullable: true })
	title!: string | null

	@Column({ type: "text", nullable: true })
	description!: string | null

	@Column({ type: "text", nullable: true })
	url!: string | null

	@Column({ type: "int", nullable: true })
	color!: number | null

	@ManyToOne(() => MessageEntity, message => message.embeds)
	@JoinColumn()
	message!: MessageEntity
}
