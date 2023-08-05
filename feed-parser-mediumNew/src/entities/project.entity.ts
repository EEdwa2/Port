import {
	Entity,
	Column,
	PrimaryColumn,
	OneToMany,
	PrimaryGeneratedColumn,
} from "typeorm"
import { MessageEntity } from "./message.entity"

@Entity()
export class ProjectEntity {
	@PrimaryGeneratedColumn()
	id!: number

	@Column({ type: "text", unique: true })
	address!: string

	@Column({ type: "text" })
	url!: string

	@Column({ type: "text", nullable: true })
	ens!: string | null

	@Column({ type: "text", nullable: true })
	avatarUrl!: string

	@Column({ type: "text", nullable: true })
	description!: string | null

	@Column({ type: "text" })
	name!: string

	@OneToMany(() => MessageEntity, message => message.project)
	messages!: MessageEntity[]
}
