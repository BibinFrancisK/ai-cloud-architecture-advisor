import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class ChatMessageDto {
  @ApiProperty({ description: 'User message', maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  message!: string;
}
