// 布尔上下文类型
export type BoolContext = 'must' | 'must_not' | 'should' | 'filter'

// 搜索项类型
export type SearchType = 'query' | 'bool'

// 查询类型
export type QueryType = 'term' | 'terms' | 'wildcard' | 'match' | 'range' | 'exists'

// 搜索项
export interface SearchItem {
  id: string
  enabled: boolean
  type: SearchType
  // type='query' 时使用
  queryType?: QueryType
  field?: string
  value?: string
  rangeLowerOp?: 'gt' | 'gte'
  rangeUpperOp?: 'lt' | 'lte'
  value1?: string
  // type='bool' 时使用
  children?: SearchQuery[]
}

// 搜索查询
export interface SearchQuery {
  id: string
  enabled: boolean
  type: BoolContext
  children: SearchItem[]
}

// Bool 查询
export interface BoolQuery {
  query: SearchQuery[]
}

// 生成随机ID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

// 创建空的 SearchItem
export function createSearchItem(type: SearchType = 'query'): SearchItem {
  const item: SearchItem = {
    id: generateId(),
    enabled: true,
    type
  }
  if (type === 'query') {
    item.queryType = 'term'
    item.field = ''
    item.value = ''
  } else {
    item.children = []
  }
  return item
}

// 创建空的 SearchQuery
export function createSearchQuery(type: BoolContext = 'must'): SearchQuery {
  return {
    id: generateId(),
    enabled: true,
    type,
    children: []
  }
}

// 创建空的 BoolQuery
export function createEmptyBoolQuery(): BoolQuery {
  return {
    query: []
  }
}

// 构建 ES DSL 查询
export function buildDslFromQuery(boolQuery: BoolQuery): any {
  const bool: any = {}

  for (const sq of boolQuery.query) {
    if (!sq.enabled || sq.children.length === 0) continue

    const clauses: any[] = []

    for (const item of sq.children) {
      if (!item.enabled) continue

      if (item.type === 'query') {
        const clause = buildQueryClause(item)
        if (clause) clauses.push(clause)
      } else if (item.type === 'bool' && item.children && item.children.length > 0) {
        // 递归构建嵌套 bool
        const nestedBool = buildNestedBool(item.children)
        if (nestedBool) clauses.push({ bool: nestedBool })
      }
    }

    if (clauses.length > 0) {
      bool[sq.type] = clauses
    }
  }

  return { bool }
}

// 构建单个查询子句
function buildQueryClause(item: SearchItem): any | null {
  if (!item.field) return null

  switch (item.queryType) {
    case 'term':
      if (!item.value) return null
      return { term: { [item.field]: item.value } }
    case 'terms':
      if (!item.value) return null
      const termsValues = item.value.split(',').map(v => v.trim()).filter(Boolean)
      if (termsValues.length === 0) return null
      return { terms: { [item.field]: termsValues } }
    case 'wildcard':
      if (!item.value) return null
      return { wildcard: { [item.field]: item.value } }
    case 'match':
      if (!item.value) return null
      return { match: { [item.field]: item.value } }
    case 'range':
      const range: any = {}
      if (item.rangeLowerOp && item.value) {
        range[item.rangeLowerOp] = item.value
      }
      if (item.rangeUpperOp && item.value1) {
        range[item.rangeUpperOp] = item.value1
      }
      if (Object.keys(range).length === 0) return null
      return { range: { [item.field]: range } }
    case 'exists':
      return { exists: { field: item.field } }
    default:
      return null
  }
}

// 构建嵌套 bool
function buildNestedBool(items: SearchQuery[]): any {
  const bool: any = {}

  for (const sq of items) {
    if (!sq.enabled || sq.children.length === 0) continue

    const clauses: any[] = []

    for (const item of sq.children) {
      if (!item.enabled) continue

      if (item.type === 'query') {
        const clause = buildQueryClause(item)
        if (clause) clauses.push(clause)
      } else if (item.type === 'bool' && item.children && item.children.length > 0) {
        const nestedBool = buildNestedBool(item.children)
        if (nestedBool) clauses.push({ bool: nestedBool })
      }
    }

    if (clauses.length > 0) {
      bool[sq.type] = clauses
    }
  }

  return Object.keys(bool).length > 0 ? bool : null
}

// Mapping 字段类型
export interface MappingField {
  name: string
  type: string
}

// 搜索历史
export interface SearchHistoryItem {
  id: string
  index: string
  query: any
  timestamp: number
}

// 排序配置
export interface SortConfig {
  field: string
  order: 'asc' | 'desc'
}

// 聚合类型
export type AggregationType = 'terms' | 'max' | 'min' | 'sum' | 'count' | 'avg' | 'cardinality' | 'date_histogram'

// 聚合配置（支持子聚合）
export interface AggregationConfig {
  id: string
  name: string
  type: AggregationType
  field: string
  enabled: boolean
  size?: number
  order?: { _key: 'asc' | 'desc' } | { _count: 'asc' | 'desc' }
  interval?: string
  format?: string
  // 子聚合（仅 terms 和 date_histogram 支持）
  subAggs?: AggregationConfig[]
}

// 创建空的聚合配置
export function createAggregationConfig(type: AggregationType = 'terms'): AggregationConfig {
  const config: AggregationConfig = {
    id: generateId(),
    name: '',
    type,
    field: '',
    enabled: true
  }

  if (type === 'terms') {
    config.size = 10
  } else if (type === 'date_histogram') {
    config.interval = '1d'
  }

  return config
}

// 构建完整搜索 DSL
export function buildSearchDsl(config: {
  index: string
  boolQuery: BoolQuery
  sorts: SortConfig[]
  pagination: { from: number; size: number }
  trackTotalHits: boolean
  aggregations: AggregationConfig[]
}): any {
  const query = buildDslFromQuery(config.boolQuery)

  const dsl: any = {
    query: query.bool && Object.keys(query.bool).length > 0 ? query : { match_all: {} },
    track_total_hits: config.trackTotalHits
  }

  if (config.sorts.length > 0) {
    dsl.sort = config.sorts.map(s => ({ [s.field]: s.order }))
  }

  if (config.pagination.size > 0) {
    dsl.from = config.pagination.from
    dsl.size = config.pagination.size
  }

  if (config.aggregations.length > 0) {
    dsl.aggs = {}
    for (const agg of config.aggregations) {
      dsl.aggs[agg.name] = buildAggregation(agg)
    }
  }

  return dsl
}

function buildAggregation(agg: AggregationConfig): any {
  const result: any = {}

  switch (agg.type) {
    case 'terms':
      result.terms = {
        field: agg.field,
        size: agg.size || 10
      }
      if (agg.order) {
        result.terms.order = agg.order
      }
      break
    case 'max':
      result.max = { field: agg.field }
      break
    case 'min':
      result.min = { field: agg.field }
      break
    case 'sum':
      result.sum = { field: agg.field }
      break
    case 'count':
      result.value_count = { field: agg.field }
      break
    case 'avg':
      result.avg = { field: agg.field }
      break
    case 'cardinality':
      result.cardinality = { field: agg.field }
      break
    case 'date_histogram':
      result.date_histogram = {
        field: agg.field,
        calendar_interval: agg.interval || '1d'
      }
      if (agg.format) {
        result.date_histogram.format = agg.format
      }
      break
  }

  return result
}