import { Injectable, Logger } from '@nestjs/common';
import { MERMAID_LIVE_BASE_URL } from '../common/constants';
import type { ArchitectureRecommendation } from '../common/types/architecture.types';
import type { DiagramResponse } from '../common/types/diagram.types';

@Injectable()
export class DiagramService {
  private readonly logger = new Logger(DiagramService.name);

  getDiagram(architecture: ArchitectureRecommendation): DiagramResponse {
    let mermaidSyntax = architecture.diagram.trim();

    // Replace legacy `graph <DIR>` declaration with `flowchart TD`
    mermaidSyntax = mermaidSyntax.replace(/^graph\s+\w+/i, 'flowchart TD');

    // Prepend declaration only when no recognised diagram type is present
    if (!/^flowchart\s/i.test(mermaidSyntax)) {
      mermaidSyntax = `flowchart TD\n${mermaidSyntax}`;
    }

    const encoded = Buffer.from(
      JSON.stringify({ code: mermaidSyntax }),
    ).toString('base64');

    const renderUrl = `${MERMAID_LIVE_BASE_URL}${encoded}`;

    this.logger.debug(
      `Diagram built: ${mermaidSyntax.split('\n').length} lines`,
    );

    return { mermaidSyntax, renderUrl };
  }
}
