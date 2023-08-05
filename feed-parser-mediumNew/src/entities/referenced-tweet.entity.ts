import {
	Column,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from "typeorm"
import { MessageEntity } from "./message.entity"
import { ReferencedType } from "../types/types"

@Entity()
export class ReferencedTweetEntity {
	@PrimaryGeneratedColumn()
	id!: number

	@Column({ type: "text" })
	type!: ReferencedType

	@Column({ name: "referenced_id", type: "text" })
	referencedId!: string

	@ManyToOne(() => MessageEntity, message => message.referencedTweets)
	@JoinColumn()
	message!: MessageEntity
}
