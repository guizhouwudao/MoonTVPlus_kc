/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { ArrowLeft, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import PageLayout from '@/components/PageLayout';
import VideoCard from '@/components/VideoCard';

interface SearchResult {
  id: string;
  source: string;
  title: string;
  poster: string;
  year: string;
  rating: number;
}

export default function PrivateLibrarySearchPage() {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 自动聚焦输入框
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = async () => {
    const kw = keyword.trim();
    if (!kw) return;

    setLoading(true);
    setError('');
    setSearched(true);

    try {
      const response = await fetch(`/api/private-library-search?keyword=${encodeURIComponent(kw)}`);
      const data = await response.json();

      if (data.error) {
        setError(data.error);
        setResults([]);
      } else {
        setResults(data.list || []);
      }
    } catch (err) {
      console.error('搜索失败:', err);
      setError('搜索失败，请稍后重试');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClear = () => {
    setKeyword('');
    setResults([]);
    setError('');
    setSearched(false);
    inputRef.current?.focus();
  };

  const handleCardClick = (item: SearchResult) => {
    router.push(`/play?source=${encodeURIComponent(item.source)}&id=${encodeURIComponent(item.id)}&title=${encodeURIComponent(item.title)}`);
  };

  return (
    <PageLayout activePath='/private-library'>
      <div className='container mx-auto px-4 py-6'>
        {/* 返回按钮 + 标题 */}
        <div className='mb-6 flex items-center gap-4'>
          <button
            onClick={() => router.push('/private-library')}
            className='flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors'
          >
            <ArrowLeft size={20} />
            <span className='text-sm'>返回私人影库</span>
          </button>
          <h1 className='text-2xl font-bold text-gray-900 dark:text-gray-100'>
            搜索
          </h1>
        </div>

        {/* 搜索框 */}
        <div className='mb-6 flex justify-center'>
          <div className='relative w-full max-w-xl'>
            <input
              ref={inputRef}
              type='text'
              placeholder='搜索 OpenList / Emby 中的资源...'
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              className='w-full px-4 py-3 pr-12 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base'
            />
            {keyword ? (
              <button
                onClick={handleClear}
                className='absolute right-12 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              >
                <X size={20} />
              </button>
            ) : null}
            <button
              onClick={handleSearch}
              disabled={!keyword.trim() || loading}
              className='absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              <Search size={20} />
            </button>
          </div>
        </div>

        {/* 搜索提示 */}
        {!searched && !loading && (
          <div className='text-center py-12'>
            <Search size={48} className='mx-auto text-gray-300 dark:text-gray-600 mb-4' />
            <p className='text-gray-500 dark:text-gray-400'>
              输入关键词搜索 OpenList 和 Emby 中的资源
            </p>
          </div>
        )}

        {/* 错误信息 */}
        {error && (
          <div className='bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6'>
            <p className='text-red-800 dark:text-red-200'>{error}</p>
          </div>
        )}

        {/* 加载中 */}
        {loading && (
          <div className='flex justify-center py-12'>
            <div className='flex items-center gap-2 text-gray-600 dark:text-gray-400'>
              <div className='w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin' />
              <span>搜索中...</span>
            </div>
          </div>
        )}

        {/* 搜索结果 - 空 */}
        {searched && !loading && !error && results.length === 0 && (
          <div className='text-center py-12'>
            <p className='text-gray-500 dark:text-gray-400'>
              未找到与「{keyword}」相关的资源
            </p>
          </div>
        )}

        {/* 搜索结果 - 卡片网格 */}
        {results.length > 0 && (
          <>
            <div className='mb-4 text-sm text-gray-500 dark:text-gray-400'>
              找到 {results.length} 个结果
            </div>
            <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4'>
              {results.map((item) => (
                <div key={`${item.source}:${item.id}`} onClick={() => handleCardClick(item)}>
                  <VideoCard
                    id={item.id}
                    source={item.source}
                    title={item.title}
                    poster={item.poster}
                    year={item.year}
                    rate={item.rating > 0 ? item.rating.toFixed(1) : ''}
                    from='search'
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
}