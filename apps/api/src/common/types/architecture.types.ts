import { z } from 'zod';

export const awsServiceSchema = z.object({
  name: z.string().describe('AWS service name, e.g. "AWS Lambda"'),
  purpose: z.string().describe('What this service does in the architecture'),
  tier: z.enum(['compute', 'storage', 'networking', 'security', 'monitoring']),
  rationale: z
    .string()
    .describe('Why this service was chosen over alternatives'),
});

export const tradeoffSchema = z.object({
  aspect: z
    .string()
    .describe('The aspect being traded off, e.g. "Scalability"'),
  chosen: z.string().describe('What was chosen and why'),
  alternative: z.string().describe('What was not chosen and why not'),
  impact: z.enum(['LOW', 'MEDIUM', 'HIGH']),
});

export const wellArchitectedAlignmentSchema = z.object({
  pillar: z.enum([
    'Operational Excellence',
    'Security',
    'Reliability',
    'Performance Efficiency',
    'Cost Optimization',
    'Sustainability',
  ]),
  score: z.enum(['STRONG', 'ADEQUATE', 'GAPS']),
  notes: z.string().describe('Brief explanation of alignment with this pillar'),
});

export const architectureSchema = z.object({
  summary: z
    .string()
    .describe('High-level narrative of the recommended architecture'),
  services: z
    .array(awsServiceSchema)
    .describe('AWS services used in the architecture'),
  tradeoffs: z
    .array(tradeoffSchema)
    .describe('Explicit tradeoff decisions made'),
  wellArchitectedAlignment: z
    .array(wellArchitectedAlignmentSchema)
    .describe('Alignment with each Well-Architected pillar'),
  estimatedMonthlyCost: z
    .string()
    .describe('Cost estimate range, e.g. "$45-120/month"'),
  diagram: z
    .string()
    .describe(
      'Valid Mermaid flowchart TD syntax representing the architecture',
    ),
});

export type AWSService = z.infer<typeof awsServiceSchema>;
export type Tradeoff = z.infer<typeof tradeoffSchema>;
export type WellArchitectedAlignment = z.infer<
  typeof wellArchitectedAlignmentSchema
>;
export type ArchitectureRecommendation = z.infer<typeof architectureSchema>;
