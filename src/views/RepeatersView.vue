<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import ItemDetailsCard from '../components/ItemDetailsCard.vue'
import RepeaterListItem from '../components/RepeaterListItem.vue'
import { CALL_SIGN_RE } from '../utils/regex.js'
import { useUnsavedChanges } from '../utils/unsavedChanges.js'

const props = defineProps({
  apiFetch: { type: Function, required: true },
  userSubject: { type: String, default: '' },
  isSystemSuperAdmin: { type: Boolean, default: false },
})
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const isFormRoute = computed(() => route.meta.formPage === true)
const isDetailRoute = computed(() => route.name === 'repeater-detail')
const sites = ref([])
const entities = ref([])
const repeaters = ref([])
const repeaterDetail = ref(null)
const loading = ref(false)
const saving = ref(false)
const creating = ref(false)
const createFormCard = ref(null)
const enabledSaving = ref(new Set())
const error = ref('')
const search = ref('')
const searchQuery = computed(() => String(search.value ?? '').trim())
const page = ref(1)
const pageSize = ref(10)
const listScope = ref('mine')
const siteFilter = ref('all')
const entityFilter = ref('all')
const pagination = ref({ page: 1, page_size: pageSize.value, total: 0, pages: 1 })
const editReturnRoute = ref({ name: 'repeaters' })
const editing = ref(null)
const siteId = ref(null)
const selectedSiteRepeaterCount = ref(null)
const siteCapacityLoading = ref(false)
const siteCapacityError = ref('')
const callSign = ref('')
const frequency = ref('')
const tone = ref('')
const editForm = ref({ call_sign: '', frequency: '', tone: '', enabled: false })
const callSignValid = computed(() => !callSign.value.trim() || CALL_SIGN_RE.test(callSign.value.trim()))
const editCallSignValid = computed(() => !editForm.value.call_sign.trim() || CALL_SIGN_RE.test(editForm.value.call_sign.trim()))
const callSignRule = (value) => (
  !String(value || '').trim()
  || CALL_SIGN_RE.test(String(value).trim())
  || t('repeaters.invalidCallSign')
)
const secretReveal = ref('')
const unsavedChanges = useUnsavedChanges('repeaters', () => ({
  active: creating.value || Boolean(editing.value),
  siteId: siteId.value,
  callSign: callSign.value,
  frequency: frequency.value,
  tone: tone.value,
  editForm: editForm.value,
}), () => t('common.unsavedChanges'))
const siteItems = computed(() => sites.value.filter((site) => site.can_manage).map((site) => ({
  title: `${site.name} · ${site.site_id || '—'}`,
  value: site.id,
})))
const selectedSite = computed(() => sites.value.find((site) => Number(site.id) === Number(siteId.value)) || null)
const selectedSiteCapacity = computed(() => (
  selectedSite.value?.numbering_mode === 'extended' ? 10
    : selectedSite.value?.numbering_mode === 'short' ? 1
      : 0
))
const selectedSiteAtCapacity = computed(() => (
  selectedSite.value != null
  && selectedSiteCapacity.value > 0
  && selectedSiteRepeaterCount.value != null
  && selectedSiteRepeaterCount.value >= selectedSiteCapacity.value
))
const siteCapacityMessage = computed(() => {
  if (!siteId.value) return ''
  if (siteCapacityLoading.value) return t('repeaters.checkingSiteCapacity')
  if (siteCapacityError.value) return t('repeaters.siteCapacityUnavailable')
  if (!selectedSite.value) return t('repeaters.selectedSiteUnavailable')
  if (selectedSite.value && !selectedSite.value.site_id) return t('repeaters.siteIdRequired')
  return selectedSiteAtCapacity.value
    ? t('repeaters.selectedSiteCapacityReached', { count: selectedSiteRepeaterCount.value, limit: selectedSiteCapacity.value })
    : ''
})
const createRepeaterDisabled = computed(() => (
  !siteId.value || !selectedSite.value || !callSignValid.value || siteCapacityLoading.value
  || selectedSiteRepeaterCount.value == null
  || Boolean(siteCapacityError.value) || selectedSiteAtCapacity.value
  || Boolean(selectedSite.value && (!selectedSite.value.site_id || !selectedSiteCapacity.value))
))
const visibleRepeaters = computed(() => repeaters.value)
const pageCount = computed(() => pagination.value.pages)
let listRequest = 0
function setSearchValue(value) {
  search.value = value == null ? '' : String(value)
}
watch([search, listScope, siteFilter, entityFilter, pageSize], () => {
  if (page.value !== 1) page.value = 1
  else load()
})
watch(page, () => load())
watch(siteId, async (value) => {
  selectedSiteRepeaterCount.value = null
  siteCapacityError.value = ''
  if (value == null || value === '') {
    siteCapacityLoading.value = false
    return
  }
  const selectedId = Number(value)
  siteCapacityLoading.value = true
  try {
    const result = await props.apiFetch(`v1/sites/${selectedId}/repeaters?page=1&page_size=100`)
    if (Number(siteId.value) === selectedId) {
      selectedSiteRepeaterCount.value = Number(result.pagination?.total ?? result.items?.length ?? 0)
    }
  } catch (cause) {
    if (Number(siteId.value) === selectedId) {
      siteCapacityError.value = cause instanceof Error ? cause.message : String(cause)
    }
  } finally {
    if (Number(siteId.value) === selectedId) siteCapacityLoading.value = false
  }
})

function prepareCreateForm() {
  unsavedChanges.clearTracking()
  editing.value = null
  siteId.value = null
  callSign.value = ''
  frequency.value = ''
  tone.value = ''
  creating.value = true
  unsavedChanges.startTracking()
}

async function openCreateForm() {
  editReturnRoute.value = { name: 'repeaters' }
  prepareCreateForm()
  await router.push({ name: 'repeater-create' })
  await nextTick()
  createFormCard.value?.$el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function cancelCreateForm() {
  creating.value = false
  siteId.value = null
  callSign.value = ''
  frequency.value = ''
  tone.value = ''
  unsavedChanges.clearTracking()
  if (route.name !== editReturnRoute.value.name) router.push(editReturnRoute.value)
}

function cancelEditForm() {
  editing.value = null
  unsavedChanges.clearTracking()
  if (route.name !== editReturnRoute.value.name) router.push(editReturnRoute.value)
}

async function load() {
  const requestId = ++listRequest
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({
      q: searchQuery.value, page: String(page.value), page_size: String(pageSize.value), scope: listScope.value,
    })
    if (siteFilter.value !== 'all') params.set('site_id', siteFilter.value)
    if (entityFilter.value !== 'all') params.set('entity_id', entityFilter.value)
    const [siteResponse, repeaterResponse, entityResponse] = await Promise.all([
      props.apiFetch('v1/sites?page=1&page_size=100'),
      props.apiFetch(`v1/repeaters?${params}`),
      props.apiFetch('v1/orgs?page=1&page_size=100'),
    ])
    if (requestId !== listRequest) return
    sites.value = siteResponse.items || []
    repeaters.value = repeaterResponse.items || []
    pagination.value = repeaterResponse.pagination || pagination.value
    entities.value = entityResponse.items || []
  } catch (cause) {
    if (requestId !== listRequest) return
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    if (requestId === listRequest) loading.value = false
  }
}

async function createRepeater() {
  if (createRepeaterDisabled.value) return
  saving.value = true
  error.value = ''
  try {
    const result = await props.apiFetch(`v1/sites/${siteId.value}/repeaters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        call_sign: callSign.value.trim().toUpperCase() || null,
        frequency: frequency.value.trim() || null,
        tone: tone.value.trim() || null,
      }),
    })
    secretReveal.value = result.registration_secret
    callSign.value = ''
    frequency.value = ''
    tone.value = ''
    creating.value = false
    unsavedChanges.clearTracking()
    const fromSiteId = Number(route.query.fromSite)
    if (Number.isInteger(fromSiteId) && fromSiteId > 0 && result.repeater?.node_id) {
      router.push({
        name: 'repeater-detail',
        params: { nodeId: result.repeater.node_id },
        query: route.query.fromEntity
          ? { fromSite: String(fromSiteId), fromEntity: String(route.query.fromEntity) }
          : { fromSite: String(fromSiteId) },
      })
    } else {
      router.push({ name: 'repeaters' })
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    saving.value = false
  }
}

async function setEnabled(repeater, enabled) {
  const previous = repeater.enabled
  const savingIds = new Set(enabledSaving.value)
  savingIds.add(repeater.node_id)
  enabledSaving.value = savingIds
  repeater.enabled = Boolean(enabled)
  error.value = ''
  try {
    const updated = await props.apiFetch(`v1/repeaters/${repeater.node_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: repeater.enabled }),
    })
    Object.assign(repeater, updated)
  } catch (cause) {
    repeater.enabled = previous
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    const remaining = new Set(enabledSaving.value)
    remaining.delete(repeater.node_id)
    enabledSaving.value = remaining
  }
}

function prepareEditRepeater(repeater) {
  unsavedChanges.clearTracking()
  creating.value = false
  editing.value = repeater
  editForm.value = {
    call_sign: repeater.call_sign || '',
    frequency: repeater.frequency || '',
    tone: repeater.tone || '',
    enabled: repeater.enabled,
  }
  unsavedChanges.startTracking()
}

function editRepeater(repeater, returnToDetail = false) {
  editReturnRoute.value = returnToDetail
    ? { name: 'repeater-detail', params: { nodeId: repeater.node_id }, query: { ...route.query } }
    : { name: 'repeaters' }
  prepareEditRepeater(repeater)
  router.push({ name: 'repeater-edit', params: { nodeId: repeater.node_id } })
}

function openRepeater(repeater) {
  router.push({ name: 'repeater-detail', params: { nodeId: repeater.node_id } })
}

function backFromRepeaterDetail() {
  const siteId = Number(route.query.fromSite)
  if (Number.isInteger(siteId) && siteId > 0) {
    router.push({
      name: 'site-detail',
      params: { id: siteId },
      query: route.query.fromEntity ? { fromEntity: route.query.fromEntity } : {},
    })
  } else {
    router.push({ name: 'repeaters' })
  }
}

async function saveRepeater() {
  if (!editing.value) return
  saving.value = true
  error.value = ''
  try {
    const updated = await props.apiFetch(`v1/repeaters/${editing.value.node_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        call_sign: editForm.value.call_sign.trim().toUpperCase() || null,
        frequency: editForm.value.frequency.trim() || null,
        tone: editForm.value.tone.trim() || null,
        enabled: editForm.value.enabled,
      }),
    })
    Object.assign(editing.value, updated)
    editing.value = null
    unsavedChanges.clearTracking()
    router.push(editReturnRoute.value)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    saving.value = false
  }
}

async function rotateSecret(repeater) {
  error.value = ''
  try {
    const result = await props.apiFetch(`v1/repeaters/${repeater.node_id}/credential/rotate`, { method: 'POST' })
    secretReveal.value = result.registration_secret
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
}

function closeSecret() {
  secretReveal.value = ''
}

watch(() => [route.name, route.params.nodeId], async ([name, nodeId]) => {
  error.value = ''
  if (name === 'repeaters') {
    creating.value = false
    editing.value = null
    repeaterDetail.value = null
    unsavedChanges.clearTracking()
    await load()
    return
  }
  if (name === 'repeater-detail' && nodeId) {
    creating.value = false
    editing.value = null
    repeaterDetail.value = null
    unsavedChanges.clearTracking()
    loading.value = true
    try {
      repeaterDetail.value = await props.apiFetch(`v1/repeaters/${encodeURIComponent(nodeId)}`)
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      loading.value = false
    }
    return
  }
  if (name === 'repeater-create') {
    const fromSiteId = Number(route.query.fromSite)
    const fromEntityId = Number(route.query.fromEntity)
    editReturnRoute.value = Number.isInteger(fromSiteId) && fromSiteId > 0
      ? {
        name: 'site-detail',
        params: { id: fromSiteId },
        query: Number.isInteger(fromEntityId) && fromEntityId > 0 ? { fromEntity: String(fromEntityId) } : {},
      }
      : { name: 'repeaters' }
    if (!creating.value) prepareCreateForm()
    if (!sites.value.length || !entities.value.length) await load()
    const selectedSiteId = Number(route.query.site_id || route.query.fromSite)
    if (Number.isInteger(selectedSiteId) && selectedSiteId > 0 && siteItems.value.some((item) => Number(item.value) === selectedSiteId)) {
      siteId.value = selectedSiteId
    }
    return
  }
  if (name === 'repeater-edit' && nodeId && String(editing.value?.node_id) !== String(nodeId)) {
    if (editReturnRoute.value.name !== 'repeater-detail' || String(editReturnRoute.value.params?.nodeId) !== String(nodeId)) {
      editReturnRoute.value = { name: 'repeaters' }
    }
    loading.value = true
    try {
      const query = new URLSearchParams({ q: String(nodeId), page: '1', page_size: '50', scope: listScope.value })
      const result = await props.apiFetch(`v1/repeaters?${query}`)
      const repeater = (result.items || []).find((item) => String(item.node_id) === String(nodeId))
      if (!repeater) throw new Error(t('repeaters.notFound'))
      if (!repeater.can_manage) throw new Error(t('common.notManageable'))
      prepareEditRepeater(repeater)
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      loading.value = false
    }
  }
}, { immediate: true })
</script>

<template>
  <div class="repeaters-view">
    <div v-if="route.name === 'repeaters'" class="d-flex align-center justify-space-between ga-4 mb-5">
      <p class="text-body-1 text-medium-emphasis mb-0">{{ t('repeaters.description') }}</p>
      <v-btn color="primary" :disabled="!siteItems.length" @click="openCreateForm">{{ t('repeaters.create') }}</v-btn>
    </div>
    <v-alert v-if="error" class="mb-4" type="error" variant="tonal">{{ error }}</v-alert>
    <v-alert v-if="secretReveal" class="mb-5" type="warning" variant="tonal">
      <div class="font-weight-bold mb-2">{{ t('repeaters.secretShownOnce') }}</div>
      <code class="secret-value">{{ secretReveal }}</code>
      <v-btn class="d-block mt-3" size="small" variant="text" @click="closeSecret">{{ t('repeaters.dismissSecret') }}</v-btn>
    </v-alert>

    <v-btn v-if="isFormRoute && !creating && !editing && !loading" class="mb-4" variant="text" @click="router.push(editReturnRoute)">{{ t('repeaters.cancel') }}</v-btn>
    <v-progress-linear v-if="isFormRoute && loading && !creating && !editing" indeterminate color="primary" class="mb-4" />
    <v-btn v-if="isDetailRoute" class="mb-4" variant="text" prepend-icon="mdi-arrow-left" @click="backFromRepeaterDetail">{{ route.query.fromSite ? t('repeaters.backToSite') : t('repeaters.backToRepeaters') }}</v-btn>
    <v-progress-linear v-if="isDetailRoute && loading" indeterminate color="primary" class="mb-4" />
    <template v-if="isDetailRoute && repeaterDetail">
      <ItemDetailsCard
        :eyebrow="`${t('repeaters.nodeId')} ${repeaterDetail.node_id}`"
        :title="repeaterDetail.call_sign || ' '"
        :fields="[
          { key: 'description', label: t('repeaters.descriptionField'), value: repeaterDetail.description, fullWidth: true },
          { key: 'site', label: t('repeaters.site'), value: repeaterDetail.site_name },
          { key: 'siteCode', label: t('repeaters.siteCode'), value: repeaterDetail.site_code },
          { key: 'frequency', label: t('repeaters.frequency'), value: repeaterDetail.frequency },
          { key: 'tone', label: t('repeaters.tone'), value: repeaterDetail.tone },
          { key: 'enabled', label: t('repeaters.enabled'), value: repeaterDetail.enabled },
          { key: 'freshness', label: t('repeaters.freshnessLabel'), value: t(`repeaters.freshness.${repeaterDetail.registration_freshness || 'unknown'}`) },
          { key: 'lastRegistration', label: t('repeaters.lastRegistration'), value: repeaterDetail.last_registration_at ? new Date(repeaterDetail.last_registration_at).toLocaleString() : null },
          { key: 'registrationSource', label: t('repeaters.registrationSource'), value: repeaterDetail.registration_source },
          { key: 'registrationIp', label: t('repeaters.registrationIp'), value: repeaterDetail.last_registration_ip },
          { key: 'callSign', label: t('repeaters.callSign'), value: repeaterDetail.call_sign },
        ]"
      >
        <template #actions>
          <v-btn v-if="repeaterDetail.can_manage" variant="tonal" prepend-icon="mdi-key-refresh" @click="rotateSecret(repeaterDetail)">{{ t('repeaters.rotateSecret') }}</v-btn>
          <v-btn v-if="repeaterDetail.can_manage" color="primary" variant="tonal" prepend-icon="mdi-pencil" @click="editRepeater(repeaterDetail, true)">{{ t('repeaters.edit') }}</v-btn>
        </template>
        <template #value="{ field }">
          <a v-if="field.key === 'site' && field.value" class="text-body-2" href="#" @click.prevent="router.push({ name: 'site-detail', params: { id: repeaterDetail.site_id }, query: { fromRepeater: repeaterDetail.node_id } })">{{ field.value }}</a>
          <v-chip v-else-if="field.key === 'enabled' && typeof field.value === 'boolean'" size="small" :color="field.value ? 'success' : 'default'" variant="tonal">{{ t(field.value ? 'repeaters.enabled' : 'repeaters.disabled') }}</v-chip>
          <v-chip v-else-if="field.key === 'freshness' && field.value" size="small" :color="repeaterDetail.registration_freshness === 'current' ? 'success' : repeaterDetail.registration_freshness === 'stale' ? 'warning' : 'default'" variant="tonal">{{ field.value }}</v-chip>
          <div v-else class="text-body-2" :class="{ 'text-medium-emphasis': field.value == null || field.value === '' }">{{ field.value == null || field.value === '' ? '—' : field.value }}</div>
        </template>
      </ItemDetailsCard>
    </template>

    <v-card v-if="isFormRoute && creating" ref="createFormCard" class="pa-4 mb-6" rounded="xl" variant="outlined">
      <div class="text-h6 mb-3">{{ t('repeaters.addTitle') }}</div>
      <v-alert v-if="siteCapacityMessage" class="mb-4" :type="siteCapacityLoading ? 'info' : 'error'" variant="tonal">{{ siteCapacityMessage }}</v-alert>
      <v-row align="center">
        <v-col cols="12" md="5">
          <v-select v-model="siteId" :items="siteItems" :label="t('repeaters.site')" />
        </v-col>
        <v-col cols="12" md="3">
          <v-text-field v-model="callSign" :label="t('repeaters.callSign')" :rules="[callSignRule]" maxlength="32" />
        </v-col>
        <v-col cols="12" md="2">
          <v-text-field v-model="frequency" :label="t('repeaters.frequency')" maxlength="64" />
        </v-col>
        <v-col cols="12" md="2">
          <v-text-field v-model="tone" :label="t('repeaters.tone')" maxlength="64" />
        </v-col>
      </v-row>
      <div class="d-flex justify-end ga-2">
        <v-btn variant="text" @click="cancelCreateForm">{{ t('repeaters.cancel') }}</v-btn>
        <v-btn color="primary" :loading="saving" :disabled="createRepeaterDisabled" @click="createRepeater">
          {{ t('repeaters.create') }}
        </v-btn>
      </div>
    </v-card>

    <v-card v-if="isFormRoute && editing" class="pa-4 mb-6" rounded="xl" variant="outlined">
      <div class="text-h6 mb-3">{{ t('repeaters.editTitle', { nodeId: editing.node_id }) }}</div>
      <v-row>
        <v-col cols="12" sm="6"><v-text-field v-model="editForm.call_sign" :label="t('repeaters.callSign')" :rules="[callSignRule]" maxlength="32" /></v-col>
        <v-col cols="12" sm="6"><v-switch v-model="editForm.enabled" :label="t('repeaters.enabled')" color="primary" /></v-col>
        <v-col cols="12" sm="6"><v-text-field v-model="editForm.frequency" :label="t('repeaters.frequency')" maxlength="64" /></v-col>
        <v-col cols="12" sm="6"><v-text-field v-model="editForm.tone" :label="t('repeaters.tone')" maxlength="64" /></v-col>
      </v-row>
      <div class="d-flex justify-end ga-2">
        <v-btn variant="text" @click="cancelEditForm">{{ t('repeaters.cancel') }}</v-btn>
        <v-btn color="primary" :loading="saving" :disabled="!editCallSignValid" @click="saveRepeater">{{ t('repeaters.save') }}</v-btn>
      </div>
    </v-card>

    <template v-if="route.name === 'repeaters'">
    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />
    <div class="list-toolbar repeaters-toolbar mb-4">
      <v-text-field :model-value="search" class="list-search" :label="t('common.search')" prepend-inner-icon="mdi-magnify" density="compact" hide-details clearable @update:model-value="setSearchValue" />
      <v-select v-model="pageSize" class="page-size-filter" :label="t('common.pageSize')" density="compact" hide-details :items="[10, 25, 50]" />
      <v-select v-model="siteFilter" class="list-filter" :label="t('repeaters.filterBySite')" density="compact" hide-details :items="[
        { title: t('common.all'), value: 'all' },
        ...sites.map((site) => ({ title: site.name, value: String(site.id) })),
      ]" />
      <v-select v-model="entityFilter" class="list-filter entity-filter" :label="t('repeaters.filterByEntity')" density="compact" hide-details :items="[
        { title: t('common.all'), value: 'all' },
        ...entities.map((entity) => ({ title: entity.name, value: String(entity.id) })),
      ]" />
      <v-btn-toggle v-if="props.isSystemSuperAdmin" v-model="listScope" mandatory color="primary" density="compact" variant="outlined">
        <v-btn value="mine">{{ t('common.myItems') }}</v-btn>
        <v-btn value="all">{{ t('common.allSystemItems') }}</v-btn>
      </v-btn-toggle>
    </div>
    <v-card v-if="!loading" rounded="xl" variant="outlined">
      <v-list v-if="visibleRepeaters.length" lines="two">
        <RepeaterListItem
          v-for="repeater in visibleRepeaters"
          :key="repeater.node_id"
          :repeater="repeater"
          :enabled-saving="enabledSaving.has(repeater.node_id)"
          @open="openRepeater(repeater)"
          @update-enabled="setEnabled(repeater, $event)"
        />
      </v-list>
      <v-card-text v-else class="text-medium-emphasis">{{ searchQuery || siteFilter !== 'all' || entityFilter !== 'all' ? t('common.noSearchResults') : t('repeaters.empty') }}</v-card-text>
    </v-card>
    <v-pagination v-if="!loading && pagination.total > pageSize" v-model="page" :length="pageCount" class="mt-4" />
    </template>
  </div>
</template>

<style scoped>
.secret-value {
  display: inline-block;
  max-width: 100%;
  overflow-wrap: anywhere;
  padding: 0.45rem 0.65rem;
  border-radius: 0.35rem;
  background: rgba(var(--v-theme-on-surface), 0.08);
  user-select: all;
}
</style>
