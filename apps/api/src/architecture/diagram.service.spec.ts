import { DiagramService } from './diagram.service';
import { MERMAID_LIVE_BASE_URL } from '../common/constants';
import type { ArchitectureRecommendation } from '../common/types/architecture.types';

function makeArchitecture(diagram: string): ArchitectureRecommendation {
  return {
    diagram,
    summary: 'Test architecture',
    services: [
      {
        name: 'AWS Lambda',
        purpose: 'Compute',
        tier: 'compute',
        rationale: 'Serverless',
      },
    ],
    tradeoffs: [
      { aspect: 'Cost', chosen: 'Lambda', alternative: 'EC2', impact: 'LOW' },
    ],
    wellArchitectedAlignment: [
      { pillar: 'Security', score: 'STRONG', notes: 'IAM roles applied' },
    ],
    estimatedMonthlyCost: '$10-20/month',
  };
}

describe('DiagramService', () => {
  let service: DiagramService;

  beforeEach(() => {
    service = new DiagramService();
  });

  it('returns a diagram that already starts with "flowchart TD" unchanged', () => {
    const input = 'flowchart TD\n  A --> B';
    const { mermaidSyntax } = service.getDiagram(makeArchitecture(input));
    expect(mermaidSyntax).toBe(input);
  });

  it('rewrites a legacy "graph TD" declaration to "flowchart TD"', () => {
    const input = 'graph TD\n  A --> B';
    const { mermaidSyntax } = service.getDiagram(makeArchitecture(input));
    expect(mermaidSyntax).toMatch(/^flowchart TD/);
    expect(mermaidSyntax).not.toContain('graph TD');
  });

  it('prepends "flowchart TD" when no diagram type declaration is present', () => {
    const input = 'A --> B\n  B --> C';
    const { mermaidSyntax } = service.getDiagram(makeArchitecture(input));
    expect(mermaidSyntax).toMatch(/^flowchart TD\n/);
    expect(mermaidSyntax).toContain('A --> B');
  });

  it('produces a renderUrl that starts with the mermaid.live base URL', () => {
    const { renderUrl } = service.getDiagram(
      makeArchitecture('flowchart TD\n  A --> B'),
    );
    expect(renderUrl.startsWith(MERMAID_LIVE_BASE_URL)).toBe(true);
  });

  it('encodes the resolved mermaidSyntax as base64 JSON in the renderUrl', () => {
    const input = 'flowchart TD\n  A --> B';
    const { mermaidSyntax, renderUrl } = service.getDiagram(
      makeArchitecture(input),
    );
    const base64Part = renderUrl.slice(MERMAID_LIVE_BASE_URL.length);
    expect(base64Part.length).toBeGreaterThan(0);
    const decoded = JSON.parse(
      Buffer.from(base64Part, 'base64').toString('utf-8'),
    ) as { code: string };
    expect(decoded.code).toBe(mermaidSyntax);
  });
});
