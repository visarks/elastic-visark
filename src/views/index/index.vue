<script setup lang="ts">
import { NCard, NEmpty } from 'naive-ui'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <n-card :title="t('nav.index')">
    <n-empty :description="t('common.noData')" />
  </n-card>
</template>