/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { requireFeaturePermission } from '@/lib/permissions';

export const runtime = 'nodejs';

/**
 * GET /api/private-library-search?keyword=xxx
 * 只搜索 OpenList 和 Emby 中的资源，返回统一格式的结果列表
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireFeaturePermission(request, 'private_library', '无权限访问私人影库');
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword')?.trim();

    if (!keyword) {
      return NextResponse.json({ error: '请输入搜索关键词' }, { status: 400 });
    }

    const config = await getConfig();
    const results: any[] = [];

    // 1. 搜索 OpenList
    if (config.OpenListConfig?.Enabled) {
      try {
        const { db } = await import('@/lib/db');
        const { getCachedMetaInfo, MetaInfo } = await import('@/lib/openlist-cache');
        const { resolvePathMeta } = await import('@/lib/openlist-path-meta');
        const { getTMDBImageUrl } = await import('@/lib/tmdb.search');

        const openlistVideos = db.data?.openlistVideos || [];
        const kw = keyword.toLowerCase();
        const matched = openlistVideos.filter((v: any) => {
          if (!v.title) return false;
          return v.title.toLowerCase().includes(kw);
        });

        for (const video of matched.slice(0, 50)) {
          const meta = resolvePathMeta(video.path);
          let poster = '';
          if (meta?.tmdbId) {
            poster = getTMDBImageUrl(meta.tmdbId, meta.mediaType);
          }
          results.push({
            id: video.id || video.path,
            source: 'openlist',
            title: video.title,
            poster,
            year: video.year || '',
            rating: video.rating || 0,
          });
        }
      } catch (e) {
        console.error('[private-library-search] OpenList search error:', e);
      }
    }

    // 2. 搜索 Emby
    if (config.EmbyConfig?.EmbyServers?.length > 0) {
      try {
        const { embyManager } = await import('@/lib/emby-manager');
        const { getTMDBImageUrl } = await import('@/lib/tmdb.search');

        for (const server of config.EmbyConfig.EmbyServers) {
          if (!server.Enabled) continue;
          try {
            const items = await embyManager.search(server.Key, keyword);
            if (items && items.length > 0) {
              for (const item of items.slice(0, 30)) {
                results.push({
                  id: item.Id,
                  source: `emby:${server.Key}`,
                  title: item.Name,
                  poster: item.ImageTags?.Primary
                    ? `${server.Url}/emby/Items/${item.Id}/Images/Primary?maxHeight=300&quality=80`
                    : '',
                  year: item.ProductionYear ? String(item.ProductionYear) : '',
                  rating: item.CommunityRating || 0,
                });
              }
            }
          } catch (e) {
            console.error(`[private-library-search] Emby search error for ${server.Key}:`, e);
          }
        }
      } catch (e) {
        console.error('[private-library-search] Emby search error:', e);
      }
    }

    return NextResponse.json({ list: results, total: results.length });
  } catch (e) {
    console.error('[private-library-search] Error:', e);
    return NextResponse.json({ error: '搜索失败' }, { status: 500 });
  }
}
