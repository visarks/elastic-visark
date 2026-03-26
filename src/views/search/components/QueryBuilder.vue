<script setup lang="ts">
import { NButton, NIcon } from 'naive-ui'
import { AddOutline } from '@vicons/ionicons5'
import { type BoolQuery, type MappingField, type SearchQuery as SearchQueryType, createSearchQuery } from '../types'
import SearchQueryItem from './SearchQueryItem.vue'

const props = defineProps<{
  boolQuery: BoolQuery
  mapping: MappingField[]
}>()

const emit = defineEmits<{
  (e: 'update:boolQuery', value: BoolQuery): void
}>()

// 添加新的 SearchQuery
function addSearchQuery() {
  const newQuery = JSON.parse(JSON.stringify(props.boolQuery))
  newQuery.query.push(createSearchQuery())
  emit('update:boolQuery', newQuery)
}

// 删除 SearchQuery
function removeSearchQuery(id: string) {
  const newQuery = JSON.parse(JSON.stringify(props.boolQuery))
  newQuery.query = newQuery.query.filter((sq: { id: string }) => sq.id !== id)
  emit('update:boolQuery', newQuery)
}

// 更新 SearchQuery
function updateSearchQuery(id: string, updated: SearchQueryType) {
  const newQuery = JSON.parse(JSON.stringify(props.boolQuery))
  const idx = newQuery.query.findIndex((sq: { id: string }) => sq.id === id)
  if (idx > -1) {
    newQuery.query[idx] = updated
    emit('update:boolQuery', newQuery)
  }
}
</script>

<template>
  <div class="query-builder">
    <!-- SearchQuery 列表 -->
    <div class="query-list">
      <SearchQueryItem
        v-for="sq in boolQuery.query"
        :key="sq.id"
        :search-query="sq"
        :mapping="mapping"
        @update="(updated) => updateSearchQuery(sq.id, updated)"
        @remove="removeSearchQuery(sq.id)"
      />
    </div>

    <!-- 添加按钮 -->
    <div class="add-query-row">
      <n-button block dashed size="small" @click="addSearchQuery">
        <template #icon>
          <n-icon :component="AddOutline" />
        </template>
        添加查询条件组
      </n-button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.query-builder {
  font-size: 12px;
}

.query-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.add-query-row {
  padding: 8px 0;
  border-top: 1px dashed #3d3d3d;
  margin-top: 8px;
}

:root[data-theme='light'] {
  .add-query-row {
    border-top-color: #ddd;
  }
}
</style>