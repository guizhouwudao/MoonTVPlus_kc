/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { embyManager } from '@/lib/emby-manager';
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

    // 1. 搜索 OpenList（直接从数据库匹配标题）
    if (config.OpenListConfig?.Enabled) {
      try {
        const { db } = await import('@/lib/db');
        const metainfoJson = await db.getGlobalValue('video.metainfo');
        let metaInfo: any = null;
        if (metainfoJson) {
          try { metaInfo = JSON.parse(metainfoJson); } catch (e) {}
        }

        const openlistVideos: any[] = [];
        if (metaInfo?.folders) {
          for (const [path, info] of Object.entries(metaInfo.folders)) {
            if (info && typeof info === 'object') {
              const folder = info as any;
              if (folder.videos && Array.isArray(folder.videos)) {
                for (const v of folder.videos) {
                  openlistVideos.push({ ...v, path: v.path || path });
                }
              }
            }
          }
        }

        const kw = keyword.toLowerCase();
        const matched = openlistVideos.filter((v: any) => {
          if (!v.title) return false;
          return v.title.toLowerCase().includes(kw);
        });

        for (const video of matched.slice(0, 50)) {
          let poster = '';
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

    // 2. 搜索 Emby（使用 EmbyClient.getItems 传入 searchTerm）
    const adminConfig = config as any;
    const embySources = adminConfig.EmbyConfig?.Sources || adminConfig.EmbyConfig?.EmbyServers || [];
    if (embySources.length > 0) {
      for (const source of embySources) {
        if (source.enabled === false) continue;
        try {
          const client = await embyManager.getClient(source.key || 'default');
          if (!client) continue;

          const data = await client.getItems({
            IncludeItemTypes: 'Movie,Series',
            Recursive: true,
            Fields: 'Overview,ProductionYear',
            searchTerm: keyword,
            Limit: 30,
            SortBy: 'SortName',
            SortOrder: 'Ascending',
          });

          const items = data?.Items || [];
          for (const item of items) {
            results.push({
              id: item.Id,
              source: `emby_${source.key || 'default'}`,
              title: item.Name,
              poster: item.ImageTags?.Primary
                ? `${source.ServerURL || ''}/emby/Items/${item.Id}/Images/Primary?maxHeight=300&quality=80`
                : '',
              year: item.ProductionYear ? String(item.ProductionYear) : '',
              rating: item.CommunityRating || 0,
            });
          }
        } catch (e) {
          console.error(`[private-library-search] Emby search error:`, e);
        }
      }
    }

    return NextResponse.json({ list: results, total: results.length });
  } catch (e) {
    console.error('[private-library-search] Error:', e);
    return NextResponse.json({ error: '搜索失败' }, { status: 500 });
  }
}