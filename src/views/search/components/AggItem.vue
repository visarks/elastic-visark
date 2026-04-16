<script setup lang="ts">
import { computed } from 'vue'
import { NCheckbox, NSelect, NInputNumber, NButton, NIcon } from 'naive-ui'
import { AddOutline, RemoveOutline } from '@vicons/ionicons5'
import { type AggregationConfig, type AggregationType, createAggregationConfig } from '../types'

const props = defineProps<{
  agg: AggregationConfig
  level?: number
  fieldOptions?: { label: string; value: string }[]
}>()

const emit = defineEmits<{
  (e: 'update', agg: AggregationConfig): void
  (e: 'remove'): void
}>()

const level = computed(() => props.level ?? 0)

const subAggSupportedTypes = ['terms', 'date_histogram']

const aggTypeOptions = [
  { label: 'terms', value: 'terms' },
  { label: 'max', value: 'max' },
  { label: 'min', value: 'min' },
  { label: 'sum', value: 'sum' },
  { label: 'count', value: 'count' },
  { label: 'avg', value: 'avg' },
  { label: 'cardinality', value: 'cardinality' },
  { label: 'date_histogram', value: 'date_histogram' }
]

const aggOrderOptions = [
  { label: 'key 升序', value: '_key-asc' },
  { label: 'key 降序', value: '_key-desc' },
  { label: 'count 升序', value: '_count-asc' },
  { label: 'count 降序', value: '_count-desc' }
]

function updateAgg(partial: Partial<AggregationConfig>) {
  // 创建新对象并触发更新
  const newAgg = { ...props.agg, ...partial }
  // 如果是更新 subAggs，需要深拷贝
  if (partial.subAggs) {
    newAgg.subAggs = partial.subAggs
  }
  emit('update', newAgg)
}

function getAggOrderValue(agg: AggregationConfig): string {
  if (!agg.order) return '_key-asc'
  const key = Object.keys(agg.order)[0] as '_key' | '_count'
  const order = (agg.order as Record<string, 'asc' | 'desc'>)[key]
  return `${key}-${order}`
}

function updateAggOrder(_agg: AggregationConfig, value: string) {
  const [key, order] = value.split('-')
  if (key === '_key') {
    updateAgg({ order: { _key: order as 'asc' | 'desc' } })
  } else {
    updateAgg({ order: { _count: order as 'asc' | 'desc' } })
  }
}

function handleTypeChange(type: AggregationType) {
  updateAgg({ type, field: '', size: undefined, order: undefined, interval: undefined, format: undefined, subAggs: [] })
}

function handleRemove() {
  emit('remove')
}

function handleAddChild() {
  const newChild = createAggregationConfig()
  const currentSubAggs = props.agg.subAggs || []
  updateAgg({ subAggs: [...currentSubAggs, newChild] })
}

function handleChildUpdate(index: number, updated: AggregationConfig) {
  const currentSubAggs = [...(props.agg.subAggs || [])]
  currentSubAggs[index] = updated
  updateAgg({ subAggs: currentSubAggs })
}

function handleChildRemove(index: number) {
  const currentSubAggs = [...(props.agg.subAggs || [])]
  currentSubAggs.splice(index, 1)
  updateAgg({ subAggs: currentSubAggs })
}
</script>

<template>
  <div class="agg-item-wrapper">
    <div class="agg-item" :class="{ 'sub-agg-item': level > 0 }">
      <n-checkbox :checked="agg.enabled" @update:checked="(v) => updateAgg({ enabled: v })" />
      <n-select
        :value="agg.type"
        :options="aggTypeOptions"
        size="small"
        style="width: 100px"
        @update:value="(v: AggregationType) => handleTypeChange(v)"
      />
      <n-select
        :value="agg.field"
        :options="fieldOptions || []"
        size="small"
        filterable
        clearable
        placeholder="字段"
        style="width: 300px"
        @update:value="(v) => updateAgg({ field: v })"
      />
      <template v-if="agg.type === 'terms'">
        <n-input-number
          :value="agg.size"
          placeholder="size"
          size="small"
          style="width: 80px"
          :min="1"
          @update:value="(v: number | null) => updateAgg({ size: v ?? undefined })"
        />
        <n-select
          :value="getAggOrderValue(agg)"
          :options="aggOrderOptions"
          size="small"
          style="width: 110px"
          @update:value="(v: string) => updateAggOrder(agg, v)"
        />
      </template>
      <template v-else-if="agg.type === 'date_histogram'">
        <n-input
          :value="agg.interval"
          placeholder="间隔"
          size="small"
          style="width: 100px"
          @update:value="(v: string | null) => updateAgg({ interval: v ?? undefined })"
        />
        <n-input
          :value="agg.format"
          placeholder="格式"
          size="small"
          style="width: 100px"
          @update:value="(v: string | null) => updateAgg({ format: v ?? undefined })"
        />
      </template>
      <n-button v-if="subAggSupportedTypes.includes(agg.type)" size="tiny" type="info" @click="handleAddChild">
        <template #icon>
          <n-icon :component="AddOutline" />
        </template>
      </n-button>
      <n-button v-if="level > 0" size="tiny" type="error" @click="handleRemove">
        <template #icon>
          <n-icon :component="RemoveOutline" />
        </template>
      </n-button>
      <n-button v-if="level === 0" size="tiny" type="error" @click="emit('remove')">
        <template #icon>
          <n-icon :component="RemoveOutline" />
        </template>
      </n-button>
    </div>

    <!-- 递归子聚合列表 -->
    <div v-if="agg.subAggs && agg.subAggs.length > 0" class="sub-agg-list">
      <AggItem
        v-for="(child, index) in agg.subAggs"
        :key="child.id"
        :agg="child"
        :level="level + 1"
        :field-options="fieldOptions"
        @update="(updated) => handleChildUpdate(index, updated)"
        @remove="() => handleChildRemove(index)"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.agg-item-wrapper {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.agg-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background-color: rgba(255, 255, 255, 0.02);
  border-radius: 4px;

  &.sub-agg-item {
    background-color: rgba(99, 226, 183, 0.05);
  }
}

.sub-agg-list {
  margin-left: 24px;
  padding-left: 12px;
  border-left: 2px solid #3d3d3d;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

:root[data-theme='light'] {
  .agg-item {
    background-color: rgba(0, 0, 0, 0.02);

    &.sub-agg-item {
      background-color: rgba(24, 160, 88, 0.05);
    }
  }

  .sub-agg-list {
    border-left-color: #ddd;
  }
}
</style>
