<script setup>
import { useI18n } from 'vue-i18n'

defineProps({
  repeater: { type: Object, required: true },
  enabledSaving: { type: Boolean, default: false },
})
defineEmits(['open', 'update-enabled'])
const { t } = useI18n()
</script>

<template>
  <v-list-item class="repeater-row" :title="`${t('repeaters.nodeId')} ${repeater.node_id}`" @click="$emit('open')">
    <template #subtitle>
      <div class="repeater-row-primary">
        <span :class="{ 'text-medium-emphasis': !repeater.call_sign }">{{ repeater.call_sign || '—' }}</span>
        <span class="repeater-site-name" :class="{ 'text-medium-emphasis': !repeater.site_name }">{{ repeater.site_name || '—' }}</span>
      </div>
      <div class="repeater-row-secondary">
        <span>{{ t('repeaters.frequency') }}: <span :class="{ 'text-medium-emphasis': !repeater.frequency }">{{ repeater.frequency || '—' }}</span></span>
        <span>{{ t('repeaters.tone') }}: <span :class="{ 'text-medium-emphasis': !repeater.tone }">{{ repeater.tone || '—' }}</span></span>
      </div>
    </template>
    <template #append>
      <div class="repeater-row-append">
        <div class="repeater-row-status" @click.stop>
          <v-chip
            class="repeater-freshness"
            size="small"
            :color="repeater.registration_freshness === 'current' ? 'success' : repeater.registration_freshness === 'stale' ? 'warning' : undefined"
            variant="tonal"
          >{{ t(`repeaters.freshness.${repeater.registration_freshness || 'unknown'}`) }}</v-chip>
          <v-switch
            v-if="repeater.can_manage"
            :model-value="repeater.enabled"
            :label="t('repeaters.enabled')"
            color="primary"
            density="compact"
            hide-details
            :disabled="enabledSaving"
            @click.stop
            @update:model-value="$emit('update-enabled', $event)"
          />
          <v-chip v-else size="small" :color="repeater.enabled ? 'success' : undefined" variant="tonal">
            {{ t(repeater.enabled ? 'repeaters.enabled' : 'repeaters.disabled') }}
          </v-chip>
        </div>
        <v-icon icon="mdi-chevron-right" size="small" class="repeater-row-chevron" />
      </div>
    </template>
  </v-list-item>
</template>
