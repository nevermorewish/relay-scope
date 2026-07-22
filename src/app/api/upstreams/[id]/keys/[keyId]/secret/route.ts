import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { tryDecrypt } from '@/lib/crypto';

interface Params {
  params: Promise<{ id: string; keyId: string }>;
}

export async function GET(request: Request, { params }: Params) {
  const hostname = new URL(request.url).hostname;
  if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1') {
    return NextResponse.json({ error: 'API Key 只能在本机查看' }, { status: 403 });
  }
  const { id, keyId } = await params;
  const field = new URL(request.url).searchParams.get('field') || 'apiKey';
  const key = await prisma.upstreamKey.findFirst({
    where: { id: Number(keyId), upstreamId: Number(id) },
    select: { apiKeyEnc: true, accessTokenEnc: true },
  });
  if (field === 'accessToken') {
    if (!key?.accessTokenEnc) {
      return NextResponse.json({ error: '该分组没有配置 AccessToken' }, { status: 404 });
    }
    const accessToken = tryDecrypt(key.accessTokenEnc);
    if (!accessToken) {
      return NextResponse.json({ error: 'AccessToken 解密失败' }, { status: 500 });
    }
    return NextResponse.json(
      { accessToken },
      { headers: { 'Cache-Control': 'no-store, private', Pragma: 'no-cache' } },
    );
  }

  if (!key?.apiKeyEnc) {
    return NextResponse.json({ error: '该分组没有配置 API Key' }, { status: 404 });
  }
  const apiKey = tryDecrypt(key.apiKeyEnc);
  if (!apiKey) {
    return NextResponse.json({ error: 'API Key 解密失败' }, { status: 500 });
  }
  return NextResponse.json(
    { apiKey },
    { headers: { 'Cache-Control': 'no-store, private', Pragma: 'no-cache' } },
  );
}
