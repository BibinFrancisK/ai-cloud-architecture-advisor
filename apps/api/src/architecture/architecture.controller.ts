import { Controller, Get, HttpCode, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

@ApiTags('architecture')
@Controller('sessions')
export class ArchitectureController {
  @Get(':id/architecture')
  @HttpCode(501)
  @ApiOperation({
    summary: 'Retrieve the generated architecture recommendation',
  })
  @ApiParam({ name: 'id', description: 'Session UUID' })
  getArchitecture(@Param('id') _sessionId: string) {
    return { message: 'Not implemented — available from Day 7.' };
  }
}
