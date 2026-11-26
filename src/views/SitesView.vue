<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import ItemDetailsCard from '../components/ItemDetailsCard.vue'
import RepeaterListItem from '../components/RepeaterListItem.vue'
import SiteListItem from '../components/SiteListItem.vue'
import { GRID_SQUARE_RE } from '../utils/regex.js'
import { useUnsavedChanges } from '../utils/unsavedChanges.js'

const props = defineProps({
  apiFetch: { type: Function, required: true },
  userSubject: { type: String, required: true },
  isSystemSuperAdmin: { type: Boolean, default: false },
})
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const isFormRoute = computed(() => route.meta.formPage === true)
const isDetailRoute = computed(() => route.name === 'site-detail')
const sites = ref([])
const entities = ref([])
const entitiesLoaded = ref(false)
const siteDetail = ref(null)
const siteRepeaters = ref([])
const repeaterEnabledSaving = ref(new Set())
const repeaterCapacity = computed(() => (
  siteDetail.value?.numbering_mode === 'extended' ? 10
    : siteDetail.value?.numbering_mode === 'short' ? 1
      : 0
))
const canAddRepeater = computed(() => Boolean(
  siteDetail.value?.can_manage
  && siteDetail.value.site_id
  && repeaterCapacity.value > siteRepeaters.value.length,
))
const addRepeaterDisabledReason = computed(() => {
  if (!siteDetail.value?.can_manage) return t('repeaters.addPermissionRequired')
  if (!siteDetail.value.site_id) return t('repeaters.siteIdRequired')
  if (siteRepeaters.value.length >= repeaterCapacity.value) return t('repeaters.capacityReached')
  return ''
})
const loading = ref(false)
const saving = ref(false)
const creating = ref(false)
const editingSite = ref(null)
const error = ref('')
const search = ref('')
const searchQuery = computed(() => String(search.value ?? '').trim())
const page = ref(1)
const pageSize = ref(10)
const listScope = ref('mine')
const entityFilter = ref('all')
const pagination = ref({ page: 1, page_size: pageSize.value, total: 0, pages: 1 })
const editReturnRoute = ref({ name: 'sites' })
let sitesRequest = 0
let ownerCountRequest = 0
let routeRequest = 0
const location = ref(null)
const editLocation = ref(null)
const selectedSiteCode = ref('')
const editSiteCode = ref('')
const selectedOwnerSiteCount = ref(null)
const ownerSiteCountLoading = ref(false)
const ownerSiteCountError = ref('')
const form = reactive({ name: '', location: '', gridSquare: '', latitude: '', longitude: '', description: '', numberingMode: 'short', ownerSelection: 'user' })
const editForm = reactive({ name: '', location: '', gridSquare: '', latitude: '', longitude: '', description: '', numberingMode: 'short', siteId: '' })
const unsavedChanges = useUnsavedChanges('sites', () => ({
  active: creating.value || Boolean(editingSite.value),
  form: { ...form },
  editForm: { ...editForm },
  location: location.value,
  editLocation: editLocation.value,
  selectedSiteCode: selectedSiteCode.value,
  editSiteCode: editSiteCode.value,
}), () => t('common.unsavedChanges'))
watch(() => [form.gridSquare, form.latitude, form.longitude], () => {
  location.value = null
  selectedSiteCode.value = ''
})
watch(() => [editForm.gridSquare, editForm.latitude, editForm.longitude], () => {
  editLocation.value = null
  editSiteCode.value = ''
})
const siteCodeItems = computed(() => (location.value?.site_codes || [])
  .filter((item) => item.available_numbers > 0)
  .map((item) => ({ title: `${item.site_code} · ${item.available_numbers}`, value: item.site_code })))
const editSiteCodeItems = computed(() => (editLocation.value?.site_codes || [])
  .filter((item) => item.available_numbers > 0)
  .map((item) => ({ title: `${item.site_code} · ${item.available_numbers}`, value: item.site_code })))
const needsSiteCodeChoice = computed(() => siteCodeItems.value.length > 1)
const needsEditSiteCodeChoice = computed(() => editSiteCodeItems.value.length > 1)
const gridSquareValid = computed(() => GRID_SQUARE_RE.test(form.gridSquare.trim()))
const editGridSquareValid = computed(() => GRID_SQUARE_RE.test(editForm.gridSquare.trim()))
const ownerItems = computed(() => [
  { title: t('sites.myAccount'), value: 'user' },
  ...entities.value
    .filter((entity) => entity.can_manage)
    .map((entity) => ({ title: entity.name, value: `entity:${entity.id}` })),
])
const ownerEntityId = (selection) => selection.startsWith('entity:') ? Number(selection.slice(7)) : null
const selectedOwnerEntity = computed(() => {
  const id = ownerEntityId(form.ownerSelection)
  return id == null ? null : entities.value.find((entity) => Number(entity.id) === id) || null
})
const ownerSiteLimit = computed(() => Number(selectedOwnerEntity.value?.max_sites ?? 5))
const ownerAtSiteLimit = computed(() => (
  selectedOwnerEntity.value != null
  && selectedOwnerSiteCount.value != null
  && selectedOwnerSiteCount.value >= ownerSiteLimit.value
))
const ownerCapacityMessage = computed(() => {
  if (ownerSiteCountLoading.value) return t('sites.checkingEntityCapacity')
  if (ownerSiteCountError.value) return t('sites.entityCapacityUnavailable')
  return ownerAtSiteLimit.value
    ? t('sites.entityCapacityReached', { count: selectedOwnerSiteCount.value, limit: ownerSiteLimit.value })
    : ''
})
const visibleSites = computed(() => sites.value)
const pageCount = computed(() => pagination.value.pages)
function setSearchValue(value) {
  search.value = value == null ? '' : String(value)
}
watch([search, listScope, entityFilter, pageSize], () => {
  if (page.value !== 1) page.value = 1
  else loadSites()
})
watch(page, () => loadSites())
watch(() => form.ownerSelection, async (selection) => {
  const requestId = ++ownerCountRequest
  const entityId = ownerEntityId(selection)
  selectedOwnerSiteCount.value = null
  ownerSiteCountError.value = ''
  if (entityId == null) {
    ownerSiteCountLoading.value = false
    return
  }
  ownerSiteCountLoading.value = true
  try {
    const result = await props.apiFetch(`v1/sites?page=1&page_size=1&entity_id=${entityId}`)
    if (requestId === ownerCountRequest && ownerEntityId(form.ownerSelection) === entityId) {
      selectedOwnerSiteCount.value = Number(result.pagination?.total ?? result.items?.length ?? 0)
    }
  } catch (cause) {
    if (requestId === ownerCountRequest && ownerEntityId(form.ownerSelection) === entityId) {
      ownerSiteCountError.value = cause instanceof Error ? cause.message : String(cause)
    }
  } finally {
    if (requestId === ownerCountRequest) ownerSiteCountLoading.value = false
  }
})
const gridSquareRule = (value) => (
  GRID_SQUARE_RE.test(String(value || '').trim()) || t('sites.invalidGridSquare')
)
const nameRule = (value) => String(value || '').trim().length > 0 || t('sites.nameRequired')
const ownerName = (site) => {
  if (site.owner_type === 'system') return t('sites.systemManaged')
  if (site.owner_entity_id != null) {
    return entities.value.find((entity) => entity.id === site.owner_entity_id)?.name || t('sites.entity')
  }
  return site.owner_display_name || (site.owner_subject === props.userSubject ? t('sites.myAccount') : t('common.unknownUser'))
}

const ownerNameFromDetail = (site) => {
  if (site.owner_entity_id != null) {
    return entities.value.find((entity) => Number(entity.id) === Number(site.owner_entity_id))?.name || t('sites.entity')
  }
  if (site.owner_type === 'system') return t('sites.systemManaged')
  return site.owner_display_name || (site.owner_subject === props.userSubject ? t('sites.myAccount') : t('common.unknownUser'))
}

function openSite(site) {
  router.push({ name: 'site-detail', params: { id: site.id } })
}

function openRelatedRepeater(repeater) {
  router.push({
    name: 'repeater-detail',
    params: { nodeId: repeater.node_id },
    query: { fromSite: siteDetail.value.id, ...(route.query.fromEntity ? { fromEntity: route.query.fromEntity } : {}) },
  })
}

function addRepeaterToSite() {
  if (!siteDetail.value || !canAddRepeater.value) return
  router.push({
    name: 'repeater-create',
    query: {
      site_id: String(siteDetail.value.id),
      fromSite: String(siteDetail.value.id),
      ...(route.query.fromEntity ? { fromEntity: String(route.query.fromEntity) } : {}),
    },
  })
}

async function setRepeaterEnabled(repeater, enabled) {
  const previous = repeater.enabled
  const savingIds = new Set(repeaterEnabledSaving.value)
  savingIds.add(repeater.node_id)
  repeaterEnabledSaving.value = savingIds
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
    const remaining = new Set(repeaterEnabledSaving.value)
    remaining.delete(repeater.node_id)
    repeaterEnabledSaving.value = remaining
  }
}

function backFromSiteDetail() {
  const repeaterNodeId = Number(route.query.fromRepeater)
  if (Number.isInteger(repeaterNodeId) && repeaterNodeId > 0) {
    router.push({
      name: 'repeater-detail',
      params: { nodeId: repeaterNodeId },
      query: route.query.fromEntity ? { fromSite: route.params.id, fromEntity: route.query.fromEntity } : { fromSite: route.params.id },
    })
    return
  }
  const entityId = Number(route.query.fromEntity)
  if (Number.isInteger(entityId) && entityId > 0) {
    router.push({ name: 'entity-detail', params: { id: entityId } })
  } else {
    router.push({ name: 'sites' })
  }
}

function prepareNewSite(ownerSelection = 'user') {
  editingSite.value = null
  location.value = null
  selectedSiteCode.value = ''
  Object.assign(form, { name: '', location: '', gridSquare: '', latitude: '', longitude: '', description: '', numberingMode: 'short', ownerSelection })
  creating.value = true
  unsavedChanges.startTracking()
}

function openCreateSite() {
  editReturnRoute.value = { name: 'sites' }
  prepareNewSite()
  router.push({ name: 'site-create' })
}

function cancelCreateSite() {
  creating.value = false
  location.value = null
  selectedSiteCode.value = ''
  unsavedChanges.clearTracking()
  if (route.name !== editReturnRoute.value.name) router.push(editReturnRoute.value)
}

function cancelEditSite() {
  editingSite.value = null
  editLocation.value = null
  editSiteCode.value = ''
  unsavedChanges.clearTracking()
  if (route.name !== editReturnRoute.value.name) router.push(editReturnRoute.value)
}

async function loadSites() {
  const requestId = ++sitesRequest
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({
      q: searchQuery.value, page: String(page.value), page_size: String(pageSize.value), scope: listScope.value,
    })
    if (entityFilter.value === 'personal') params.set('personal', 'true')
    else if (entityFilter.value !== 'all') params.set('entity_id', entityFilter.value)
    const [siteResponse, entityResponse] = await Promise.all([
      props.apiFetch(`v1/sites?${params}`),
      props.apiFetch('v1/orgs?page=1&page_size=100'),
    ])
    if (requestId !== sitesRequest) return
    sites.value = siteResponse.items || []
    pagination.value = siteResponse.pagination || pagination.value
    entities.value = entityResponse.items || []
    entitiesLoaded.value = true
  } catch (cause) {
    if (requestId !== sitesRequest) return
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    if (requestId === sitesRequest) loading.value = false
  }
}

function locationPayload(values) {
  const payload = { grid_square: values.gridSquare.trim() }
  const hasLatitude = values.latitude !== '' && values.latitude !== null
  const hasLongitude = values.longitude !== '' && values.longitude !== null
  if (hasLatitude !== hasLongitude) throw new Error(t('sites.locationPairRequired'))
  if (hasLatitude) {
    payload.latitude = Number(values.latitude)
    payload.longitude = Number(values.longitude)
    if (!Number.isFinite(payload.latitude) || !Number.isFinite(payload.longitude)) {
      throw new Error(t('sites.invalidCoordinates'))
    }
  }
  return payload
}

async function resolveLocation() {
  error.value = ''
  location.value = null
  selectedSiteCode.value = ''
  if (!gridSquareValid.value) {
    error.value = t('sites.invalidGridSquare')
    return
  }
  try {
    const payload = locationPayload(form)
    const snapshot = JSON.stringify(payload)
    const result = await props.apiFetch('v1/site-locations/resolve', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: snapshot,
    })
    if (snapshot !== JSON.stringify(locationPayload(form))) return
    location.value = result
    if (siteCodeItems.value.length === 1) selectedSiteCode.value = siteCodeItems.value[0].value
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
}

async function createSite() {
  if (!entitiesLoaded.value || !location.value || ownerAtSiteLimit.value || ownerSiteCountLoading.value || ownerSiteCountError.value
    || (selectedOwnerEntity.value && selectedOwnerSiteCount.value == null)) return
  saving.value = true
  error.value = ''
  try {
    const payload = {
      name: form.name.trim(),
      location: form.location.trim() || null,
      grid_square: location.value.grid_square,
      latitude: location.value.latitude,
      longitude: location.value.longitude,
      description: form.description.trim() || null,
      numbering_mode: form.numberingMode,
      owner_entity_id: ownerEntityId(form.ownerSelection),
    }
    if (selectedSiteCode.value) payload.site_code = selectedSiteCode.value
    await props.apiFetch('v1/sites', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    creating.value = false
    location.value = null
    unsavedChanges.clearTracking()
    Object.assign(form, { name: '', location: '', gridSquare: '', latitude: '', longitude: '', description: '', numberingMode: 'short', ownerSelection: 'user' })
    router.push(editReturnRoute.value)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    saving.value = false
  }
}

function prepareEditSite(site) {
  unsavedChanges.clearTracking()
  creating.value = false
  editingSite.value = site
  editLocation.value = null
  editSiteCode.value = ''
  Object.assign(editForm, {
    name: site.name || '',
    location: site.location || '',
    gridSquare: site.grid_square || '',
    latitude: site.latitude ?? '',
    longitude: site.longitude ?? '',
    description: site.description || '',
    numberingMode: site.numbering_mode || 'short',
    siteId: site.site_id || '',
  })
  unsavedChanges.startTracking()
}

function editSite(site, returnToDetail = false) {
  editReturnRoute.value = returnToDetail
    ? { name: 'site-detail', params: { id: site.id }, query: { ...route.query } }
    : { name: 'sites' }
  prepareEditSite(site)
  router.push({ name: 'site-edit', params: { id: site.id } })
}

async function resolveEditLocation() {
  error.value = ''
  editLocation.value = null
  editSiteCode.value = ''
  if (!editGridSquareValid.value) {
    error.value = t('sites.invalidGridSquare')
    return
  }
  try {
    const payload = locationPayload(editForm)
    const snapshot = JSON.stringify(payload)
    const result = await props.apiFetch('v1/site-locations/resolve', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: snapshot,
    })
    if (snapshot !== JSON.stringify(locationPayload(editForm))) return
    editLocation.value = result
    if (editSiteCodeItems.value.length === 1) editSiteCode.value = editSiteCodeItems.value[0].value
    if (editSiteCodeItems.value.some((item) => item.value === editingSite.value.site_code)) {
      editSiteCode.value = editingSite.value.site_code
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
}

async function saveSite() {
  if (!editingSite.value) return
  saving.value = true
  error.value = ''
  try {
    const coordinates = locationPayload(editForm)
    const payload = {
      name: editForm.name.trim(),
      location: editForm.location.trim() || null,
      description: editForm.description.trim() || null,
      grid_square: coordinates.grid_square,
      latitude: coordinates.latitude ?? null,
      longitude: coordinates.longitude ?? null,
      numbering_mode: editForm.numberingMode,
    }
    if (props.isSystemSuperAdmin && editForm.siteId !== (editingSite.value.site_id || '')) {
      payload.site_id = editForm.siteId
    }
    if (editLocation.value && editSiteCode.value) payload.site_code = editSiteCode.value
    await props.apiFetch(`v1/sites/${editingSite.value.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    editingSite.value = null
    editLocation.value = null
    unsavedChanges.clearTracking()
    router.push(editReturnRoute.value)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    saving.value = false
  }
}

async function loadFormEntities() {
  try {
    const result = await props.apiFetch('v1/orgs?page=1&page_size=100')
    entities.value = result.items || []
    entitiesLoaded.value = true
    return true
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
    return false
  }
}

watch(() => [route.name, route.params.id], async ([name, id]) => {
  const requestId = ++routeRequest
  error.value = ''
  if (name === 'sites') {
    creating.value = false
    editingSite.value = null
    siteDetail.value = null
    unsavedChanges.clearTracking()
    await loadSites()
    return
  }
  if (name === 'site-detail' && id) {
    creating.value = false
    editingSite.value = null
    siteDetail.value = null
    siteRepeaters.value = []
    unsavedChanges.clearTracking()
    loading.value = true
    try {
      const [site, repeaterResponse, entityResponse] = await Promise.all([
        props.apiFetch(`v1/sites/${id}`),
        props.apiFetch(`v1/sites/${id}/repeaters?page=1&page_size=50`),
        props.apiFetch('v1/orgs?page=1&page_size=100'),
      ])
      if (requestId !== routeRequest) return
      siteDetail.value = site
      siteRepeaters.value = repeaterResponse.items || []
      entities.value = entityResponse.items || []
      entitiesLoaded.value = true
    } catch (cause) {
      if (requestId !== routeRequest) return
      error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      if (requestId === routeRequest) loading.value = false
    }
    return
  }
  if (name === 'site-create') {
    loading.value = false
    const fromEntityId = Number(route.query.fromEntity)
    editReturnRoute.value = Number.isInteger(fromEntityId) && fromEntityId > 0
      ? { name: 'entity-detail', params: { id: fromEntityId } }
      : { name: 'sites' }
    if (!entitiesLoaded.value && !await loadFormEntities()) return
    if (requestId !== routeRequest) return
    const ownerEntityId = Number(route.query.owner_entity_id)
    const ownerEntity = entities.value.find((entity) => Number(entity.id) === ownerEntityId && entity.can_manage)
    if (route.query.owner_entity_id && !ownerEntity) {
      error.value = t('common.notManageable')
      return
    }
    const ownerSelection = ownerEntity ? `entity:${ownerEntity.id}` : 'user'
    if (!creating.value) prepareNewSite(ownerSelection)
    else if (ownerEntity) form.ownerSelection = ownerSelection
    return
  }
  if (name === 'site-edit' && id && String(editingSite.value?.id) !== String(id)) {
    if (editReturnRoute.value.name !== 'site-detail' || String(editReturnRoute.value.params?.id) !== String(id)) {
      editReturnRoute.value = { name: 'sites' }
    }
    loading.value = true
    try {
      const [site, entityResponse] = await Promise.all([
        props.apiFetch(`v1/sites/${id}`),
        props.apiFetch('v1/orgs?page=1&page_size=100'),
      ])
      if (requestId !== routeRequest) return
      if (!site.can_manage) throw new Error(t('common.notManageable'))
      entities.value = entityResponse.items || []
      entitiesLoaded.value = true
      prepareEditSite(site)
    } catch (cause) {
      if (requestId !== routeRequest) return
      error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      if (requestId === routeRequest) loading.value = false
    }
  }
}, { immediate: true })
</script>

<template>
  <div class="sites-view">
    <div v-if="route.name === 'sites'" class="d-flex align-center justify-space-between mb-5">
      <div class="text-body-1 text-medium-emphasis">{{ t('sites.description') }}</div>
      <v-btn color="primary" @click="openCreateSite">{{ t('sites.add') }}</v-btn>
    </div>

    <v-alert v-if="error" class="mb-4" type="error" variant="tonal">{{ error }}</v-alert>
    <v-btn v-if="isFormRoute && !creating && !editingSite && !loading" class="mb-4" variant="text" @click="router.push(editReturnRoute)">{{ t('sites.cancel') }}</v-btn>
    <v-progress-linear v-if="isFormRoute && loading && !creating && !editingSite" indeterminate color="primary" class="mb-4" />
    <v-btn v-if="isDetailRoute" class="mb-4" variant="text" prepend-icon="mdi-arrow-left" @click="backFromSiteDetail">{{ route.query.fromEntity ? t('sites.backToEntity') : t('sites.backToSites') }}</v-btn>
    <v-progress-linear v-if="isDetailRoute && loading" indeterminate color="primary" class="mb-4" />
    <template v-if="isDetailRoute && siteDetail">
      <ItemDetailsCard
        :eyebrow="`${t('sites.siteIdLabel')} · ${siteDetail.site_id || '—'}`"
        :title="siteDetail.name"
        :fields="[
          { key: 'description', label: t('sites.descriptionField'), value: siteDetail.description, fullWidth: true },
          { key: 'owner', label: t('sites.owner'), value: ownerNameFromDetail(siteDetail) },
          { key: 'siteCode', label: t('sites.siteCode'), value: siteDetail.site_code },
          { key: 'country', label: t('sites.country'), value: siteDetail.country_code },
          { key: 'location', label: t('sites.location'), value: siteDetail.location },
          { key: 'gridSquare', label: t('sites.gridSquareShort'), value: siteDetail.grid_square },
          { key: 'precisePoint', label: t('sites.precisePoint'), value: siteDetail.latitude != null && siteDetail.longitude != null ? `${Number(siteDetail.latitude).toFixed(5)}, ${Number(siteDetail.longitude).toFixed(5)}` : null },
          { key: 'numberingMode', label: t('sites.numberingMode'), value: siteDetail.numbering_mode === 'extended' ? t('sites.extendedNumbering') : siteDetail.numbering_mode === 'short' ? t('sites.shortNumbering') : null },
        ]"
      >
        <template #actions>
          <v-btn v-if="siteDetail.can_manage" color="primary" variant="tonal" prepend-icon="mdi-pencil" @click="editSite(siteDetail, true)">{{ t('sites.edit') }}</v-btn>
        </template>
      </ItemDetailsCard>
      <div class="d-flex align-center justify-space-between mb-3">
        <h3 class="text-h6">{{ t('sites.relatedRepeaters') }}</h3>
        <div class="d-flex align-center ga-3">
          <span class="text-caption text-medium-emphasis">
            {{ repeaterCapacity ? t('repeaters.capacityCount', { count: siteRepeaters.length, limit: repeaterCapacity }) : siteRepeaters.length }}
          </span>
          <v-tooltip :text="addRepeaterDisabledReason">
            <template #activator="{ props: tooltipProps }">
              <span v-bind="tooltipProps" class="d-inline-flex">
                <v-btn color="primary" size="small" prepend-icon="mdi-plus" :disabled="!canAddRepeater" @click="addRepeaterToSite">{{ t('repeaters.create') }}</v-btn>
              </span>
            </template>
          </v-tooltip>
        </div>
      </div>
      <v-card rounded="xl" variant="outlined">
        <v-list v-if="siteRepeaters.length" lines="two">
          <RepeaterListItem
            v-for="repeater in siteRepeaters"
            :key="repeater.node_id"
            :repeater="repeater"
            :enabled-saving="repeaterEnabledSaving.has(repeater.node_id)"
            @open="openRelatedRepeater(repeater)"
            @update-enabled="setRepeaterEnabled(repeater, $event)"
          />
        </v-list>
        <v-card-text v-else-if="!loading" class="text-medium-emphasis">{{ t('sites.noRelatedRepeaters') }}</v-card-text>
      </v-card>
    </template>

    <v-card v-if="isFormRoute && creating" class="mb-6 pa-4" rounded="xl" variant="outlined">
      <div class="text-h6 mb-4">{{ t('sites.createTitle') }}</div>
      <v-alert v-if="ownerCapacityMessage" class="mb-4" :type="ownerSiteCountLoading ? 'info' : 'error'" variant="tonal">{{ ownerCapacityMessage }}</v-alert>
      <v-row>
        <v-col cols="12" md="6"><v-text-field v-model="form.name" :label="t('sites.name')" :rules="[nameRule]" maxlength="200" /></v-col>
        <v-col cols="12" md="6"><v-text-field v-model="form.location" :label="t('sites.location')" maxlength="512" /></v-col>
        <v-col cols="12" md="6"><v-text-field v-model="form.gridSquare" :label="t('sites.gridSquare')" :rules="[gridSquareRule]" placeholder="FN31 or FN31pr" minlength="4" maxlength="6" /></v-col>
        <v-col cols="12" md="6"><v-select v-model="form.ownerSelection" :items="ownerItems" :label="t('sites.owner')" /></v-col>
      </v-row>
      <div class="text-subtitle-2 mb-2">{{ t('sites.precisePoint') }}</div>
      <v-row>
        <v-col cols="12" sm="6"><v-text-field v-model="form.latitude" :label="t('sites.latitude')" type="number" min="-90" max="90" step="any" /></v-col>
        <v-col cols="12" sm="6"><v-text-field v-model="form.longitude" :label="t('sites.longitude')" type="number" min="-180" max="180" step="any" /></v-col>
      </v-row>
      <v-textarea v-model="form.description" :label="t('sites.descriptionField')" rows="2" auto-grow />
      <v-select v-model="form.numberingMode" :items="[{ title: t('sites.shortNumbering'), value: 'short' }, { title: t('sites.extendedNumbering'), value: 'extended' }]" :label="t('sites.numberingMode')" />
      <div class="site-derive-actions">
        <v-btn variant="tonal" :disabled="!gridSquareValid" @click="resolveLocation">{{ t('sites.resolveLocation') }}</v-btn>
      </div>
      <v-card v-if="location" class="mb-4" rounded="lg" variant="tonal">
        <v-card-text>
          <div>{{ t('sites.derivedCountry') }}: <strong>{{ location.country_code }}</strong></div>
          <div>{{ t('sites.derivedCoordinates') }}: {{ location.latitude.toFixed(5) }}, {{ location.longitude.toFixed(5) }}</div>
        </v-card-text>
      </v-card>
      <v-select v-if="needsSiteCodeChoice" v-model="selectedSiteCode" :items="siteCodeItems" :label="t('sites.siteCode')" />
      <div v-else-if="siteCodeItems.length === 1" class="text-body-2 mb-4">{{ t('sites.selectedSiteCode', { code: siteCodeItems[0].value }) }}</div>
      <v-alert v-else-if="location" type="warning" variant="tonal" class="mb-4">{{ t('sites.noSiteCodeCapacity') }}</v-alert>
      <div class="site-submit-actions">
        <v-btn variant="text" class="mr-2" @click="cancelCreateSite">{{ t('sites.cancel') }}</v-btn>
        <v-btn class="site-submit-button" color="primary" :loading="saving" :disabled="!entitiesLoaded || !form.name.trim() || !location || siteCodeItems.length === 0 || (needsSiteCodeChoice && !selectedSiteCode) || ownerAtSiteLimit || ownerSiteCountLoading || Boolean(ownerSiteCountError) || Boolean(selectedOwnerEntity && selectedOwnerSiteCount == null)" @click="createSite">{{ t('sites.create') }}</v-btn>
      </div>
    </v-card>

    <v-card v-if="isFormRoute && editingSite" class="mb-6 pa-4" rounded="xl" variant="outlined">
      <div class="text-h6 mb-4">{{ t('sites.editTitle', { name: editingSite.name }) }}</div>
      <v-row>
        <v-col cols="12" md="6"><v-text-field v-model="editForm.name" :label="t('sites.name')" :rules="[nameRule]" maxlength="200" /></v-col>
        <v-col cols="12" md="6"><v-text-field v-model="editForm.location" :label="t('sites.location')" maxlength="512" :disabled="!editingSite.can_edit_identity" /></v-col>
        <v-col cols="12" md="6"><v-text-field v-model="editForm.gridSquare" :label="t('sites.gridSquare')" :rules="[gridSquareRule]" minlength="4" maxlength="6" :disabled="!editingSite.can_edit_identity" /></v-col>
        <v-col cols="12" md="6"><v-text-field :model-value="ownerNameFromDetail(editingSite)" :label="t('sites.owner')" readonly hide-details /></v-col>
      </v-row>
      <div class="text-caption text-medium-emphasis mb-3">{{ t('sites.siteIdLabel') }}: {{ editingSite.site_id }} · {{ t('sites.siteCode') }}: {{ editingSite.site_code }}</div>
      <v-text-field v-if="props.isSystemSuperAdmin" v-model="editForm.siteId" :label="t('sites.siteIdLabel')" :hint="t('sites.siteIdAdminHint')" persistent-hint maxlength="5" minlength="5" inputmode="numeric" :rules="[(value) => /^[0-9]{5}$/.test(String(value || '')) || t('sites.siteIdFormat')]" />
      <div class="text-subtitle-2 mb-2">{{ t('sites.precisePoint') }}</div>
      <v-row>
        <v-col cols="12" sm="6"><v-text-field v-model="editForm.latitude" :label="t('sites.latitude')" type="number" min="-90" max="90" step="any" :disabled="!editingSite.can_edit_identity" /></v-col>
        <v-col cols="12" sm="6"><v-text-field v-model="editForm.longitude" :label="t('sites.longitude')" type="number" min="-180" max="180" step="any" :disabled="!editingSite.can_edit_identity" /></v-col>
      </v-row>
      <v-textarea v-model="editForm.description" :label="t('sites.descriptionField')" rows="2" auto-grow />
      <v-select v-model="editForm.numberingMode" :items="[{ title: t('sites.shortNumbering'), value: 'short' }, { title: t('sites.extendedNumbering'), value: 'extended' }]" :label="t('sites.numberingMode')" :disabled="!editingSite.can_edit_identity" />
      <div v-if="editingSite.can_edit_identity" class="site-derive-actions"><v-btn variant="tonal" :disabled="!editGridSquareValid" @click="resolveEditLocation">{{ t('sites.resolveLocation') }}</v-btn></div>
      <v-card v-if="editLocation" class="mb-4" rounded="lg" variant="tonal"><v-card-text>{{ t('sites.derivedCountry') }}: <strong>{{ editLocation.country_code }}</strong> · {{ editLocation.latitude.toFixed(5) }}, {{ editLocation.longitude.toFixed(5) }}</v-card-text></v-card>
      <v-select v-if="editingSite.can_edit_identity && needsEditSiteCodeChoice" v-model="editSiteCode" :items="editSiteCodeItems" :label="t('sites.siteCode')" />
      <div class="site-submit-actions">
        <v-btn variant="text" class="mr-2" @click="cancelEditSite">{{ t('sites.cancel') }}</v-btn>
        <v-btn class="site-submit-button" color="primary" :loading="saving" :disabled="!editForm.name.trim() || !editGridSquareValid || (props.isSystemSuperAdmin && editForm.siteId !== (editingSite.site_id || '') && !/^[0-9]{5}$/.test(editForm.siteId)) || (needsEditSiteCodeChoice && !editSiteCode && editLocation)" @click="saveSite">{{ t('sites.save') }}</v-btn>
      </div>
    </v-card>

    <template v-if="route.name === 'sites'">
    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />
    <div class="list-toolbar sites-toolbar mb-4">
      <v-text-field :model-value="search" class="list-search" :label="t('common.search')" prepend-inner-icon="mdi-magnify" density="compact" hide-details clearable @update:model-value="setSearchValue" />
      <v-select v-model="pageSize" class="page-size-filter" :label="t('common.pageSize')" density="compact" hide-details :items="[10, 25, 50]" />
      <v-select v-model="entityFilter" class="list-filter" :label="t('sites.filterByEntity')" density="compact" hide-details :items="[
        { title: t('common.all'), value: 'all' },
        { title: t('sites.myAccount'), value: 'personal' },
        ...entities.map((entity) => ({ title: entity.name, value: String(entity.id) })),
      ]" />
      <v-btn-toggle v-if="props.isSystemSuperAdmin" v-model="listScope" mandatory color="primary" density="compact" variant="outlined">
        <v-btn value="mine">{{ t('common.myItems') }}</v-btn>
        <v-btn value="all">{{ t('common.allSystemItems') }}</v-btn>
      </v-btn-toggle>
    </div>
    <v-card v-if="!loading" rounded="xl" variant="outlined">
      <v-list v-if="visibleSites.length" lines="two">
        <SiteListItem v-for="site in visibleSites" :key="site.id" :site="site" :owner-name="ownerName(site)" @open="openSite(site)" />
      </v-list>
      <v-card-text v-else class="text-medium-emphasis">{{ searchQuery ? t('common.noSearchResults') : t('sites.empty') }}</v-card-text>
    </v-card>
    <v-pagination v-if="!loading && pagination.total > pageSize" v-model="page" :length="pageCount" class="mt-4" />
    </template>
  </div>
</template>

<style scoped>
.site-derive-actions,
.site-submit-actions {
  display: flex;
  justify-content: flex-end;
}
.site-derive-actions { margin-top: -0.5rem; margin-bottom: 1.5rem; }
.site-submit-actions {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.site-submit-button { min-width: 10rem; }
</style>
