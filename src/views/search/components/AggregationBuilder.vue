<script setup lang="ts">
import { computed } from 'vue'
import {
  NButton, NIcon, NSelect, NInput, NInputNumber, NCheckbox
} from 'naive-ui'
import { AddOutline, TrashOutline } from '@vicons/ionicons5'
import { type AggregationConfig, type AggregationType, type MappingField } from '../types'

const props = defineProps<{
  aggregations: AggregationConfig[]
  mapping: MappingField[]
}>()

const emit = defineEmits<{
  (e: 'update:aggregations', value: AggregationConfig[]): void
}>()

// 聚合类型选项
const aggregationTypeOptions = [
  { label: 'terms (词项聚合)', value: 'terms' },
  { label: 'max (最大值)', value: 'max' },
  { label: 'min (最小值)', value: 'min' },
  { label: 'sum (求和)', value: 'sum' },
  { label: 'count (计数)', value: 'count' },
  { label: 'avg (平均值)', value: 'avg' },
  { label: 'cardinality (基数)', value: 'cardinality' },
  { label: 'date_histogram (日期直方图)', value: 'date_histogram' }
]

// 字段选项 - 过滤出适合聚合的字段类型
const fieldOptions = computed(() => {
  return props.mapping
    .filter(f => !['text', 'object', 'nested'].includes(f.type) || f.type === 'keyword')
    .map(f => ({
      label: `${f.name} (${f.type})`,
      value: f.name
    }))
})

// 日期字段选项
const dateFieldOptions = computed(() => {
  return props.mapping
    .filter(f => f.type === 'date')
    .map(f => ({
      label: f.name,
      value: f.name
    }))
})

// 时间间隔选项
const intervalOptions = [
  { label: '分钟', value: 'minute' },
  { label: '小时', value: 'hour' },
  { label: '天', value: 'day' },
  { label: '周', value: 'week' },
  { label: '月', value: 'month' },
  { label: '季度', value: 'quarter' },
  { label: '年', value: 'year' }
]

// 排序选项
const orderOptions = [
  { label: '按词项升序', value: JSON.stringify({ _key: 'asc' }) },
  { label: '按词项降序', value: JSON.stringify({ _key: 'desc' }) },
  { label: '按计数升序', value: JSON.stringify({ _count: 'asc' }) },
  { label: '按计数降序', value: JSON.stringify({ _count: 'desc' }) }
]

// 生成唯一ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

// 添加聚合
function addAggregation() {
  const agg: AggregationConfig = {
    id: generateId(),
    name: `agg_${props.aggregations.length + 1}`,
    type: 'terms',
    field: '',
    enabled: true,
    size: 10
  }

  emit('update:aggregations', [...props.aggregations, agg])
}

// 删除聚合
function removeAggregation(index: number) {
  const aggs = [...props.aggregations]
  aggs.splice(index, 1)
  emit('update:aggregations', aggs)
}

// 更新聚合
function updateAggregation(index: number, updates: Partial<AggregationConfig>) {
  const aggs = [...props.aggregations]
  aggs[index] = { ...aggs[index], ...updates }
  emit('update:aggregations', aggs)
}

// 切换启用状态
function toggleAggregation(index: number) {
  const aggs = [...props.aggregations]
  aggs[index] = { ...aggs[index], enabled: !aggs[index].enabled }
  emit('update:aggregations', aggs)
}

// 解析排序值
function parseOrderValue(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}
</script>

<template>
  <div class="aggregation-builder">
    <!-- 聚合列表 -->
    <div v-for="(agg, index) in aggregations" :key="agg.id" class="agg-item" :class="{ disabled: !agg.enabled }">
      <!-- 启用复选框 -->
      <n-checkbox
        :checked="agg.enabled"
        @update:checked="toggleAggregation(index)"
      />

      <!-- 聚合名称 -->
      <n-input
        :value="agg.name"
        size="small"
        placeholder="名称"
        style="width: 120px"
        @update:value="v => updateAggregation(index, { name: v })"
      />

      <!-- 聚合类型 -->
      <n-select
        :value="agg.type"
        :options="aggregationTypeOptions"
        size="small"
        style="width: 150px"
        @update:value="v => updateAggregation(index, { type: v as AggregationType })"
      />

      <!-- 字段选择 -->
      <n-select
        :value="agg.field"
        :options="agg.type === 'date_histogram' ? dateFieldOptions : fieldOptions"
        size="small"
        filterable
        clearable
        placeholder="选择字段"
        style="flex: 1; min-width: 120px"
        @update:value="v => updateAggregation(index, { field: v || '' })"
      />

      <!-- terms 特有参数 -->
      <template v-if="agg.type === 'terms'">
        <n-input-number
          :value="agg.size"
          size="small"
          placeholder="size"
          :min="1"
          :max="1000"
          style="width: 70px"
          @update:value="v => updateAggregation(index, { size: v || 10 })"
        />
        <n-select
          :value="agg.order ? JSON.stringify(agg.order) : undefined"
          :options="orderOptions"
          size="small"
          placeholder="排序"
          clearable
          style="width: 120px"
          @update:value="v => updateAggregation(index, { order: v ? parseOrderValue(v) : undefined })"
        />
      </template>

      <!-- date_histogram 特有参数 -->
      <template v-if="agg.type === 'date_histogram'">
        <n-select
          :value="agg.interval"
          :options="intervalOptions"
          size="small"
          placeholder="间隔"
          style="width: 80px"
          @update:value="v => updateAggregation(index, { interval: v })"
        />
        <n-input
          :value="agg.format"
          size="small"
          placeholder="格式化"
          style="width: 100px"
          @update:value="v => updateAggregation(index, { format: v })"
        />
      </template>

      <!-- 删除按钮 -->
      <n-button size="tiny" quaternary @click="removeAggregation(index)">
        <template #icon>
          <n-icon :component="TrashOutline" />
        </template>
      </n-button>
    </div>

    <!-- 添加按钮 -->
    <n-button size="small" dashed block @click="addAggregation">
      <template #icon>
        <n-icon :component="AddOutline" />
      </template>
      添加聚合
    </n-button>
  </div>
</template>

<style scoped lang="scss">
.aggregation-builder {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.agg-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px;
  background-color: #2d2d2d;
  border-radius: 4px;

  &.disabled {
    opacity: 0.5;
  }
}

// 浅色主题
:root[data-theme='light'] {
  .agg-item {
    background-color: #f5f5f5;
  }
}
</style>