import {
	Entity,
	Column,
	OneToMany,
	OneToOne,
	PrimaryColumn,
	JoinColumn,
} from "typeorm"
import { ObservableLinkEntity } from "./observable-link.entity"
import { MessageEntity } from "./message.entity"

@Entity()
export class ChannelEntity {
	@PrimaryColumn()
	id!: string

	@Column()
	name!: string

	@Column({ type: "jsonb", nullable: true, default: null })
	peerData!: any | null

	@OneToMany(() => MessageEntity, post => post.channel)
	@JoinColumn()
	posts!: MessageEntity[]

	@OneToOne(() => ObservableLinkEntity, {
		cascade: true,
		nullable: true,
	})
	@JoinColumn()
	link!: ObservableLinkEntity
}
