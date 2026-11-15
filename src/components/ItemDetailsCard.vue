<script setup>
defineProps({
  eyebrow: { type: String, default: '' },
  title: { type: String, required: true },
  fields: { type: Array, required: true },
})
</script>

<template>
  <v-card class="item-details-card pa-5 mb-5" rounded="xl" variant="outlined">
    <div class="d-flex align-start justify-space-between ga-4">
      <div>
        <div class="text-overline text-medium-emphasis item-details-eyebrow">{{ eyebrow || ' ' }}</div>
        <h2 class="text-h5">{{ title }}</h2>
      </div>
      <div class="d-flex flex-wrap justify-end ga-2">
        <slot name="actions" />
      </div>
    </div>

    <v-row class="item-details-fields mt-2">
      <v-col v-for="field in fields" :key="field.key" cols="12" :md="field.fullWidth ? 12 : 6">
        <div class="text-caption text-medium-emphasis">{{ field.label }}</div>
        <slot name="value" :field="field">
          <div class="text-body-2" :class="{ 'text-medium-emphasis': field.value == null || field.value === '' }">
            {{ field.value == null || field.value === '' ? '—' : field.value }}
          </div>
        </slot>
      </v-col>
    </v-row>
  </v-card>
</template>

<style scoped>
.item-details-eyebrow {
  min-height: 1.5em;
}

.item-details-fields :deep(.v-col) {
  min-width: 0;
}
</style>
