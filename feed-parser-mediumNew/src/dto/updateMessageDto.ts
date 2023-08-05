import { MessageEntity } from "../entities/message.entity"

export interface UpdateMessageDto extends Partial<MessageEntity> {}
