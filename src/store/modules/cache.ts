import { defineStore } from 'pinia'
import { ref } from 'vue'

interface CacheData {
  // 概览页面数据
  clusterInfo: any
  clusterHealth: any
  // 节点页面数据
  nodes: any[]
  // 索引页面数据
  indices: any[]
  indexStats: any
  // 搜索页面数据
  indexOptions: any[]
  mappingCache: Record<string, any[]>  // 按索引名缓存 mapping
  // 分片页面数据
  shards: any[]
  // 当前激活的 tab
  activeTab: string
}

export const useCacheStore = defineStore('cache', () => {
  // 每个集群的缓存数据
  const clusterCache = ref<Map<string, CacheData>>(new Map())

  // 获取集群缓存，不存在则创建
  function getClusterCache(connectionId: string): CacheData {
    if (!clusterCache.value.has(connectionId)) {
      clusterCache.value.set(connectionId, {
        clusterInfo: null,
        clusterHealth: null,
        nodes: [],
        indices: [],
        indexStats: null,
        indexOptions: [],
        mappingCache: {},
        shards: [],
        activeTab: 'overview'
      })
    }
    return clusterCache.value.get(connectionId)!
  }

  // 获取指定索引的 mapping
  function getMapping(connectionId: string, indexName: string): any[] | undefined {
    const cache = getClusterCache(connectionId)
    return cache.mappingCache[indexName]
  }

  // 设置指定索引的 mapping
  function setMapping(connectionId: string, indexName: string, mapping: any[]) {
    const cache = getClusterCache(connectionId)
    cache.mappingCache[indexName] = mapping
  }

  // 更新集群缓存
  function updateCache(connectionId: string, updates: Partial<CacheData>) {
    const cache = getClusterCache(connectionId)
    Object.assign(cache, updates)
  }

  // 清除指定集群缓存
  function clearClusterCache(connectionId: string) {
    clusterCache.value.delete(connectionId)
  }

  // 清除所有缓存
  function clearAll() {
    clusterCache.value.clear()
  }

  return {
    clusterCache,
    getClusterCache,
    updateCache,
    clearClusterCache,
    clearAll,
    getMapping,
    setMapping
  }
})