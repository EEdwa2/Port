import { Entity, Column, PrimaryColumn, OneToMany } from "typeorm"
import { MessageEntity } from "./message.entity"

@Entity()
export class MessageAuthorEntity {
	@PrimaryColumn({ type: "text" })
	id!: string

	@Column({ type: "boolean", nullable: true  })
	bot!: boolean | null

	@Column({ type: "boolean", nullable: true   })
	system!: boolean | null

	@Column({ type: "text" })
	username!: string

	@Column({ type: "text", nullable: true })
	avatarHash!: string | null

	@Column({ type: "text", nullable: true })
	avatarUrl!: string | null

	@Column({ type: "text", nullable: true })
	bio!: string | null

	@OneToMany(() => MessageEntity, message => message.author)
	messages!: MessageEntity[]
}
