import { NextResponse } from 'next/server';

export async function POST(req: Request, { params }: { params: Promise<{ action: string[] }> }) {
  const actionArgs = await params;
  const actionPath = actionArgs.action?.join('/') || '';
  const targetUrl = `http://aibigtree.com/api/tool/${actionPath}`;

  try {
    const body = await req.json();
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    let data;
    const text = await response.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    const res = NextResponse.json(data, { status: response.status });
    res.headers.set('Access-Control-Allow-Origin', '*');
    return res;
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json({ error: "代理转发失败", success: false }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}

export async function OPTIONS() {
  const res = new NextResponse(null, { status: 200 });
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.headers.set('Content-Security-Policy', "frame-ancestors *");
  return res;
}
