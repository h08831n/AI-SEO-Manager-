export async function crawlUrl(url: string) {
  const response = await fetch('/api/crawl', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Crawl request failed' }));
    throw new Error(errorData.message || errorData.error || 'Crawl failed');
  }
  return response.json();
}

export async function askCopilot(question: string, websiteContext: any) {
  const response = await fetch('/api/copilot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, websiteContext }),
  });
  if (!response.ok) {
    throw new Error('Copilot request failed');
  }
  return response.json();
}

export async function generateBrief(keyword: string, topic: string, targetAudience?: string, searchIntent?: string) {
  const response = await fetch('/api/generate-brief', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyword, topic, targetAudience, searchIntent }),
  });
  if (!response.ok) {
    throw new Error('Brief generation failed');
  }
  return response.json();
}

export async function generateRefresh(url: string, currentTitle: string, dropPercentage: number, previousClicks: number, currentClicks: number) {
  const response = await fetch('/api/generate-refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, currentTitle, dropPercentage, previousClicks, currentClicks }),
  });
  if (!response.ok) {
    throw new Error('Refresh diagnosis failed');
  }
  return response.json();
}

export async function optimizeCtr(currentTitle: string, currentMeta: string, keyword: string, position: number, currentCtr: number, impressions: number) {
  const response = await fetch('/api/optimize-ctr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentTitle, currentMeta, keyword, position, currentCtr, impressions }),
  });
  if (!response.ok) {
    throw new Error('CTR optimization failed');
  }
  return response.json();
}

export async function generateSchema(type: string, data: any) {
  const response = await fetch('/api/generate-schema', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, data }),
  });
  if (!response.ok) {
    throw new Error('Schema generation failed');
  }
  return response.json();
}

export async function exportToCsv(rows: any[]) {
  const response = await fetch('/api/export-sheets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
  if (!response.ok) {
    throw new Error('CSV export failed');
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `seo_export_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function exportToWordPress(payload: any) {
  const response = await fetch('/api/export-wordpress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error('WordPress export failed');
  }
  return response.json();
}
