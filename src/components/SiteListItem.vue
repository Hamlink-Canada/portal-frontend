<script setup>
import { useI18n } from 'vue-i18n'

defineProps({
  site: { type: Object, required: true },
  ownerName: { type: String, default: '' },
})
defineEmits(['open'])
const { t } = useI18n()
</script>

<template>
  <v-list-item class="site-row" :title="site.name" @click="$emit('open')">
    <template #subtitle>
      <div class="site-row-primary">
        <span class="site-id-label" :class="{ 'site-row-empty': !site.site_id }">{{ site.site_id || '—' }}</span>
        <span :class="{ 'site-row-empty': !site.grid_square }">{{ site.grid_square || '—' }}</span>
        <span :class="{ 'site-row-empty': !site.location && !site.country_code }">{{ site.location || site.country_code || '—' }}</span>
        <span v-if="site.location" :class="{ 'site-row-empty': !site.country_code }">{{ site.country_code || '—' }}</span>
      </div>
      <div class="site-row-secondary">
        <span>{{ t('sites.owner') }}: <span :class="{ 'site-row-empty': !ownerName }">{{ ownerName || '—' }}</span></span>
        <span class="site-coordinates" :class="{ 'site-row-empty': site.latitude == null || site.longitude == null }">
          {{ site.latitude != null && site.longitude != null ? `${Number(site.latitude).toFixed(4)}, ${Number(site.longitude).toFixed(4)}` : '—' }}
        </span>
      </div>
    </template>
    <template #append>
      <div class="site-row-append">
        <v-chip size="small" variant="tonal" :class="{ 'text-medium-emphasis': !site.numbering_mode }">
          {{ site.numbering_mode === 'extended' ? t('sites.extendedNumbering') : site.numbering_mode === 'short' ? t('sites.shortNumbering') : '—' }}
        </v-chip>
        <v-icon icon="mdi-chevron-right" size="small" class="site-row-chevron" />
      </div>
    </template>
  </v-list-item>
</template>
