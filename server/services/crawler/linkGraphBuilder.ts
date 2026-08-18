export interface DiscoveredLink {
  sourceUrl: string;
  targetUrl: string;
  normalizedTarget: string;
  anchorText?: string;
  isInternal: boolean;
  rel?: string;
  isNofollow: boolean;
}

export interface LinkGraphNode {
  url: string;
  inlinksCount: number;
  outlinksCount: number;
  externalOutlinksCount: number;
  crawlDepth: number;
  isOrphanCandidate: boolean;
}

export class LinkGraphBuilder {
  /**
   * Constructs inlinks, outlinks, and shortest click depth from graph edges
   */
  public static computeGraphMetrics(
    edges: DiscoveredLink[],
    seedUrls: string[],
    allKnownUrls: string[]
  ): Map<string, LinkGraphNode> {
    const nodeMap = new Map<string, LinkGraphNode>();

    for (const url of allKnownUrls) {
      nodeMap.set(url, {
        url,
        inlinksCount: 0,
        outlinksCount: 0,
        externalOutlinksCount: 0,
        crawlDepth: 9999, // default unreached
        isOrphanCandidate: false,
      });
    }

    const adjacencyList = new Map<string, string[]>();

    for (const edge of edges) {
      if (edge.isInternal) {
        // Outlink
        const sourceNode = nodeMap.get(edge.sourceUrl);
        if (sourceNode) sourceNode.outlinksCount += 1;

        // Inlink
        const targetNode = nodeMap.get(edge.normalizedTarget);
        if (targetNode) {
          targetNode.inlinksCount += 1;
        }

        // Adjacency
        if (!adjacencyList.has(edge.sourceUrl)) {
          adjacencyList.set(edge.sourceUrl, []);
        }
        adjacencyList.get(edge.sourceUrl)!.push(edge.normalizedTarget);
      } else {
        const sourceNode = nodeMap.get(edge.sourceUrl);
        if (sourceNode) sourceNode.externalOutlinksCount += 1;
      }
    }

    // BFS for Shortest Click Depth starting from seed URLs
    const queue: Array<{ url: string; depth: number }> = [];
    const visited = new Set<string>();

    for (const seed of seedUrls) {
      const node = nodeMap.get(seed);
      if (node) {
        node.crawlDepth = 0;
        queue.push({ url: seed, depth: 0 });
        visited.add(seed);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = adjacencyList.get(current.url) || [];

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          const nNode = nodeMap.get(neighbor);
          if (nNode) {
            nNode.crawlDepth = current.depth + 1;
          }
          queue.push({ url: neighbor, depth: current.depth + 1 });
        }
      }
    }

    // Orphan Candidate Detection: URL has 0 internal inlinks and was not the primary seed
    for (const [url, node] of nodeMap.entries()) {
      if (node.inlinksCount === 0 && !seedUrls.includes(url)) {
        node.isOrphanCandidate = true;
      }
    }

    return nodeMap;
  }
}
