import { invoke } from '@tauri-apps/api/core'
import { fetch } from '@tauri-apps/plugin-http'

export interface Connection {
  id: string
  name: string
  url: string
  username?: string
  password?: string
  created_at: number
  updated_at: number
}

export interface History {
  id: string
  connection_id: string
  connection_name: string
  start_time: number
  end_time: number
  curl: string
  status: 'success' | 'failed'
  duration: number
}

export interface Settings {
  history_retention_days: number
}

// Connection CRUD
export async function getConnections(): Promise<Connection[]> {
  return invoke('get_connections')
}

export async function saveConnection(conn: Partial<Connection>): Promise<void> {
  const now = Date.now()
  const connection: Connection = {
    id: conn.id || now.toString(),
    name: conn.name || '',
    url: conn.url || '',
    username: conn.username,
    password: conn.password,
    created_at: conn.created_at || now,
    updated_at: now
  }
  return invoke('save_connection', { connection })
}

export async function deleteConnection(id: string): Promise<void> {
  return invoke('delete_connection', { id })
}

// History CRUD
export async function getHistory(): Promise<History[]> {
  return invoke('get_history')
}

export async function saveHistoryItem(item: Partial<History>): Promise<void> {
  const history: History = {
    id: item.id || Date.now().toString(),
    connection_id: item.connection_id || '',
    connection_name: item.connection_name || '',
    start_time: item.start_time || 0,
    end_time: item.end_time || 0,
    curl: item.curl || '',
    status: item.status || 'success',
    duration: item.duration || 0
  }
  return invoke('save_history_item', { history })
}

export async function deleteHistoryItem(id: string): Promise<void> {
  return invoke('delete_history_item', { id })
}

export async function clearHistory(): Promise<void> {
  return invoke('clear_history')
}

// Settings
export async function getSettings(): Promise<Settings> {
  return invoke('get_settings')
}

export async function saveSettings(settings: Settings): Promise<void> {
  return invoke('save_settings', { settings })
}

// Save file with dialog
export async function saveFileWithDialog(defaultName: string, content: string): Promise<boolean> {
  return invoke('save_file_with_dialog', { defaultName, content })
}

// Elasticsearch client
export class ElasticClient {
  private baseUrl: string
  private username?: string
  private password?: string
  private connectionId?: string
  private connectionName?: string

  constructor(url: string, username?: string, password?: string, connectionId?: string, connectionName?: string) {
    this.baseUrl = url.replace(/\/$/, '')
    this.username = username
    this.password = password
    this.connectionId = connectionId
    this.connectionName = connectionName
  }

  // 生成 curl 命令
  private generateCurl(method: string, url: string, headers: Record<string, string>, body?: any): string {
    const lines: string[] = [`curl -X ${method} '${url}'`]

    for (const [key, value] of Object.entries(headers)) {
      lines.push(`  -H '${key}: ${value}'`)
    }

    if (body) {
      const bodyStr = JSON.stringify(body)
      // 如果 body 太长，格式化显示
      if (bodyStr.length > 100) {
        lines.push(`  -d '${bodyStr}'`)
      } else {
        lines.push(`  -d '${bodyStr}'`)
      }
    }

    return lines.join(' \\\n')
  }

  private async request(method: string, path: string, body?: any): Promise<any> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    const options: RequestInit & { headers: Record<string, string> } = {
      method,
      headers,
    }

    if (this.username && this.password) {
      headers['Authorization'] = 'Basic ' + btoa(`${this.username}:${this.password}`)
    }

    if (body) {
      options.body = JSON.stringify(body)
    }

    const startTime = Date.now()
    let status: 'success' | 'failed' = 'success'

    try {
      const response = await fetch(url, options)
      const contentType = response.headers.get('content-type') || ''
      const responseText = await response.text()

      // 2xx 和 3xx 状态码都视为正常
      const isOk = response.status >= 200 && response.status < 400

      if (!isOk) {
        throw new Error(`HTTP ${response.status}: ${responseText}`)
      }

      // 根据 content-type 判断响应类型
      if (contentType.includes('application/json')) {
        try {
          return JSON.parse(responseText)
        } catch {
          return responseText
        }
      }

      // 尝试解析为 JSON（有些响应没有正确的 content-type）
      if (responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
        try {
          return JSON.parse(responseText)
        } catch {
          return responseText
        }
      }

      return responseText
    } catch (e) {
      status = 'failed'
      throw e
    } finally {
      // 保存历史记录
      if (this.connectionId && this.connectionName) {
        const endTime = Date.now()
        const curl = this.generateCurl(method, url, headers, body)
        try {
          await saveHistoryItem({
            connection_id: this.connectionId,
            connection_name: this.connectionName,
            start_time: startTime,
            end_time: endTime,
            curl,
            status,
            duration: endTime - startTime
          })
        } catch {
          // 忽略保存历史记录的错误
        }
      }
    }
  }

  // Cluster APIs
  async getInfo(): Promise<any> {
    return this.request('GET', '/')
  }

  async getHealth(): Promise<any> {
    return this.request('GET', '/_cluster/health')
  }

  // Index APIs
  async getIndices(): Promise<any[]> {
    const h = 'index,health,pri,rep,docs.count,status,tm,store.size,memory.total,creation.date'
    return this.request('GET', `/_cat/indices?format=json&h=${h}`)
  }

  async getIndexStats(index: string): Promise<any> {
    return this.request('GET', `/${index}/_stats`)
  }

  async getIndexMapping(index: string): Promise<any> {
    return this.request('GET', `/${index}/_mapping`)
  }

  async getIndexSettings(index: string): Promise<any> {
    return this.request('GET', `/${index}/_settings`)
  }

  async deleteIndex(index: string): Promise<any> {
    return this.request('DELETE', `/${index}`)
  }

  async openIndex(index: string): Promise<any> {
    return this.request('POST', `/${index}/_open`)
  }

  async closeIndex(index: string): Promise<any> {
    return this.request('POST', `/${index}/_close`)
  }

  async refreshIndex(index: string): Promise<any> {
    return this.request('POST', `/${index}/_refresh`)
  }

  async flushIndex(index: string): Promise<any> {
    return this.request('POST', `/${index}/_flush`)
  }

  async clearIndexCache(index: string): Promise<any> {
    return this.request('POST', `/${index}/_cache/clear`)
  }

  async getIndexInfo(index: string): Promise<any> {
    return this.request('GET', `/${index}`)
  }

  async getIndexShards(index: string): Promise<any[]> {
    const h = 'index,shard,prirep,state,docs,store,ip,id,node,unassigned.reason'
    return this.request('GET', `/_cat/shards/${index}?format=json&h=${h}`)
  }

  // Node APIs
  async getNodes(): Promise<any[]> {
    return this.request('GET', '/_cat/nodes?format=json')
  }

  async getNodesDetailed(): Promise<any[]> {
    const h = 'id,pid,ip,port,http_address,version,flavor,type,build,jdk,disk.total,disk.used,disk.avail,disk.used_percent,heap.current,heap.percent,heap.max,ram.current,ram.percent,ram.max,file_desc.current,file_desc.percent,file_desc.max,cpu,load_1m,load_5m,load_15m,uptime,node.role,master,name,completion.size,fielddata.memory_size,fielddata.evictions,query_cache.memory_size,query_cache.evictions,request_cache.memory_size,request_cache.evictions,request_cache.hit_count,request_cache.miss_count,flush.total,flush.total_time,get.current,get.time,get.total,get.exists_time,get.exists_total,get.missing_time,get.missing_total,indexing.delete_current,indexing.delete_time,indexing.delete_total,indexing.index_current,indexing.index_time,indexing.index_total,indexing.index_failed,merges.current,merges.current_docs,merges.current_size,merges.total,merges.total_docs,merges.total_size,merges.total_time,refresh.total,refresh.time,refresh.external_total,refresh.external_time,refresh.listeners,script.compilations,script.cache_evictions,script.compilation_limit_triggered,search.fetch_current,search.fetch_time,search.fetch_total,search.open_contexts,search.query_current,search.query_time,search.query_total,search.scroll_current,search.scroll_time,search.scroll_total,segments.count,segments.memory,segments.index_writer_memory,segments.version_map_memory,suggest.current,suggest.time,suggest.total'
    return this.request('GET', `/_cat/nodes?format=json&h=${h}`)
  }

  // Shard APIs
  async getShards(): Promise<any[]> {
    const h = 'index,shard,prirep,state,docs,store,ip,id,node,unassigned.reason'
    return this.request('GET', `/_cat/shards?format=json&h=${h}`)
  }

  // Template APIs
  async getTemplates(): Promise<any[]> {
    return this.request('GET', '/_cat/templates?format=json')
  }

  async getIndexTemplates(): Promise<any[]> {
    try {
      // ES 7.10+ 使用 /_index_template API
      const result = await this.request('GET', '/_index_template')
      // 返回格式: { index_templates: [{ name: "xxx", index_template: {...} }] }
      if (result.index_templates && Array.isArray(result.index_templates)) {
        return result.index_templates.map((t: any) => ({
          name: t.name,
          index_patterns: t.index_template?.index_patterns || [],
          priority: t.index_template?.priority || 0,
          version: t.index_template?.version || null
        }))
      }
      return []
    } catch {
      // 如果 API 不存在（ES < 7.8），返回空数组
      return []
    }
  }

  async getTemplate(name: string): Promise<any> {
    return this.request('GET', `/_template/${name}`)
  }

  async getIndexTemplate(name: string): Promise<any> {
    return this.request('GET', `/_index_template/${name}`)
  }

  // Search
  async search(index: string, query: any): Promise<any> {
    return this.request('POST', `/${index}/_search`, query)
  }

  // Generic REST
  async execute(method: string, path: string, body?: any): Promise<any> {
    return this.request(method, path, body)
  }
}