import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { ChatMessageDto } from './dto/chat-message.dto';

@ApiTags('chat')
@Controller('sessions')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post(':id/chat')
  @ApiOperation({
    summary:
      'Send a message and receive a clarification or architecture response',
  })
  @ApiParam({ name: 'id', description: 'Session UUID' })
  handleMessage(@Param('id') id: string, @Body() dto: ChatMessageDto) {
    return this.chatService.handleMessage(id, dto);
  }
}
