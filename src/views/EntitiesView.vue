<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import ItemDetailsCard from '../components/ItemDetailsCard.vue'
import SiteListItem from '../components/SiteListItem.vue'
import { CALL_SIGN_RE } from '../utils/regex.js'
import { useUnsavedChanges } from '../utils/unsavedChanges.js'

const props = defineProps({
  apiFetch: { type: Function, required: true },
  canManageSiteLimits: { type: Boolean, default: false },
  userSubject: { type: String, default: '' },
  isSystemSuperAdmin: { type: Boolean, default: false },
})
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const isFormRoute = computed(() => route.meta.formPage === true)
const isDetailRoute = computed(() => route.name === 'entity-detail')
const entities = ref([])
const entityDetail = ref(null)
const relatedSites = ref([])
const relatedSiteCount = ref(0)
const canAddSite = computed(() => Boolean(
  entityDetail.value?.can_manage
  && relatedSiteCount.value < Number(entityDetail.value.max_sites ?? 5),
))
const addSiteDisabledReason = computed(() => {
  if (!entityDetail.value?.can_manage) return t('entities.addSitePermissionRequired')
  if (relatedSiteCount.value >= Number(entityDetail.value.max_sites ?? 5)) return t('entities.siteCapacityReached')
  return ''
})
const loading = ref(false)
const saving = ref(false)
const creating = ref(false)
const editing = ref(null)
const error = ref('')
const callSignDialogOpen = ref(false)
const callSignEntry = ref('')
const callSignEntryError = ref('')
const userOptions = ref([])
const memberDialogOpen = ref(false)
const memberSearch = ref('')
const memberSelection = ref('')
const search = ref('')
const searchQuery = computed(() => String(search.value ?? '').trim())
const page = ref(1)
const pageSize = ref(10)
const listScope = ref('mine')
const pagination = ref({ page: 1, page_size: pageSize.value, total: 0, pages: 1 })
const editReturnRoute = ref({ name: 'entities' })
const memberRoles = ['Staff', 'Viewer']
const form = reactive({
  name: '', entityType: 'other', description: '', website: '', maxSites: 5,
  primaryCallSign: '', callSigns: [], members: [],
})
const unsavedChanges = useUnsavedChanges('entities', () => ({
  active: creating.value || Boolean(editing.value),
  form,
}), () => t('common.unsavedChanges'))
const nameRule = (value) => String(value || '').trim().length > 0 || t('entities.nameRequired')
const callSignsRule = () => {
  if (
    !form.callSigns.includes(form.primaryCallSign) && form.primaryCallSign
    || form.callSigns.some((value) => !CALL_SIGN_RE.test(value))
    || new Set(form.callSigns).size !== form.callSigns.length
  ) {
    return t('entities.invalidCallSigns')
  }
  if (form.callSigns.length && !form.primaryCallSign) return t('entities.primaryCallSignRequired')
  return true
}
const callSignsValid = computed(() => callSignsRule() === true)
const orderedCallSigns = computed(() => [...form.callSigns].sort((left, right) => {
  if (left === form.primaryCallSign) return -1
  if (right === form.primaryCallSign) return 1
  return left.localeCompare(right)
}))
const visibleEntities = computed(() => entities.value)
const pageCount = computed(() => pagination.value.pages)
let entitiesRequest = 0
function setSearchValue(value) {
  search.value = value == null ? '' : String(value)
}
watch([search, listScope, pageSize], () => {
  if (page.value !== 1) page.value = 1
  else loadEntities()
})
watch(page, () => loadEntities())

function openCallSignDialog() {
  callSignEntry.value = ''
  callSignEntryError.value = ''
  callSignDialogOpen.value = true
}

function addCallSign() {
  const value = callSignEntry.value.trim().toUpperCase()
  if (!CALL_SIGN_RE.test(value)) {
    callSignEntryError.value = t('entities.invalidCallSign')
    return
  }
  if (form.callSigns.includes(value)) {
    callSignEntryError.value = t('entities.duplicateCallSign')
    return
  }
  form.callSigns.push(value)
  if (!form.primaryCallSign) form.primaryCallSign = value
  callSignDialogOpen.value = false
}

function setPrimaryCallSign(value) {
  form.primaryCallSign = value
}

function removeCallSign(value) {
  form.callSigns = form.callSigns.filter((callSign) => callSign !== value)
  if (form.primaryCallSign === value) form.primaryCallSign = form.callSigns[0] || ''
}

async function loadEntities() {
  const requestId = ++entitiesRequest
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({
      q: searchQuery.value, page: String(page.value), page_size: String(pageSize.value), scope: listScope.value,
    })
    const result = await props.apiFetch(`v1/orgs?${params}`)
    if (requestId !== entitiesRequest) return
    entities.value = result.items || []
    pagination.value = result.pagination || pagination.value
  } catch (cause) {
    if (requestId !== entitiesRequest) return
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    if (requestId === entitiesRequest) loading.value = false
  }
}

function prepareNewEntity() {
  unsavedChanges.clearTracking()
  editing.value = null
  creating.value = true
  Object.assign(form, {
    name: '', entityType: 'other', description: '', website: '', maxSites: 5,
    primaryCallSign: '', callSigns: [], members: [],
  })
  unsavedChanges.startTracking()
}

function newEntity() {
  editReturnRoute.value = { name: 'entities' }
  prepareNewEntity()
  router.push({ name: 'entity-create' })
}

function prepareEditEntity(entity) {
  unsavedChanges.clearTracking()
  editing.value = entity
  creating.value = false
  Object.assign(form, {
    name: entity.name || '',
    entityType: entity.entity_type === 'organization' ? 'other' : entity.entity_type || 'other',
    description: entity.description || '',
    website: entity.website || '',
    maxSites: entity.max_sites ?? 5,
    primaryCallSign: entity.primary_call_sign || '',
    callSigns: [entity.primary_call_sign, ...(entity.aka_call_signs || [])].filter(Boolean),
    members: (entity.members || []).map((member) => ({ ...member })),
  })
  unsavedChanges.startTracking()
}

function editEntity(entity, returnToDetail = false) {
  editReturnRoute.value = returnToDetail
    ? { name: 'entity-detail', params: { id: entity.id } }
    : { name: 'entities' }
  prepareEditEntity(entity)
  router.push({ name: 'entity-edit', params: { id: entity.id } })
}

function openEntity(entity) {
  router.push({ name: 'entity-detail', params: { id: entity.id } })
}

function openRelatedSite(site) {
  router.push({ name: 'site-detail', params: { id: site.id }, query: { fromEntity: entityDetail.value.id } })
}

function addSiteForEntity() {
  if (!entityDetail.value || !canAddSite.value) return
  router.push({
    name: 'site-create',
    query: { owner_entity_id: String(entityDetail.value.id), fromEntity: String(entityDetail.value.id) },
  })
}

function entityMemberCount(entity) {
  return (entity.members?.length || 0) + (entity.owner_user_id ? 1 : 0)
}

function addMember() {
  error.value = ''
  memberSelection.value = ''
  memberSearch.value = ''
  userOptions.value = []
  memberDialogOpen.value = true
}

function memberSubject(value) {
  if (typeof value === 'string') return value.trim()
  const subject = value?.subject ?? value?.raw?.subject ?? value?.value ?? value?.raw?.value
  return typeof subject === 'string' ? subject.trim() : ''
}

async function searchUsers(query) {
  const term = String(query || '').trim()
  if (term.length < 2) {
    userOptions.value = []
    return
  }
  try {
    const result = await props.apiFetch(`v1/users?q=${encodeURIComponent(term)}`)
    userOptions.value = result.items || []
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
}

function addSelectedMember() {
  const subject = memberSubject(memberSelection.value)
  if (!subject) return
  if (form.members.some((member) => memberSubject(member.user_id) === subject)) {
    error.value = t('entities.duplicateMember')
    return
  }
  const selectedUser = userOptions.value.find((user) => user.subject === subject)
  form.members.push({
    user_id: subject,
    display_name: selectedUser?.display_name || subject,
    call_signs: selectedUser?.call_signs || [],
    role: 'Viewer',
  })
  memberDialogOpen.value = false
}

function removeMember(index) {
  form.members.splice(index, 1)
}

function cancelForm() {
  creating.value = false
  editing.value = null
  unsavedChanges.clearTracking()
  if (route.name !== editReturnRoute.value.name) router.push(editReturnRoute.value)
}

async function saveEntity() {
  if (!form.name.trim()) return
  saving.value = true
  error.value = ''
  const payload = {
    name: form.name.trim(),
    entity_type: form.entityType,
    description: form.description.trim() || null,
    website: form.website.trim() || null,
    primary_call_sign: form.primaryCallSign || null,
    aka_call_signs: form.callSigns.filter((value) => value !== form.primaryCallSign),
    members: form.members.filter((member) => memberSubject(member.user_id)).map((member) => ({
      user_id: memberSubject(member.user_id),
      role: member.role,
    })),
  }
  if (props.canManageSiteLimits) payload.max_sites = Number(form.maxSites)
  try {
    const path = editing.value ? `v1/orgs/${editing.value.id}` : 'v1/orgs'
    await props.apiFetch(path, {
      method: editing.value ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    creating.value = false
    editing.value = null
    unsavedChanges.clearTracking()
    router.push(editReturnRoute.value)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    saving.value = false
  }
}

watch(() => [route.name, route.params.id], async ([name, id]) => {
  error.value = ''
  if (name === 'entities') {
    creating.value = false
    editing.value = null
    entityDetail.value = null
    unsavedChanges.clearTracking()
    await loadEntities()
    return
  }
  if (name === 'entity-detail' && id) {
    creating.value = false
    editing.value = null
    unsavedChanges.clearTracking()
    entityDetail.value = null
    relatedSites.value = []
    relatedSiteCount.value = 0
    loading.value = true
    try {
      const [entity, siteResponse] = await Promise.all([
        props.apiFetch(`v1/orgs/${id}`),
        props.apiFetch(`v1/sites?entity_id=${encodeURIComponent(id)}&page=1&page_size=50`),
      ])
      entityDetail.value = entity
      relatedSites.value = siteResponse.items || []
      relatedSiteCount.value = siteResponse.pagination?.total ?? relatedSites.value.length
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      loading.value = false
    }
    return
  }
  if (name === 'entity-create') {
    editReturnRoute.value = { name: 'entities' }
    if (!creating.value) prepareNewEntity()
    return
  }
  if (name === 'entity-edit' && id && String(editing.value?.id) !== String(id)) {
    if (editReturnRoute.value.name !== 'entity-detail' || String(editReturnRoute.value.params?.id) !== String(id)) {
      editReturnRoute.value = { name: 'entities' }
    }
    loading.value = true
    try {
      const entity = await props.apiFetch(`v1/orgs/${id}`)
      if (!entity.can_manage) throw new Error(t('common.notManageable'))
      prepareEditEntity(entity)
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      loading.value = false
    }
  }
}, { immediate: true })
</script>

<template>
  <div class="entities-view">
    <div v-if="route.name === 'entities'" class="d-flex align-center justify-space-between mb-5">
      <div class="text-body-1 text-medium-emphasis">{{ t('entities.description') }}</div>
      <v-btn color="primary" @click="newEntity">{{ t('entities.add') }}</v-btn>
    </div>
    <v-alert v-if="error" class="mb-4" type="error" variant="tonal">{{ error }}</v-alert>
    <v-btn v-if="isFormRoute && !creating && !editing && !loading" class="mb-4" variant="text" @click="router.push({ name: 'entities' })">{{ t('entities.cancel') }}</v-btn>
    <v-progress-linear v-if="isFormRoute && loading && !creating && !editing" indeterminate color="primary" class="mb-4" />
    <v-btn v-if="isDetailRoute" class="mb-4" variant="text" prepend-icon="mdi-arrow-left" @click="router.push({ name: 'entities' })">{{ t('entities.backToEntities') }}</v-btn>
    <v-progress-linear v-if="isDetailRoute && loading" indeterminate color="primary" class="mb-4" />
    <template v-if="isDetailRoute && entityDetail">
      <ItemDetailsCard
        :eyebrow="t(`entities.types.${entityDetail.entity_type}`)"
        :title="entityDetail.name"
        :fields="[
          { key: 'description', label: t('entities.descriptionField'), value: entityDetail.description, fullWidth: true },
          { key: 'website', label: t('entities.website'), value: entityDetail.website },
          { key: 'maxSites', label: t('entities.maxSites'), value: entityDetail.max_sites },
          { key: 'callSigns', label: t('entities.callSigns'), value: [entityDetail.primary_call_sign, ...(entityDetail.aka_call_signs || [])].filter(Boolean).join(', ') },
          { key: 'owner', label: t('entities.owner'), value: entityDetail.owner_display_name || (entityDetail.is_system_maintained ? t('entities.systemMaintained') : t('common.unknownUser')) },
          { key: 'members', label: t('entities.members'), value: entityDetail.members?.length ? 'assigned' : '', fullWidth: true },
        ]"
      >
        <template #actions>
          <v-btn v-if="entityDetail.can_manage" color="primary" variant="tonal" prepend-icon="mdi-pencil" @click="editEntity(entityDetail, true)">{{ t('entities.edit') }}</v-btn>
        </template>
        <template #value="{ field }">
          <a v-if="field.key === 'website' && field.value" class="text-body-2" :href="field.value" target="_blank" rel="noopener noreferrer">{{ field.value }}</a>
          <div v-else-if="field.key === 'members' && entityDetail.members?.length" class="d-flex flex-wrap ga-2">
            <v-chip v-for="member in entityDetail.members" :key="member.user_id" variant="tonal">{{ member.display_name || member.user_id }} · {{ member.role }}</v-chip>
          </div>
          <div v-else class="text-body-2" :class="{ 'text-medium-emphasis': field.value == null || field.value === '' }">{{ field.value == null || field.value === '' ? '—' : field.value }}</div>
        </template>
      </ItemDetailsCard>
      <div class="d-flex align-center justify-space-between mb-3">
        <h3 class="text-h6">{{ t('entities.relatedSites') }}</h3>
        <div class="d-flex align-center ga-3">
          <span class="text-caption text-medium-emphasis">{{ t('entities.siteCount', { count: relatedSiteCount, limit: entityDetail.max_sites ?? 5 }) }}</span>
          <v-tooltip :text="addSiteDisabledReason">
            <template #activator="{ props: tooltipProps }">
              <span v-bind="tooltipProps" class="d-inline-flex">
                <v-btn color="primary" size="small" prepend-icon="mdi-plus" :disabled="!canAddSite" @click="addSiteForEntity">{{ t('sites.add') }}</v-btn>
              </span>
            </template>
          </v-tooltip>
        </div>
      </div>
      <v-card rounded="xl" variant="outlined">
        <v-list v-if="relatedSites.length" lines="two">
          <SiteListItem v-for="site in relatedSites" :key="site.id" :site="site" :owner-name="entityDetail.name" @open="openRelatedSite(site)" />
        </v-list>
        <v-card-text v-else-if="!loading" class="text-medium-emphasis">{{ t('entities.noRelatedSites') }}</v-card-text>
      </v-card>
    </template>

    <v-card v-if="isFormRoute && (creating || editing)" class="pa-4 mb-6" rounded="xl" variant="outlined">
      <div class="text-h6 mb-4">{{ editing ? t('entities.editTitle', { name: editing.name }) : t('entities.createTitle') }}</div>
      <v-row>
        <v-col cols="12" md="6"><v-text-field v-model="form.name" :label="t('entities.name')" :rules="[nameRule]" maxlength="200" /></v-col>
        <v-col cols="12" md="6">
          <div class="d-flex align-center ga-2">
            <v-select
              v-model="form.entityType"
              class="flex-grow-1"
              :items="[
                { title: t('entities.types.club'), value: 'club' },
                { title: t('entities.types.association'), value: 'association' },
                { title: t('entities.types.society'), value: 'society' },
                { title: t('entities.types.league'), value: 'league' },
                { title: t('entities.types.union'), value: 'union' },
                { title: t('entities.types.federation'), value: 'federation' },
                { title: t('entities.types.other'), value: 'other' },
              ]"
              :label="t('entities.type')"
            />
            <v-tooltip :text="t('entities.typeHint')" location="top" max-width="320">
              <template #activator="{ props: tooltipProps }">
                <v-btn v-bind="tooltipProps" icon="mdi-information-outline" variant="text" size="small" :aria-label="t('entities.typeHelp')" />
              </template>
            </v-tooltip>
          </div>
        </v-col>
        <v-col cols="12" md="6"><v-text-field v-model="form.website" :label="t('entities.website')" maxlength="512" /></v-col>
        <v-col v-if="props.canManageSiteLimits" cols="12" md="6">
          <v-text-field v-model.number="form.maxSites" :label="t('entities.maxSites')" type="number" min="0" step="1" />
        </v-col>
        <v-col v-else cols="12" md="6">
          <v-text-field :model-value="form.maxSites" :label="t('entities.maxSites')" readonly hide-details />
        </v-col>
      </v-row>
      <v-textarea v-model="form.description" :label="t('entities.descriptionField')" maxlength="2000" rows="2" auto-grow />
      <section class="call-sign-manager mt-4" :aria-label="t('entities.callSigns')">
        <div class="d-flex align-center justify-space-between mb-3">
          <div>
            <div class="text-subtitle-1">{{ t('entities.callSigns') }}</div>
            <div class="text-caption text-medium-emphasis">{{ t('entities.callSignManagerHint') }}</div>
          </div>
          <v-btn size="small" variant="tonal" @click="openCallSignDialog">{{ t('entities.addCallSign') }}</v-btn>
        </div>
        <div v-if="form.callSigns.length" class="d-flex flex-column ga-2">
          <div v-for="callSign in orderedCallSigns" :key="callSign" class="d-flex align-center ga-2">
            <v-chip :color="callSign === form.primaryCallSign ? 'primary' : undefined" variant="tonal">
              {{ callSign }} · {{ t(callSign === form.primaryCallSign ? 'entities.primaryCallSign' : 'entities.alternateCallSign') }}
            </v-chip>
            <v-btn v-if="callSign !== form.primaryCallSign" size="small" variant="text" @click="setPrimaryCallSign(callSign)">{{ t('entities.makePrimary') }}</v-btn>
            <v-btn v-if="callSign !== form.primaryCallSign" size="small" variant="text" @click="removeCallSign(callSign)">{{ t('entities.removeCallSign') }}</v-btn>
          </div>
        </div>
        <div v-else class="text-body-2 text-medium-emphasis">{{ t('entities.noCallSigns') }}</div>
        <div v-if="!callSignsValid" class="text-caption text-error mt-2">{{ callSignsRule() }}</div>
      </section>

      <v-dialog v-model="callSignDialogOpen" max-width="440">
        <v-card rounded="xl">
          <v-card-title>{{ t('entities.addCallSignTitle') }}</v-card-title>
          <v-card-text>
            <div class="text-body-2 text-medium-emphasis mb-3">{{ t('entities.addCallSignHint') }}</div>
            <v-alert v-if="callSignEntryError" class="mb-3" type="error" variant="tonal">{{ callSignEntryError }}</v-alert>
            <v-text-field v-model="callSignEntry" :label="t('entities.callSign')" maxlength="32" autofocus @keydown.enter.prevent="addCallSign" />
            <div class="d-flex justify-end ga-2 mt-3">
              <v-btn variant="text" @click="callSignDialogOpen = false">{{ t('entities.cancel') }}</v-btn>
              <v-btn color="primary" :disabled="!callSignEntry.trim()" @click="addCallSign">{{ t('entities.addCallSign') }}</v-btn>
            </div>
          </v-card-text>
        </v-card>
      </v-dialog>

      <div class="d-flex align-center justify-space-between mt-4 mb-2">
        <div class="text-subtitle-1">{{ t('entities.members') }}</div>
        <v-btn size="small" variant="tonal" @click="addMember">{{ t('entities.addMember') }}</v-btn>
      </div>
      <div v-if="form.members.length === 0" class="text-body-2 text-medium-emphasis mb-3">{{ t('entities.noMembers') }}</div>
      <v-row v-for="(member, index) in form.members" :key="index" align="center">
        <v-col cols="12" md="7">
          <div class="entity-member-identity">
            <div class="entity-member-name">{{ member.display_name || member.user_id }}</div>
            <div v-if="member.call_signs?.length" class="text-caption text-medium-emphasis">{{ member.call_signs.join(', ') }}</div>
          </div>
        </v-col>
        <v-col cols="8" md="3"><v-select v-model="member.role" :items="memberRoles" :label="t('entities.memberRole')" hide-details /></v-col>
        <v-col cols="4" md="2"><v-btn block variant="text" @click="removeMember(index)">{{ t('entities.removeMember') }}</v-btn></v-col>
      </v-row>
      <v-dialog v-model="memberDialogOpen" max-width="520">
        <v-card rounded="xl">
          <v-card-title>{{ t('entities.addMember') }}</v-card-title>
          <v-card-text>
            <div class="text-body-2 text-medium-emphasis mb-3">{{ t('entities.userSearchHint') }}</div>
            <v-alert v-if="error" class="mb-3" type="error" variant="tonal">{{ error }}</v-alert>
            <v-autocomplete
              v-model="memberSelection"
              v-model:search="memberSearch"
              :items="userOptions"
              item-title="display_name"
              item-value="subject"
              :label="t('entities.userId')"
              :no-filter="true"
              @update:search="searchUsers"
            >
              <template #item="{ props: itemProps, internalItem }">
                <v-list-item v-bind="itemProps" :subtitle="internalItem.raw.call_signs?.join(', ') || ''" />
              </template>
            </v-autocomplete>
            <div class="d-flex justify-end ga-2 mt-3">
              <v-btn variant="text" @click="memberDialogOpen = false">{{ t('entities.cancel') }}</v-btn>
              <v-btn color="primary" :disabled="!memberSelection" @click="addSelectedMember">{{ t('entities.addMember') }}</v-btn>
            </div>
          </v-card-text>
        </v-card>
      </v-dialog>
      <div v-if="editing" class="text-caption text-medium-emphasis mt-2">{{ t('entities.owner') }}: {{ editing.owner_display_name || (editing.is_system_maintained ? t('entities.systemMaintained') : t('common.unknownUser')) }}</div>
      <div class="d-flex justify-end ga-2 mt-5">
        <v-btn variant="text" @click="cancelForm">{{ t('entities.cancel') }}</v-btn>
        <v-btn color="primary" :loading="saving" :disabled="!form.name.trim() || !callSignsValid || !Number.isInteger(Number(form.maxSites)) || Number(form.maxSites) < 0" @click="saveEntity">{{ t('entities.save') }}</v-btn>
      </div>
    </v-card>

    <template v-if="route.name === 'entities'">
    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />
    <div class="list-toolbar entities-toolbar mb-4">
      <v-text-field :model-value="search" class="list-search" :label="t('common.search')" prepend-inner-icon="mdi-magnify" density="compact" hide-details clearable @update:model-value="setSearchValue" />
      <v-select v-model="pageSize" class="page-size-filter" :label="t('common.pageSize')" density="compact" hide-details :items="[10, 25, 50]" />
      <v-btn-toggle v-if="props.isSystemSuperAdmin" v-model="listScope" mandatory color="primary" density="compact" variant="outlined">
        <v-btn value="mine">{{ t('common.myItems') }}</v-btn>
        <v-btn value="all">{{ t('common.allSystemItems') }}</v-btn>
      </v-btn-toggle>
    </div>
    <v-row v-if="!loading && visibleEntities.length">
      <v-col v-for="entity in visibleEntities" :key="entity.id" cols="12" lg="6">
        <v-card class="entity-card pa-4 h-100 entity-card-clickable" variant="outlined" role="link" tabindex="0" @click="openEntity(entity)" @keydown.enter="openEntity(entity)" @keydown.space.prevent="openEntity(entity)">
          <div class="d-flex align-start justify-space-between ga-3">
            <div class="entity-card-heading">
              <div class="entity-card-mark" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM16 3.2a3.5 3.5 0 0 1 0 6.8M17 14.5a4 4 0 0 1 4 4V20"/></svg>
              </div>
              <div>
                <div class="text-h6">{{ entity.name }}</div>
                <div class="text-caption text-medium-emphasis">{{ t(`entities.types.${entity.entity_type}`) }} · {{ t('entities.siteUsage', { count: entity.site_count ?? 0, limit: entity.max_sites ?? 5 }) }}</div>
              </div>
            </div>
          </div>
          <div v-if="entity.description" class="text-body-2 mt-3">{{ entity.description }}</div>
          <div v-if="entity.website" class="text-body-2 mt-2"><a :href="entity.website" target="_blank" rel="noopener noreferrer" @click.stop>{{ entity.website }}</a></div>
          <div v-if="entity.primary_call_sign" class="text-body-2 mt-2">{{ t('entities.primaryCallSign') }}: {{ entity.primary_call_sign }}<span v-if="entity.aka_call_signs.length"> · {{ t('entities.akaCallSigns') }}: {{ entity.aka_call_signs.join(', ') }}</span></div>
          <div class="text-caption text-medium-emphasis mt-3">{{ t('entities.memberCount', { count: entityMemberCount(entity) }) }}</div>
        </v-card>
      </v-col>
    </v-row>
    <v-pagination v-if="!loading && pagination.total > pageSize" v-model="page" :length="pageCount" class="mt-4" />
    <v-card v-if="!loading && !visibleEntities.length" rounded="xl" variant="outlined"><v-card-text class="text-medium-emphasis">{{ searchQuery ? t('common.noSearchResults') : t('entities.empty') }}</v-card-text></v-card>
    </template>
  </div>
</template>

<style scoped>
.entity-member-identity {
  display: flex;
  min-height: 56px;
  flex-direction: column;
  justify-content: center;
  padding: 8px 12px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
}

.entity-member-name {
  overflow-wrap: anywhere;
  color: rgb(var(--v-theme-on-surface));
  font-size: 0.9rem;
  font-weight: 500;
}

.entity-card-clickable { cursor: pointer; }
.entity-card-clickable:hover { border-color: rgba(var(--v-theme-primary), 0.7); }
</style>
