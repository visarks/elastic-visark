<script setup lang="ts">
import { ref, computed } from 'vue'
import { NCheckbox, NSelect, NButton, NIcon, NInput } from 'naive-ui'
import { RemoveOutline, ChevronDownOutline, ChevronForwardOutline, AddOutline } from '@vicons/ionicons5'
import {
  type SearchItem as SearchItemType,
  type SearchQuery,
  type MappingField,
  type QueryType,
  type BoolContext,
  createSearchQuery
} from '../types'
import SearchQueryItem from './SearchQueryItem.vue'

const props = defineProps<{
  searchItem: SearchItemType
  mapping: MappingField[]
}>()

const emit = defineEmits<{
  (e: 'update', item: SearchItemType): void
  (e: 'remove'): void
}>()

// 展开状态（用于 bool 类型）
const expanded = ref(true)

// 查询类型选项
const queryTypeOptions = [
  { label: 'term', value: 'term' },
  { label: 'terms', value: 'terms' },
  { label: 'match', value: 'match' },
  { label: 'wildcard', value: 'wildcard' },
  { label: 'range', value: 'range' },
  { label: 'exists', value: 'exists' }
]

// range 操作符选项
const rangeOpOptions = [
  { label: '>', value: 'gt' },
  { label: '>=', value: 'gte' },
  { label: '<', value: 'lt' },
  { label: '<=', value: 'lte' }
]

// 字段选项
const fieldOptions = computed(() =>
  props.mapping.map(f => ({ label: f.name, value: f.name }))
)

// 更新项
function updateItem(item: SearchItemType) {
  emit('update', JSON.parse(JSON.stringify(item)))
}

// 切换启用状态
function toggleEnabled() {
  const newItem = JSON.parse(JSON.stringify(props.searchItem))
  newItem.enabled = !newItem.enabled
  updateItem(newItem)
}

// 更新字段
function updateField(field: string) {
  const newItem = JSON.parse(JSON.stringify(props.searchItem))
  newItem.field = field
  updateItem(newItem)
}

// 更新查询类型
function updateQueryType(type: QueryType) {
  const newItem = JSON.parse(JSON.stringify(props.searchItem))
  newItem.queryType = type
  // 重置值
  newItem.value = ''
  newItem.value1 = ''
  updateItem(newItem)
}

// 更新值
function updateValue(val: string) {
  const newItem = JSON.parse(JSON.stringify(props.searchItem))
  newItem.value = val
  updateItem(newItem)
}

// 更新上界值
function updateValue1(val: string) {
  const newItem = JSON.parse(JSON.stringify(props.searchItem))
  newItem.value1 = val
  updateItem(newItem)
}

// 更新 range 下界操作符
function updateRangeLowerOp(op: 'gt' | 'gte') {
  const newItem = JSON.parse(JSON.stringify(props.searchItem))
  newItem.rangeLowerOp = op
  updateItem(newItem)
}

// 更新 range 上界操作符
function updateRangeUpperOp(op: 'lt' | 'lte') {
  const newItem = JSON.parse(JSON.stringify(props.searchItem))
  newItem.rangeUpperOp = op
  updateItem(newItem)
}

// 添加嵌套 SearchQuery
function addNestedQuery(type: BoolContext = 'must') {
  const newItem = JSON.parse(JSON.stringify(props.searchItem))
  if (!newItem.children) {
    newItem.children = []
  }
  newItem.children.push(createSearchQuery(type))
  updateItem(newItem)
}

// 更新嵌套 SearchQuery
function updateNestedQuery(id: string, query: SearchQuery) {
  const newItem = JSON.parse(JSON.stringify(props.searchItem))
  const idx = newItem.children.findIndex((q: SearchQuery) => q.id === id)
  if (idx > -1) {
    newItem.children[idx] = query
    updateItem(newItem)
  }
}

// 删除嵌套 SearchQuery
function removeNestedQuery(id: string) {
  const newItem = JSON.parse(JSON.stringify(props.searchItem))
  newItem.children = newItem.children.filter((q: SearchQuery) => q.id !== id)
  updateItem(newItem)
}
</script>

<template>
  <div class="search-item" :class="{ disabled: !searchItem.enabled }">
    <!-- type='query' 查询项 -->
    <template v-if="searchItem.type === 'query'">
      <div class="query-row">
        <n-checkbox
          :checked="searchItem.enabled"
          @update:checked="toggleEnabled"
        />

        <!-- 字段选择 -->
        <n-select
          :value="searchItem.field"
          :options="fieldOptions"
          size="tiny"
          filterable
          clearable
          placeholder="字段"
          style="width: 170px"
          @update:value="updateField"
        />

        <!-- 查询类型 -->
        <n-select
          :value="searchItem.queryType"
          :options="queryTypeOptions"
          size="tiny"
          style="width: 120px"
          @update:value="updateQueryType"
        />

        <!-- 值输入 -->
        <template v-if="['term', 'terms', 'match', 'wildcard'].includes(searchItem.queryType || '')">
          <n-input
            :value="searchItem.value"
            :placeholder="searchItem.queryType === 'terms' ? '值1,值2,...' : '值'"
            size="tiny"
            style="width: 300px"
            @update:value="updateValue"
          />
        </template>

        <!-- range 查询 -->
        <template v-else-if="searchItem.queryType === 'range'">
          <n-select
            :value="searchItem.rangeLowerOp || 'gte'"
            :options="rangeOpOptions.filter(o => ['gt', 'gte'].includes(o.value))"
            size="tiny"
            style="width: 70px"
            @update:value="(v) => updateRangeLowerOp(v as 'gt' | 'gte')"
          />
          <n-input
            :value="searchItem.value"
            placeholder="下界"
            size="tiny"
            style="width: 160px"
            @update:value="updateValue"
          />
          <span class="range-sep">~</span>
          <n-select
            :value="searchItem.rangeUpperOp || 'lte'"
            :options="rangeOpOptions.filter(o => ['lt', 'lte'].includes(o.value))"
            size="tiny"
            style="width: 70px"
            @update:value="(v) => updateRangeUpperOp(v as 'lt' | 'lte')"
          />
          <n-input
            :value="searchItem.value1"
            placeholder="上界"
            size="tiny"
            style="width: 160px"
            @update:value="updateValue1"
          />
        </template>

        <!-- exists 查询 -->
        <template v-else-if="searchItem.queryType === 'exists'">
        </template>

        <n-button size="tiny" type="error" @click="emit('remove')">
          <template #icon><n-icon :size="14"><RemoveOutline /></n-icon></template>
        </n-button>
      </div>
    </template>

    <!-- type='bool' 嵌套 bool -->
    <template v-else-if="searchItem.type === 'bool'">
      <div class="bool-item">
        <div class="bool-header">
          <span class="expand-btn" @click="expanded = !expanded">
            <n-icon :size="14">
              <ChevronDownOutline v-if="expanded" />
              <ChevronForwardOutline v-else />
            </n-icon>
          </span>

          <n-checkbox
            :checked="searchItem.enabled"
            @update:checked="toggleEnabled"
          />

          <span class="bool-label">bool</span>
          <span class="bool-count">{{ searchItem.children?.length || 0 }} 组</span>

<!--          <div class="bool-actions">-->
<!--            <n-button size="tiny" type="primary" @click="addNestedQuery('must')">-->
<!--              must-->
<!--            </n-button>-->
<!--            <n-button size="tiny" @click="addNestedQuery('must_not')">-->
<!--              must_not-->
<!--            </n-button>-->
<!--            <n-button size="tiny" @click="addNestedQuery('should')">-->
<!--              should-->
<!--            </n-button>-->
<!--            <n-button size="tiny" @click="addNestedQuery('filter')">-->
<!--              filter-->
<!--            </n-button>-->
<!--          </div>-->

          <n-button size="tiny" type="success" @click="addNestedQuery('must')">
            <template #icon><n-icon :size="14"><AddOutline /></n-icon></template>
          </n-button>
          <n-button size="tiny" type="error" @click="emit('remove')">
            <template #icon><n-icon :size="14"><RemoveOutline /></n-icon></template>
          </n-button>
        </div>

        <!-- 嵌套的 SearchQuery 列表 -->
        <div v-show="expanded" class="bool-content">
          <SearchQueryItem
            v-for="sq in searchItem.children"
            :key="sq.id"
            :search-query="sq"
            :mapping="mapping"
            @update="(q) => updateNestedQuery(sq.id, q)"
            @remove="removeNestedQuery(sq.id)"
          />

          <div v-if="!searchItem.children || searchItem.children.length === 0" class="empty-state">
            点击上方按钮添加嵌套查询条件
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.search-item {
  padding: 4px;
  background-color: rgba(255, 255, 255, 0.02);
  border-radius: 4px;

  &.disabled {
    opacity: 0.5;
  }
}

.query-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.range-sep {
  color: #666;
  font-size: 12px;
}

.exists-hint {
  font-size: 11px;
  color: #888;
  font-style: italic;
}

.bool-item {
  border: 1px solid #3d3d3d;
  border-radius: 4px;
}

.bool-header {
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

.bool-label {
  font-family: monospace;
  font-size: 12px;
  font-weight: 600;
  color: #63e2b7;
}

.bool-count {
  font-size: 11px;
  color: #888;
}

.bool-actions {
  display: flex;
  gap: 4px;
}

.bool-content {
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.empty-state {
  padding: 12px;
  text-align: center;
  color: #666;
  font-size: 12px;
}

:root[data-theme='light'] {
  .search-item {
    background-color: rgba(0, 0, 0, 0.02);
  }

  .bool-item { border-color: #ddd; }
  .bool-header { background-color: #e8e8e8; }
  .expand-btn:hover { color: #333; }
  .bool-label { color: #18a058; }
  .empty-state { color: #999; }
}
</style>