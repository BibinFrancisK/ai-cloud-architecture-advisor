import { ApiProperty } from '@nestjs/swagger';

export class AWSServiceDto {
  @ApiProperty({ example: 'AWS Lambda' })
  name!: string;

  @ApiProperty({ example: 'Handles API request processing' })
  purpose!: string;

  @ApiProperty({
    enum: ['compute', 'storage', 'networking', 'security', 'monitoring'],
  })
  tier!: 'compute' | 'storage' | 'networking' | 'security' | 'monitoring';

  @ApiProperty({
    example: 'Serverless execution eliminates server management overhead',
  })
  rationale!: string;
}

export class TradeoffDto {
  @ApiProperty({ example: 'Scalability' })
  aspect!: string;

  @ApiProperty({
    example: 'AWS Lambda for auto-scaling with zero configuration',
  })
  chosen!: string;

  @ApiProperty({
    example: 'ECS Fargate — more control but higher operational overhead',
  })
  alternative!: string;

  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH'] })
  impact!: 'LOW' | 'MEDIUM' | 'HIGH';
}

export class WellArchitectedAlignmentDto {
  @ApiProperty({
    enum: [
      'Operational Excellence',
      'Security',
      'Reliability',
      'Performance Efficiency',
      'Cost Optimization',
      'Sustainability',
    ],
  })
  pillar!: string;

  @ApiProperty({ enum: ['STRONG', 'ADEQUATE', 'GAPS'] })
  score!: 'STRONG' | 'ADEQUATE' | 'GAPS';

  @ApiProperty({ example: 'Managed services reduce operational burden' })
  notes!: string;
}

export class ArchitectureRecommendationDto {
  @ApiProperty({
    description: 'High-level narrative of the recommended architecture',
  })
  summary!: string;

  @ApiProperty({ type: [AWSServiceDto] })
  services!: AWSServiceDto[];

  @ApiProperty({ type: [TradeoffDto] })
  tradeoffs!: TradeoffDto[];

  @ApiProperty({ type: [WellArchitectedAlignmentDto] })
  wellArchitectedAlignment!: WellArchitectedAlignmentDto[];

  @ApiProperty({ example: '$80-150/month' })
  estimatedMonthlyCost!: string;

  @ApiProperty({
    description: 'Mermaid flowchart TD syntax for the architecture diagram',
  })
  diagram!: string;
}
