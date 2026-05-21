import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength } from 'class-validator';

export class ChatMessageDto {
  @ApiProperty({ description: 'User message', maxLength: 2000 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/<[^>]*>/g, '').trim() : value,
  )
  @IsString()
  @MaxLength(2000)
  message!: string;
}
