<script setup lang="ts">
import { NCheckbox, NSelect, NButton, NIcon } from 'naive-ui'
import { AddOutline, RemoveOutline, ChevronDownOutline, ChevronForwardOutline } from '@vicons/ionicons5'
import {
  type SearchQuery as SearchQueryType,
  type SearchItem,
  type MappingField,
  type BoolContext,
  createSearchItem
} from '../types'
import SearchItemComponent from './SearchItemComponent.vue'

const props = defineProps<{
  searchQuery: SearchQueryType
  mapping: MappingField[]
}>()

const emit = defineEmits<{
  (e: 'update', query: SearchQueryType): void
  (e: 'remove'): void
}>()

// 展开状态
const expanded = defineModel<boolean>('expanded', { default: true })

// 上下文选项
const contextOptions = [
  { label: 'must', value: 'must' },
  { label: 'must_not', value: 'must_not' },
  { label: 'should', value: 'should' },
  { label: 'filter', value: 'filter' }
]

// 上下文颜色
const contextColors: Record<BoolContext, string> = {
  must: '#22c55e',
  must_not: '#ef4444',
  should: '#3b82f6',
  filter: '#f59e0b'
}

// 深拷贝 - 使用 JSON 方式（Vue 响应式对象需用此方式）
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

// 更新查询
function updateQuery(query: SearchQueryType) {
  emit('update', deepClone(query))
}

// 切换启用状态
function toggleEnabled() {
  const newQuery = deepClone(props.searchQuery)
  newQuery.enabled = !newQuery.enabled
  updateQuery(newQuery)
}

// 改变上下文类型
function changeContext(val: BoolContext) {
  const newQuery = deepClone(props.searchQuery)
  newQuery.type = val
  updateQuery(newQuery)
}

// 添加查询项
function addSearchItem(type: 'query' | 'bool' = 'query') {
  const newQuery = deepClone(props.searchQuery)
  newQuery.children.push(createSearchItem(type))
  updateQuery(newQuery)
}

// 删除查询项
function removeSearchItem(id: string) {
  const newQuery = deepClone(props.searchQuery)
  newQuery.children = newQuery.children.filter((item: SearchItem) => item.id !== id)
  updateQuery(newQuery)
}

// 更新查询项
function updateSearchItem(id: string, updated: SearchItem) {
  const newQuery = deepClone(props.searchQuery)
  const idx = newQuery.children.findIndex((item: SearchItem) => item.id === id)
  if (idx > -1) {
    newQuery.children[idx] = updated
    updateQuery(newQuery)
  }
}
</script>

<template>
  <div class="search-query-item" :style="{ borderLeftColor: contextColors[searchQuery.type] }">
    <!-- 头部 -->
    <div class="query-header">
      <span class="expand-btn" @click="expanded = !expanded">
        <n-icon :size="14">
          <ChevronDownOutline v-if="expanded" />
          <ChevronForwardOutline v-else />
        </n-icon>
      </span>

      <n-checkbox
        :checked="searchQuery.enabled"
        @update:checked="toggleEnabled"
      />

      <n-select
        :value="searchQuery.type"
        :options="contextOptions"
        size="tiny"
        style="width: 110px"
        @update:value="changeContext"
      />

      <span class="query-label">{{ searchQuery.children.length }} 项</span>

      <div class="header-actions">
        <n-button size="tiny" type="success" @click="addSearchItem('bool')">
          <template #icon>
            <n-icon :component="AddOutline" />
          </template>
         bool
        </n-button>
        <n-button size="tiny" type="primary" @click="addSearchItem('query')">
          <template #icon><n-icon :size="14"><AddOutline /></n-icon></template>
        </n-button>
      </div>

      <n-button size="tiny" type="error" @click="emit('remove')">
        <template #icon><n-icon :size="14"><RemoveOutline /></n-icon></template>
      </n-button>
    </div>

    <!-- 内容 -->
    <div v-show="expanded" class="query-content">
      <div class="items-list">
        <SearchItemComponent
          v-for="item in searchQuery.children"
          :key="item.id"
          :search-item="item"
          :mapping="mapping"
          @update="(updated: SearchItem) => updateSearchItem(item.id, updated)"
          @remove="removeSearchItem(item.id)"
        />
      </div>

      <!-- 空状态 -->
      <div v-if="searchQuery.children.length === 0" class="empty-state">
        点击上方按钮添加查询条件
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.search-query-item {
  border-left: 3px solid #666;
  border-radius: 4px;
  background-color: rgba(255, 255, 255, 0.02);
}

.query-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background-color: #2d2d2d;
  border-radius: 4px;
}

.expand-btn {
  cursor: pointer;
  color: #888;
  display: flex;
  align-items: center;

  &:hover { color: #fff; }
}

.query-label {
  font-size: 11px;
  color: #888;
}

.header-actions {
  display: flex;
  gap: 4px;
}

.query-content {
  padding: 6px 8px 6px 12px;
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.empty-state {
  padding: 12px;
  text-align: center;
  color: #666;
  font-size: 12px;
}

:root[data-theme='light'] {
  .search-query-item {
    background-color: rgba(0, 0, 0, 0.02);
  }

  .query-header {
    background-color: #e8e8e8;
  }

  .expand-btn:hover { color: #333; }
  .query-label { color: #666; }
  .empty-state { color: #999; }
}
</style>